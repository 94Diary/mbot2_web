import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import WebSocket from 'ws';

const token = 'a'.repeat(64);
const app = createApp(undefined, undefined, token);
const headers = { Authorization: `Bearer ${token}` };
let baseUrl;
before(async () => {
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${app.server.address().port}`;
});
after(() => app.close());

test('HTTP endpoints keep the frontend contract', async () => {
  const health = await fetch(`${baseUrl}/api/health`, { headers }).then((response) => response.json());
  const team = await fetch(`${baseUrl}/api/team`, { headers }).then((response) => response.json());
  const events = await fetch(`${baseUrl}/api/events`, { headers }).then((response) => response.json());
  assert.equal(health.backend, 'ok');
  assert.deepEqual(team.data.robots, {});
  assert.deepEqual(events.items, []);
});

test('invalid event query gets a 400', async () => {
  assert.equal((await fetch(`${baseUrl}/api/events?limit=201`, { headers })).status, 400);
});

test('telemetry rejects absent and wrong HTTP tokens', async () => {
  assert.equal((await fetch(`${baseUrl}/api/team`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/events`, {
    headers: { Authorization: `Bearer ${'b'.repeat(64)}` },
  })).status, 401);
});

test('browser authorization preflight allows only configured origins', async () => {
  const request = (origin) => fetch(`${baseUrl}/api/team`, {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Headers': 'authorization' },
  });
  const allowed = await request('http://localhost:5173');
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-headers'), 'Authorization');
  assert.equal((await request('http://localhost:5174')).status, 403);
});

test('server cannot start without a configured token', () => {
  assert.throws(() => createApp(), /MBOT2_API_TOKEN/);
});

test('websocket authenticates before upgrade and never echoes the token', async () => {
  const url = baseUrl.replace('http:', 'ws:') + '/ws/telemetry';
  const unauthorized = new WebSocket(url);
  await new Promise((resolve, reject) => {
    unauthorized.once('error', reject);
    unauthorized.once('open', () => {
      unauthorized.close();
      reject(new Error('anonymous socket accepted'));
    });
    unauthorized.once('unexpected-response', (_request, response) => {
      response.resume();
      if (response.statusCode === 401) resolve();
      else reject(new Error(`unexpected status ${response.statusCode}`));
    });
  });
  const client = new WebSocket(url, ['mbot2.telemetry.v1', `mbot2.token.${token}`]);
  try {
    await new Promise((resolve, reject) => {
      client.once('open', resolve);
      client.once('error', reject);
    });
    assert.equal(client.protocol, 'mbot2.telemetry.v1');
  } finally {
    client.close();
  }
});

test('lists topics discovered by ROS and reports an unavailable bridge', async () => {
  assert.equal((await fetch(`${baseUrl}/api/topics`, { headers })).status, 503);
  const topics = [{ name: '/maze_team/state', types: ['std_msgs/msg/String'] }];
  app.store.setTopicReader(() => topics);
  try {
    const response = await fetch(`${baseUrl}/api/topics`, { headers });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { items: topics });
  } finally {
    app.store.setTopicReader(null);
  }
});

test('filters events by robot before applying the limit', async () => {
  for (const robot of ['mbot1', 'mbot2', 'mbot2']) {
    app.store.ingest('/maze_team/report', JSON.stringify({ robot, type: 'BRANCH_REQUEST' }));
  }
  const response = await fetch(`${baseUrl}/api/events?robot=mbot1&limit=1`, { headers });
  assert.equal(response.status, 200);
  const { items } = await response.json();
  assert.deepEqual(items.map(({ robot }) => robot), ['mbot1']);
  assert.equal((await fetch(`${baseUrl}/api/events?robot=mbot1&robot=mbot2`, { headers })).status, 400);
});

test('reports goal discovery and the freshness of the team state', async () => {
  const url = `${baseUrl}/api/goals`;
  const initial = await fetch(url, { headers }).then((response) => response.json());
  assert.equal(initial.found_count, 0);
  assert.equal(initial.fresh, false);
  const goal = { robot: 'mbot3', x: -1, y: 2 };
  app.store.ingest('/maze_team/state', JSON.stringify({ goal }));
  const result = await fetch(url, { headers }).then((response) => response.json());
  assert.equal(result.found, true);
  assert.equal(result.found_count, 1);
  assert.equal(result.fresh, true);
  assert.deepEqual(result.items, [goal]);
});

test('path API filters robots, separates interrupted tracks and resets on a new run', async () => {
  const frame = { east: '+x', north: '+y', distance_unit: 'm' };
  const ingest = (run_id, robots) =>
    app.store.ingest('/maze_team/state', JSON.stringify({ run_id, map_frame: frame, robots }));
  const point = (x, y) => ({ x, y });
  const read = async (query = '') => {
    const response = await fetch(baseUrl + '/api/paths' + query, { headers });
    assert.equal(response.status, 200);
    return response.json();
  };

  ingest('first', { mbot1: point(0, 0), mbot2: point(0, 1) });
  ingest('first', { mbot1: point(0.01, 0), mbot2: point(0, 1) });
  ingest('first', { mbot2: point(0, 2) });
  ingest('first', { mbot1: point(1, 0), mbot2: point(0, 2) });
  assert.deepEqual(await read('?robot=mbot1'), {
    run_id: 'first', map_frame: frame, robots: { mbot1: [[0, 0], null, [1, 0]] },
  });
  assert.deepEqual((await read()).robots.mbot2, [[0, 1], [0, 2]]);
  assert.equal((await fetch(baseUrl + '/api/paths')).status, 401);
  ingest('second', { mbot1: point(3, 3) });
  assert.deepEqual((await read()).robots, { mbot1: [[3, 3]] });
});
