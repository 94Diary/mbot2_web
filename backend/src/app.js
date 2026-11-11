import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { TelemetryStore } from './modules/telemetry/store.js';
import { createTelemetryRouter } from './modules/telemetry/routes.js';
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
  }, originPolicy.middleware, auth.requireToken, createTelemetryRouter(store));

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
