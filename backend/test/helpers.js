import { createApp } from '../src/app.js';
import { openDb } from '../src/db/index.js';
import { createUser } from '../src/auth/users.js';
import { setSettings } from '../src/db/settings.js';

export const PASSWORD = 'correct-horse-9';
export const ORIGIN = 'http://localhost:5173';

/** Starts a full app on a random port with an in-memory DB and the given fakes. */
export async function startTestApp(options = {}) {
  const db = options.db ?? openDb();
  const app = createApp({ db, ...options });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  return { db, app, base, close: () => app.close() };
}

export async function makeUser(db, name, { role = 'member', isOwner = false } = {}) {
  return createUser(db, { email: `${name}@test.local`, displayName: name, password: PASSWORD, role, isOwner });
}

/** Tiny client that keeps the session cookie and sends the dev Origin on writes. */
export function client(base) {
  let cookie = '';
  async function call(method, path, body) {
    const headers = { Origin: ORIGIN };
    if (cookie) headers.Cookie = cookie;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = response.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: response.status, body: json, headers: response.headers };
  }
  return {
    get: (path) => call('GET', path),
    post: (path, body = {}) => call('POST', path, body),
    patch: (path, body = {}) => call('PATCH', path, body),
    put: (path, body = {}) => call('PUT', path, body),
    del: (path, body) => call('DELETE', path, body),
    cookie: () => cookie,
    async login(email) {
      return call('POST', '/api/v1/auth/login', { email, password: PASSWORD });
    },
  };
}

export async function loggedIn(base, user) {
  const c = client(base);
  const res = await c.login(user.email);
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return c;
}

export { setSettings };
