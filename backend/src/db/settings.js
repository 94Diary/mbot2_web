export const DEFAULT_SETTINGS = Object.freeze({
  title: 'mBot2 Maze Ops',
  tagline: 'ฝูงหุ่น mBot2 สำรวจเขาวงกตเป็นทีม',
  registration: 'invite',
  maintenance: false,
  description: 'ศูนย์ควบคุมและห้องเรียนของโปรเจกต์ฝูงหุ่น mBot2 สำรวจเขาวงกต',
  noindex: true,
  contact_email: 'team@mbot2.local',
  contact_line: '',
  contact_phone: '',
  contact_github: '',
  log_retention_days: 365,
  consent_retention_days: 365,
});

const days = (v) => Number.isInteger(v) && v >= 30 && v <= 3650;
const optionalText = (max) => (v) => typeof v === 'string' && v.length <= max;

const VALIDATORS = {
  title: (v) => typeof v === 'string' && v.trim().length >= 1 && v.length <= 60,
  tagline: (v) => typeof v === 'string' && v.length <= 140,
  registration: (v) => ['open', 'invite', 'closed'].includes(v),
  maintenance: (v) => typeof v === 'boolean',
  description: optionalText(200),
  noindex: (v) => typeof v === 'boolean',
  contact_email: (v) => v === '' || (typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 120),
  contact_line: optionalText(60),
  contact_phone: optionalText(30),
  contact_github: optionalText(120),
  log_retention_days: days,
  consent_retention_days: days,
};

/** Keys anyone may read through GET /site. */
export const PUBLIC_SETTINGS = ['title', 'tagline', 'registration', 'maintenance', 'description', 'noindex',
  'contact_email', 'contact_line', 'contact_phone', 'contact_github'];

export function getSettings(db) {
  const rows = db.prepare('SELECT key, value FROM site_settings').all();
  const stored = Object.fromEntries(rows.map((row) => [row.key, JSON.parse(row.value)]));
  return { ...DEFAULT_SETTINGS, ...stored };
}

/** Returns field errors, or null when the patch is valid. */
export function validateSettings(patch) {
  const fields = {};
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (!VALIDATORS[key]) fields[key] = 'ไม่รู้จักค่านี้';
    else if (!VALIDATORS[key](value)) fields[key] = 'ค่าไม่ถูกต้อง';
  }
  return Object.keys(fields).length ? fields : null;
}

export function setSettings(db, patch) {
  const upsert = db.prepare(
    'INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );
  for (const [key, value] of Object.entries(patch)) upsert.run(key, JSON.stringify(value));
  return getSettings(db);
}
