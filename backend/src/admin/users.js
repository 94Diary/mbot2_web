import { randomBytes } from 'node:crypto';
import { can } from '../auth/permissions.js';
import { revokeUserSessions } from '../auth/sessions.js';
import { countOwners, findUserById, publicUser } from '../auth/users.js';
import { nowIso, pageResult, transaction } from '../db/index.js';
import { badRequest, conflict, forbidden, isNonEmptyString, notFound } from '../http.js';

export const SUSPEND_REASONS = {
  stop_others: 'สั่งหยุดหุ่นคนอื่นซ้ำๆ',
  unsafe: 'ใช้หุ่นไม่ปลอดภัย',
  spam: 'สแปม',
  terms: 'ผิดข้อตกลง',
  other: 'อื่นๆ',
};
export const SUSPEND_DAYS = [1, 7, 30];
const DAY_MS = 86400000;

export function listUsers(db, { q, role, status }, pager) {
  const clauses = ["status != 'deleted'"];
  const params = [];
  if (q) { clauses.push('(display_name LIKE ? OR email LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  if (role === 'owner') clauses.push('is_owner = 1');
  else if (role === 'admin') clauses.push("role = 'admin' AND is_owner = 0");
  else if (role === 'member') clauses.push("role = 'member'");
  if (status) { clauses.push('status = ?'); params.push(status); }
  const where = `WHERE ${clauses.join(' AND ')}`;
  const total = db.prepare(`SELECT COUNT(*) AS n FROM users ${where}`).get(...params).n;
  const rows = db.prepare(`SELECT u.*, (SELECT COUNT(*) FROM missions m WHERE m.user_id = u.id AND m.deleted_at IS NULL)
    AS mission_count FROM users u ${where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, pager.pageSize, pager.offset);
  return pageResult(rows.map((row) => ({ ...publicUser(row), mission_count: row.mission_count })), total, pager);
}

export function userDetail(db, id) {
  const user = findUserById(db, id);
  if (!user || user.status === 'deleted') throw notFound('ไม่พบผู้ใช้');
  const suspensions = db.prepare(`SELECT s.*, u.display_name AS created_by_name FROM suspensions s
    LEFT JOIN users u ON u.id = s.created_by WHERE s.user_id = ? ORDER BY s.id DESC`).all(id);
  return { ...publicUser(user), suspensions };
}

/** The rules from roles-permissions.md: not yourself, admins only by owners. */
export function assertCanManage(actor, target) {
  if (actor.id === target.id) throw conflict('SELF', 'จัดการบัญชีของตัวเองจากหน้านี้ไม่ได้');
  if (target.role === 'admin' && !can(actor, 'users.admins')) {
    throw forbidden('ผู้ดูแลจัดการได้เฉพาะบัญชีสมาชิก');
  }
}

function load(db, id) {
  const user = findUserById(db, id);
  if (!user || user.status === 'deleted') throw notFound('ไม่พบผู้ใช้');
  return user;
}

export function suspendUser(db, actor, id, body) {
  const target = load(db, id);
  assertCanManage(actor, target);
  const kind = body?.kind;
  const fields = {};
  if (!['suspend', 'ban'].includes(kind)) fields.kind = 'เลือกระงับหรือแบน';
  if (!SUSPEND_REASONS[body?.reason_code]) fields.reason_code = 'เลือกเหตุผล';
  if (kind === 'suspend' && !SUSPEND_DAYS.includes(body?.days)) fields.days = 'เลือก 1, 7 หรือ 30 วัน';
  for (const key of ['message', 'note']) {
    if (body?.[key] !== undefined && (typeof body[key] !== 'string' || body[key].length > 500)) fields[key] = 'ยาวไม่เกิน 500 ตัว';
  }
  if (Object.keys(fields).length) throw badRequest('ข้อมูลการระงับไม่ครบ', fields);
  const until = kind === 'ban' ? null : new Date(Date.now() + body.days * DAY_MS).toISOString();
  transaction(db, () => {
    db.prepare("UPDATE suspensions SET lifted_at = ?, lifted_by = ?, lift_reason = 'แทนที่ด้วยการระงับใหม่' WHERE user_id = ? AND lifted_at IS NULL")
      .run(nowIso(), actor.id, id);
    db.prepare(`INSERT INTO suspensions (user_id, kind, reason_code, message_to_user, internal_note, until, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, kind, body.reason_code, body.message ?? '', body.note ?? '', until, actor.id, nowIso());
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(kind === 'ban' ? 'banned' : 'suspended', id);
  });
  if (body.force_logout !== false) revokeUserSessions(db, id);
  return { before: publicUser(target), after: publicUser(load(db, id)), until };
}

export function unsuspendUser(db, actor, id, reason) {
  const target = load(db, id);
  assertCanManage(actor, target);
  if (!isNonEmptyString(reason, 300)) throw badRequest('ต้องใส่เหตุผลการยกเลิก', { reason: 'ต้องใส่เหตุผล' });
  if (target.status === 'active') throw conflict('NOT_SUSPENDED', 'บัญชีนี้ไม่ได้ถูกระงับ');
  transaction(db, () => {
    db.prepare('UPDATE suspensions SET lifted_at = ?, lifted_by = ?, lift_reason = ? WHERE user_id = ? AND lifted_at IS NULL')
      .run(nowIso(), actor.id, reason.trim(), id);
    db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(id);
  });
  return { before: publicUser(target), after: publicUser(load(db, id)) };
}

/** role ∈ member|admin, isOwner implies admin; the last owner can never be removed. */
export function changeRole(db, actor, id, { role, is_owner: isOwner }) {
  const target = load(db, id);
  if (actor.id === target.id) throw conflict('SELF', 'เปลี่ยนบทบาทของตัวเองไม่ได้');
  if (!['member', 'admin'].includes(role) || typeof isOwner !== 'boolean') throw badRequest('บทบาทไม่ถูกต้อง');
  if (isOwner && role !== 'admin') throw badRequest('เจ้าของต้องเป็นผู้ดูแลด้วย');
  if (target.is_owner && !isOwner && countOwners(db) <= 1) {
    throw conflict('LAST_OWNER', 'ต้องมีเจ้าของอย่างน้อย 1 คนเสมอ');
  }
  db.prepare('UPDATE users SET role = ?, is_owner = ? WHERE id = ?').run(role, isOwner ? 1 : 0, id);
  return { before: publicUser(target), after: publicUser(load(db, id)) };
}

export function deleteUser(db, actor, id, confirmName) {
  const target = load(db, id);
  assertCanManage(actor, target);
  if (confirmName !== target.display_name) throw badRequest('พิมพ์ชื่อผู้ใช้ให้ตรงเพื่อยืนยัน', { confirm_name: 'ชื่อไม่ตรง' });
  if (target.is_owner && countOwners(db) <= 1) throw conflict('LAST_OWNER', 'ต้องมีเจ้าของอย่างน้อย 1 คนเสมอ');
  db.prepare("UPDATE users SET status = 'deleted', deleted_at = ?, is_owner = 0 WHERE id = ?").run(nowIso(), id);
  revokeUserSessions(db, id);
  return { before: publicUser(target) };
}

export function createInvite(db, actor, role = 'member') {
  if (!['member', 'admin'].includes(role)) throw badRequest('บทบาทไม่ถูกต้อง');
  if (role !== 'member' && !can(actor, 'users.role')) throw forbidden('เชิญผู้ดูแลได้เฉพาะเจ้าของ');
  const code = randomBytes(5).toString('hex').toUpperCase();
  const expiresAt = new Date(Date.now() + 7 * DAY_MS).toISOString();
  db.prepare('INSERT INTO invites (code, role, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(code, role, actor.id, nowIso(), expiresAt);
  return { code, role, expires_at: expiresAt };
}

export function listInvites(db) {
  return db.prepare(`SELECT i.*, u.display_name AS created_by_name, v.display_name AS used_by_name FROM invites i
    LEFT JOIN users u ON u.id = i.created_by LEFT JOIN users v ON v.id = i.used_by
    ORDER BY i.created_at DESC LIMIT 50`).all();
}
