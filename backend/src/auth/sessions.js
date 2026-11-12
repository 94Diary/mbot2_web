import { createHash, randomBytes } from 'node:crypto';
import { nowIso } from '../db/index.js';
import { findUserById, refreshStatus } from './users.js';

export const SESSION_COOKIE = 'sid';
const DAY_MS = 24 * 60 * 60 * 1000;

const digest = (token) => createHash('sha256').update(token).digest('hex');

export function createSession(db, userId, { ip = null, userAgent = null, days = 7 } = {}) {
  const token = randomBytes(32).toString('base64url');
  const now = nowIso();
  db.prepare(`INSERT INTO sessions (id, user_id, created_at, last_seen_at, expires_at, ip, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(digest(token), userId, now, now,
    new Date(Date.now() + days * DAY_MS).toISOString(), ip, userAgent);
  return token;
}

/** The active user for a session token, or null (expired, revoked, or user not active). */
export function userForToken(db, token) {
  if (typeof token !== 'string' || token.length < 20) return null;
  const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND revoked_at IS NULL').get(digest(token));
  if (!session || session.expires_at <= nowIso()) return null;
  const user = refreshStatus(db, findUserById(db, session.user_id));
  if (!user || user.status !== 'active') return null;
  const now = nowIso();
  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(now, session.id);
  db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(now, user.id);
  return user;
}

export function revokeSession(db, token) {
  if (typeof token !== 'string') return;
  db.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').run(nowIso(), digest(token));
}

export function revokeUserSessions(db, userId) {
  db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(nowIso(), userId);
}

export function sessionCookie(token, days) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${days * 86400}`;
}

export const clearedCookie = `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
