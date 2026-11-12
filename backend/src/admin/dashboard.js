import { getSettings } from '../db/settings.js';

const DAY_MS = 86400000;
const RANGES = { '7d': 7, '30d': 30, all: null };

export function isRange(value) {
  return Object.hasOwn(RANGES, value);
}

function dayKey(date) {
  return new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 10); // วันที่ตามเวลาไทย
}

export function dashboard(db, range = '7d', sim = null) {
  const days = RANGES[range];
  const since = days ? new Date(Date.now() - days * DAY_MS).toISOString() : '0000';
  const week = new Date(Date.now() - 7 * DAY_MS).toISOString();
  const one = (sql, ...params) => db.prepare(sql).get(...params).n;

  const chartDays = days ?? 30;
  const perDay = new Map();
  for (let i = chartDays - 1; i >= 0; i -= 1) perDay.set(dayKey(new Date(Date.now() - i * DAY_MS)), { missions: 0, ok: 0 });
  const chartSince = new Date(Date.now() - chartDays * DAY_MS).toISOString();
  for (const row of db.prepare('SELECT started_at, result FROM missions WHERE deleted_at IS NULL AND started_at >= ?').all(chartSince)) {
    const bucket = perDay.get(dayKey(new Date(row.started_at)));
    if (bucket) { bucket.missions += 1; if (row.result === 'ok') bucket.ok += 1; }
  }

  const settings = getSettings(db);
  const todo = [];
  const suspended = one("SELECT COUNT(*) AS n FROM users WHERE status IN ('suspended','banned')");
  if (suspended) todo.push({ kind: 'suspended', count: suspended, text: `${suspended} บัญชีถูกระงับอยู่`, link: '/admin/users?status=suspended' });
  if (settings.maintenance) todo.push({ kind: 'maintenance', text: 'เว็บอยู่ในโหมดปิดปรับปรุง', link: '/admin/settings' });
  const owners = one("SELECT COUNT(*) AS n FROM users WHERE is_owner = 1 AND status != 'deleted'");
  const messages = one("SELECT COUNT(*) AS n FROM contact_messages WHERE status = 'new'");
  if (messages) todo.push({ kind: 'messages', count: messages, text: `ข้อความติดต่อใหม่ ${messages} ข้อความ`, link: '/admin/messages' });
  if (owners < 2) todo.push({ kind: 'owners', text: 'มีเจ้าของระบบคนเดียว แนะนำให้มี 2 คน', link: '/admin/users?role=admin' });

  return {
    range,
    kpi: {
      users: one("SELECT COUNT(*) AS n FROM users WHERE status != 'deleted'"),
      active_7d: one("SELECT COUNT(*) AS n FROM users WHERE status != 'deleted' AND last_seen_at >= ?", week),
      missions_range: one('SELECT COUNT(*) AS n FROM missions WHERE deleted_at IS NULL AND started_at >= ?', since),
      missions_week: one('SELECT COUNT(*) AS n FROM missions WHERE deleted_at IS NULL AND started_at >= ?', week),
      lesson_readers: one('SELECT COUNT(DISTINCT viewer) AS n FROM lesson_views WHERE day >= ?', since.slice(0, 10)),
    },
    lessons: db.prepare(`SELECT l.slug, l.title, COUNT(*) AS views FROM lesson_views v JOIN lessons l ON l.id = v.lesson_id
      WHERE v.day >= ? AND l.deleted_at IS NULL GROUP BY l.id ORDER BY views DESC LIMIT 5`).all(since.slice(0, 10)),
    results: db.prepare(`SELECT result, COUNT(*) AS n FROM missions WHERE deleted_at IS NULL AND started_at >= ?
      GROUP BY result`).all(since),
    per_day: [...perDay].map(([day, v]) => ({ day, ...v })),
    worlds: db.prepare(`SELECT world, COUNT(*) AS n FROM missions WHERE deleted_at IS NULL AND started_at >= ?
      GROUP BY world ORDER BY n DESC LIMIT 5`).all(since),
    todo,
    online: db.prepare(`SELECT id, display_name, avatar_color, role, is_owner, last_seen_at FROM users
      WHERE status = 'active' AND last_seen_at >= ? ORDER BY last_seen_at DESC LIMIT 8`).all(new Date(Date.now() - 5 * 60000).toISOString()),
    lesson_completion: db.prepare(`SELECT l.ord, l.title, COUNT(p.user_id) AS n FROM lessons l
      LEFT JOIN lesson_progress p ON p.lesson_id = l.id WHERE l.deleted_at IS NULL AND l.status = 'published'
      GROUP BY l.id ORDER BY l.ord`).all(),
    members_total: one("SELECT COUNT(*) AS n FROM users WHERE status != 'deleted'"),
    funnel: {
      sim_builds: one("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'sim.build' AND at >= ?", since),
      sim_starts: one("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'sim.start' AND at >= ?", since),
      saved: one('SELECT COUNT(*) AS n FROM missions WHERE deleted_at IS NULL AND started_at >= ?', since),
      goal_ok: one("SELECT COUNT(*) AS n FROM missions WHERE deleted_at IS NULL AND result = 'ok' AND started_at >= ?", since),
    },
    failed_logins: one("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'auth.failed' AND at >= ?", since),
    recent: db.prepare(`SELECT a.id, a.at, a.action, a.summary, u.display_name AS actor_name FROM audit_log a
      LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT 8`).all(),
    sim,
  };
}
