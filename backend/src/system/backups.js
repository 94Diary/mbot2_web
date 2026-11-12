import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { nowIso, transaction } from '../db/index.js';
import { conflict, notFound } from '../http.js';

const KEEP_DAYS = 30;
const DAY_MS = 86400000;
// ตารางที่กู้คืน · ไม่กู้ audit_log (append-only), sessions (คนที่ใช้อยู่ไม่ควรหลุด),
// consent_records (หลักฐาน PDPA) และ backups (ประวัติการสำรองเอง)
export const RESTORE_TABLES = [
  'users', 'suspensions', 'invites', 'missions', 'mission_robots', 'user_robot_prefs', 'announcements',
  'site_settings', 'lessons', 'lesson_progress', 'lesson_views', 'contact_messages',
];

const stamp = (d = new Date()) => d.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const sqlString = (text) => `'${String(text).replaceAll("'", "''")}'`;

export function listBackups(db) {
  return db.prepare('SELECT * FROM backups ORDER BY id DESC LIMIT 100').all()
    .map((b) => ({ ...b, ok: Boolean(b.ok), restore_test_result: b.restore_test_result && JSON.parse(b.restore_test_result) }));
}

/** Consistent online copy with `VACUUM INTO`; records success or failure. */
export function createBackup(db, dir, kind = 'manual') {
  mkdirSync(dir, { recursive: true });
  const file = `mbot2-${stamp()}-${kind}-${Math.random().toString(36).slice(2, 6)}.db`;
  const path = join(dir, file);
  try {
    db.exec(`VACUUM INTO ${sqlString(path)}`);
    const size = statSync(path).size;
    const { lastInsertRowid } = db.prepare('INSERT INTO backups (at, kind, file, size_bytes, ok) VALUES (?, ?, ?, ?, 1)')
      .run(nowIso(), kind, file, size);
    return getBackup(db, Number(lastInsertRowid));
  } catch (error) {
    const { lastInsertRowid } = db.prepare('INSERT INTO backups (at, kind, file, ok, error) VALUES (?, ?, ?, 0, ?)')
      .run(nowIso(), kind, file, String(error.message).slice(0, 300));
    return getBackup(db, Number(lastInsertRowid));
  }
}

export function getBackup(db, id) {
  const row = listBackups(db).find((b) => b.id === id) ?? null;
  if (!row) throw notFound('ไม่พบรอบสำรองนี้');
  return row;
}

function backupPath(db, dir, id) {
  const backup = getBackup(db, id);
  if (!backup.ok) throw conflict('BACKUP_FAILED', 'รอบสำรองนี้ไม่สำเร็จ ใช้กู้ไม่ได้');
  const path = join(dir, backup.file);
  if (!existsSync(path)) throw conflict('FILE_MISSING', 'ไม่พบไฟล์สำรองในเครื่องแล้ว');
  return { backup, path };
}

/** Opens the copy read-only, runs integrity_check and counts key rows; never touches the live DB. */
export function testRestore(db, dir, id) {
  const { path } = backupPath(db, dir, id);
  const copy = new DatabaseSync(path, { readOnly: true });
  try {
    const integrity = copy.prepare('PRAGMA integrity_check').get().integrity_check;
    const count = (table) => copy.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
    const result = { ok: integrity === 'ok', integrity, users: count('users'), missions: count('missions'), lessons: count('lessons') };
    db.prepare('UPDATE backups SET restore_tested_at = ?, restore_test_result = ? WHERE id = ?').run(nowIso(), JSON.stringify(result), id);
    return result;
  } finally {
    copy.close();
  }
}

/** Replaces RESTORE_TABLES with the backup's rows after taking a pre-restore backup. */
export function restoreBackup(db, dir, id) {
  const { backup, path } = backupPath(db, dir, id);
  const safety = createBackup(db, dir, 'pre-restore');
  if (!safety.ok) throw conflict('BACKUP_FAILED', 'สำรองข้อมูลปัจจุบันก่อนกู้ไม่สำเร็จ จึงยังไม่กู้คืน');
  db.exec(`ATTACH DATABASE ${sqlString(path)} AS b`);
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    transaction(db, () => {
      for (const table of RESTORE_TABLES) {
        const exists = db.prepare("SELECT 1 FROM b.sqlite_master WHERE type = 'table' AND name = ?").get(table);
        db.exec(`DELETE FROM main.${table}`);
        if (!exists) continue;
        const backupCols = new Set(db.prepare(`PRAGMA b.table_info(${table})`).all().map((c) => c.name));
        const cols = db.prepare(`PRAGMA main.table_info(${table})`).all().map((c) => c.name).filter((c) => backupCols.has(c));
        const list = cols.map((c) => `"${c}"`).join(', ');
        db.exec(`INSERT INTO main.${table} (${list}) SELECT ${list} FROM b.${table}`);
      }
    });
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('DETACH DATABASE b');
  }
  return { restored: backup, safety };
}

/** Deletes backup files and rows older than 30 days (keeps the newest successful one no matter what). */
export function pruneBackups(db, dir, now = Date.now()) {
  const cutoff = new Date(now - KEEP_DAYS * DAY_MS).toISOString();
  const newestOk = db.prepare('SELECT id FROM backups WHERE ok = 1 ORDER BY id DESC LIMIT 1').get()?.id;
  const old = db.prepare('SELECT id, file FROM backups WHERE at < ? AND id IS NOT ?').all(cutoff, newestOk ?? null);
  for (const row of old) {
    if (row.file) rmSync(join(dir, row.file), { force: true });
    db.prepare('DELETE FROM backups WHERE id = ?').run(row.id);
  }
  return old.length;
}

/** Daily automatic backup at 03:00 Bangkok time; checks every 10 minutes. Returns a stop function. */
export function scheduleDailyBackup(db, dir, { hour = 3, onRun = () => {} } = {}) {
  const tick = () => {
    const bangkok = new Date(Date.now() + 7 * 3600000);
    const today = bangkok.toISOString().slice(0, 10);
    if (bangkok.getUTCHours() < hour) return;
    const done = db.prepare("SELECT 1 FROM backups WHERE kind = 'auto' AND ok = 1 AND substr(datetime(at, '+7 hours'), 1, 10) = ?").get(today);
    if (done) return;
    onRun(createBackup(db, dir, 'auto'));
    pruneBackups(db, dir);
  };
  const timer = setInterval(tick, 10 * 60 * 1000);
  timer.unref();
  tick();
  return () => clearInterval(timer);
}
