import { Router } from 'express';
import { nowIso } from '../db/index.js';
import { writeAudit } from '../db/audit.js';
import { getSettings } from '../db/settings.js';
import { HttpError, badRequest, isNonEmptyString } from '../http.js';
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from './passwords.js';
import { permissionsFor } from './permissions.js';
import { requireLogin, sessionToken } from './middleware.js';
import { clearedCookie, createSession, revokeSession, revokeUserSessions, sessionCookie } from './sessions.js';
import {
  EMAIL_RE, activeSuspension, createUser, findUserByEmail, publicUser, refreshStatus,
} from './users.js';

function validateRegistration(body) {
  const fields = {};
  if (!isNonEmptyString(body.display_name, 40)) fields.display_name = 'ใส่ชื่อที่แสดง 1–40 ตัวอักษร';
  if (typeof body.email !== 'string' || !EMAIL_RE.test(body.email.trim())) fields.email = 'อีเมลไม่ถูกต้อง';
  if (typeof body.password !== 'string' || body.password.length < MIN_PASSWORD_LENGTH) {
    fields.password = `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัว`;
  }
  return Object.keys(fields).length ? fields : null;
}

function suspendedError(db, user) {
  const suspension = activeSuspension(db, user.id);
  const error = new HttpError(403, 'SUSPENDED', user.status === 'banned'
    ? 'บัญชีนี้ถูกแบน' : 'บัญชีนี้ถูกระงับชั่วคราว');
  error.extra = {
    kind: suspension?.kind ?? (user.status === 'banned' ? 'ban' : 'suspend'),
    reason: suspension?.reason_code ?? null,
    message_to_user: suspension?.message_to_user ?? '',
    until: suspension?.until ?? null,
  };
  return error;
}

export function createAuthRouter(db, { sessionDays = 7 } = {}) {
  const router = Router();
  const meta = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') ?? null, days: sessionDays });

  router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      throw badRequest('กรอกอีเมลและรหัสผ่าน');
    }
    const user = refreshStatus(db, findUserByEmail(db, email));
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      writeAudit(db, { action: 'auth.failed', summary: `เข้าสู่ระบบไม่สำเร็จ (${email.slice(0, 80)})`, ip: req.ip });
      throw new HttpError(401, 'BAD_CREDENTIALS', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }
    if (user.status !== 'active') {
      const error = suspendedError(db, user);
      return res.status(403).json({ error: { code: error.code, message: error.message, ...error.extra } });
    }
    const token = createSession(db, user.id, meta(req));
    res.set('Set-Cookie', sessionCookie(token, sessionDays));
    return res.json({ user: publicUser(user), permissions: permissionsFor(user) });
  });

  router.post('/auth/register', async (req, res) => {
    const body = req.body ?? {};
    const { registration } = getSettings(db);
    if (registration === 'closed') throw new HttpError(403, 'REGISTRATION_CLOSED', 'ตอนนี้ปิดรับสมัครสมาชิก');
    const fields = validateRegistration(body);
    if (fields) throw badRequest('ข้อมูลไม่ครบ', fields);
    if (findUserByEmail(db, body.email)) throw badRequest('อีเมลนี้มีบัญชีแล้ว', { email: 'อีเมลนี้มีบัญชีแล้ว' });

    const code = typeof body.invite === 'string' ? body.invite.trim() : '';
    const invite = code
      ? db.prepare('SELECT * FROM invites WHERE code = ? AND used_at IS NULL AND expires_at > ?').get(code, nowIso())
      : null;
    if ((registration === 'invite' || code) && !invite) {
      throw badRequest('รหัสเชิญไม่ถูกต้องหรือหมดอายุ', { invite: 'รหัสเชิญไม่ถูกต้องหรือหมดอายุ' });
    }
    const user = await createUser(db, {
      email: body.email, displayName: body.display_name, password: body.password, role: invite?.role ?? 'member',
    });
    if (invite) {
      db.prepare('UPDATE invites SET used_at = ?, used_by = ? WHERE code = ?').run(nowIso(), user.id, invite.code);
    }
    writeAudit(db, {
      actorId: user.id, action: 'user.register', targetType: 'user', targetId: user.id,
      summary: `สมัครสมาชิก ${user.display_name}${invite ? ' (รหัสเชิญ)' : ''}`, ip: req.ip,
    });
    const token = createSession(db, user.id, meta(req));
    res.set('Set-Cookie', sessionCookie(token, sessionDays));
    return res.status(201).json({ user: publicUser(user), permissions: permissionsFor(user) });
  });

  router.post('/auth/logout', (req, res) => {
    revokeSession(db, sessionToken(req));
    res.set('Set-Cookie', clearedCookie);
    res.status(204).end();
  });

  router.get('/me', (req, res) => {
    res.json({ user: publicUser(req.user), permissions: permissionsFor(req.user) });
  });

  router.post('/me/password', requireLogin, async (req, res) => {
    const { current, next } = req.body ?? {};
    if (typeof current !== 'string' || !(await verifyPassword(current, req.user.password_hash))) {
      throw badRequest('รหัสผ่านปัจจุบันไม่ถูกต้อง', { current: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
    }
    if (typeof next !== 'string' || next.length < MIN_PASSWORD_LENGTH) {
      throw badRequest('รหัสผ่านใหม่สั้นเกินไป', { next: `ต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัว` });
    }
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(next), req.user.id);
    revokeUserSessions(db, req.user.id);
    const token = createSession(db, req.user.id, meta(req));
    res.set('Set-Cookie', sessionCookie(token, sessionDays));
    writeAudit(db, { actorId: req.user.id, action: 'user.password', targetType: 'user', targetId: req.user.id,
      summary: 'เปลี่ยนรหัสผ่าน (ออกจากระบบเครื่องอื่นแล้ว)', ip: req.ip });
    res.status(204).end();
  });

  return router;
}
