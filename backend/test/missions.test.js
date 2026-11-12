import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { after, before, test } from 'node:test';
import { buildMap } from '../src/missions/mapModel.js';
import { MissionRecorder } from '../src/missions/recorder.js';
import { SimRunner } from '../src/sim/runner.js';
import { loggedIn, makeUser, startTestApp } from './helpers.js';

function fakeRunner() {
  const spawn = () => {
    const child = new EventEmitter();
    child.pid = 4242;
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    spawn.child = child;
    return child;
  };
  const kill = (_pid, signal) => { if (signal === 'SIGINT') setImmediate(() => spawn.child.emit('exit', 0)); };
  return new SimRunner({ wsPath: '/ws', spawn, kill });
}

const JUNCTION = {
  id: 1, x: 0, y: 0,
  branches: { 0: { status: 'OPEN', heading: 0, visited_by: ['mbot1'] }, 1: { status: 'BLOCKED', heading: Math.PI / 2, visited_by: ['mbot2'] } },
};

test('map model: junctions, dead ends from BLOCKED branches, goal and robots', () => {
  const map = buildMap({ junctions: [JUNCTION], goal: { x: 2, y: 2, robot: 'mbot1' }, robots: { mbot1: { x: 1, y: 1, heading: 0, state: 'SEARCH' } } },
    { robots: { mbot1: [[0, 0], [1, 1]] } });
  assert.equal(map.junctions.length, 1);
  assert.equal(map.dead_ends.length, 1);
  assert.equal(map.dead_ends[0].by, 'mbot2');
  assert.ok(Math.abs(map.dead_ends[0].at[1] - 0.18) < 1e-9);
  assert.deepEqual(map.goal, { at: [2, 2], by: 'mbot1' });
  assert.deepEqual(map.paths.mbot1, [[0, 0], [1, 1]]);
});

test('map model separates node kinds: START/GOAL/CORNER are not junctions; DEAD_END nodes are dead ends', () => {
  const node = (id, kind, x, y, branches = {}) => ({ id, kind, x, y, branches });
  const map = buildMap({
    junctions: [
      node(1, 'START', -3.5, 3), node(2, 'JUNCTION', -2.6, 3), node(3, 'CORNER', -2.6, 2.6),
      node(4, 'DEAD_END', -2.2, 2.6), node(5, 'GOAL', 3.4, -3), node(6, undefined, 0, 0),
      node(7, 'JUNCTION', 1, 1, { 0: { status: 'BLOCKED', heading: 0, visited_by: ['mbot2'] } }),
    ],
  }, null);
  assert.deepEqual(map.junctions.map((j) => j.id), [2, 6, 7]);
  assert.deepEqual(map.start, [-3.5, 3]);
  assert.deepEqual(map.goal, { at: [3.4, -3], by: null });
  assert.deepEqual(map.dead_ends.map((d) => d.at[0]), [-2.2, 1.18]);
  assert.deepEqual(map.corners, [[-2.6, 2.6]]);
  const stubs = buildMap({ junctions: [node(9, 'JUNCTION', 0, 0, { 0: { status: 'OPEN', heading: 0 }, 1: { status: 'OPEN', heading: 1.57, visited_by: ['mbot1'] } })] }, null).open_stubs;
  assert.equal(stubs.length, 1);
  assert.ok(Math.abs(stubs[0][1][0] - 0.22) < 1e-9);
  const twice = buildMap({ junctions: [node(1, 'JUNCTION', 0, 0, { 0: { status: 'BLOCKED', heading: 0 } }), node(2, 'DEAD_END', 0.2, 0)] }, null);
  assert.equal(twice.dead_ends.length, 1);
});

test('recorder tolerates malformed state', () => {
  const rec = new MissionRecorder();
  rec.begin({ world: 'w', robotCount: 2 });
  for (const bad of [null, {}, { robots: undefined, junctions: 'x' }, { robots: { mbot1: { x: NaN, y: 1 } } }, { junctions: [null, { x: 'a' }] }]) {
    rec.observe(bad, null);
  }
  rec.end();
  const summary = rec.summary();
  assert.equal(summary.junction_count, 0);
  assert.equal(summary.result, 'stop');
});

test('result is ok when every robot reaches the goal, part when some do, stop when none', () => {
  let clock = 0;
  const run = (states) => {
    const rec = new MissionRecorder({ now: () => clock });
    rec.begin({ world: 'w', robotCount: 2 });
    clock += 1000;
    rec.observe({ robots: Object.fromEntries(states.map((s, i) => [`mbot${i + 1}`, { x: 0, y: 0, state: s }])) }, null);
    clock += 1000;
    rec.end();
    return rec.summary();
  };
  assert.equal(run(['GOAL_REACHED', 'GOAL_REACHED']).result, 'ok');
  assert.equal(run(['GOAL_REACHED', 'SEARCH']).result, 'part');
  const none = run(['SEARCH', 'SEARCH']);
  assert.equal(none.result, 'stop');
  assert.equal(none.duration_s, 2);
});

let t;
let ann;
let bob;
let admin;
before(async () => {
  t = await startTestApp({ runner: fakeRunner(), listWorlds: () => ['mbot2_seed7_maze', 'Map1'], envInfo: () => ({ code_commit: 'abc1234' }) });
  ann = await makeUser(t.db, 'ann');
  bob = await makeUser(t.db, 'bob');
  admin = await makeUser(t.db, 'adm', { role: 'admin' });
});
after(() => t.close());

async function runMission(c, { goal = true } = {}) {
  const start = await c.post('/api/v1/sim/start', { count: 2, world: 'Map1', build: false, headless: true });
  assert.equal(start.status, 202, JSON.stringify(start.body));
  const state = (robots) => t.app.store.ingest('/maze_team/state', JSON.stringify({ junctions: [JUNCTION], robots }));
  state({ mbot1: { x: 0, y: 0, state: 'SEARCH' }, mbot2: { x: 0, y: 0.5, state: 'SEARCH' } });
  t.app.store.ingest('/mbot1/trail', JSON.stringify({ robot: 'mbot1', status: 'JUNCTION', segment_id: 1 }));
  if (goal) state({ mbot1: { x: 1, y: 0, state: 'GOAL_REACHED' }, mbot2: { x: 0, y: 1, state: 'SEARCH' } });
  assert.equal((await c.get('/api/v1/mission/current')).body.phase, 'recording');
  assert.equal((await c.post('/api/v1/sim/stop?wait=1')).status, 202);
  assert.equal((await c.get('/api/v1/mission/current')).body.phase, 'ended');
}

test('run → stop → save → shows in history with map, log and env', async () => {
  const c = await loggedIn(t.base, ann);
  await runMission(c);
  const saved = await c.post('/api/v1/mission/save', { map_name: 'ทางลัดแรก' });
  assert.equal(saved.status, 201);
  const list = (await c.get('/api/v1/missions')).body;
  assert.equal(list.total, 1);
  assert.equal(list.items[0].result, 'part');
  assert.equal(list.items[0].map_name, 'ทางลัดแรก');
  assert.ok(list.items[0].log_count >= 2);
  assert.equal(list.items[0].key_event.ns, 'mbot1');
  assert.ok(Array.isArray(list.items[0].thumb.mbot1));
  assert.deepEqual(list.worlds, ['Map1']);
  const detail = (await c.get(`/api/v1/missions/${saved.body.id}`)).body;
  assert.equal(detail.junction_count, 1);
  assert.equal(detail.dead_end_count, 1);
  assert.equal(detail.env.code_commit, 'abc1234');
  assert.ok(detail.log.some((l) => l.kind === 'goal'));
  assert.ok(detail.log.some((l) => l.kind === 'junction'));
  assert.equal(detail.robots.find((r) => r.robot_ns === 'mbot1').color, '#FF6B1A');
  assert.equal((await c.get('/api/v1/mission/current')).body.phase, 'idle');
});

test('another member cannot open, rename or save someone else’s mission; admin can view', async () => {
  const a = await loggedIn(t.base, ann);
  const b = await loggedIn(t.base, bob);
  const id = (await a.get('/api/v1/missions')).body.items[0].id;
  assert.equal((await b.get(`/api/v1/missions/${id}`)).status, 403);
  assert.equal((await b.patch(`/api/v1/missions/${id}`, { map_name: 'x' })).status, 403);
  assert.equal((await b.del(`/api/v1/missions/${id}`)).status, 403);
  assert.equal((await b.get('/api/v1/missions')).body.total, 0);
  const ad = await loggedIn(t.base, admin);
  assert.equal((await ad.get(`/api/v1/missions/${id}`)).status, 200);

  await runMission(a, { goal: false });
  assert.equal((await b.post('/api/v1/mission/save')).status, 403);
  assert.equal((await a.post('/api/v1/mission/discard')).status, 204);
});

test('history filters and validates paging', async () => {
  const a = await loggedIn(t.base, ann);
  assert.equal((await a.get('/api/v1/missions?page_size=15')).status, 400);
  assert.equal((await a.get('/api/v1/missions?result=nope')).status, 400);
  assert.equal((await a.get('/api/v1/missions?result=ok')).body.total, 0);
  assert.equal((await a.get('/api/v1/missions?result=part')).body.total, 1);
  assert.equal((await a.get('/api/v1/missions?q=ทางลัด')).body.total, 1);
  assert.equal((await a.get('/api/v1/missions?world=mbot2_seed7_maze')).body.total, 0);
});

test('save before the mission ends is refused; a second start while running is BUSY', async () => {
  const a = await loggedIn(t.base, ann);
  assert.equal((await a.post('/api/v1/mission/save')).body.error.code, 'NOT_ENDED');
  await a.post('/api/v1/sim/start', { count: 2, world: 'Map1', build: false, headless: true });
  const again = await a.post('/api/v1/sim/start', { count: 2, world: 'Map1', build: false, headless: true });
  assert.equal(again.status, 409);
  assert.equal(again.body.error.code, 'BUSY');
  assert.equal((await a.post('/api/v1/sim/start', { count: 2, world: '../etc' })).status, 400);
  await a.post('/api/v1/sim/stop?wait=1');
});

test('robot prefs validate name and colour', async () => {
  const a = await loggedIn(t.base, ann);
  assert.equal((await a.put('/api/v1/me/robot-prefs', { mbot1: { display_name: 'ส้ม', color: '#ff6b1a' } })).status, 200);
  assert.deepEqual((await a.get('/api/v1/me/robot-prefs')).body, { mbot1: { display_name: 'ส้ม', color: '#FF6B1A' } });
  assert.equal((await a.put('/api/v1/me/robot-prefs', { mbot1: { display_name: 'x', color: 'red' } })).status, 400);
  assert.equal((await a.put('/api/v1/me/robot-prefs', { '../x': { display_name: 'x', color: '#000000' } })).status, 400);
});
