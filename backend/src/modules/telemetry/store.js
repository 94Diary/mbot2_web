import { RobotPaths } from './paths.js';

const MAX_EVENTS = 500;
const STALE_AFTER_MS = 3000;

function copy(value) {
  return structuredClone(value);
}

export class TelemetryStore {
  constructor() {
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
      return;
    }

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
