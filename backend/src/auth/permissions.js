// ตารางสิทธิ์จาก docs/roles-permissions.md · guest = ไม่ได้ล็อกอิน
// ผู้เยี่ยมชมดูคอนโซลสดและกดหยุดทุกตัวได้เพื่อความปลอดภัย (docs/roles-permissions.md + ดีไซน์)
// แต่เริ่มซิม บันทึก และทิ้งผลต้องเข้าสู่ระบบ (console.use)
const GUEST = ['console.view', 'console.stop'];
const MEMBER = ['console.view', 'console.stop', 'console.use', 'history.own'];
const ADMIN = [
  ...MEMBER, 'admin.access', 'dash.view', 'content.edit', 'content.delete', 'announce.edit',
  'users.view', 'users.edit', 'data.view', 'data.delete', 'settings.edit', 'backup.run', 'audit.view',
];
const OWNER = [...ADMIN, 'users.admins', 'users.role', 'security.edit', 'backup.restore', 'agent.release'];

export const ROLE_PERMISSIONS = Object.freeze({ guest: GUEST, member: MEMBER, admin: ADMIN, owner: OWNER });

export const PERMISSION_LABELS = Object.freeze({
  'console.view': 'ใช้คอนโซลกับหุ่นในเครื่อง',
  'console.stop': 'กดหยุดทุกตัว',
  'console.use': 'บันทึกภารกิจขึ้นเว็บ',
  'history.own': 'ดูประวัติของตัวเอง',
  'admin.access': 'เข้าหลังบ้าน',
  'dash.view': 'Dashboard และสถานะระบบ',
  'content.edit': 'สร้าง แก้ เผยแพร่บทเรียน',
  'content.delete': 'ลบบทเรียน',
  'announce.edit': 'จัดการประกาศ',
  'users.view': 'ดูรายชื่อผู้ใช้',
  'users.edit': 'เชิญ แก้ ระงับ แบน (เฉพาะสมาชิก)',
  'users.admins': 'ระงับ แบน ลบผู้ดูแลคนอื่น',
  'users.role': 'เปลี่ยนบทบาท ตั้ง/ถอดผู้ดูแล',
  'data.view': 'ดูภารกิจของทุกคน',
  'data.delete': 'ลบหรือส่งออกข้อมูล',
  'settings.edit': 'ตั้งค่าเว็บ',
  'backup.run': 'สำรองข้อมูล',
  'audit.view': 'ดู Audit log',
  'security.edit': 'ตั้งค่าความปลอดภัย',
  'backup.restore': 'กู้คืนข้อมูล',
  'agent.release': 'จัดการเวอร์ชันตัวเชื่อม',
});

export function roleKey(user) {
  if (!user) return 'guest';
  if (user.role === 'admin') return user.is_owner ? 'owner' : 'admin';
  return 'member';
}

export function permissionsFor(user) {
  return [...ROLE_PERMISSIONS[roleKey(user)]];
}

export function can(user, key) {
  return ROLE_PERMISSIONS[roleKey(user)].includes(key);
}
