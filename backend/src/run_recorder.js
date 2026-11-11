import { appendFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_LOG_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), '..', 'logs',
);
const SESSION_STALE_MS = 3000;
const bangkokClock = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function localTime(date) {
  return bangkokClock.format(date);
}

function elapsedClock(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:` +
    `${String(seconds % 60).padStart(2, '0')}`;
}

export class RunRecorder {
  constructor({ directory = DEFAULT_LOG_DIR, now = () => new Date() } = {}) {
    this.directory = directory;
    this.now = now;
    this.session = null;
    this.lastSessionSignalMs = 0;
    this.pendingWrite = Promise.resolve();
    this.lastError = null;
    this.seenEventKeys = new Set();
  }

  startSession({ run_id: runId, run_started_at: startedAt } = {}) {
    if (typeof runId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(runId) ||
        typeof startedAt !== 'string' || !Number.isFinite(Date.parse(startedAt))) {
      return false;
    }

    this.lastSessionSignalMs = this.now().getTime();
    if (this.session?.runId === runId) return false;

    const timestamp = localTime(new Date(startedAt)).replace(' ', '_').replace(/:/g, '-');
    const file = path.join(this.directory, `run-${timestamp}-${runId}.jsonl`);
    this.session = { runId, startedAt, file };
    this.seenEventKeys.clear();
    const receivedAt = this.now().toISOString();
    this._enqueue(async () => {
      await mkdir(this.directory, { recursive: true });
      const exists = await stat(file).then(() => true, (error) => {
        if (error.code === 'ENOENT') return false;
        throw error;
      });
      const kind = exists ? 'BACKEND_RECONNECTED' : 'RUN_STARTED';
      await appendFile(file, `${JSON.stringify({
        received_at: receivedAt, local_time: localTime(new Date(receivedAt)),
        run_id: runId, type: kind,
        run_started_at: startedAt,
      })}\n`, 'utf8');
    });
    return true;
  }

  record({ robot = null, type, detail = '', topic = null, data = null,
           dedupeKey = null } = {}) {
    const session = this.session;
    const receivedAt = this.now();
    if (!session || receivedAt.getTime() - this.lastSessionSignalMs > SESSION_STALE_MS ||
        !type) return false;
    if (dedupeKey && this.seenEventKeys.has(dedupeKey)) return false;
    if (dedupeKey) this.seenEventKeys.add(dedupeKey);

    const elapsedMs = Math.max(0, receivedAt.getTime() - Date.parse(session.startedAt));
    this._enqueue(() => appendFile(session.file, `${JSON.stringify({
      received_at: receivedAt.toISOString(),
      local_time: localTime(receivedAt),
      elapsed_hms: elapsedClock(elapsedMs),
      elapsed_seconds: Math.round(elapsedMs) / 1000,
      run_id: session.runId,
      robot,
      type,
      detail,
      topic,
      data,
    })}\n`, 'utf8'));
    return true;
  }

  get currentFile() {
    return this.session?.file ?? null;
  }

  flush() {
    return this.pendingWrite;
  }

  _enqueue(write) {
    this.pendingWrite = this.pendingWrite.then(write).catch((error) => {
      this.lastError = error;
      console.error('Could not save robot run log:', error);
    });
  }
}
