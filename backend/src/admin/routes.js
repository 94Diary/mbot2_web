import { Router } from 'express';
import { requirePerm } from '../auth/middleware.js';
import { PERMISSION_LABELS, ROLE_PERMISSIONS } from '../auth/permissions.js';
import { auditCsv, auditFor, listAudit } from '../db/audit.js';
import { readPage } from '../db/index.js';
import { getSettings, setSettings, validateSettings } from '../db/settings.js';
import { badRequest } from '../http.js';
import { readMissionFilter } from '../missions/routes.js';
import { listMissions, missionWorlds } from '../missions/repo.js';
import {
  createAnnouncement, deleteAnnouncement, listAnnouncements, updateAnnouncement,
} from './announcements.js';
import { activity, isRange as isActivityRange } from './activity.js';
import { dashboard, isRange } from './dashboard.js';
import {
  SUSPEND_DAYS, SUSPEND_REASONS, changeRole, createInvite, deleteUser, listInvites, listUsers, suspendUser,
  unsuspendUser, userDetail,
} from './users.js';

const STATUSES = ['active', 'suspended', 'banned'];
const ROLES = ['member', 'admin', 'owner'];

function pagerOr400(query) {
  const pager = readPage(query);
  if (!pager) throw badRequest('page_size ต้องเป็น 10, 20, 30 หรือ 50');
  return pager;
}

export function createAdminRouter({ db, runner }) {
  const router = Router();
  router.use(requirePerm('admin.access'));

  router.get('/dashboard', requirePerm('dash.view'), (req, res) => {
    const range = req.query.range ?? '7d';
    if (!isRange(range)) throw badRequest('ช่วงเวลาต้องเป็น 7d, 30d หรือ all');
    res.json(dashboard(db, range, runner?.state() ?? null));
  });

  // ผู้ใช้
  router.get('/users', requirePerm('users.view'), (req, res) => {
    const { q, role, status } = req.query;
    if (role !== undefined && !ROLES.includes(role)) throw badRequest('บทบาทไม่ถูกต้อง');
    if (status !== undefined && !STATUSES.includes(status)) throw badRequest('สถานะไม่ถูกต้อง');
    res.json(listUsers(db, { q, role, status }, pagerOr400(req.query)));
  });
  router.get('/users/:id', requirePerm('users.view'), (req, res) => res.json(userDetail(db, req.params.id)));
  router.get('/suspend-options', requirePerm('users.view'), (_req, res) => {
    res.json({ reasons: SUSPEND_REASONS, days: SUSPEND_DAYS });
  });

  router.post('/users/:id/suspend', requirePerm('users.edit'), (req, res) => {
    const out = suspendUser(db, req.user, req.params.id, req.body);
    auditFor(db, req)({ action: req.body.kind === 'ban' ? 'user.ban' : 'user.suspend', targetType: 'user',
      targetId: req.params.id, summary: `${req.body.kind === 'ban' ? 'แบน' : 'ระงับ'} ${out.before.display_name} · ${SUSPEND_REASONS[req.body.reason_code]}`,
      before: { status: out.before.status }, after: { status: out.after.status, until: out.until, note: req.body.note ?? '' } });
    res.json(userDetail(db, req.params.id));
  });

  router.post('/users/:id/unsuspend', requirePerm('users.edit'), (req, res) => {
    const out = unsuspendUser(db, req.user, req.params.id, req.body?.reason);
    auditFor(db, req)({ action: 'user.unsuspend', targetType: 'user', targetId: req.params.id,
      summary: `ยกเลิกการระงับ ${out.before.display_name} · ${req.body.reason.trim()}`,
      before: { status: out.before.status }, after: { status: out.after.status } });
    res.json(userDetail(db, req.params.id));
  });

  router.post('/users/:id/role', requirePerm('users.role'), (req, res) => {
    const out = changeRole(db, req.user, req.params.id, req.body ?? {});
    auditFor(db, req)({ action: 'role.change', targetType: 'user', targetId: req.params.id,
      summary: `เปลี่ยนบทบาท ${out.before.display_name}`,
      before: { role: out.before.role, is_owner: out.before.is_owner }, after: { role: out.after.role, is_owner: out.after.is_owner } });
    res.json(userDetail(db, req.params.id));
  });

  router.delete('/users/:id', requirePerm('users.edit'), (req, res) => {
    const out = deleteUser(db, req.user, req.params.id, req.body?.confirm_name);
    auditFor(db, req)({ action: 'user.delete', targetType: 'user', targetId: req.params.id,
      summary: `ลบบัญชี ${out.before.display_name}`, before: { email: out.before.email, role: out.before.role } });
    res.status(204).end();
  });

  router.get('/invites', requirePerm('users.edit'), (_req, res) => res.json({ items: listInvites(db) }));
  router.post('/invites', requirePerm('users.edit'), (req, res) => {
    const invite = createInvite(db, req.user, req.body?.role ?? 'member');
    auditFor(db, req)({ action: 'invite.create', targetType: 'invite', targetId: invite.code,
      summary: `สร้างรหัสเชิญ (${invite.role === 'admin' ? 'ผู้ดูแล' : 'สมาชิก'})` });
    res.status(201).json(invite);
  });

  router.get('/roles', requirePerm('users.view'), (_req, res) => {
    const counts = db.prepare(`SELECT
      SUM(role = 'member') AS member, SUM(role = 'admin' AND is_owner = 0) AS admin, SUM(is_owner = 1) AS owner
      FROM users WHERE status != 'deleted'`).get();
    res.json({
      roles: ['guest', 'member', 'admin', 'owner'].map((key) => ({ key, count: counts[key] ?? null, permissions: ROLE_PERMISSIONS[key] })),
      permissions: Object.entries(PERMISSION_LABELS).map(([key, label]) => ({ key, label })),
    });
  });

  // ภารกิจของทุกคน
  router.get('/missions', requirePerm('data.view'), (req, res) => {
    const { pager, filter } = readMissionFilter(req.query);
    res.json({ ...listMissions(db, { ...filter, userId: req.query.user || null }, pager), worlds: missionWorlds(db) });
  });

  // ประกาศ
  router.get('/announcements', requirePerm('announce.edit'), (_req, res) => res.json({ items: listAnnouncements(db) }));
  router.post('/announcements', requirePerm('announce.edit'), (req, res) => {
    const item = createAnnouncement(db, req.user, req.body);
    auditFor(db, req)({ action: 'announce.create', targetType: 'announcement', targetId: item.id,
      summary: `สร้างประกาศ: ${item.text.slice(0, 60)}`, after: item });
    res.status(201).json(item);
  });
  router.patch('/announcements/:id', requirePerm('announce.edit'), (req, res) => {
    const out = updateAnnouncement(db, Number(req.params.id), req.body ?? {});
    auditFor(db, req)({ action: 'announce.update', targetType: 'announcement', targetId: req.params.id,
      summary: `แก้ประกาศ: ${out.after.text.slice(0, 60)}`, before: out.before, after: out.after });
    res.json(out.after);
  });
  router.delete('/announcements/:id', requirePerm('announce.edit'), (req, res) => {
    const before = deleteAnnouncement(db, Number(req.params.id));
    auditFor(db, req)({ action: 'announce.delete', targetType: 'announcement', targetId: req.params.id,
      summary: `ลบประกาศ: ${before.text.slice(0, 60)}`, before });
    res.status(204).end();
  });

  // ตั้งค่าเว็บ
  router.get('/settings', requirePerm('settings.edit'), (_req, res) => res.json(getSettings(db)));
  router.patch('/settings', requirePerm('settings.edit'), (req, res) => {
    const fields = validateSettings(req.body);
    if (fields) throw badRequest('ค่าตั้งไม่ถูกต้อง', fields);
    const before = getSettings(db);
    const after = setSettings(db, req.body);
    const changed = Object.keys(req.body);
    auditFor(db, req)({ action: 'settings.update', targetType: 'settings',
      summary: `ตั้งค่าเว็บ: ${changed.join(', ')}`,
      before: Object.fromEntries(changed.map((k) => [k, before[k]])), after: Object.fromEntries(changed.map((k) => [k, after[k]])) });
    res.json(after);
  });

  router.get('/activity', requirePerm('audit.view'), (req, res) => {
    const range = req.query.range ?? '7d';
    if (!isActivityRange(range)) throw badRequest('ช่วงเวลาต้องเป็น today, 7d หรือ all');
    res.json(activity(db, { range, q: String(req.query.q ?? ''), actor: String(req.query.actor ?? ''),
      category: String(req.query.category ?? ''), failed: req.query.failed === '1' }));
  });

  // Audit log (อ่านอย่างเดียว)
  const auditFilter = (q) => ({ actor: q.actor, action: q.action, q: q.q, from: q.from, to: q.to });
  router.get('/audit', requirePerm('audit.view'), (req, res) => {
    res.json(listAudit(db, auditFilter(req.query), pagerOr400(req.query)));
  });
  router.get('/audit/export.csv', requirePerm('audit.view'), (req, res) => {
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="audit-log.csv"' });
    res.send(`﻿${auditCsv(db, auditFilter(req.query))}`);
  });

  return router;
}
