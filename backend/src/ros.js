// rclnodejs is loaded only at runtime in Ubuntu after ROS 2 has been sourced.
// This keeps API/store tests runnable without Gazebo or native ROS libraries.
const BRANCH_LABELS = { straight: 'ทางตรง', left: 'ทางซ้าย', right: 'ทางขวา', back: 'ทางเดิม' };

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

export function recordTelemetryEvent(recorder, topic, raw) {
  if (!recorder) return;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return;

  if (topic === '/maze_team/state') {
    if (recorder.startSession(data)) {
      console.log(`[RUN] Started ${data.run_id}; saving to ${recorder.currentFile}`);
    }
    return;
  }
  if (topic === '/maze_team/report' && data.type === 'RETRY_BRANCH') {
    recorder.record({robot: data.robot, type: 'BRANCH_RETRY', topic, data,
      detail: `${data.robot} จับเส้นหลังเลี้ยวไม่ได้ที่ J${data.junction_id} ให้ทีมสำรวจซ้ำได้`});
    return;
  }
  if (topic === '/maze_team/decision') {
    if (recorder.startSession(data)) {
      console.log(`[RUN] Started ${data.run_id}; saving to ${recorder.currentFile}`);
    }
    const detail = data.choice
      ? `${data.robot} เลือก${BRANCH_LABELS[data.choice] || data.choice}ที่แยก J${data.junction_id}`
      : `${data.robot} ไม่มีทางเปิดที่แยก J${data.junction_id} (${data.reason || 'ไม่ระบุสาเหตุ'})`;
    recorder.record({
      robot: data.robot,
      type: 'BRANCH_DECISION',
      detail,
      topic, data,
      dedupeKey: data.request_id ? `decision:${data.robot}:${data.request_id}` : null,
    });
    return;
  }
  if (topic === '/maze_team/report' && ['BLOCKED', 'GOAL'].includes(data.type)) {
    recorder.record({
      robot: data.robot,
      type: data.type === 'BLOCKED' ? 'BRANCH_BLOCKED' : 'GOAL_FOUND',
      detail: data.type === 'BLOCKED'
        ? `${data.robot} พบว่า${BRANCH_LABELS[data.choice] || 'กิ่งที่เลือก'}ของแยก J${data.junction_id} เป็นทางตัน`
        : `${data.robot} พบเป้าหมาย`,
      topic, data,
    });
    return;
  }
  if (topic.endsWith('/trail') && data.status && data.status !== 'IN_PROGRESS') {
    recorder.record({
      robot: data.robot || topic.split('/')[1],
      type: data.status,
      detail: `${data.robot || topic.split('/')[1]}: ${data.status}`,
      topic, data,
    });
  }
}

export async function startRosBridge(store, robotNames = ['mbot1', 'mbot2', 'mbot3'], recorder = null) {
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
        recordTelemetryEvent(recorder, topic, message.data);
        // Decisions/trails remain in the recorder; /rosout is the single
        // human-readable console stream, avoiding repeated announcements.
      });
    }
    const recent = new Map();
    node.createSubscription('rcl_interfaces/msg/Log', '/rosout', (message) => {
      const line = formatRobotLog(message, robotNames);
      if (line) {
        const now = Date.now();
        const previous = recent.get(line);
        if (previous !== undefined && now - previous < 5000) return;
        recent.set(line, now);
        for (const [key, at] of recent) if (now - at > 5000) recent.delete(key);
        console.log(line);
        recorder?.record({
          robot: String(message.name).split('.')[0],
          type: 'ROBOT_LOG',
          detail: String(message.msg),
          topic: '/rosout',
          data: { severity: Number(message.level) },
        });
      }
    });
    node.spin();
    store.setRosStatus(true);
    console.log(`ROS 2 connected; listening for ${robotNames.join(', ')} telemetry`);
    return () => {
      store.setRosStatus(false);
      rclnodejs.shutdown();
    };
  } catch (error) {
    store.setRosStatus(false, `${error.name}: ${error.message}`);
    console.error('ROS 2 connection failed:', error);
    return () => {};
  }
}
