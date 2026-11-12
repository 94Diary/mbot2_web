// สร้างเจ้าของระบบคนแรก: npm run create-owner -- --email a@b.c --name "ชื่อ"
// รหัสผ่านอ่านจาก stdin (ไม่ใส่ใน argument เพื่อไม่ให้ค้างใน shell history)
import { loadEnvFile } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { MIN_PASSWORD_LENGTH } from '../src/auth/passwords.js';
import { EMAIL_RE, createUser, findUserByEmail } from '../src/auth/users.js';
import { readConfig } from '../src/config/security.js';
import { writeAudit } from '../src/db/audit.js';
import { openDb } from '../src/db/index.js';

try { loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }

const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' } } });
if (!values.email || !EMAIL_RE.test(values.email) || !values.name) {
  console.error('ใช้: npm run create-owner -- --email you@example.com --name "ชื่อที่แสดง"');
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
const password = (await rl.question(`รหัสผ่าน (อย่างน้อย ${MIN_PASSWORD_LENGTH} ตัว): `)).trim();
rl.close();
if (password.length < MIN_PASSWORD_LENGTH) {
  console.error('รหัสผ่านสั้นเกินไป');
  process.exit(1);
}

const db = openDb(readConfig(process.env).dbPath);
if (findUserByEmail(db, values.email)) {
  console.error('อีเมลนี้มีบัญชีอยู่แล้ว');
  process.exit(1);
}
const user = await createUser(db, { email: values.email, displayName: values.name, password, role: 'admin', isOwner: true });
writeAudit(db, { action: 'user.create_owner', targetType: 'user', targetId: user.id, summary: `สร้างเจ้าของระบบ ${user.display_name} จาก CLI` });
console.log(`สร้างเจ้าของระบบแล้ว: ${user.email}`);
db.close();
