import { rosoutLogEntry } from './logs.js';

// rclnodejs is loaded only at runtime in Ubuntu after ROS 2 has been sourced.
// This keeps API/store tests runnable without Gazebo or native ROS libraries.
export function formatTelemetryLog(topic, raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return `[ROS] Invalid JSON on ${topic}`;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  if (topic === '/maze_team/decision') {
    return `[TEAM] ${data.robot || 'robot'} at J${data.junction_id ?? '?'}: ` +
      `${data.choice || data.reason || 'no choice'} (shared=${Boolean(data.shared)})`;
  }
  if (topic === '/maze_team/report' && ['BLOCKED', 'GOAL'].includes(data.type)) {
    return `[TEAM] ${data.robot || 'robot'}: ${data.type}`;
  }
  if (topic.endsWith('/trail') && data.status && data.status !== 'IN_PROGRESS') {
    return `[TRAIL] ${data.robot || topic.split('/')[1]}: ${data.status} ` +
      `(segment ${data.segment_id ?? '?'})`;
  }
  return null;
}

export function formatRobotLog(message, robotNames) {
  const severity = Number(message?.level);
  if (!Number.isFinite(severity) || severity < 20) return null;
  const logger = String(message.name || '');
  const robot = robotNames.find((name) => logger === `${name}.maze_solver`);
  if (!robot || !message.msg) return null;
  const level = severity >= 40 ? 'ERROR' : severity >= 30 ? 'WARN' : 'INFO';
  return `${level} ${robot}: ${message.msg}`;
}

export async function startRosBridge(store, robotNames = ['mbot1', 'mbot2', 'mbot3']) {
  let rclnodejs;
  try {
    ({ default: rclnodejs } = await import('rclnodejs'));
    await rclnodejs.init();
    const node = new rclnodejs.Node('mbot2_web_telemetry');
    const topics = ['/maze_team/state', '/maze_team/report', '/maze_team/decision'];
    topics.push(...robotNames.map((name) => `/${name}/trail`));
    for (const topic of topics) {
      node.createSubscription('std_msgs/msg/String', topic, (message) => {
        store.ingest(topic, message.data);
      });
    }
    const recent = new Map();
    node.createSubscription('rcl_interfaces/msg/Log', '/rosout', (message) => {
      const entry = rosoutLogEntry(message, robotNames);
      const line = entry && formatRobotLog(message, robotNames);
      if (line) {
        const now = Date.now();
        const previous = recent.get(line);
        if (previous !== undefined && now - previous < 5000) return;
        recent.set(line, now);
        store.addLog(entry);
        for (const [key, at] of recent) if (now - at > 5000) recent.delete(key);
        console.log(line);
      }
    });
    node.spin();
    store.setTopicReader(() => node.getTopicNamesAndTypes());
    store.setRosStatus(true);
    console.log(`ROS 2 connected; listening for ${robotNames.join(', ')} telemetry`);
    return () => {
      store.setTopicReader(null);
      store.setRosStatus(false);
      rclnodejs.shutdown();
    };
  } catch (error) {
    store.setRosStatus(false, `${error.name}: ${error.message}`);
    console.error('ROS 2 connection failed:', error);
    return () => {};
  }
}
