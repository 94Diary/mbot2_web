import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { changeRole, deleteUser } from '../src/admin/users.js';
import { client, loggedIn, makeUser, startTestApp } from './helpers.js';

let t;
let owner;
let admin;
let admin2;
let member;
before(async () => {
  t = await startTestApp();
  owner = await makeUser(t.db, 'owner', { role: 'admin', isOwner: true });
  admin = await makeUser(t.db, 'admin', { role: 'admin' });
  admin2 = await makeUser(t.db, 'admin2', { role: 'admin' });
  member = await makeUser(t.db, 'member');
});
after(() => t.close());

const ADMIN_GETS = ['dashboard', 'users', 'roles', 'missions', 'announcements', 'settings', 'audit', 'invites', 'audit/export.csv'];

test('members get 403 and guests 401 on every admin endpoint', async () => {
  const m = await loggedIn(t.base, member);
  for (const path of ADMIN_GETS) {
    assert.equal((await m.get(`/api/v1/admin/${path}`)).status, 403, path);
    assert.equal((await client(t.base).get(`/api/v1/admin/${path}`)).status, 401, path);
  }
  assert.equal((await m.post(`/api/v1/admin/users/${member.id}/suspend`, {})).status, 403);
  assert.equal((await m.patch('/api/v1/admin/settings', { maintenance: true })).status, 403);
});

test('admin suspends a member: audit written and their sessions revoked', async () => {
  const victim = await makeUser(t.db, 'victim');
  const v = await loggedIn(t.base, victim);
  const a = await loggedIn(t.base, admin);
  const bad = await a.post(`/api/v1/admin/users/${victim.id}/suspend`, { kind: 'suspend', reason_code: 'nope' });
  assert.equal(bad.status, 400);
  const res = await a.post(`/api/v1/admin/users/${victim.id}/suspend`, {
    kind: 'suspend', reason_code: 'spam', days: 7, message: 'พัก 7 วัน', note: 'ภายใน',
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'suspended');
  assert.equal((await v.get('/api/v1/me')).body.user, null);
  const audit = (await a.get('/api/v1/admin/audit?action=user.suspend')).body.items[0];
  assert.equal(audit.actor_name, 'admin');
  assert.equal(audit.after.status, 'suspended');
  const lift = await a.post(`/api/v1/admin/users/${victim.id}/unsuspend`, {});
  assert.equal(lift.status, 400);
  assert.equal((await a.post(`/api/v1/admin/users/${victim.id}/unsuspend`, { reason: 'อุทธรณ์ผ่าน' })).body.status, 'active');
});

test('admin cannot manage other admins or themselves', async () => {
  const a = await loggedIn(t.base, admin);
  const body = { kind: 'ban', reason_code: 'spam' };
  assert.equal((await a.post(`/api/v1/admin/users/${admin2.id}/suspend`, body)).status, 403);
  const self = await a.post(`/api/v1/admin/users/${admin.id}/suspend`, body);
  assert.equal(self.status, 409);
  assert.equal(self.body.error.code, 'SELF');
  assert.equal((await a.post(`/api/v1/admin/users/${member.id}/role`, { role: 'admin', is_owner: false })).status, 403);
});

test('owner changes roles and can hand ownership to another admin', async () => {
  const o = await loggedIn(t.base, owner);
  assert.equal((await o.post(`/api/v1/admin/users/${member.id}/role`, { role: 'admin', is_owner: false })).body.role, 'admin');
  assert.equal((await o.post(`/api/v1/admin/users/${member.id}/role`, { role: 'member', is_owner: false })).body.role, 'member');
  assert.equal((await o.post(`/api/v1/admin/users/${member.id}/role`, { role: 'member', is_owner: true })).status, 400);
  const self = await o.post(`/api/v1/admin/users/${owner.id}/role`, { role: 'member', is_owner: false });
  assert.equal(self.body.error.code, 'SELF');
  assert.equal((await o.post(`/api/v1/admin/users/${admin2.id}/role`, { role: 'admin', is_owner: true })).body.is_owner, true);
  const o2 = await loggedIn(t.base, admin2);
  assert.equal((await o2.post(`/api/v1/admin/users/${owner.id}/role`, { role: 'admin', is_owner: true })).status, 200);
  assert.equal((await o.post(`/api/v1/admin/users/${admin2.id}/role`, { role: 'admin', is_owner: false })).body.is_owner, false);
});

test('LAST_OWNER guard in the service layer', () => {
  const sole = t.db.prepare('SELECT * FROM users WHERE id = ?').get(owner.id);
  t.db.prepare('UPDATE users SET is_owner = 0 WHERE id != ?').run(sole.id);
  const actor = { id: 'someone-else', role: 'admin', is_owner: 1 };
  assert.throws(() => changeRole(t.db, actor, sole.id, { role: 'admin', is_owner: false }),
    (error) => error.status === 409 && error.code === 'LAST_OWNER');
  assert.throws(() => deleteUser(t.db, actor, sole.id, sole.display_name), (error) => error.code === 'LAST_OWNER');
});

test('announcements: CRUD and active filtering by audience', async () => {
  const a = await loggedIn(t.base, admin);
  const bad = await a.post('/api/v1/admin/announcements', { text: '' });
  assert.equal(bad.status, 400);
  const created = await a.post('/api/v1/admin/announcements', { text: 'ปิดเซิร์ฟเวอร์คืนนี้', level: 'warn', audience: 'members' });
  assert.equal(created.status, 201);
  assert.equal((await client(t.base).get('/api/v1/announcements/active')).body.items.length, 0);
  const m = await loggedIn(t.base, await makeUser(t.db, 'reader'));
  assert.equal((await m.get('/api/v1/announcements/active')).body.items[0].text, 'ปิดเซิร์ฟเวอร์คืนนี้');
  await a.patch(`/api/v1/admin/announcements/${created.body.id}`, { enabled: false });
  assert.equal((await m.get('/api/v1/announcements/active')).body.items.length, 0);
  assert.equal((await a.del(`/api/v1/admin/announcements/${created.body.id}`)).status, 204);
});

test('settings validate, audit, and invites register members', async () => {
  const a = await loggedIn(t.base, admin);
  assert.equal((await a.patch('/api/v1/admin/settings', { registration: 'maybe' })).status, 400);
  assert.equal((await a.patch('/api/v1/admin/settings', { title: 'Maze Lab', registration: 'invite' })).body.title, 'Maze Lab');
  assert.equal((await client(t.base).get('/api/v1/site')).body.title, 'Maze Lab');
  assert.equal((await a.post('/api/v1/admin/invites', { role: 'admin' })).status, 403);
  const invite = (await a.post('/api/v1/admin/invites', {})).body;
  const reg = await client(t.base).post('/api/v1/auth/register', {
    display_name: 'New', email: 'new@test.local', password: 'longenough1', invite: invite.code,
  });
  assert.equal(reg.status, 201);
  const bytes = Buffer.from(await fetch(`${t.base}/api/v1/admin/audit/export.csv`, { headers: { Cookie: a.cookie() } })
    .then((r) => r.arrayBuffer()));
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]); // BOM ให้ Excel อ่านภาษาไทยถูก
  const csv = bytes.subarray(3).toString('utf8');
  assert.match(csv, /^id,at,actor,action/);
  assert.match(csv, /settings\.update/);
});

test('dashboard has KPIs, per-day series and a todo box', async () => {
  const a = await loggedIn(t.base, admin);
  assert.equal((await a.get('/api/v1/admin/dashboard?range=1y')).status, 400);
  const d = (await a.get('/api/v1/admin/dashboard?range=7d')).body;
  assert.ok(d.kpi.users >= 4);
  assert.equal(d.per_day.length, 7);
  assert.ok(Array.isArray(d.todo));
  assert.ok(Array.isArray(d.online) && Array.isArray(d.lesson_completion));
  assert.equal(typeof d.funnel.sim_starts, 'number');
  const roles = (await a.get('/api/v1/admin/roles')).body;
  assert.deepEqual(roles.roles.map((r) => r.key), ['guest', 'member', 'admin', 'owner']);
});

test('users list filters and pages', async () => {
  const a = await loggedIn(t.base, admin);
  assert.equal((await a.get('/api/v1/admin/users?page_size=7')).status, 400);
  assert.equal((await a.get('/api/v1/admin/users?role=wizard')).status, 400);
  const admins = (await a.get('/api/v1/admin/users?role=admin')).body;
  assert.ok(admins.items.every((u) => u.role === 'admin' && !u.is_owner));
  assert.ok((await a.get('/api/v1/admin/users?q=victim')).body.items.length >= 1);
});

test('activity groups audit entries into categories with facets and a failed filter', async () => {
  const a = await loggedIn(t.base, admin);
  await client(t.base).post('/api/v1/auth/login', { email: 'nobody@test.local', password: 'wrong-password' });
  const all = (await a.get('/api/v1/admin/activity?range=all')).body;
  assert.ok(all.total > 0);
  assert.ok(all.facets.categories.find((c) => c.key === 'users').n > 0);
  assert.ok(all.facets.failed >= 1);
  const failed = (await a.get('/api/v1/admin/activity?range=all&failed=1')).body;
  assert.ok(failed.items.every((i) => !i.ok && i.category === 'account'));
  assert.equal((await a.get('/api/v1/admin/activity?range=1y')).status, 400);
  const m = await loggedIn(t.base, member);
  assert.equal((await m.get('/api/v1/admin/activity')).status, 403);
});
