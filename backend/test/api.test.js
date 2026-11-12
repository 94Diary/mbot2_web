import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import WebSocket from 'ws';
import { createApp } from '../src/app.js';
import { ORIGIN, client, loggedIn, makeUser, setSettings, startTestApp } from './helpers.js';

let t;
let member;
let c;
before(async () => {
  t = await startTestApp();
  member = await makeUser(t.db, 'tele');
  c = await loggedIn(t.base, member);
});
after(() => t.close());

const store = () => t.app.store;

test('createApp needs a database', () => {
  assert.throws(() => createApp({}), /database/);
});

test('guests can watch telemetry but cannot start a sim', async () => {
  for (const path of ['health', 'team', 'paths', 'goals', 'events', 'logs']) {
    assert.equal((await client(t.base).get(`/api/v1/telemetry/${path}`)).status, 200, path);
  }
  assert.equal((await client(t.base).post('/api/v1/sim/start', { count: 2, world: 'x' })).status, 401);
  assert.equal((await client(t.base).get('/api/v1/sim/worlds')).status, 401);
  assert.equal((await client(t.base).post('/api/v1/mission/save')).status, 401);
  const health = await c.get('/api/v1/telemetry/health');
  assert.equal(health.body.backend, 'ok');
  assert.deepEqual((await c.get('/api/v1/telemetry/events')).body.items, []);
});

test('invalid event query gets a 400', async () => {
  assert.equal((await c.get('/api/v1/telemetry/events?limit=201')).status, 400);
});

test('writes from another origin are refused', async () => {
  const res = await fetch(`${t.base}/api/v1/auth/logout`, { method: 'POST', headers: { Origin: 'https://evil.example', Cookie: c.cookie() } });
  assert.equal(res.status, 403);
  const preflight = await fetch(`${t.base}/api/v1/me`, {
    method: 'OPTIONS', headers: { Origin: ORIGIN, 'Access-Control-Request-Headers': 'content-type' },
  });
  assert.equal(preflight.status, 204);
});

test('unknown API path is a JSON 404', async () => {
  const res = await c.get('/api/v1/nope');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

test('lists topics discovered by ROS and reports an unavailable bridge', async () => {
  assert.equal((await c.get('/api/v1/telemetry/topics')).status, 503);
  const topics = [{ name: '/maze_team/state', types: ['std_msgs/msg/String'] }];
  store().setTopicReader(() => topics);
  try {
    assert.deepEqual((await c.get('/api/v1/telemetry/topics')).body, { items: topics });
  } finally {
    store().setTopicReader(null);
  }
});

test('filters events by robot before applying the limit', async () => {
  for (const robot of ['mbot1', 'mbot2', 'mbot2']) {
    store().ingest('/maze_team/report', JSON.stringify({ robot, type: 'BRANCH_REQUEST' }));
  }
  const { items } = (await c.get('/api/v1/telemetry/events?robot=mbot1&limit=1')).body;
  assert.deepEqual(items.map(({ robot }) => robot), ['mbot1']);
  assert.equal((await c.get('/api/v1/telemetry/events?robot=mbot1&robot=mbot2')).status, 400);
});

test('team reports and trails become readable log entries', async () => {
  store().ingest('/maze_team/report', JSON.stringify({ robot: 'mbot2', type: 'BLOCKED' }));
  store().ingest('/mbot1/trail', JSON.stringify({ robot: 'mbot1', status: 'JUNCTION', segment_id: 4 }));
  const items = (await c.get('/api/v1/telemetry/logs')).body.items.slice(-2);
  assert.deepEqual(items.map(({ ns, level, kind }) => [ns, level, kind]), [['mbot2', 'warn', 'dead_end'], ['mbot1', 'info', 'junction']]);
});

test('reports goal discovery and the freshness of the team state', async () => {
  const goal = { robot: 'mbot3', x: -1, y: 2 };
  store().ingest('/maze_team/state', JSON.stringify({ goal }));
  const result = (await c.get('/api/v1/telemetry/goals')).body;
  assert.equal(result.found_count, 1);
  assert.equal(result.fresh, true);
  assert.deepEqual(result.items, [goal]);
});

test('path API filters robots, separates interrupted tracks and resets on a new run', async () => {
  const frame = { east: '+x', north: '+y', distance_unit: 'm' };
  const ingest = (run_id, robots) => store().ingest('/maze_team/state', JSON.stringify({ run_id, map_frame: frame, robots }));
  const point = (x, y) => ({ x, y });
  ingest('first', { mbot1: point(0, 0), mbot2: point(0, 1) });
  ingest('first', { mbot1: point(0.01, 0), mbot2: point(0, 1) });
  ingest('first', { mbot2: point(0, 2) });
  ingest('first', { mbot1: point(1, 0), mbot2: point(0, 2) });
  assert.deepEqual((await c.get('/api/v1/telemetry/paths?robot=mbot1')).body, {
    run_id: 'first', map_frame: frame, robots: { mbot1: [[0, 0], null, [1, 0]] },
  });
  assert.deepEqual((await c.get('/api/v1/telemetry/paths')).body.robots.mbot2, [[0, 1], [0, 2]]);
  ingest('second', { mbot1: point(3, 3) });
  assert.deepEqual((await c.get('/api/v1/telemetry/paths')).body.robots, { mbot1: [[3, 3]] });
});

function openSocket(cookie, origin = ORIGIN) {
  const ws = new WebSocket(`${t.base.replace('http:', 'ws:')}/ws/telemetry`, ['mbot2.telemetry.v1'], {
    headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
  });
  return new Promise((resolve) => {
    const messages = [];
    ws.on('message', (data) => messages.push(JSON.parse(data)));
    ws.once('open', () => resolve({ ws, messages, status: 101 }));
    ws.once('unexpected-response', (_req, res) => resolve({ ws, messages, status: res.statusCode }));
    ws.once('error', () => resolve({ ws, messages, status: 0 }));
  });
}

test('websocket: guests may watch; a dead session cookie is refused', async () => {
  const guest = await openSocket(null);
  assert.equal(guest.status, 101);
  guest.ws.close();
  assert.equal((await openSocket('sid=not-a-real-session-token-xxxxx')).status, 401);
  const { ws, messages, status } = await openSocket(c.cookie());
  assert.equal(status, 101);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(messages[0].type, 'hello');
  const snapshot = messages.find((m) => m.type === 'snapshot');
  assert.ok(snapshot.sim && snapshot.mission && snapshot.map && snapshot.health);
  assert.equal(snapshot.sim.state, 'idle');
  ws.close();
});

test('suspended user socket rejected and closed', async () => {
  const user = await makeUser(t.db, 'sock');
  const s = await loggedIn(t.base, user);
  const { ws, status } = await openSocket(s.cookie());
  assert.equal(status, 101);
  const closed = new Promise((resolve) => ws.once('close', (code) => resolve(code)));
  t.db.prepare("UPDATE users SET status = 'suspended' WHERE id = ?").run(user.id);
  // ทำให้รอบตรวจ session ถัดไปเกิดทันที
  const original = Date.now;
  Date.now = () => original() + 60000;
  try { t.app.broadcast(); } finally { Date.now = original; }
  assert.equal(await closed, 4401);
  assert.equal((await openSocket(s.cookie())).status, 401);
});

test('maintenance mode blocks members but not admins', async () => {
  const admin = await makeUser(t.db, 'boss', { role: 'admin' });
  const a = await loggedIn(t.base, admin);
  setSettings(t.db, { maintenance: true });
  try {
    assert.equal((await c.get('/api/v1/missions')).status, 503);
    assert.equal((await c.get('/api/v1/missions')).body.error.code, 'MAINTENANCE');
    assert.equal((await c.get('/api/v1/me')).status, 200);
    assert.equal((await client(t.base).get('/api/v1/site')).body.maintenance, true);
    assert.equal((await a.get('/api/v1/missions')).status, 200);
  } finally {
    setSettings(t.db, { maintenance: false });
  }
});
