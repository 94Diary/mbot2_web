import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { TelemetryStore } from './store.js';
import { DEFAULT_ORIGINS, TELEMETRY_PROTOCOL } from './config/security.js';
import { createTelemetryAuth } from './middleware/auth.js';
import { createOriginPolicy } from './middleware/origin.js';

export function createApp(store = new TelemetryStore(), allowedOrigins = DEFAULT_ORIGINS, token) {
  const app = express();
  const originPolicy = createOriginPolicy(allowedOrigins);
  const auth = createTelemetryAuth(token);
  app.disable('x-powered-by');

  app.use('/api', (_req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    next();
  }, originPolicy.middleware, auth.requireToken);

  app.get('/api/health', (_req, res) => res.json(store.health()));
  app.get('/api/team', (_req, res) => res.json(store.team()));
  app.get('/api/events', (req, res) => {
    const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
    const afterId = req.query.after_id === undefined ? null : Number(req.query.after_id);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200 ||
        (afterId !== null && (!Number.isInteger(afterId) || afterId < 0))) {
      return res.status(400).json({ error: 'limit must be 1-200 and after_id must be a non-negative integer' });
    }
    return res.json({ items: store.events(limit, afterId) });
  });

  const server = createServer(app);
  const sockets = new WebSocketServer({
    noServer: true,
    maxPayload: 1024,
    handleProtocols: (protocols) => protocols.has(TELEMETRY_PROTOCOL) ? TELEMETRY_PROTOCOL : false,
  });
  server.on('upgrade', (request, socket, head) => {
    const origin = request.headers.origin;
    if (request.url !== '/ws/telemetry' || !originPolicy.allows(origin)) {
      socket.destroy();
      return;
    }
    if (!auth.allowsWebSocket(request)) {
      socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      return;
    }
    sockets.handleUpgrade(request, socket, head, (client) => {
      sockets.emit('connection', client, request);
    });
  });

  const timer = setInterval(() => {
    const payload = JSON.stringify(store.snapshot());
    for (const client of sockets.clients) {
      if (client.readyState === 1) client.send(payload);
    }
  }, 500);
  timer.unref();

  return {
    server,
    store,
    close() {
      clearInterval(timer);
      for (const client of sockets.clients) client.terminate();
      sockets.close();
      return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}
