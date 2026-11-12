import { randomUUID } from 'node:crypto';
import { nowIso } from '../db/index.js';
import { hashPassword } from './passwords.js';

export const AVATAR_COLORS = ['#FF6B1A', '#1B9BD1', '#B6E33C', '#8B7CF6', '#FF5FA2', '#2EC4B6', '#FFD23F', '#E5484D'];
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
    is_owner: Boolean(user.is_owner),
    status: user.status,
    avatar_color: user.avatar_color,
    created_at: user.created_at,
    last_seen_at: user.last_seen_at,
  };
}

export function findUserById(db, id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) ?? null;
}

export function findUserByEmail(db, email) {
  return db.prepare("SELECT * FROM users WHERE email = ? AND status != 'deleted'").get(String(email).trim()) ?? null;
}

export async function createUser(db, { email, displayName, password, role = 'member', isOwner = false }) {
  const user = {
    id: randomUUID(),
    email: email.trim(),
    display_name: displayName.trim(),
    password_hash: await hashPassword(password),
    role,
    is_owner: isOwner ? 1 : 0,
    avatar_color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    created_at: nowIso(),
  };
  db.prepare(`INSERT INTO users (id, email, display_name, password_hash, role, is_owner, avatar_color, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(user.id, user.email, user.display_name, user.password_hash,
    user.role, user.is_owner, user.avatar_color, user.created_at);
  return findUserById(db, user.id);
}

export function activeSuspension(db, userId) {
  return db.prepare(`SELECT * FROM suspensions WHERE user_id = ? AND lifted_at IS NULL
    ORDER BY id DESC LIMIT 1`).get(userId) ?? null;
}

/** Lifts a suspension whose `until` has passed; returns the up-to-date user row. */
export function refreshStatus(db, user) {
  if (!user || !['suspended', 'banned'].includes(user.status)) return user;
  const suspension = activeSuspension(db, user.id);
  if (suspension?.until && suspension.until <= nowIso()) {
    db.prepare("UPDATE suspensions SET lifted_at = ?, lift_reason = 'หมดเวลาระงับ' WHERE id = ?")
      .run(nowIso(), suspension.id);
    db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(user.id);
    return findUserById(db, user.id);
  }
  return user;
}

export function countOwners(db) {
  return db.prepare("SELECT COUNT(*) AS n FROM users WHERE is_owner = 1 AND status != 'deleted'").get().n;
}
