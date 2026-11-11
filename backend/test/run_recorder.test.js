import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { RunRecorder } from '../src/run_recorder.js';

test('each coordinator run gets a separate durable file', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mbot2-runs-'));
  let clock = new Date('2026-10-19T07:00:01.000Z');
  const recorder = new RunRecorder({ directory, now: () => clock });
  try {
    assert.equal(recorder.record({ type: 'TOO_EARLY' }), false);
    assert.equal(recorder.startSession({
      run_id: 'run_a', run_started_at: '2026-10-19T07:00:00.000Z',
    }), true);
    assert.equal(recorder.record({ robot: 'mbot1', type: 'GOAL_FOUND', detail: 'พบเป้าหมาย' }), true);
    assert.equal(recorder.startSession({
      run_id: 'run_a', run_started_at: '2026-10-19T07:00:00.000Z',
    }), false);
    clock = new Date('2026-10-19T07:10:01.000Z');
    assert.equal(recorder.startSession({
      run_id: 'run_b', run_started_at: '2026-10-19T07:10:00.000Z',
    }), true);
    assert.equal(recorder.record({ robot: 'mbot2', type: 'BRANCH_BLOCKED' }), true);
    await recorder.flush();

    const files = (await readdir(directory)).sort();
    assert.equal(files.length, 2);
    const first = (await readFile(path.join(directory, files[0]), 'utf8')).trim().split('\n').map(JSON.parse);
    const second = (await readFile(path.join(directory, files[1]), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.deepEqual(first.map((item) => item.type), ['RUN_STARTED', 'GOAL_FOUND']);
    assert.deepEqual(second.map((item) => item.type), ['RUN_STARTED', 'BRANCH_BLOCKED']);
    assert.equal(first[1].elapsed_seconds, 1);
    assert.equal(first[1].elapsed_hms, '00:00:01');
    assert.equal(first[1].local_time, '2026-10-19 14:00:01');
    assert.equal(first[1].robot, 'mbot1');
    assert.equal(second[1].robot, 'mbot2');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('stale sessions reject events and repeated decisions are deduplicated', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mbot2-runs-'));
  let clock = new Date('2026-10-19T07:00:00.000Z');
  const recorder = new RunRecorder({ directory, now: () => clock });
  try {
    recorder.startSession({ run_id: 'run_a', run_started_at: clock.toISOString() });
    assert.equal(recorder.record({ type: 'BRANCH_DECISION', dedupeKey: 'decision:mbot1:1' }), true);
    assert.equal(recorder.record({ type: 'BRANCH_DECISION', dedupeKey: 'decision:mbot1:1' }), false);
    clock = new Date('2026-10-19T07:00:04.000Z');
    assert.equal(recorder.record({ type: 'OLD_RUN_EVENT' }), false);
    await recorder.flush();
    const entries = (await readFile(recorder.currentFile, 'utf8')).trim().split('\n').map(JSON.parse);
    assert.deepEqual(entries.map((item) => item.type), ['RUN_STARTED', 'BRANCH_DECISION']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('backend restart resumes the same run file', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mbot2-runs-'));
  const now = () => new Date('2026-10-19T07:00:02.000Z');
  const metadata = { run_id: 'run_a', run_started_at: '2026-10-19T07:00:00.000Z' };
  try {
    const first = new RunRecorder({ directory, now });
    first.startSession(metadata);
    first.record({ type: 'FIRST' });
    await first.flush();

    const restarted = new RunRecorder({ directory, now });
    restarted.startSession(metadata);
    restarted.record({ type: 'SECOND' });
    await restarted.flush();

    assert.equal(first.currentFile, restarted.currentFile);
    const files = await readdir(directory);
    assert.equal(files.length, 1);
    const entries = (await readFile(first.currentFile, 'utf8')).trim().split('\n').map(JSON.parse);
    assert.deepEqual(entries.map((item) => item.type), [
      'RUN_STARTED', 'FIRST', 'BACKEND_RECONNECTED', 'SECOND',
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
