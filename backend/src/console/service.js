import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { buildMap } from '../missions/mapModel.js';

/** Reads the robot code version so every mission records which commit it ran. */
export function gitInfo(wsPath) {
  const git = (...args) => {
    try {
      return execFileSync('git', ['-C', join(wsPath, 'src'), ...args], { encoding: 'utf8', timeout: 2000 }).trim();
    } catch {
      return null;
    }
  };
  return { code_commit: git('rev-parse', '--short', 'HEAD'), code_branch: git('rev-parse', '--abbrev-ref', 'HEAD') };
}

/**
 * Wires the sim runner, live telemetry and mission recorder together:
 * start → clear old run → launch → first team state = linked/running → record → stop = mission ended.
 */
export class ConsoleService {
  constructor({ store, runner, recorder, envInfo = () => ({}) }) {
    this.store = store;
    this.runner = runner;
    this.recorder = recorder;
    this.envInfo = envInfo;

    store.on('team', (team) => {
      runner.markLinked();
      this.recorder.observe(team, store.paths.read());
    });
    store.on('log', (entry) => this.recorder.addLog({ ns: entry.ns, level: entry.level, kind: entry.kind, msg: entry.msg }));
    runner.on('running', () => {
      const opts = runner.options;
      this.recorder.begin({
        world: opts.world, robotCount: opts.count, headless: opts.headless, startedBy: opts.startedBy, env: this.envInfo(),
      });
      this.recorder.observe(store.teamData, store.paths.read());
    });
    runner.on('ended', ({ reason }) => this.recorder.end(reason));
  }

  start(options, userId) {
    if (this.runner.state().state !== 'idle') return this.runner.start(options); // throws BUSY
    this.store.resetRun();
    this.recorder.discard();
    return this.runner.start({ ...options, startedBy: userId });
  }

  stop() {
    return this.runner.stop();
  }

  /** Everything the console needs, sent over the WebSocket every tick. */
  snapshot() {
    return {
      type: 'snapshot',
      health: this.store.health(),
      sim: this.runner.state(),
      mission: this.recorder.status(),
      map: buildMap(this.store.teamData, this.store.paths.read()),
    };
  }
}
