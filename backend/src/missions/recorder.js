import { GOAL_STATES, buildMap, pathLength } from './mapModel.js';

const MAX_LOG = 5000;
export const DEFAULT_ROBOT_COLORS = { mbot1: '#FF6B1A', mbot2: '#1B9BD1', mbot3: '#B6E33C' };

/**
 * Collects one mission while the sim runs: latest map, log, and when each robot reached the goal.
 * Lifecycle: idle → recording → ended → (save | discard) → idle.
 */
export class MissionRecorder {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.discard();
  }

  discard() {
    this.phase = 'idle';
    this.meta = null;
    this.map = null;
    this.log = [];
    this.goalAt = {};
    this.startedMs = null;
    this.endedMs = null;
    this.endReason = null;
  }

  /** meta: { world, robotCount, headless, startedBy, env } */
  begin(meta) {
    this.discard();
    this.phase = 'recording';
    this.meta = { ...meta };
    this.startedMs = this.now();
  }

  observe(team, paths) {
    if (this.phase !== 'recording') return;
    this.map = buildMap(team, paths);
    for (const [name, pose] of Object.entries(this.map.robots)) {
      if (GOAL_STATES.has(pose.state) && !this.goalAt[name]) {
        this.goalAt[name] = new Date(this.now()).toISOString();
        this.addLog({ ns: name, level: 'ok', kind: 'goal', msg: `${name} ถึงเป้าหมาย` });
      }
    }
  }

  /** entry: { ns, level: info|ok|warn|err, kind, msg } */
  addLog(entry) {
    if (this.phase !== 'recording') return;
    this.log.push({ t: Math.round((this.now() - this.startedMs) / 100) / 10, ...entry });
    if (this.log.length > MAX_LOG) this.log.splice(0, this.log.length - MAX_LOG);
  }

  end(reason = 'stopped') {
    if (this.phase !== 'recording') return;
    this.phase = 'ended';
    this.endedMs = this.now();
    this.endReason = reason;
  }

  result() {
    const reached = Object.keys(this.goalAt).length;
    if (reached > 0 && reached >= (this.meta?.robotCount ?? Infinity)) return 'ok';
    return reached > 0 ? 'part' : 'stop';
  }

  status() {
    return {
      phase: this.phase,
      world: this.meta?.world ?? null,
      robot_count: this.meta?.robotCount ?? 0,
      started_at: this.startedMs ? new Date(this.startedMs).toISOString() : null,
      ended_at: this.endedMs ? new Date(this.endedMs).toISOString() : null,
      started_by: this.meta?.startedBy ?? null,
      result: this.phase === 'idle' ? null : this.result(),
      goal_at: { ...this.goalAt },
    };
  }

  /** Everything needed to store the mission; only valid once ended. */
  summary() {
    const map = this.map ?? buildMap(null, null);
    const names = new Set([
      ...Object.keys(map.paths), ...Object.keys(map.robots),
      ...Array.from({ length: this.meta.robotCount }, (_, i) => `mbot${i + 1}`),
    ]);
    return {
      source: 'sim',
      world: this.meta.world,
      robot_count: this.meta.robotCount,
      result: this.result(),
      started_at: new Date(this.startedMs).toISOString(),
      ended_at: new Date(this.endedMs ?? this.now()).toISOString(),
      duration_s: Math.round(((this.endedMs ?? this.now()) - this.startedMs) / 1000),
      junction_count: map.junctions.length,
      dead_end_count: map.dead_ends.length,
      env: { ...(this.meta.env ?? {}), headless: this.meta.headless ?? null, end_reason: this.endReason },
      map,
      log: this.log,
      robots: [...names].sort().map((ns) => ({
        robot_ns: ns,
        reached_goal_at: this.goalAt[ns] ?? null,
        distance_m: Math.round(pathLength(map.paths[ns]) * 100) / 100,
      })),
    };
  }
}
