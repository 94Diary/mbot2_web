import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDb, readPage } from '../src/db/index.js';
import { getSettings, setSettings, validateSettings } from '../src/db/settings.js';
import { writeAudit } from '../src/db/audit.js';

test('settings start with defaults and persist patches', () => {
  const db = openDb();
  const defaults = getSettings(db);
  assert.equal(defaults.title, 'mBot2 Maze Ops');
  assert.equal(defaults.registration, 'invite');
  assert.equal(defaults.maintenance, false);
  assert.equal(defaults.noindex, true);
  assert.equal(validateSettings({ contact_email: 'bad' }).contact_email, 'ค่าไม่ถูกต้อง');
  assert.equal(validateSettings({ log_retention_days: 10 }).log_retention_days, 'ค่าไม่ถูกต้อง');
  assert.equal(validateSettings({ contact_email: '', log_retention_days: 365 }), null);
  setSettings(db, { maintenance: true, registration: 'open' });
  assert.equal(getSettings(db).maintenance, true);
  assert.equal(getSettings(db).registration, 'open');
  assert.deepEqual(validateSettings({ registration: 'maybe', nope: 1 }), { registration: 'ค่าไม่ถูกต้อง', nope: 'ไม่รู้จักค่านี้' });
});

test('audit log is append-only and never stores secrets', () => {
  const db = openDb();
  writeAudit(db, { action: 'user.create', summary: 'x', after: { email: 'a@b.c', password_hash: 'h' } });
  assert.deepEqual(JSON.parse(db.prepare('SELECT after FROM audit_log').get().after), { email: 'a@b.c' });
  assert.throws(() => db.exec("UPDATE audit_log SET summary = 'y'"), /append-only/);
  assert.throws(() => db.exec('DELETE FROM audit_log'), /append-only/);
});

test('pager accepts only 10/20/30/50 per page', () => {
  assert.deepEqual(readPage({}), { page: 1, pageSize: 10, offset: 0 });
  assert.deepEqual(readPage({ page: '3', page_size: '20' }), { page: 3, pageSize: 20, offset: 40 });
  assert.equal(readPage({ page_size: '15' }), null);
  assert.equal(readPage({ page: '0' }), null);
});
