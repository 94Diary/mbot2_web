import { EventEmitter } from 'node:events';
import { telemetryLogEntry } from './logs.js';
import { RobotPaths } from './paths.js';

const MAX_EVENTS = 500;
const MAX_LOGS = 1000;
const STALE_AFTER_MS = 3000;

function copy(value) {
  return structuredClone(value);
}

/** Latest ROS telemetry. Emits `team` (data) on each team state and `log` (entry) on each log line. */
export class TelemetryStore extends EventEmitter {
  constructor() {
    super();
    this.logItems = [];
    this.nextLogId = 1;
    this.teamData = { robots: {}, junctions: [], goal: null };
    this.teamReceivedAt = null;
    this.teamReceivedMs = null;
    this.eventItems = [];
    this.nextEventId = 1;
    this.rosNodeRunning = false;
    this.rosError = null;
    this.readTopics = null;
    this.paths = new RobotPaths();
  }

  setRosStatus(running, error = null) {
    this.rosNodeRunning = Boolean(running);
    this.rosError = error;
  }

  setTopicReader(readTopics) {
    this.readTopics = readTopics;
  }

  topics() {
    return this.readTopics?.() ?? null;
  }

  ingest(topic, raw) {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw: String(raw), parse_error: true };
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      data = { raw: data, parse_error: true };
    }

    const receivedAt = new Date().toISOString();
    if (topic === '/maze_team/state' && !data.parse_error) {
      this.teamData = copy(data);
      this.paths.update(data);
      this.teamReceivedAt = receivedAt;
      this.teamReceivedMs = Date.now();
      this.emit('team', this.teamData);
      return;
    }
    const entry = telemetryLogEntry(topic, data);
    if (entry) this.addLog(entry);

    this.eventItems.push({
      id: this.nextEventId++,
      received_at: receivedAt,
      topic,
      robot: data.robot || topic.split('/')[1] || 'team',
      type: data.type || data.status || 'MESSAGE',
      data: copy(data),
    });
    if (this.eventItems.length > MAX_EVENTS) this.eventItems.shift();
  }

  addLog(entry) {
    const item = { id: this.nextLogId++, at: new Date().toISOString(), ...entry };
    this.logItems.push(item);
    if (this.logItems.length > MAX_LOGS) this.logItems.shift();
    this.emit('log', item);
    return item;
  }

  logs(limit = 200, afterId = null) {
    return copy(this.logItems.filter((item) => afterId === null || item.id > afterId).slice(-limit));
  }

  /** Forget the previous run so a new sim starts from an empty map and log. */
  resetRun() {
    this.teamData = { robots: {}, junctions: [], goal: null };
    this.teamReceivedAt = null;
    this.teamReceivedMs = null;
    this.eventItems = [];
    this.logItems = [];
    this.paths = new RobotPaths();
  }

  health() {
    const ageMs = this.teamReceivedMs === null ? null : Date.now() - this.teamReceivedMs;
    return {
      backend: 'ok',
      ros_node_running: this.rosNodeRunning,
      ros_error: this.rosError,
      team_state_fresh: ageMs !== null && ageMs < STALE_AFTER_MS,
      team_state_age_seconds: ageMs === null ? null : Math.round(ageMs / 10) / 100,
    };
  }

  team() {
    return { received_at: this.teamReceivedAt, data: copy(this.teamData) };
  }

  goals() {
    const { goal } = this.teamData;
    const items = goal ? [copy(goal)] : [];
    return {
      received_at: this.teamReceivedAt,
      fresh: this.health().team_state_fresh,
      found: items.length > 0,
      found_count: items.length,
      items,
    };
  }

  events(limit = 50, afterId = null, robot = null) {
    const items = this.eventItems.filter((item) =>
      (afterId === null || item.id > afterId) && (robot === null || item.robot === robot));
    return copy(items.slice(-limit));
  }

  snapshot() {
    return { health: this.health(), team: this.team(), events: this.events(30) };
  }
}
