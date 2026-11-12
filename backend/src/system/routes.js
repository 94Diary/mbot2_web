import { existsSync, statfsSync } from 'node:fs';
import { join } from 'node:path';
import { Router } from 'express';
import { requirePerm } from '../auth/middleware.js';
import { auditFor } from '../db/audit.js';
import { badRequest } from '../http.js';
import { BUILD_ARGV, ROBOT_COUNTS, launchArgv } from '../sim/commands.js';
import { createBackup, listBackups, restoreBackup, testRestore } from './backups.js';

const startedAt = Date.now();

function diskInfo(dir) {
  try {
    const s = statfsSync(dir);
    return { free_bytes: s.bavail * s.bsize, total_bytes: s.blocks * s.bsize };
  } catch {
    return null;
  }
}

export function createSystemRouter({ db, store, runner, backupDir, wsPath, listWorlds, envInfo }) {
  const router = Router();

  router.get('/admin/system', requirePerm('dash.view'), (_req, res) => {
    const pageCount = db.prepare('PRAGMA page_count').get().page_count;
    const pageSize = db.prepare('PRAGMA page_size').get().page_size;
    const lastBackup = listBackups(db).find((b) => b.kind !== 'pre-restore') ?? null;
    const since = new Date(Date.now() - 86400000).toISOString();
    res.json({
      server: { ok: true, uptime_s: Math.round((Date.now() - startedAt) / 1000), node: process.version, pid: process.pid },
      database: { ok: db.prepare('PRAGMA quick_check').get().quick_check === 'ok', size_bytes: pageCount * pageSize },
      disk: diskInfo(backupDir),
      ros: store.health(),
      sim: runner.state(),
      backup: lastBackup,
      missions_24h: {
        saved: db.prepare('SELECT COUNT(*) AS n FROM missions WHERE started_at >= ?').get(since).n,
        users: db.prepare('SELECT COUNT(DISTINCT user_id) AS n FROM missions WHERE started_at >= ?').get(since).n,
      },
      messages_new: db.prepare("SELECT COUNT(*) AS n FROM contact_messages WHERE status = 'new'").get().n,
    });
  });

  router.get('/admin/machine', requirePerm('settings.edit'), (_req, res) => {
    res.json({
      ws_path: wsPath,
      built: existsSync(join(wsPath, 'install', 'setup.bash')),
      ros_distro: process.env.ROS_DISTRO ?? null,
      git: envInfo(),
      worlds: listWorlds(),
      commands: [
        { name: 'build', argv: BUILD_ARGV.join(' '), when: 'เปิด “Build ใหม่ก่อนรัน”' },
        { name: 'launch', argv: launchArgv({ count: '<2|3>', world: '<สนาม>', headless: false }).join(' ').replace('headless:=false', 'headless:=<true|false>'), when: 'กดรันซิม' },
        { name: 'stop', argv: 'SIGINT → SIGTERM → SIGKILL ทั้ง process group', when: 'กดหยุดทุกตัว / จบภารกิจ' },
      ],
      robot_counts: ROBOT_COUNTS,
      sim: runner.state(),
    });
  });

  router.get('/admin/backups', requirePerm('backup.run'), (_req, res) => res.json({ items: listBackups(db), dir: backupDir }));

  router.post('/admin/backups', requirePerm('backup.run'), (req, res) => {
    const backup = createBackup(db, backupDir, 'manual');
    auditFor(db, req)({ action: 'backup.run', targetType: 'backup', targetId: backup.id,
      summary: backup.ok ? `สำรองข้อมูลทันที (${backup.file})` : `สำรองข้อมูลไม่สำเร็จ: ${backup.error}` });
    res.status(backup.ok ? 201 : 500).json(backup);
  });

  router.post('/admin/backups/:id/test-restore', requirePerm('backup.run'), (req, res) => {
    const result = testRestore(db, backupDir, Number(req.params.id));
    auditFor(db, req)({ action: 'backup.test', targetType: 'backup', targetId: req.params.id,
      summary: `ทดสอบกู้ข้อมูลรอบ #${req.params.id}: ${result.ok ? 'ผ่าน' : 'ไม่ผ่าน'}`, after: result });
    res.json(result);
  });

  router.post('/admin/backups/:id/restore', requirePerm('backup.restore'), (req, res) => {
    if (req.body?.confirm !== 'กู้คืน') throw badRequest('พิมพ์คำว่า “กู้คืน” เพื่อยืนยัน', { confirm: 'พิมพ์ กู้คืน' });
    const out = restoreBackup(db, backupDir, Number(req.params.id));
    auditFor(db, req)({ action: 'backup.restore', targetType: 'backup', targetId: req.params.id,
      summary: `กู้คืนข้อมูลจากรอบ #${req.params.id} (สำรองก่อนกู้ไว้ที่ #${out.safety.id})` });
    res.json(out);
  });

  return router;
}
