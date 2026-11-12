import { Router } from 'express';
import { can } from '../auth/permissions.js';
import { requirePerm } from '../auth/middleware.js';
import { auditFor } from '../db/audit.js';
import { readPage } from '../db/index.js';
import { badRequest, conflict, forbidden, isNonEmptyString, notFound } from '../http.js';
import {
  RESULTS, deleteMission, getMission, listMissions, missionWorlds, renameMission, robotPrefs, saveMission, saveRobotPrefs,
} from './repo.js';

const COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const ROBOT_NS_RE = /^mbot[1-9]$/;

export function readMissionFilter(query) {
  const pager = readPage(query);
  if (!pager) throw badRequest('page_size ต้องเป็น 10, 20, 30 หรือ 50');
  if (query.result !== undefined && !RESULTS.includes(query.result)) throw badRequest('ตัวกรองผลไม่ถูกต้อง');
  if (query.sort !== undefined && !['new', 'old'].includes(query.sort)) throw badRequest('การเรียงไม่ถูกต้อง');
  return {
    pager,
    filter: { q: query.q || null, result: query.result || null, world: query.world || null, sort: query.sort ?? 'new' },
  };
}

function loadVisible(db, req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw notFound();
  const mission = getMission(db, id);
  if (!mission) throw notFound('ไม่พบภารกิจนี้');
  if (mission.user_id !== req.user.id && !can(req.user, 'data.view')) throw forbidden('ภารกิจนี้เป็นของผู้ใช้อื่น');
  return mission;
}

function validatePrefs(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest('รูปแบบไม่ถูกต้อง');
  const out = {};
  for (const [ns, pref] of Object.entries(body)) {
    if (!ROBOT_NS_RE.test(ns) || !isNonEmptyString(pref?.display_name, 20) || !COLOR_RE.test(pref?.color ?? '')) {
      throw badRequest('ชื่อหุ่นต้องยาว 1–20 ตัว และสีต้องเป็นรูปแบบ #RRGGBB', { [ns]: 'ไม่ถูกต้อง' });
    }
    out[ns] = { display_name: pref.display_name.trim(), color: pref.color.toUpperCase() };
  }
  return out;
}

export function createMissionRouter({ db, recorder }) {
  const router = Router();

  router.get('/mission/current', requirePerm('console.view'), (_req, res) => res.json(recorder.status()));

  router.post('/mission/save', requirePerm('console.use'), (req, res) => {
    if (recorder.phase !== 'ended') throw conflict('NOT_ENDED', 'จบภารกิจก่อนจึงจะบันทึกได้');
    if (recorder.meta.startedBy !== req.user.id && !can(req.user, 'data.view')) {
      throw forbidden('บันทึกได้เฉพาะคนที่เริ่มภารกิจนี้');
    }
    const mapName = req.body?.map_name;
    if (mapName !== undefined && mapName !== null && !isNonEmptyString(mapName, 60)) {
      throw badRequest('ชื่อแผนที่ยาวได้ไม่เกิน 60 ตัว', { map_name: 'ยาวไม่เกิน 60 ตัว' });
    }
    const id = saveMission(db, recorder.meta.startedBy, recorder.summary(), { mapName: mapName?.trim() || null });
    recorder.discard();
    auditFor(db, req)({ action: 'mission.save', targetType: 'mission', targetId: id, summary: `บันทึกภารกิจ #${id}` });
    res.status(201).json({ id });
  });

  router.post('/mission/discard', requirePerm('console.use'), (_req, res) => {
    if (recorder.phase === 'recording') throw conflict('RUNNING', 'ภารกิจยังวิ่งอยู่ กดจบภารกิจก่อน');
    recorder.discard();
    res.status(204).end();
  });

  router.get('/missions', requirePerm('history.own'), (req, res) => {
    const { pager, filter } = readMissionFilter(req.query);
    res.json({ ...listMissions(db, { ...filter, userId: req.user.id }, pager), worlds: missionWorlds(db, req.user.id) });
  });

  router.get('/missions/:id', requirePerm('history.own'), (req, res) => res.json(loadVisible(db, req)));

  router.patch('/missions/:id', requirePerm('history.own'), (req, res) => {
    const mission = loadVisible(db, req);
    if (mission.user_id !== req.user.id) throw forbidden('แก้ได้เฉพาะภารกิจของตัวเอง');
    const name = req.body?.map_name;
    if (name !== null && !isNonEmptyString(name, 60)) throw badRequest('ชื่อแผนที่ยาว 1–60 ตัว', { map_name: 'ยาว 1–60 ตัว' });
    renameMission(db, mission.id, name?.trim() ?? null);
    res.json(getMission(db, mission.id));
  });

  router.delete('/missions/:id', requirePerm('history.own'), (req, res) => {
    const mission = loadVisible(db, req);
    if (mission.user_id !== req.user.id && !can(req.user, 'data.delete')) throw forbidden();
    deleteMission(db, mission.id);
    auditFor(db, req)({ action: 'mission.delete', targetType: 'mission', targetId: mission.id,
      summary: `ลบภารกิจ #${mission.id} ของ ${mission.user_name}` });
    res.status(204).end();
  });

  router.get('/me/robot-prefs', requirePerm('history.own'), (req, res) => res.json(robotPrefs(db, req.user.id)));
  router.put('/me/robot-prefs', requirePerm('history.own'), (req, res) => {
    res.json(saveRobotPrefs(db, req.user.id, validatePrefs(req.body)));
  });

  return router;
}

