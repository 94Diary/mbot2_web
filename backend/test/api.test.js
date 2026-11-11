import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import WebSocket from 'ws';

const token = 'a'.repeat(64);
const app = createApp(undefined, undefined, token);
const headers = { Authorization: `Bearer ${token}` };
let baseUrl;
before(async () => {
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${app.server.address().port}`;
});
after(() => app.close());

test('HTTP endpoints keep the frontend contract', async () => {
  const health = await fetch(`${baseUrl}/api/health`, { headers }).then((response) => response.json());
  const team = await fetch(`${baseUrl}/api/team`, { headers }).then((response) => response.json());
  const events = await fetch(`${baseUrl}/api/events`, { headers }).then((response) => response.json());
  assert.equal(health.backend, 'ok');
  assert.deepEqual(team.data.robots, {});
  assert.deepEqual(events.items, []);
});

test('invalid event query gets a 400', async () => {
  assert.equal((await fetch(`${baseUrl}/api/events?limit=201`, { headers })).status, 400);
});

test('telemetry rejects absent and wrong HTTP tokens', async () => {
  assert.equal((await fetch(`${baseUrl}/api/team`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/events`, {
    headers: { Authorization: `Bearer ${'b'.repeat(64)}` },
  })).status, 401);
});

test('browser authorization preflight allows only configured origins', async () => {
  const request = (origin) => fetch(`${baseUrl}/api/team`, {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Headers': 'authorization' },
  });
  const allowed = await request('http://localhost:5173');
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-headers'), 'Authorization');
  assert.equal((await request('http://localhost:5174')).status, 403);
});

test('server cannot start without a configured token', () => {
  assert.throws(() => createApp(), /MBOT2_API_TOKEN/);
});

test('websocket authenticates before upgrade and never echoes the token', async () => {
  const url = baseUrl.replace('http:', 'ws:') + '/ws/telemetry';
  const unauthorized = new WebSocket(url);
  await new Promise((resolve, reject) => {
    unauthorized.once('error', reject);
    unauthorized.once('open', () => {
      unauthorized.close();
      reject(new Error('anonymous socket accepted'));
    });
    unauthorized.once('unexpected-response', (_request, response) => {
      response.resume();
      if (response.statusCode === 401) resolve();
      else reject(new Error(`unexpected status ${response.statusCode}`));
    });
  });
  const client = new WebSocket(url, ['mbot2.telemetry.v1', `mbot2.token.${token}`]);
  try {
    await new Promise((resolve, reject) => {
      client.once('open', resolve);
      client.once('error', reject);
    });
    assert.equal(client.protocol, 'mbot2.telemetry.v1');
  } finally {
    client.close();
  }
});
