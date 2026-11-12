import assert from 'node:assert/strict';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { createRateLimiter } from '../src/contact/routes.js';
import { purgeTrash } from '../src/content/lessons.js';
import { seedLessons } from '../src/content/seed.js';
import { createBackup, pruneBackups, RESTORE_TABLES } from '../src/system/backups.js';
import { client, loggedIn, makeUser, setSettings, startTestApp } from './helpers.js';

let t;
let owner;
let admin;
let member;
const backupDir = mkdtempSync(join(tmpdir(), 'mbot2-backups-'));
before(async () => {
  let clock = 0;
  t = await startTestApp({ backupDir, contactRateLimit: createRateLimiter(5, 3600000, () => clock) });
  t.advance = (ms) => { clock += ms; };
  seedLessons(t.db);
  owner = await makeUser(t.db, 'owner2', { role: 'admin', isOwner: true });
  admin = await makeUser(t.db, 'admin2', { role: 'admin' });
  member = await makeUser(t.db, 'member2');
});
after(() => t.close());

// ===== บทเรียน =====
test('seed: 13 lessons once; guests see published only, editors also see drafts', async () => {
  assert.equal(seedLessons(t.db), 0);
  const guest = (await client(t.base).get('/api/v1/lessons')).body;
  assert.equal(guest.items.length, 11);
  assert.ok(guest.items.every((l) => l.status === 'published'));
  assert.deepEqual(guest.completed, []);
  const a = await loggedIn(t.base, admin);
  assert.equal((await a.get('/api/v1/lessons')).body.items.length, 13);
});

test('drafts are 404 for guests and members, readable for editors', async () => {
  assert.equal((await client(t.base).get('/api/v1/lessons/yielding')).status, 404);
  assert.equal((await (await loggedIn(t.base, member)).get('/api/v1/lessons/yielding')).status, 404);
  const draft = (await (await loggedIn(t.base, admin)).get('/api/v1/lessons/yielding')).body;
  assert.equal(draft.status, 'draft');
  assert.match(draft.body, /## เมื่อไหร่ถือว่าสวนทาง/);
});

test('members-only lesson: 401 for guests, listed as locked, readable after login', async () => {
  const a = await loggedIn(t.base, admin);
  const id = (await a.get('/api/v1/lessons')).body.items.find((l) => l.slug === 'sensors').id;
  assert.equal((await a.patch(`/api/v1/admin/lessons/${id}`, { audience: 'members' })).status, 200);
  assert.equal((await client(t.base).get('/api/v1/lessons/sensors')).status, 401);
  assert.equal((await client(t.base).get('/api/v1/lessons')).body.items.find((l) => l.slug === 'sensors').locked, true);
  assert.equal((await (await loggedIn(t.base, member)).get('/api/v1/lessons/sensors')).status, 200);
  await a.patch(`/api/v1/admin/lessons/${id}`, { audience: 'all' });
});

test('reader gives prev/next, records one view per day and member progress', async () => {
  const m = await loggedIn(t.base, member);
  const lesson = (await m.get('/api/v1/lessons/install-ros2')).body;
  assert.equal(lesson.prev.slug, 'install-wsl');
  assert.equal(lesson.next.slug, 'first-build');
  assert.equal(lesson.completed, false);
  await m.get('/api/v1/lessons/install-ros2');
  assert.equal(t.db.prepare('SELECT COUNT(*) AS n FROM lesson_views WHERE lesson_id = ?').get(lesson.id).n, 1);
  assert.equal((await m.post(`/api/v1/lessons/${lesson.id}/progress`)).status, 204);
  assert.deepEqual((await m.get('/api/v1/lessons')).body.completed, [lesson.id]);
  assert.equal((await m.del(`/api/v1/lessons/${lesson.id}/progress`)).status, 204);
  assert.equal((await client(t.base).post(`/api/v1/lessons/${lesson.id}/progress`)).status, 401);
});

test('admin lesson CRUD: validation, unique slug, publish audit, trash and restore', async () => {
  const m = await loggedIn(t.base, member);
  assert.equal((await m.get('/api/v1/admin/lessons')).status, 403);
  assert.equal((await m.post('/api/v1/admin/lessons', { title: 'x', slug: 'x' })).status, 403);
  const a = await loggedIn(t.base, admin);
  const bad = await a.post('/api/v1/admin/lessons', { title: '', slug: 'Bad Slug', summary: 'x'.repeat(81) });
  assert.equal(bad.status, 400);
  assert.deepEqual(Object.keys(bad.body.error.fields).sort(), ['slug', 'summary', 'title']);
  assert.equal((await a.post('/api/v1/admin/lessons', { title: 'ซ้ำ', slug: 'intro' })).body.error.fields.slug, 'slug นี้มีบทเรียนอื่นใช้แล้ว');
  const created = (await a.post('/api/v1/admin/lessons', { title: 'บทใหม่', slug: 'new-lesson', body: '## หัวข้อ' })).body;
  assert.equal(created.status, 'draft');
  assert.equal(created.ord, 14);
  await a.patch(`/api/v1/admin/lessons/${created.id}`, { body: 'ร่างอัตโนมัติ', autosave: true });
  assert.equal(t.db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'lesson.update' AND target_id = ?").get(String(created.id)).n, 0);
  assert.equal((await a.patch(`/api/v1/admin/lessons/${created.id}`, { status: 'published' })).body.status, 'published');
  assert.ok(t.db.prepare("SELECT 1 FROM audit_log WHERE action = 'lesson.publish'").get());
  assert.equal((await client(t.base).get('/api/v1/lessons/new-lesson')).status, 200);
  assert.equal((await a.del(`/api/v1/admin/lessons/${created.id}`)).status, 204);
  assert.equal((await client(t.base).get('/api/v1/lessons/new-lesson')).status, 404);
  assert.equal((await a.get('/api/v1/admin/lessons?trash=1')).body.items.length, 1);
  assert.equal((await a.patch(`/api/v1/admin/lessons/${created.id}`, { title: 'x' })).body.error.code, 'IN_TRASH');
  assert.equal((await a.post(`/api/v1/admin/lessons/${created.id}/restore`)).status, 200);
  assert.equal((await client(t.base).get('/api/v1/lessons/new-lesson')).status, 200);
  await a.del(`/api/v1/admin/lessons/${created.id}`);
  t.db.prepare("UPDATE lessons SET deleted_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").run(created.id);
  assert.equal(purgeTrash(t.db), 1);
  assert.equal(t.db.prepare('SELECT COUNT(*) AS n FROM lessons WHERE id = ?').get(created.id).n, 0);
});

// ===== ค้นหา =====
test('search finds published lessons, pages and FAQ, never drafts', async () => {
  const items = (await client(t.base).get(`/api/v1/search?q=${encodeURIComponent('ROS')}`)).body.items;
  assert.ok(items.some((i) => i.kind === 'lesson' && i.href === '/lessons/install-ros2'));
  assert.ok(items.some((i) => i.kind === 'help'));
  const draft = (await client(t.base).get(`/api/v1/search?q=${encodeURIComponent('หลบกัน')}`)).body.items;
  assert.ok(!draft.some((i) => i.href === '/lessons/yielding'));
  assert.deepEqual((await client(t.base).get('/api/v1/search?q=')).body.items, []);
  assert.equal((await client(t.base).get(`/api/v1/search?q=${'a'.repeat(101)}`)).status, 400);
});

// ===== ติดต่อ / คุกกี้ / สถานะสาธารณะ =====
test('contact form validates, ignores bots, rate-limits per IP, and reaches the admin inbox', async () => {
  const c = client(t.base);
  const bad = await c.post('/api/v1/contact', { name: '', email: 'x', topic: 'nope', message: 'สั้น' });
  assert.deepEqual(Object.keys(bad.body.error.fields).sort(), ['email', 'human', 'message', 'name', 'topic']);
  const ok = { name: 'Nan', email: 'nan@mail.com', topic: 'ถามเรื่องบทเรียน', message: 'อยากถามเรื่องบทที่ 3 ครับ', human: true };
  assert.equal((await c.post('/api/v1/contact', { ...ok, website: 'spam.example' })).status, 201);
  assert.equal(t.db.prepare('SELECT COUNT(*) AS n FROM contact_messages').get().n, 0);
  for (let i = 0; i < 5; i += 1) assert.equal((await c.post('/api/v1/contact', ok)).status, 201);
  assert.equal((await c.post('/api/v1/contact', ok)).status, 429);
  t.advance(3600001);
  assert.equal((await c.post('/api/v1/contact', ok)).status, 201);

  assert.equal((await (await loggedIn(t.base, member)).get('/api/v1/admin/messages')).status, 403);
  const a = await loggedIn(t.base, admin);
  const inbox = (await a.get('/api/v1/admin/messages')).body;
  assert.equal(inbox.total, 6);
  assert.equal(inbox.unread, 6);
  const id = inbox.items[0].id;
  assert.equal((await a.patch(`/api/v1/admin/messages/${id}`, { status: 'done' })).body.handled_by, admin.id);
  assert.equal((await a.get('/api/v1/admin/messages?status=new')).body.total, 5);
  assert.equal((await a.del(`/api/v1/admin/messages/${id}`)).status, 204);
  const d = (await a.get('/api/v1/admin/dashboard')).body;
  assert.ok(d.todo.some((x) => x.kind === 'messages'));
  assert.ok('lesson_readers' in d.kpi);
});

test('consent is recorded with the policy version; bad shapes are rejected', async () => {
  const c = client(t.base);
  assert.equal((await c.post('/api/v1/consent', { choices: { prefs: 'yes' } })).status, 400);
  const res = await c.post('/api/v1/consent', { choices: { prefs: true, analytics: false } });
  assert.equal(res.status, 201);
  assert.deepEqual(res.body.choices, { necessary: true, prefs: true, analytics: false });
  const again = await c.post('/api/v1/consent', { anon_id: res.body.anon_id, choices: { prefs: false, analytics: false } });
  assert.equal(again.body.anon_id, res.body.anon_id);
  assert.equal(t.db.prepare('SELECT COUNT(*) AS n FROM consent_records WHERE anon_id = ?').get(res.body.anon_id).n, 2);
});

test('public site settings and status expose only safe fields', async () => {
  setSettings(t.db, { contact_line: '@mbot2team' });
  const site = (await client(t.base).get('/api/v1/site')).body;
  assert.equal(site.contact_line, '@mbot2team');
  assert.equal(site.log_retention_days, undefined);
  assert.deepEqual(Object.keys((await client(t.base).get('/api/v1/site/status')).body).sort(), ['robots_online', 'ros_connected', 'sim_state']);
});

// ===== ระบบ / เครื่อง / สำรองข้อมูล =====
test('system and machine pages need the right permissions', async () => {
  const m = await loggedIn(t.base, member);
  for (const p of ['system', 'machine', 'backups']) assert.equal((await m.get(`/api/v1/admin/${p}`)).status, 403);
  const a = await loggedIn(t.base, admin);
  const sys = (await a.get('/api/v1/admin/system')).body;
  assert.equal(sys.database.ok, true);
  assert.ok(sys.database.size_bytes > 0);
  const machine = (await a.get('/api/v1/admin/machine')).body;
  assert.equal(machine.commands.length, 3);
  assert.match(machine.commands[0].argv, /^colcon build/);
});

test('backup, test-restore, and owner-only restore that keeps the audit log', async () => {
  const a = await loggedIn(t.base, admin);
  const made = await a.post('/api/v1/admin/backups');
  assert.equal(made.status, 201);
  assert.ok(existsSync(join(backupDir, made.body.file)));
  const test1 = (await a.post(`/api/v1/admin/backups/${made.body.id}/test-restore`)).body;
  assert.equal(test1.ok, true);
  assert.ok(test1.lessons >= 13);

  // หลังสำรอง: เปลี่ยนข้อมูล แล้วกู้กลับ
  setSettings(t.db, { title: 'ชื่อหลังสำรอง' });
  const auditBefore = t.db.prepare('SELECT COUNT(*) AS n FROM audit_log').get().n;
  assert.equal((await a.post(`/api/v1/admin/backups/${made.body.id}/restore`, { confirm: 'กู้คืน' })).status, 403);
  const o = await loggedIn(t.base, owner);
  assert.equal((await o.post(`/api/v1/admin/backups/${made.body.id}/restore`, { confirm: 'ใช่' })).status, 400);
  const restored = await o.post(`/api/v1/admin/backups/${made.body.id}/restore`, { confirm: 'กู้คืน' });
  assert.equal(restored.status, 200);
  assert.equal(restored.body.safety.kind, 'pre-restore');
  assert.notEqual((await client(t.base).get('/api/v1/site')).body.title, 'ชื่อหลังสำรอง');
  assert.ok(t.db.prepare('SELECT COUNT(*) AS n FROM audit_log').get().n > auditBefore, 'audit log kept and grew');
  assert.ok(t.db.prepare("SELECT 1 FROM audit_log WHERE action = 'backup.restore'").get());
  assert.equal((await o.get('/api/v1/me')).body.user.id, owner.id, 'restorer stays logged in');
  assert.ok(!RESTORE_TABLES.includes('audit_log'));
});

test('old backups are pruned but the newest good one is always kept', () => {
  const newest = createBackup(t.db, backupDir, 'auto');
  t.db.prepare("UPDATE backups SET at = '2000-01-01T00:00:00.000Z'").run();
  assert.ok(pruneBackups(t.db, backupDir) >= 1);
  assert.deepEqual(t.db.prepare('SELECT id FROM backups').all().map((r) => r.id), [newest.id]);
  assert.ok(existsSync(join(backupDir, newest.file)));
});
