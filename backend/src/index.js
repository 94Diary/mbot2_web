import { loadEnvFile } from 'node:process';
import { createApp } from './app.js';
import { readConfig } from './config/security.js';
import { gitInfo } from './console/service.js';
import { seedLessons } from './content/seed.js';
import { purgeTrash } from './content/lessons.js';
import { openDb } from './db/index.js';
import { scheduleDailyBackup } from './system/backups.js';
import { startRosBridge } from './modules/telemetry/ros.js';
import { SimRunner } from './sim/runner.js';
import { listWorlds } from './sim/worlds.js';

try {
  loadEnvFile();
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const config = readConfig(process.env);
const db = openDb(config.dbPath);
if (seedLessons(db)) console.log('ใส่โครงบทเรียนเริ่มต้น 13 บท');
purgeTrash(db);
const stopBackups = scheduleDailyBackup(db, config.backupDir, {
  onRun: (b) => console.log(b.ok ? `สำรองข้อมูลอัตโนมัติ: ${b.file}` : `สำรองข้อมูลอัตโนมัติไม่สำเร็จ: ${b.error}`),
});
const ownerCount = db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_owner = 1').get().n;
if (!ownerCount) console.warn('ยังไม่มีเจ้าของระบบ: รัน `npm run create-owner -- --email you@example.com --name "ชื่อ"`');

const app = createApp({
  db,
  origins: config.origins,
  runner: new SimRunner({ wsPath: config.wsPath }),
  listWorlds: () => listWorlds(config.wsPath),
  envInfo: () => gitInfo(config.wsPath),
  sessionDays: config.sessionDays,
  backupDir: config.backupDir,
  wsPath: config.wsPath,
});
app.server.listen(config.port, config.host, () => {
  console.log(`mBot2 Maze Ops backend: http://${config.host}:${config.port} · ros2_ws: ${config.wsPath}`);
});
const stopRos = await startRosBridge(app.store, config.robotNames);

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  console.log('กำลังปิด: หยุดซิมที่รันอยู่ก่อน…');
  stopBackups();
  await app.runner.shutdown();
  stopRos();
  await app.close();
  db.close();
  process.exit(0);
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
