import { nowIso } from '../db/index.js';
import { badRequest, isNonEmptyString, notFound } from '../http.js';

const LEVELS = ['info', 'warn', 'red'];
const AUDIENCES = ['all', 'members', 'admins'];

const toApi = (row) => row && { ...row, enabled: Boolean(row.enabled) };

function validate(body, partial = false) {
  const fields = {};
  const has = (key) => body?.[key] !== undefined;
  if ((!partial || has('text')) && !isNonEmptyString(body?.text, 280)) fields.text = 'ใส่ข้อความ 1–280 ตัว';
  if (has('level') && !LEVELS.includes(body.level)) fields.level = 'ระดับไม่ถูกต้อง';
  if (has('audience') && !AUDIENCES.includes(body.audience)) fields.audience = 'กลุ่มผู้เห็นไม่ถูกต้อง';
  if (has('enabled') && typeof body.enabled !== 'boolean') fields.enabled = 'ต้องเป็นเปิด/ปิด';
  for (const key of ['starts_at', 'ends_at']) {
    if (has(key) && body[key] !== null && Number.isNaN(Date.parse(body[key]))) fields[key] = 'วันที่ไม่ถูกต้อง';
  }
  if (body?.starts_at && body?.ends_at && Date.parse(body.ends_at) < Date.parse(body.starts_at)) {
    fields.ends_at = 'วันสิ้นสุดต้องหลังวันเริ่ม';
  }
  if (Object.keys(fields).length) throw badRequest('ข้อมูลประกาศไม่ถูกต้อง', fields);
}

export function listAnnouncements(db) {
  return db.prepare('SELECT * FROM announcements ORDER BY id DESC').all().map(toApi);
}

export function getAnnouncement(db, id) {
  const row = db.prepare('SELECT * FROM announcements WHERE id = ?').get(id);
  if (!row) throw notFound('ไม่พบประกาศ');
  return toApi(row);
}

export function createAnnouncement(db, actor, body) {
  validate(body);
  const { lastInsertRowid } = db.prepare(`INSERT INTO announcements
    (text, level, audience, starts_at, ends_at, enabled, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    body.text.trim(), body.level ?? 'info', body.audience ?? 'all', body.starts_at ?? null, body.ends_at ?? null,
    body.enabled === false ? 0 : 1, actor.id, nowIso(),
  );
  return getAnnouncement(db, Number(lastInsertRowid));
}

export function updateAnnouncement(db, id, body) {
  const before = getAnnouncement(db, id);
  validate({ ...before, ...body }, true);
  const next = { ...before, ...body };
  db.prepare(`UPDATE announcements SET text = ?, level = ?, audience = ?, starts_at = ?, ends_at = ?, enabled = ?
    WHERE id = ?`).run(next.text.trim(), next.level, next.audience, next.starts_at, next.ends_at, next.enabled ? 1 : 0, id);
  return { before, after: getAnnouncement(db, id) };
}

export function deleteAnnouncement(db, id) {
  const before = getAnnouncement(db, id);
  db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
  return before;
}

/** Announcements a given viewer should see right now. */
export function activeAnnouncements(db, viewer) {
  const now = nowIso();
  const audiences = ['all'];
  if (viewer) audiences.push('members');
  if (viewer?.role === 'admin') audiences.push('admins');
  return db.prepare(`SELECT id, text, level, audience FROM announcements
    WHERE enabled = 1 AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at >= ?)
    AND audience IN (${audiences.map(() => '?').join(',')}) ORDER BY id DESC`).all(now, now, ...audiences);
}
