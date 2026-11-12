import { nowIso, pageResult } from './index.js';

const SECRET_KEYS = /pass|token|secret|hash/i;

function scrub(value) {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value, (key, inner) => (SECRET_KEYS.test(key) ? undefined : inner));
}

export function writeAudit(db, entry) {
  db.prepare(`INSERT INTO audit_log
    (at, actor_id, action, target_type, target_id, summary, before, after, ip, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    nowIso(), entry.actorId ?? null, entry.action, entry.targetType ?? null,
    entry.targetId === undefined || entry.targetId === null ? null : String(entry.targetId),
    entry.summary, scrub(entry.before), scrub(entry.after), entry.ip ?? null, entry.userAgent ?? null,
  );
}

/** Audit helper bound to one HTTP request (actor, ip, user agent). */
export function auditFor(db, req) {
  return (entry) => writeAudit(db, {
    actorId: req.user?.id ?? null,
    ip: req.ip,
    userAgent: req.get('user-agent') ?? null,
    ...entry,
  });
}

function where(filter) {
  const clauses = [];
  const params = [];
  if (filter.actor) { clauses.push('a.actor_id = ?'); params.push(filter.actor); }
  if (filter.action) { clauses.push('a.action LIKE ?'); params.push(`${filter.action}%`); }
  if (filter.from) { clauses.push('a.at >= ?'); params.push(filter.from); }
  if (filter.to) { clauses.push('a.at <= ?'); params.push(filter.to); }
  if (filter.q) { clauses.push('(a.summary LIKE ? OR u.display_name LIKE ?)'); params.push(`%${filter.q}%`, `%${filter.q}%`); }
  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

const SELECT = `SELECT a.*, u.display_name AS actor_name FROM audit_log a
  LEFT JOIN users u ON u.id = a.actor_id`;

function parse(row) {
  return { ...row, before: row.before && JSON.parse(row.before), after: row.after && JSON.parse(row.after) };
}

export function listAudit(db, filter, pager) {
  const { sql, params } = where(filter);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ${sql}`)
    .get(...params).n;
  const items = db.prepare(`${SELECT} ${sql} ORDER BY a.id DESC LIMIT ? OFFSET ?`)
    .all(...params, pager.pageSize, pager.offset).map(parse);
  return pageResult(items, total, pager);
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function auditCsv(db, filter) {
  const { sql, params } = where(filter);
  const rows = db.prepare(`${SELECT} ${sql} ORDER BY a.id DESC LIMIT 10000`).all(...params);
  const header = ['id', 'at', 'actor', 'action', 'target_type', 'target_id', 'summary', 'ip'];
  const lines = rows.map((r) => [r.id, r.at, r.actor_name ?? 'system', r.action, r.target_type,
    r.target_id, r.summary, r.ip].map(csvCell).join(','));
  return [header.join(','), ...lines].join('\n');
}
