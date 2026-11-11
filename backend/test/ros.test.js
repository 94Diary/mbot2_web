import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatRobotLog, formatTelemetryLog } from '../src/modules/telemetry/ros.js';

test('logs team decisions and important trail events', () => {
  assert.equal(
    formatTelemetryLog('/maze_team/decision', JSON.stringify({ robot: 'mbot2', junction_id: 1, choice: 'left', shared: false })),
    '[TEAM] mbot2 at J1: left (shared=false)',
  );
  assert.equal(
    formatTelemetryLog('/mbot2/trail', JSON.stringify({ robot: 'mbot2', status: 'JUNCTION', segment_id: 2 })),
    '[TRAIL] mbot2: JUNCTION (segment 2)',
  );
});

test('suppresses high-frequency pose, state and progress updates', () => {
  assert.equal(formatTelemetryLog('/maze_team/report', '{"type":"POSE"}'), null);
  assert.equal(formatTelemetryLog('/maze_team/state', '{"robots":{}}'), null);
  assert.equal(formatTelemetryLog('/mbot1/trail', '{"status":"IN_PROGRESS"}'), null);
});

test('forwards real maze solver logs and ignores unrelated ROS logs', () => {
  const robots = ['mbot1', 'mbot2', 'mbot3'];
  assert.equal(
    formatRobotLog({ name: 'mbot2.maze_solver', level: 20, msg: 'SEARCH -> FOLLOW' }, robots),
    'INFO mbot2: SEARCH -> FOLLOW',
  );
  assert.equal(
    formatRobotLog({ name: 'mbot1.maze_solver', level: 30, msg: 'เจอกำแพง: ถอยสั้น' }, robots),
    'WARN mbot1: เจอกำแพง: ถอยสั้น',
  );
  assert.equal(formatRobotLog({ name: 'other_node', level: 20, msg: 'noise' }, robots), null);
  assert.equal(formatRobotLog({ name: 'mbot1.maze_solver', level: 10, msg: 'debug' }, robots), null);
});
