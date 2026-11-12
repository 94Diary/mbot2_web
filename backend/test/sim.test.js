import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { launchArgv, parseBuildError, validateStart } from '../src/sim/commands.js';
import { SimRunner } from '../src/sim/runner.js';

const WORLDS = ['mbot2_seed7_maze', 'Map1', 'Map2'];

function fakeSpawner() {
  const calls = [];
  let nextPid = 1000;
  const spawn = (cmd, args, opts) => {
    const child = new EventEmitter();
    child.pid = nextPid++;
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    calls.push({ cmd, args, opts, child, argv: args.slice(3) });
    return child;
  };
  const kills = [];
  const kill = (pid, signal) => { kills.push([pid, signal]); };
  return { spawn, kill, calls, kills };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

test('launch argv is fixed and only carries validated values', () => {
  assert.deepEqual(launchArgv({ count: 2, world: 'Map2', headless: true }),
    ['ros2', 'launch', 'mbot2_description', 'two_mbot2.launch.py', 'robot_count:=2', 'headless:=true', 'world:=Map2']);
});

test('validateStart rejects anything outside the table', () => {
  assert.deepEqual(validateStart({ count: 3, world: 'Map1', build: true }, WORLDS),
    { count: 3, world: 'Map1', build: true, headless: false });
  for (const body of [{ count: 4, world: 'Map1' }, { count: 2, world: '../x' }, { count: 2, world: 'nope' },
    { count: 2, world: 'Map1', headless: 'yes' }, null]) {
    assert.throws(() => validateStart(body, WORLDS), (error) => error.status === 400);
  }
});

test('build error points at file and line', () => {
  assert.deepEqual(parseBuildError(['x', '  File "/ws/src/pkg/junction_manager.py", line 142', 'IndentationError: bad']),
    { file: 'junction_manager.py', line: 142, message: 'IndentationError: bad' });
});

test('runs through bash with argv as separate arguments, in its own process group', async () => {
  const fake = fakeSpawner();
  const runner = new SimRunner({ wsPath: '/ws', spawn: fake.spawn, kill: fake.kill });
  runner.start({ count: 2, world: 'Map2', build: false, headless: true });
  const call = fake.calls[0];
  assert.equal(call.cmd, 'bash');
  assert.equal(call.args[0], '-c');
  assert.doesNotMatch(call.args[1], /Map2/);
  assert.deepEqual(call.argv, launchArgv({ count: 2, world: 'Map2', headless: true }));
  assert.equal(call.opts.detached, true);
  assert.equal(runner.state().state, 'launching');
  assert.equal(runner.state().steps.build, 'skip');
});

test('build first, launch after a clean exit', async () => {
  const fake = fakeSpawner();
  const runner = new SimRunner({ wsPath: '/ws', spawn: fake.spawn, kill: fake.kill });
  runner.start({ count: 2, world: 'Map1', build: true, headless: false });
  assert.equal(fake.calls[0].argv[0], 'colcon');
  assert.equal(runner.state().state, 'building');
  fake.calls[0].child.emit('exit', 0);
  assert.equal(fake.calls[1].argv[0], 'ros2');
  assert.equal(runner.state().steps.build, 'done');
});

test('failed build reports BUILD_FAILED with file and line and returns to idle', async () => {
  const fake = fakeSpawner();
  const runner = new SimRunner({ wsPath: '/ws', spawn: fake.spawn, kill: fake.kill });
  runner.start({ count: 2, world: 'Map1', build: true, headless: false });
  fake.calls[0].child.stdout.write('  File "x.py", line 12\nSyntaxError: oops\n');
  await tick();
  fake.calls[0].child.emit('exit', 1);
  const state = runner.state();
  assert.equal(state.state, 'idle');
  assert.deepEqual(state.error, { code: 'BUILD_FAILED', message: 'SyntaxError: oops', file: 'x.py', line: 12 });
  assert.equal(fake.calls.length, 1);
});

test('start twice → BUSY', () => {
  const fake = fakeSpawner();
  const runner = new SimRunner({ wsPath: '/ws', spawn: fake.spawn, kill: fake.kill });
  runner.start({ count: 2, world: 'Map1', build: false, headless: true });
  assert.throws(() => runner.start({ count: 2, world: 'Map1', build: false, headless: true }),
    (error) => error.status === 409 && error.code === 'BUSY');
});

test('link → running emits running; stop signals the group and escalates', async () => {
  const fake = fakeSpawner();
  const runner = new SimRunner({ wsPath: '/ws', spawn: fake.spawn, kill: fake.kill, stopAfterMs: { int: 10, term: 10 } });
  const events = [];
  runner.on('running', () => events.push('running'));
  runner.on('ended', (e) => events.push(`ended:${e.reason}`));
  runner.start({ count: 2, world: 'Map1', build: false, headless: true });
  runner.markLinked();
  assert.equal(runner.state().state, 'running');
  const pid = fake.calls[0].child.pid;
  const stopped = runner.stop();
  assert.equal(runner.state().state, 'stopping');
  assert.deepEqual(fake.kills[0], [-pid, 'SIGINT']);
  await new Promise((r) => setTimeout(r, 35));
  assert.deepEqual(fake.kills.map((k) => k[1]), ['SIGINT', 'SIGTERM', 'SIGKILL']);
  fake.calls[0].child.emit('exit', null, 'SIGKILL');
  await stopped;
  assert.equal(runner.state().state, 'idle');
  assert.deepEqual(events, ['running', 'ended:stopped']);
});

test('shutdown stops running sim', async () => {
  const fake = fakeSpawner();
  const runner = new SimRunner({ wsPath: '/ws', spawn: fake.spawn, kill: fake.kill, stopAfterMs: { int: 10, term: 10 } });
  runner.start({ count: 2, world: 'Map1', build: false, headless: true });
  const done = runner.shutdown();
  fake.calls[0].child.emit('exit', 0);
  await done;
  assert.equal(fake.kills[0][1], 'SIGINT');
  assert.equal(runner.state().state, 'idle');
});

test('launch exiting on its own is an error, not a silent idle', () => {
  const fake = fakeSpawner();
  const runner = new SimRunner({ wsPath: '/ws', spawn: fake.spawn, kill: fake.kill });
  runner.start({ count: 2, world: 'Map1', build: false, headless: true });
  fake.calls[0].child.emit('exit', 1);
  assert.equal(runner.state().error.code, 'LAUNCH_EXITED');
});

test('bridge log line advances the progress steps', async () => {
  const fake = fakeSpawner();
  const runner = new SimRunner({ wsPath: '/ws', spawn: fake.spawn, kill: fake.kill });
  runner.start({ count: 2, world: 'Map1', build: false, headless: true });
  fake.calls[0].child.stdout.write('[parameter_bridge-5] [INFO] [x]: Creating GZ->ROS Bridge: [/clock]\n');
  await tick();
  assert.deepEqual(runner.state().steps, { build: 'skip', gazebo: 'done', bridge: 'done', link: 'run' });
});

test('world list = installed files that still exist in source (no stale build leftovers)', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { listWorlds } = await import('../src/sim/worlds.js');
  const ws = mkdtempSync(join(tmpdir(), 'ws-'));
  const inst = join(ws, 'install/mbot2_description/share/mbot2_description/worlds');
  const src = join(ws, 'src/mbot2_description/worlds');
  mkdirSync(inst, { recursive: true });
  mkdirSync(src, { recursive: true });
  const files = ['Map10.sdf', 'Map2.sdf', 'Map1_Walled.sdf', 'Map1.sdf', 'mbot2_seed7_maze.sdf'];
  for (const f of [...files, 'old_stale.sdf', 'bad name.sdf', 'notes.txt']) writeFileSync(join(inst, f), '');
  for (const f of [...files, 'NotBuiltYet.sdf']) writeFileSync(join(src, f), '');
  assert.deepEqual(listWorlds(ws), ['Map1', 'Map1_Walled', 'Map2', 'Map10', 'mbot2_seed7_maze']);
  assert.deepEqual(listWorlds(join(ws, 'missing')), []);
});

test('build-only runs colcon, returns to idle with build done, and blocks a second job', () => {
  const fake = fakeSpawner();
  const runner = new SimRunner({ wsPath: '/ws', spawn: fake.spawn, kill: fake.kill });
  runner.build();
  assert.equal(fake.calls[0].argv[0], 'colcon');
  assert.equal(runner.state().state, 'building');
  assert.throws(() => runner.build(), (e) => e.code === 'BUSY');
  fake.calls[0].child.emit('exit', 0);
  assert.equal(runner.state().state, 'idle');
  assert.equal(runner.state().steps.build, 'done');
  assert.ok(runner.state().last_build_at);
  assert.equal(fake.calls.length, 1, 'no launch after build-only');
});
