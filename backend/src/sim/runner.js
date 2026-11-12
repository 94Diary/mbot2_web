import { spawn as nodeSpawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { join } from 'node:path';
import { conflict } from '../http.js';
import { BUILD_ARGV, launchArgv, parseBuildError } from './commands.js';

const MAX_LINES = 400;
// สคริปต์คงที่: source ROS แล้ว exec argv ที่ส่งมาแยก ไม่มีค่าจากผู้ใช้ในสตริงนี้
const SHELL = 'source "$MBOT2_ROS_SETUP" && if [ -f "$MBOT2_WS_SETUP" ]; then source "$MBOT2_WS_SETUP"; fi; exec "$@"';
const STEP_NAMES = ['build', 'gazebo', 'bridge', 'link'];
const GAZEBO_READY = /Entity creation successful|Requesting list of world names|\[create-\d+\].*(?:Requested creation|Waiting messages)/;
const BRIDGE_READY = /Creating (?:GZ|ROS|IGN)->(?:ROS|GZ|IGN) Bridge|parameter_bridge.*Creating/;

/**
 * Runs one simulation at a time: optional colcon build, then ros2 launch.
 * Emits `line` (text), `state` (snapshot), `running` (snapshot) and `ended` ({ reason }).
 */
export class SimRunner extends EventEmitter {
  constructor({
    wsPath, spawn = nodeSpawn, kill = process.kill.bind(process),
    rosSetup = '/opt/ros/humble/setup.bash', stopAfterMs = { int: 5000, term: 3000 },
  }) {
    super();
    this.wsPath = wsPath;
    this.spawnFn = spawn;
    this.killFn = kill;
    this.rosSetup = rosSetup;
    this.stopAfterMs = stopAfterMs;
    this.lines = [];
    this.child = null;
    this.reset();
  }

  reset() {
    this.status = 'idle';
    this.wasRunning = false;
    this.options = null;
    this.startedAt = null;
    this.steps = Object.fromEntries(STEP_NAMES.map((name) => [name, 'wait']));
  }

  state() {
    return {
      state: this.status,
      steps: { ...this.steps },
      world: this.options?.world ?? null,
      robots: this.options?.count ?? 0,
      headless: this.options?.headless ?? null,
      started_at: this.startedAt,
      error: this.error ?? null,
      building_only: Boolean(this.options?.buildOnly),
      last_build_at: this.lastBuildAt ?? null,
    };
  }

  recentLines(limit = MAX_LINES) {
    return this.lines.slice(-limit);
  }

  setStatus(status) {
    this.status = status;
    this.emit('state', this.state());
  }

  setStep(name, value) {
    if (this.steps[name] === value) return;
    this.steps[name] = value;
    this.emit('state', this.state());
  }

  pushLine(text) {
    const line = text.replace(/\x1b\[[0-9;]*m/g, '').trimEnd();
    if (!line) return;
    this.lines.push(line);
    if (this.lines.length > MAX_LINES) this.lines.splice(0, this.lines.length - MAX_LINES);
    this.emit('line', line);
    if (this.status === 'launching') {
      if (this.steps.gazebo === 'run' && GAZEBO_READY.test(line)) {
        this.setStep('gazebo', 'done');
        this.setStep('bridge', 'run');
      }
      if (BRIDGE_READY.test(line)) {
        this.setStep('gazebo', 'done');
        this.setStep('bridge', 'done');
        this.setStep('link', 'run');
      }
    }
  }

  spawnStep(argv) {
    const child = this.spawnFn('bash', ['-c', SHELL, 'mbot2-sim', ...argv], {
      cwd: this.wsPath,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        MBOT2_ROS_SETUP: this.rosSetup,
        MBOT2_WS_SETUP: join(this.wsPath, 'install', 'setup.bash'),
        PYTHONUNBUFFERED: '1',
        RCUTILS_COLORIZED_OUTPUT: '0',
      },
    });
    this.child = child;
    for (const stream of [child.stdout, child.stderr]) {
      let buffer = '';
      stream?.on('data', (chunk) => {
        buffer += chunk.toString();
        const parts = buffer.split('\n');
        buffer = parts.pop();
        for (const part of parts) this.pushLine(part);
      });
      stream?.on('end', () => { if (buffer) this.pushLine(buffer); buffer = ''; });
    }
    return child;
  }

  /** Starts a run with already-validated options; throws 409 BUSY when one is active. */
  start(options) {
    if (this.status !== 'idle') throw conflict('BUSY', 'มีซิมรันอยู่แล้ว จบภารกิจเดิมก่อน');
    this.reset();
    this.error = null;
    this.lines = [];
    this.options = { ...options };
    this.startedAt = new Date().toISOString();
    if (options.build) this.runBuild();
    else {
      this.steps.build = 'skip';
      this.runLaunch();
    }
    return this.state();
  }

  /** Build only (ขั้น 1 ปุ่ม Build): colcon build แล้วกลับเป็น idle โดยคงผล build ไว้ให้หน้าเว็บเห็น */
  build() {
    if (this.status !== 'idle') throw conflict('BUSY', 'มีงานรันอยู่แล้ว รอให้เสร็จก่อน');
    this.reset();
    this.error = null;
    this.lines = [];
    this.options = { buildOnly: true };
    this.startedAt = new Date().toISOString();
    this.runBuild();
    return this.state();
  }

  runBuild() {
    this.setStep('build', 'run');
    this.setStatus('building');
    this.pushLine(`$ ${BUILD_ARGV.join(' ')}`);
    const child = this.spawnStep(BUILD_ARGV);
    child.on('error', (error) => this.fail('SPAWN_FAILED', error.message));
    child.on('exit', (code) => {
      if (this.child === child) this.child = null;
      if (this.status === 'stopping') return this.finish('stopped');
      if (code === 0) {
        if (this.options?.buildOnly) {
          const steps = { ...this.steps, build: 'done' };
          this.reset();
          this.steps = steps;
          this.lastBuildAt = new Date().toISOString();
          return this.emit('state', this.state());
        }
        this.setStep('build', 'done');
        this.lastBuildAt = new Date().toISOString();
        return this.runLaunch();
      }
      this.setStep('build', 'fail');
      const parsed = parseBuildError(this.lines);
      return this.fail('BUILD_FAILED', parsed.message, { file: parsed.file, line: parsed.line });
    });
  }

  runLaunch() {
    this.setStep('gazebo', 'run');
    this.setStatus('launching');
    const argv = launchArgv(this.options);
    this.pushLine(`$ ${argv.join(' ')}`);
    const child = this.spawnStep(argv);
    child.on('error', (error) => this.fail('SPAWN_FAILED', error.message));
    child.on('exit', (code, signal) => {
      if (this.child === child) this.child = null;
      if (this.status === 'stopping') return this.finish('stopped');
      return this.fail('LAUNCH_EXITED', `ros2 launch หยุดเอง (code ${code ?? signal})`);
    });
  }

  /** Called when the first team state arrives from ROS: the robots are live. */
  markLinked() {
    if (this.status !== 'launching') return;
    for (const name of ['gazebo', 'bridge']) if (this.steps[name] !== 'done') this.steps[name] = 'done';
    this.setStep('link', 'done');
    this.wasRunning = true;
    this.setStatus('running');
    this.emit('running', this.state());
  }

  fail(code, message, extra = {}) {
    this.error = { code, message, ...extra };
    const { wasRunning } = this;
    this.killGroup('SIGTERM');
    this.reset();
    this.emit('state', this.state());
    if (wasRunning) this.emit('ended', { reason: 'crashed' });
  }

  finish(reason) {
    clearTimeout(this.termTimer);
    clearTimeout(this.killTimer);
    const { wasRunning } = this;
    this.reset();
    this.emit('state', this.state());
    if (wasRunning) this.emit('ended', { reason });
    for (const resolve of this.stopWaiters ?? []) resolve();
    this.stopWaiters = [];
  }

  killGroup(signal) {
    if (!this.child?.pid) return;
    try {
      this.killFn(-this.child.pid, signal);
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }

  /** SIGINT the whole process group, escalate to SIGTERM then SIGKILL; resolves when it exits. */
  stop() {
    if (this.status === 'idle') return Promise.resolve();
    const waiter = new Promise((resolve) => { (this.stopWaiters ??= []).push(resolve); });
    if (this.status === 'stopping') return waiter;
    if (!this.child) {
      this.finish('stopped');
      return waiter;
    }
    this.setStatus('stopping');
    this.killGroup('SIGINT');
    this.termTimer = setTimeout(() => {
      this.killGroup('SIGTERM');
      this.killTimer = setTimeout(() => this.killGroup('SIGKILL'), this.stopAfterMs.term);
    }, this.stopAfterMs.int);
    return waiter;
  }

  async shutdown() {
    await this.stop();
  }
}
