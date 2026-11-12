import { nowIso, pageResult, transaction } from '../db/index.js';
import { DEFAULT_ROBOT_COLORS } from './recorder.js';

export const RESULTS = ['ok', 'part', 'stop'];

export function robotPrefs(db, userId) {
  const rows = db.prepare('SELECT robot_ns, display_name, color FROM user_robot_prefs WHERE user_id = ?').all(userId);
  return Object.fromEntries(rows.map((r) => [r.robot_ns, { display_name: r.display_name, color: r.color }]));
}

export function saveRobotPrefs(db, userId, prefs) {
  transaction(db, () => {
    db.prepare('DELETE FROM user_robot_prefs WHERE user_id = ?').run(userId);
    const insert = db.prepare('INSERT INTO user_robot_prefs (user_id, robot_ns, display_name, color) VALUES (?, ?, ?, ?)');
    for (const [ns, pref] of Object.entries(prefs)) insert.run(userId, ns, pref.display_name, pref.color);
  });
  return robotPrefs(db, userId);
}

export function saveMission(db, userId, summary, { mapName = null } = {}) {
  const prefs = robotPrefs(db, userId);
  return transaction(db, () => {
    const { lastInsertRowid } = db.prepare(`INSERT INTO missions
      (user_id, source, world, robot_count, result, started_at, ended_at, duration_s,
       junction_count, dead_end_count, map_name, env, map, log)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      userId, summary.source, summary.world, summary.robot_count, summary.result, summary.started_at,
      summary.ended_at, summary.duration_s, summary.junction_count, summary.dead_end_count, mapName,
      JSON.stringify(summary.env), JSON.stringify(summary.map), JSON.stringify(summary.log),
    );
    const insert = db.prepare(`INSERT INTO mission_robots
      (mission_id, robot_ns, display_name, color, reached_goal_at, distance_m) VALUES (?, ?, ?, ?, ?, ?)`);
    for (const robot of summary.robots) {
      insert.run(lastInsertRowid, robot.robot_ns, prefs[robot.robot_ns]?.display_name ?? robot.robot_ns.toUpperCase(),
        prefs[robot.robot_ns]?.color ?? DEFAULT_ROBOT_COLORS[robot.robot_ns] ?? '#8B7CF6',
        robot.reached_goal_at, robot.distance_m);
    }
    return Number(lastInsertRowid);
  });
}

const THUMB_POINTS = 40;

/** สรุปสำหรับการ์ดประวัติ: จำนวน log ตามระดับ เหตุการณ์สำคัญ และเส้นทางย่อสำหรับแผนที่เล็ก */
export function cardSummary(log, map) {
  const count = (level) => log.filter((l) => l.level === level).length;
  const key = log.find((l) => l.kind === 'goal') ?? log.find((l) => l.level === 'warn' || l.level === 'err') ?? log.at(-1) ?? null;
  const thumb = Object.fromEntries(Object.entries(map?.paths ?? {}).map(([ns, pts]) => {
    const clean = (pts ?? []).filter(Boolean);
    const stride = Math.max(1, Math.ceil(clean.length / THUMB_POINTS));
    return [ns, clean.filter((_, i) => i % stride === 0 || i === clean.length - 1).map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100])];
  }));
  return {
    log_count: log.length, warn_count: count('warn'), err_count: count('err'),
    key_event: key ? { ns: key.ns, msg: key.msg, t: key.t } : null,
    thumb,
  };
}

const LIST_COLUMNS = `m.id, m.user_id, u.display_name AS user_name, m.source, m.world, m.robot_count, m.result,
  m.started_at, m.ended_at, m.duration_s, m.junction_count, m.dead_end_count, m.map_name`;

/** filter: { userId?, q?, result?, world?, sort: 'new'|'old' } */
export function listMissions(db, filter, pager) {
  const clauses = ['m.deleted_at IS NULL'];
  const params = [];
  if (filter.userId) { clauses.push('m.user_id = ?'); params.push(filter.userId); }
  if (filter.result) { clauses.push('m.result = ?'); params.push(filter.result); }
  if (filter.world) { clauses.push('m.world = ?'); params.push(filter.world); }
  if (filter.q) {
    const q = String(filter.q).replace(/^#/, '');
    clauses.push('(CAST(m.id AS TEXT) = ? OR m.map_name LIKE ? OR u.display_name LIKE ?)');
    params.push(q, `%${q}%`, `%${q}%`);
  }
  const where = `WHERE ${clauses.join(' AND ')}`;
  const from = 'FROM missions m JOIN users u ON u.id = m.user_id';
  const total = db.prepare(`SELECT COUNT(*) AS n ${from} ${where}`).get(...params).n;
  const order = filter.sort === 'old' ? 'ASC' : 'DESC';
  const items = db.prepare(`SELECT ${LIST_COLUMNS} ${from} ${where} ORDER BY m.started_at ${order}, m.id ${order}
    LIMIT ? OFFSET ?`).all(...params, pager.pageSize, pager.offset);
  const robots = db.prepare('SELECT robot_ns, display_name, color, reached_goal_at FROM mission_robots WHERE mission_id = ?');
  const extra = db.prepare('SELECT log, map FROM missions WHERE id = ?');
  return pageResult(items.map((m) => {
    const row = extra.get(m.id);
    return { ...m, robots: robots.all(m.id), ...cardSummary(JSON.parse(row.log), JSON.parse(row.map)) };
  }), total, pager);
}

export function getMission(db, id) {
  const row = db.prepare(`SELECT m.*, u.display_name AS user_name FROM missions m JOIN users u ON u.id = m.user_id
    WHERE m.id = ? AND m.deleted_at IS NULL`).get(id);
  if (!row) return null;
  return {
    ...row,
    env: JSON.parse(row.env),
    map: JSON.parse(row.map),
    log: JSON.parse(row.log),
    robots: db.prepare('SELECT * FROM mission_robots WHERE mission_id = ? ORDER BY robot_ns').all(id),
  };
}

export function renameMission(db, id, mapName) {
  db.prepare('UPDATE missions SET map_name = ? WHERE id = ?').run(mapName, id);
}

export function deleteMission(db, id) {
  db.prepare('UPDATE missions SET deleted_at = ? WHERE id = ?').run(nowIso(), id);
}

export function missionWorlds(db, userId = null) {
  const rows = userId
    ? db.prepare('SELECT DISTINCT world FROM missions WHERE user_id = ? AND deleted_at IS NULL ORDER BY world').all(userId)
    : db.prepare('SELECT DISTINCT world FROM missions WHERE deleted_at IS NULL ORDER BY world').all();
  return rows.map((r) => r.world);
}
