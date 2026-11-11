import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TelemetryStore } from '../src/store.js';

test('team snapshot and freshness', () => {
  const store = new TelemetryStore();
  assert.equal(store.team().received_at, null);
  store.ingest('/maze_team/state', JSON.stringify({ robots: { mbot1: { x: 1 } }, junctions: [], goal: null }));
  assert.equal(store.team().data.robots.mbot1.x, 1);
  assert.equal(store.health().team_state_fresh, true);
});

test('events keep increasing IDs and filter by after_id', () => {
  const store = new TelemetryStore();
  store.ingest('/maze_team/report', '{"robot":"mbot1","type":"JUNCTION"}');
  store.ingest('/mbot1/trail', '{"robot":"mbot1","type":"TRAIL"}');
  assert.deepEqual(store.events(20, 1).map((event) => event.id), [2]);
});

test('bad JSON is kept as a parse-error event, not a team state', () => {
  const store = new TelemetryStore();
  store.ingest('/maze_team/state', 'oops');
  assert.equal(store.team().received_at, null);
  assert.equal(store.events()[0].data.parse_error, true);
});
