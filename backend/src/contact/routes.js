import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { requirePerm } from '../auth/middleware.js';
import { EMAIL_RE } from '../auth/users.js';
import { auditFor } from '../db/audit.js';
import { nowIso, pageResult, readPage } from '../db/index.js';
import { HttpError, badRequest, isNonEmptyString, notFound } from '../http.js';

export const TOPICS = ['ถามเรื่องบทเรียน', 'แจ้งปัญหาเว็บ', 'ขอสิทธิ์ใช้งาน', 'อื่นๆ'];
export const POLICY_VERSION = '1.2';
const LIMIT_PER_HOUR = 5;
const HOUR_MS = 3600000;

/** Tiny in-memory sliding window per key; enough for a single local server. */
export function createRateLimiter(limit, windowMs, now = () => Date.now()) {
  const hits = new Map();
  return (key) => {
    const t = now();
    const list = (hits.get(key) ?? []).filter((at) => t - at < windowMs);
    if (list.length >= limit) { hits.set(key, list); return false; }
    list.push(t);
    hits.set(key, list);
    return true;
  };
}

export function createContactRouter({ db, rateLimit = createRateLimiter(LIMIT_PER_HOUR, HOUR_MS) }) {
  const router = Router();

  router.post('/contact', (req, res) => {
    const b = req.body ?? {};
    // honeypot: ช่องที่คนมองไม่เห็น บอทกรอก → ตอบเหมือนสำเร็จแต่ไม่เก็บ
    if (typeof b.website === 'string' && b.website.trim()) return res.status(201).json({ ok: true });
    const fields = {};
    if (!isNonEmptyString(b.name, 80)) fields.name = 'ใส่ชื่อก่อน';
    if (typeof b.email !== 'string' || !EMAIL_RE.test(b.email.trim()) || b.email.length > 120) fields.email = 'อีเมลไม่ถูกต้อง เช่น name@mail.com';
    if (!TOPICS.includes(b.topic)) fields.topic = 'เลือกหัวข้อ';
    if (typeof b.message !== 'string' || b.message.trim().length < 10 || b.message.length > 4000) fields.message = 'เขียนอย่างน้อย 10 ตัวอักษร';
    if (b.human !== true) fields.human = 'ติ๊กว่าคุณไม่ใช่บอท';
    if (Object.keys(fields).length) throw badRequest('กรอกข้อมูลให้ครบ', fields);
    if (!rateLimit(req.ip)) throw new HttpError(429, 'RATE_LIMITED', 'ส่งบ่อยเกินไป ลองใหม่ในอีกหนึ่งชั่วโมง');
    db.prepare(`INSERT INTO contact_messages (name, email, topic, message, user_id, ip, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(b.name.trim(), b.email.trim(), b.topic, b.message.trim(), req.user?.id ?? null, req.ip, nowIso());
    return res.status(201).json({ ok: true });
  });

  router.post('/consent', (req, res) => {
    const c = req.body?.choices;
    if (!c || typeof c.prefs !== 'boolean' || typeof c.analytics !== 'boolean') throw badRequest('รูปแบบความยินยอมไม่ถูกต้อง');
    const anonId = typeof req.body.anon_id === 'string' && /^[a-f0-9-]{36}$/.test(req.body.anon_id) ? req.body.anon_id : randomUUID();
    const choices = { necessary: true, prefs: c.prefs, analytics: c.analytics };
    db.prepare('INSERT INTO consent_records (user_id, anon_id, choices, policy_version, at, ip) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.user?.id ?? null, anonId, JSON.stringify(choices), POLICY_VERSION, nowIso(), req.ip);
    res.status(201).json({ anon_id: anonId, choices, policy_version: POLICY_VERSION });
  });

  // ===== หลังบ้าน: กล่องข้อความ =====
  router.get('/admin/messages', requirePerm('users.view'), (req, res) => {
    const pager = readPage(req.query);
    if (!pager) throw badRequest('page_size ต้องเป็น 10, 20, 30 หรือ 50');
    const status = ['new', 'done'].includes(req.query.status) ? req.query.status : null;
    const where = status ? 'WHERE m.status = ?' : '';
    const params = status ? [status] : [];
    const total = db.prepare(`SELECT COUNT(*) AS n FROM contact_messages m ${where}`).get(...params).n;
    const items = db.prepare(`SELECT m.*, u.display_name AS handled_by_name FROM contact_messages m
      LEFT JOIN users u ON u.id = m.handled_by ${where} ORDER BY m.id DESC LIMIT ? OFFSET ?`).all(...params, pager.pageSize, pager.offset);
    const unread = db.prepare("SELECT COUNT(*) AS n FROM contact_messages WHERE status = 'new'").get().n;
    res.json({ ...pageResult(items, total, pager), unread });
  });

  router.patch('/admin/messages/:id', requirePerm('users.view'), (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT * FROM contact_messages WHERE id = ?').get(id);
    if (!row) throw notFound('ไม่พบข้อความ');
    if (!['new', 'done'].includes(req.body?.status)) throw badRequest('สถานะไม่ถูกต้อง');
    const done = req.body.status === 'done';
    db.prepare('UPDATE contact_messages SET status = ?, handled_by = ?, handled_at = ? WHERE id = ?')
      .run(req.body.status, done ? req.user.id : null, done ? nowIso() : null, id);
    auditFor(db, req)({ action: 'message.update', targetType: 'message', targetId: id,
      summary: `${done ? 'ปิด' : 'เปิดใหม่'}ข้อความจาก ${row.name}`, before: { status: row.status }, after: { status: req.body.status } });
    res.json(db.prepare('SELECT * FROM contact_messages WHERE id = ?').get(id));
  });

  router.delete('/admin/messages/:id', requirePerm('data.delete'), (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT * FROM contact_messages WHERE id = ?').get(id);
    if (!row) throw notFound('ไม่พบข้อความ');
    db.prepare('DELETE FROM contact_messages WHERE id = ?').run(id);
    auditFor(db, req)({ action: 'message.delete', targetType: 'message', targetId: id, summary: `ลบข้อความจาก ${row.name}` });
    res.status(204).end();
  });

  return router;
}
