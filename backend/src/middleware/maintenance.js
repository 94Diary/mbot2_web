import { can } from '../auth/permissions.js';
import { getSettings } from '../db/settings.js';
import { sendError } from '../http.js';

const ALWAYS_OPEN = [/^\/auth\//, /^\/site(\/status)?$/, /^\/me$/, /^\/announcements\/active$/];

/** Maintenance mode: everyone except admins gets 503 outside the always-open endpoints. */
export function maintenanceGate(db) {
  return (req, res, next) => {
    if (!getSettings(db).maintenance) return next();
    if (ALWAYS_OPEN.some((re) => re.test(req.path)) || can(req.user, 'admin.access')) return next();
    return sendError(res, 503, 'MAINTENANCE', 'เว็บปิดปรับปรุงชั่วคราว กลับมาใหม่ภายหลัง');
  };
}
