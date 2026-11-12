import { nowIso, transaction } from '../db/index.js';
import { badRequest, conflict, isNonEmptyString, notFound } from '../http.js';

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TRASH_DAYS = 30;
const DAY_MS = 86400000;

const COLUMNS = `l.id, l.ord, l.slug, l.title, l.summary, l.status, l.audience, l.updated_at, l.created_at, l.deleted_at,
  u.display_name AS author_name`;
const FROM = 'FROM lessons l LEFT JOIN users u ON u.id = l.author_id';

/** Lessons a viewer may list: published for everyone; drafts only for editors. */
export function listLessons(db, { includeDrafts = false, includeDeleted = false, status = null } = {}) {
  const clauses = [includeDeleted ? 'l.deleted_at IS NOT NULL' : 'l.deleted_at IS NULL'];
  if (!includeDrafts) clauses.push("l.status = 'published'");
  if (status) clauses.push('l.status = ?');
  return db.prepare(`SELECT ${COLUMNS} ${FROM} WHERE ${clauses.join(' AND ')} ORDER BY l.ord, l.id`).all(...(status ? [status] : []));
}

export function getLessonBySlug(db, slug) {
  return db.prepare(`SELECT ${COLUMNS}, l.body ${FROM} WHERE l.slug = ? AND l.deleted_at IS NULL`).get(slug) ?? null;
}

export function getLesson(db, id) {
  const row = db.prepare(`SELECT ${COLUMNS}, l.body ${FROM} WHERE l.id = ?`).get(id);
  if (!row) throw notFound('ไม่พบบทเรียน');
  return row;
}

/** Previous/next published lessons around `ord` for the reader's nav. */
export function neighbours(db, ord, includeDrafts) {
  const where = `deleted_at IS NULL ${includeDrafts ? '' : "AND status = 'published'"}`;
  return {
    prev: db.prepare(`SELECT slug, title FROM lessons WHERE ${where} AND ord < ? ORDER BY ord DESC LIMIT 1`).get(ord) ?? null,
    next: db.prepare(`SELECT slug, title FROM lessons WHERE ${where} AND ord > ? ORDER BY ord ASC LIMIT 1`).get(ord) ?? null,
  };
}

function validate(db, body, id = null) {
  const fields = {};
  if (!isNonEmptyString(body.title, 120)) fields.title = 'ใส่ชื่อบทเรียน (ไม่เกิน 120 ตัว)';
  if (typeof body.summary !== 'string' || body.summary.length > 80) fields.summary = 'สรุปไม่เกิน 80 ตัวอักษร';
  if (typeof body.body !== 'string' || body.body.length > 100000) fields.body = 'เนื้อหายาวเกินไป';
  if (!SLUG_RE.test(body.slug ?? '') || body.slug.length > 60) fields.slug = 'ใช้ a-z 0-9 และขีด - เท่านั้น';
  else if (db.prepare('SELECT id FROM lessons WHERE slug = ? AND id IS NOT ?').get(body.slug, id)) fields.slug = 'slug นี้มีบทเรียนอื่นใช้แล้ว';
  if (!['draft', 'published'].includes(body.status)) fields.status = 'สถานะไม่ถูกต้อง';
  if (!['all', 'members'].includes(body.audience)) fields.audience = 'กลุ่มผู้อ่านไม่ถูกต้อง';
  if (!Number.isInteger(body.ord) || body.ord < 1 || body.ord > 999) fields.ord = 'ลำดับต้องเป็น 1–999';
  if (Object.keys(fields).length) throw badRequest('ข้อมูลบทเรียนไม่ถูกต้อง', fields);
}

export function createLesson(db, actor, input) {
  const nextOrd = db.prepare('SELECT COALESCE(MAX(ord), 0) + 1 AS n FROM lessons WHERE deleted_at IS NULL').get().n;
  const body = { summary: '', body: '', status: 'draft', audience: 'all', ord: nextOrd, ...input };
  validate(db, body);
  const now = nowIso();
  const { lastInsertRowid } = db.prepare(`INSERT INTO lessons
    (ord, slug, title, summary, body, status, audience, author_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    body.ord, body.slug, body.title.trim(), body.summary.trim(), body.body, body.status, body.audience, actor.id, now, now,
  );
  return getLesson(db, Number(lastInsertRowid));
}

export function updateLesson(db, actor, id, patch) {
  const before = getLesson(db, id);
  if (before.deleted_at) throw conflict('IN_TRASH', 'บทเรียนนี้อยู่ในถังขยะ กู้คืนก่อนแก้');
  const next = { ...before, ...patch };
  validate(db, next, id);
  db.prepare(`UPDATE lessons SET ord = ?, slug = ?, title = ?, summary = ?, body = ?, status = ?, audience = ?,
    author_id = COALESCE(author_id, ?), updated_at = ? WHERE id = ?`).run(
    next.ord, next.slug, next.title.trim(), next.summary.trim(), next.body, next.status, next.audience, actor.id, nowIso(), id,
  );
  return { before, after: getLesson(db, id) };
}

export function trashLesson(db, id) {
  const before = getLesson(db, id);
  if (before.deleted_at) throw conflict('IN_TRASH', 'บทเรียนนี้อยู่ในถังขยะแล้ว');
  db.prepare('UPDATE lessons SET deleted_at = ? WHERE id = ?').run(nowIso(), id);
  return before;
}

export function restoreLesson(db, id) {
  const before = getLesson(db, id);
  if (!before.deleted_at) throw conflict('NOT_IN_TRASH', 'บทเรียนนี้ไม่ได้อยู่ในถังขยะ');
  db.prepare('UPDATE lessons SET deleted_at = NULL WHERE id = ?').run(id);
  return getLesson(db, id);
}

/** Lessons in the trash longer than 30 days are removed for good (with their progress and views). */
export function purgeTrash(db, now = Date.now()) {
  const cutoff = new Date(now - TRASH_DAYS * DAY_MS).toISOString();
  const ids = db.prepare('SELECT id FROM lessons WHERE deleted_at IS NOT NULL AND deleted_at < ?').all(cutoff).map((r) => r.id);
  transaction(db, () => {
    for (const id of ids) {
      db.prepare('DELETE FROM lesson_progress WHERE lesson_id = ?').run(id);
      db.prepare('DELETE FROM lesson_views WHERE lesson_id = ?').run(id);
      db.prepare('DELETE FROM lessons WHERE id = ?').run(id);
    }
  });
  return ids.length;
}

export function progressFor(db, userId) {
  return db.prepare('SELECT lesson_id FROM lesson_progress WHERE user_id = ?').all(userId).map((r) => r.lesson_id);
}

export function setProgress(db, userId, lessonId, done) {
  if (done) {
    db.prepare('INSERT OR IGNORE INTO lesson_progress (user_id, lesson_id, completed_at) VALUES (?, ?, ?)').run(userId, lessonId, nowIso());
  } else {
    db.prepare('DELETE FROM lesson_progress WHERE user_id = ? AND lesson_id = ?').run(userId, lessonId);
  }
}

/** One view per viewer per lesson per day (viewer = user id, or a hash of IP for guests). */
export function recordView(db, lessonId, viewer) {
  db.prepare('INSERT OR IGNORE INTO lesson_views (lesson_id, viewer, day) VALUES (?, ?, ?)').run(lessonId, viewer, nowIso().slice(0, 10));
}
