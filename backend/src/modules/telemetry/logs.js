// แปลงข้อความ ROS เป็นรายการ log ที่หน้าเว็บแสดง: { ns, level: info|ok|warn|err, kind, msg }
const TRAIL_TEXT = {
  JUNCTION: 'ถึงทางแยก',
  BLOCKED: 'เจอทางตัน',
  DEAD_END: 'เจอทางตัน',
  GOAL: 'ถึงเป้าหมาย',
  COMPLETE: 'เดินเส้นนี้ครบ',
};

/** One log entry for a team/trail message, or null for high-frequency noise. */
export function telemetryLogEntry(topic, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.parse_error) {
    return data?.parse_error ? { ns: 'team', level: 'err', kind: 'parse', msg: `ข้อมูลจาก ${topic} อ่านไม่ได้` } : null;
  }
  if (topic === '/maze_team/decision') {
    const ns = data.robot || 'team';
    const choice = data.choice || data.reason || 'ยังไม่เลือก';
    return { ns, level: 'info', kind: 'decision', msg: `ที่ทางแยก J${data.junction_id ?? '?'} เลือก ${choice}${data.shared ? ' (แผนที่ร่วม)' : ''}` };
  }
  if (topic === '/maze_team/report') {
    if (data.type === 'BLOCKED') return { ns: data.robot || 'team', level: 'warn', kind: 'dead_end', msg: 'รายงานกิ่งตัน' };
    if (data.type === 'GOAL') return { ns: data.robot || 'team', level: 'ok', kind: 'goal', msg: 'พบเป้าหมาย' };
    return null;
  }
  if (topic.endsWith('/trail') && data.status && data.status !== 'IN_PROGRESS') {
    const ns = data.robot || topic.split('/')[1];
    const level = data.status === 'GOAL' ? 'ok' : ['BLOCKED', 'DEAD_END'].includes(data.status) ? 'warn' : 'info';
    const kind = data.status === 'JUNCTION' ? 'junction' : level === 'warn' ? 'dead_end' : data.status.toLowerCase();
    return { ns, level, kind, msg: `${TRAIL_TEXT[data.status] ?? data.status} (เส้นที่ ${data.segment_id ?? '?'})` };
  }
  return null;
}

/** One log entry for a /rosout message from a robot's maze_solver, or null. */
export function rosoutLogEntry(message, robotNames) {
  const severity = Number(message?.level);
  if (!Number.isFinite(severity) || severity < 20) return null;
  const logger = String(message.name || '');
  const ns = robotNames.find((name) => logger === `${name}.maze_solver`);
  if (!ns || !message.msg) return null;
  const level = severity >= 40 ? 'err' : severity >= 30 ? 'warn' : 'info';
  return { ns, level, kind: 'robot', msg: String(message.msg).slice(0, 300) };
}
