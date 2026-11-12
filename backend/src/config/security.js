import { homedir } from 'node:os';
import { join } from 'node:path';

export const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
export const TELEMETRY_PROTOCOL = 'mbot2.telemetry.v1';

export function readConfig(env) {
  const host = env.HOST || '127.0.0.1';
  if (!['127.0.0.1', '::1', 'localhost'].includes(host)) {
    throw new Error('HOST must be a loopback address for this local backend.');
  }
  const origins = env.MBOT2_CORS_ORIGINS === undefined
    ? DEFAULT_ORIGINS
    : env.MBOT2_CORS_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean);
  const sessionDays = Number(env.MBOT2_SESSION_DAYS || 7);
  if (!Number.isInteger(sessionDays) || sessionDays < 1 || sessionDays > 90) {
    throw new Error('MBOT2_SESSION_DAYS must be an integer from 1 to 90.');
  }
  return {
    host,
    port: Number(env.PORT || 8000),
    origins,
    dbPath: env.MBOT2_DB_PATH || join(process.cwd(), 'data', 'mbot2.db'),
    backupDir: env.MBOT2_BACKUP_DIR || join(process.cwd(), 'backups'),
    wsPath: env.MBOT2_WS_PATH || join(homedir(), 'ros2_ws'),
    sessionDays,
    robotNames: (env.MBOT2_ROBOTS || 'mbot1,mbot2,mbot3').split(',').map((name) => name.trim()).filter(Boolean),
  };
}
