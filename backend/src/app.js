import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { createAdminRouter } from './admin/routes.js';
import { activeAnnouncements } from './admin/announcements.js';
import { attachUser, sessionToken } from './auth/middleware.js';
import { can } from './auth/permissions.js';
import { createAuthRouter } from './auth/routes.js';
import { createContactRouter } from './contact/routes.js';
import { createContentRouter } from './content/routes.js';
import { userForToken } from './auth/sessions.js';
import { DEFAULT_ORIGINS, TELEMETRY_PROTOCOL } from './config/security.js';
import { ConsoleService } from './console/service.js';
import { PUBLIC_SETTINGS, getSettings } from './db/settings.js';
import { errorHandler, sendError } from './http.js';
import { maintenanceGate } from './middleware/maintenance.js';
import { createOriginPolicy } from './middleware/origin.js';
import { MissionRecorder } from './missions/recorder.js';
import { createMissionRouter } from './missions/routes.js';
import { createTelemetryRouter } from './modules/telemetry/routes.js';
import { TelemetryStore } from './modules/telemetry/store.js';
import { createSimRouter } from './sim/routes.js';
import { createSystemRouter } from './system/routes.js';
import { SimRunner } from './sim/runner.js';

const TICK_MS = 500;
const RECHECK_SESSION_MS = 5000;

/**
 * Composition root: builds the HTTP API and the telemetry WebSocket from injected parts
 * so tests can swap the DB, sim runner and world list.
 */
export function createApp({
  db,
  store = new TelemetryStore(),
  runner = new SimRunner({ wsPath: '/nonexistent' }),
  recorder = new MissionRecorder(),
  origins = DEFAULT_ORIGINS,
  listWorlds = () => [],
  envInfo = () => ({}),
  sessionDays = 7,
  backupDir = '/nonexistent/backups',
  wsPath = '/nonexistent',
  contactRateLimit,
}) {
  if (!db) throw new Error('createApp needs a database');
  const service = new ConsoleService({ store, runner, recorder, envInfo });
  const originPolicy = createOriginPolicy(origins);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');

  const api = express.Router();
  api.use((_req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    next();
  });
  api.use(originPolicy.middleware);
  api.use(express.json({ limit: '100kb' }));
  api.use(attachUser(db));

  api.get('/site', (_req, res) => {
    const settings = getSettings(db);
    res.json(Object.fromEntries(PUBLIC_SETTINGS.map((key) => [key, settings[key]])));
  });
  // สถานะสั้นๆ ให้หน้าแรกแสดง “ROS เชื่อมต่อแล้ว · หุ่นออนไลน์ N ตัว” (ไม่มีข้อมูลส่วนตัว)
  api.get('/site/status', (_req, res) => {
    const health = store.health();
    const sim = runner.state();
    res.json({
      ros_connected: health.ros_node_running,
      sim_state: sim.state,
      robots_online: sim.state === 'running' && health.team_state_fresh ? Object.keys(store.teamData.robots ?? {}).length : 0,
    });
  });
  api.get('/announcements/active', (req, res) => res.json({ items: activeAnnouncements(db, req.user) }));
  api.use(createAuthRouter(db, { sessionDays }));
  api.use(maintenanceGate(db));
  api.use(createContentRouter({ db }));
  api.use(createContactRouter({ db, ...(contactRateLimit ? { rateLimit: contactRateLimit } : {}) }));
  api.use(createSystemRouter({ db, store, runner, backupDir, wsPath, listWorlds, envInfo }));
  api.use(createSimRouter({ db, service, listWorlds }));
  api.use(createMissionRouter({ db, recorder }));
  api.use('/telemetry', createTelemetryRouter(store));
  api.use('/admin', createAdminRouter({ db, runner }));
  api.use((_req, res) => sendError(res, 404, 'NOT_FOUND', 'ไม่พบ API นี้'));
  api.use(errorHandler);
  app.use('/api/v1', api);

  const server = createServer(app);
  const sockets = new WebSocketServer({
    noServer: true,
    maxPayload: 1024,
    handleProtocols: (protocols) => (protocols.has(TELEMETRY_PROTOCOL) ? TELEMETRY_PROTOCOL : false),
  });

  const rejectUpgrade = (socket, status, text) => {
    socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  };

  server.on('upgrade', (request, socket, head) => {
    if (request.url !== '/ws/telemetry' || !originPolicy.allows(request.headers.origin)) {
      socket.destroy();
      return;
    }
    const token = sessionToken(request);
    const user = userForToken(db, token);
    if (token && !user) return rejectUpgrade(socket, 401, 'Unauthorized'); // session หมดอายุ/ถูกระงับ
    if (!can(user, 'console.view')) return rejectUpgrade(socket, user ? 403 : 401, user ? 'Forbidden' : 'Unauthorized');
    if (getSettings(db).maintenance && !can(user, 'admin.access')) return rejectUpgrade(socket, 503, 'Service Unavailable');
    return sockets.handleUpgrade(request, socket, head, (client) => {
      client.sessionToken = user ? token : null;
      client.checkedAt = Date.now();
      client.send(JSON.stringify({ type: 'hello', logs: store.logs(200), lines: runner.recentLines(200) }));
      client.send(JSON.stringify(service.snapshot()));
    });
  });

  // ส่งเป็นชุดทุก tick: log ใหม่, บรรทัด Terminal ใหม่, และ snapshot
  let pendingLogs = [];
  let pendingLines = [];
  store.on('log', (item) => pendingLogs.push(item));
  runner.on('line', (line) => pendingLines.push(line));

  const broadcast = () => {
    const now = Date.now();
    const messages = [];
    if (pendingLogs.length) messages.push(JSON.stringify({ type: 'log', items: pendingLogs }));
    if (pendingLines.length) messages.push(JSON.stringify({ type: 'simlog', lines: pendingLines }));
    messages.push(JSON.stringify(service.snapshot()));
    pendingLogs = [];
    pendingLines = [];
    for (const client of sockets.clients) {
      if (client.readyState !== 1) continue;
      if (now - client.checkedAt > RECHECK_SESSION_MS) {
        client.checkedAt = now;
        if (client.sessionToken && !userForToken(db, client.sessionToken)) {
          client.close(4401, 'session ended');
          continue;
        }
      }
      for (const message of messages) client.send(message);
    }
  };
  const timer = setInterval(broadcast, TICK_MS);
  timer.unref();

  return {
    server,
    store,
    runner,
    recorder,
    service,
    broadcast,
    async close() {
      clearInterval(timer);
      for (const client of sockets.clients) client.terminate();
      sockets.close();
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    },
  };
}
