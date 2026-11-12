import { HttpError, parseCookies } from '../http.js';
import { can } from './permissions.js';
import { SESSION_COOKIE, userForToken } from './sessions.js';

export function sessionToken(req) {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE];
}

export function attachUser(db) {
  return (req, _res, next) => {
    req.user = userForToken(db, sessionToken(req));
    next();
  };
}

export function requireLogin(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'UNAUTHENTICATED', 'กรุณาเข้าสู่ระบบก่อน'));
  return next();
}

export function requirePerm(key) {
  return (req, _res, next) => {
    if (can(req.user, key)) return next();
    if (!req.user) return next(new HttpError(401, 'UNAUTHENTICATED', 'กรุณาเข้าสู่ระบบก่อน'));
    return next(new HttpError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์ทำสิ่งนี้'));
  };
}
