import { createHash } from 'node:crypto';
import { Router } from 'express';
import { requireLogin, requirePerm } from '../auth/middleware.js';
import { can } from '../auth/permissions.js';
import { auditFor } from '../db/audit.js';
import { badRequest, HttpError, notFound } from '../http.js';
import {
  createLesson, getLesson, getLessonBySlug, listLessons, neighbours, progressFor, recordView, restoreLesson, setProgress,
  trashLesson, updateLesson,
} from './lessons.js';
import { search } from './search.js';

const EDITABLE = ['ord', 'slug', 'title', 'summary', 'body', 'status', 'audience'];
const pick = (body) => Object.fromEntries(EDITABLE.filter((k) => body?.[k] !== undefined).map((k) => [k, body[k]]));

export function createContentRouter({ db }) {
  const router = Router();

  // ===== สาธารณะ =====
  router.get('/lessons', (req, res) => {
    const editor = can(req.user, 'content.edit');
    const items = listLessons(db, { includeDrafts: editor })
      .map((l) => ({ ...l, locked: l.audience === 'members' && !req.user }));
    res.json({ items, completed: req.user ? progressFor(db, req.user.id) : [] });
  });

  router.get('/lessons/:slug', (req, res) => {
    const editor = can(req.user, 'content.edit');
    const lesson = getLessonBySlug(db, req.params.slug);
    if (!lesson || (lesson.status !== 'published' && !editor)) throw notFound('ไม่พบบทเรียนนี้');
    if (lesson.audience === 'members' && !req.user) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'บทเรียนนี้สำหรับสมาชิก กรุณาเข้าสู่ระบบ');
    }
    if (lesson.status === 'published') {
      const viewer = req.user?.id ?? `ip:${createHash('sha256').update(String(req.ip)).digest('hex').slice(0, 16)}`;
      recordView(db, lesson.id, viewer);
    }
    res.json({
      ...lesson,
      ...neighbours(db, lesson.ord, editor),
      completed: req.user ? progressFor(db, req.user.id).includes(lesson.id) : false,
    });
  });

  router.post('/lessons/:id/progress', requireLogin, (req, res) => {
    const lesson = getLesson(db, Number(req.params.id));
    if (lesson.deleted_at || lesson.status !== 'published') throw notFound('ไม่พบบทเรียนนี้');
    setProgress(db, req.user.id, lesson.id, true);
    res.status(204).end();
  });
  router.delete('/lessons/:id/progress', requireLogin, (req, res) => {
    setProgress(db, req.user.id, Number(req.params.id), false);
    res.status(204).end();
  });

  router.get('/search', (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    if (q.length > 100) throw badRequest('คำค้นยาวเกินไป');
    res.json({ q, items: search(db, q, { loggedIn: Boolean(req.user) }) });
  });

  // ===== หลังบ้าน =====
  router.get('/admin/lessons', requirePerm('content.edit'), (req, res) => {
    const trash = req.query.trash === '1';
    const status = ['draft', 'published'].includes(req.query.status) ? req.query.status : null;
    const items = listLessons(db, { includeDrafts: true, includeDeleted: trash, status });
    res.json({ items, counts: {
      published: listLessons(db, { status: 'published', includeDrafts: true }).length,
      draft: listLessons(db, { status: 'draft', includeDrafts: true }).length,
      trash: listLessons(db, { includeDrafts: true, includeDeleted: true }).length,
    } });
  });
  router.get('/admin/lessons/:id', requirePerm('content.edit'), (req, res) => res.json(getLesson(db, Number(req.params.id))));

  router.post('/admin/lessons', requirePerm('content.edit'), (req, res) => {
    const lesson = createLesson(db, req.user, pick(req.body));
    auditFor(db, req)({ action: 'lesson.create', targetType: 'lesson', targetId: lesson.id, summary: `สร้างบทเรียน “${lesson.title}”` });
    res.status(201).json(lesson);
  });

  router.patch('/admin/lessons/:id', requirePerm('content.edit'), (req, res) => {
    const patch = pick(req.body);
    const { before, after } = updateLesson(db, req.user, Number(req.params.id), patch);
    if (req.body?.autosave !== true || before.status !== after.status) {
      const published = before.status !== after.status && after.status === 'published';
      auditFor(db, req)({ action: published ? 'lesson.publish' : 'lesson.update', targetType: 'lesson', targetId: after.id,
        summary: `${published ? 'เผยแพร่' : 'แก้'}บทเรียน “${after.title}”`,
        before: { status: before.status, slug: before.slug, ord: before.ord }, after: { status: after.status, slug: after.slug, ord: after.ord } });
    }
    res.json(after);
  });

  router.delete('/admin/lessons/:id', requirePerm('content.delete'), (req, res) => {
    const before = trashLesson(db, Number(req.params.id));
    auditFor(db, req)({ action: 'lesson.trash', targetType: 'lesson', targetId: before.id, summary: `ย้ายบทเรียน “${before.title}” ไปถังขยะ` });
    res.status(204).end();
  });

  router.post('/admin/lessons/:id/restore', requirePerm('content.delete'), (req, res) => {
    const lesson = restoreLesson(db, Number(req.params.id));
    auditFor(db, req)({ action: 'lesson.restore', targetType: 'lesson', targetId: lesson.id, summary: `กู้คืนบทเรียน “${lesson.title}”` });
    res.json(lesson);
  });

  return router;
}

