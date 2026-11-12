import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { permissionsFor } from '../src/auth/permissions.js';
import { client, loggedIn, makeUser, setSettings, startTestApp } from './helpers.js';

let t;
before(async () => { t = await startTestApp(); });
after(() => t.close());

test('login sets an HttpOnly session cookie; wrong password is 401', async () => {
  const user = await makeUser(t.db, 'ann');
  const c = client(t.base);
  const bad = await c.post('/api/v1/auth/login', { email: user.email, password: 'nope-nope' });
  assert.equal(bad.status, 401);
  assert.equal(bad.body.error.code, 'BAD_CREDENTIALS');
  const ok = await c.login(user.email);
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('set-cookie'), /^sid=.+HttpOnly; SameSite=Lax/);
  assert.equal(ok.body.user.email, 'ann@test.local');
  assert.equal(ok.body.user.password_hash, undefined);
  assert.ok(ok.body.permissions.includes('console.use'));
});

test('/me without a session is a guest', async () => {
  const res = await client(t.base).get('/api/v1/me');
  assert.deepEqual(res.body, { user: null, permissions: ['console.view', 'console.stop'] });
});

test('logout revokes the session', async () => {
  const user = await makeUser(t.db, 'bob');
  const c = await loggedIn(t.base, user);
  const cookie = c.cookie();
  await c.post('/api/v1/auth/logout');
  const res = await fetch(`${t.base}/api/v1/me`, { headers: { Cookie: cookie } }).then((r) => r.json());
  assert.equal(res.user, null);
});

test('register follows the registration mode', async () => {
  const body = { display_name: 'Cee', email: 'cee@test.local', password: 'longenough1' };
  setSettings(t.db, { registration: 'closed' });
  assert.equal((await client(t.base).post('/api/v1/auth/register', body)).body.error.code, 'REGISTRATION_CLOSED');
  setSettings(t.db, { registration: 'invite' });
  const noInvite = await client(t.base).post('/api/v1/auth/register', { ...body, invite: 'WRONG' });
  assert.equal(noInvite.status, 400);
  assert.ok(noInvite.body.error.fields.invite);
  setSettings(t.db, { registration: 'open' });
  const ok = await client(t.base).post('/api/v1/auth/register', body);
  assert.equal(ok.status, 201);
  assert.equal(ok.body.user.role, 'member');
  const dup = await client(t.base).post('/api/v1/auth/register', body);
  assert.equal(dup.status, 400);
  const weak = await client(t.base).post('/api/v1/auth/register', { ...body, email: 'd@test.local', password: 'short' });
  assert.ok(weak.body.error.fields.password);
});

test('invite code registers with the invite role once', async () => {
  setSettings(t.db, { registration: 'invite' });
  t.db.prepare(`INSERT INTO invites (code, role, created_by, created_at, expires_at)
    VALUES ('JOIN-1', 'member', 'x', '2026-01-01', '2999-01-01')`).run();
  const body = { display_name: 'Dee', email: 'dee@test.local', password: 'longenough1', invite: 'JOIN-1' };
  assert.equal((await client(t.base).post('/api/v1/auth/register', body)).status, 201);
  const again = await client(t.base).post('/api/v1/auth/register', { ...body, email: 'dee2@test.local' });
  assert.equal(again.status, 400);
});

test('suspended user cannot log in and gets the reason', async () => {
  const user = await makeUser(t.db, 'sus');
  t.db.prepare("UPDATE users SET status = 'suspended' WHERE id = ?").run(user.id);
  t.db.prepare(`INSERT INTO suspensions (user_id, kind, reason_code, message_to_user, until, created_by, created_at)
    VALUES (?, 'suspend', 'spam', 'พักก่อนนะ', '2999-01-01T00:00:00.000Z', 'x', '2026-01-01')`).run(user.id);
  const res = await client(t.base).login(user.email);
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'SUSPENDED');
  assert.equal(res.body.error.reason, 'spam');
  assert.equal(res.body.error.message_to_user, 'พักก่อนนะ');
});

test('expired suspension lifts itself at login', async () => {
  const user = await makeUser(t.db, 'back');
  t.db.prepare("UPDATE users SET status = 'suspended' WHERE id = ?").run(user.id);
  t.db.prepare(`INSERT INTO suspensions (user_id, kind, reason_code, until, created_by, created_at)
    VALUES (?, 'suspend', 'spam', '2000-01-01T00:00:00.000Z', 'x', '2000-01-01')`).run(user.id);
  assert.equal((await client(t.base).login(user.email)).status, 200);
});

test('change password keeps this session and revokes others', async () => {
  const user = await makeUser(t.db, 'pw');
  const a = await loggedIn(t.base, user);
  const b = await loggedIn(t.base, user);
  const res = await a.post('/api/v1/me/password', { current: 'correct-horse-9', next: 'brand-new-pass' });
  assert.equal(res.status, 204);
  assert.ok((await a.get('/api/v1/me')).body.user);
  assert.equal((await b.get('/api/v1/me')).body.user, null);
});

test('permission table matches roles-permissions.md', () => {
  assert.ok(!permissionsFor({ role: 'member' }).includes('admin.access'));
  assert.ok(permissionsFor({ role: 'admin' }).includes('audit.view'));
  assert.ok(!permissionsFor({ role: 'admin' }).includes('users.role'));
  assert.ok(permissionsFor({ role: 'admin', is_owner: 1 }).includes('users.role'));
  assert.deepEqual(permissionsFor(null), ['console.view', 'console.stop']);
});
