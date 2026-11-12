-- mBot2 Maze Ops · subset ของ docs/data-model.md สำหรับเฟส 1 (SQLite)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  is_owner INTEGER NOT NULL DEFAULT 0 CHECK (is_owner = 0 OR role = 'admin'),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned', 'deleted')),
  avatar_color TEXT NOT NULL DEFAULT '#FF6B1A',
  created_at TEXT NOT NULL,
  last_seen_at TEXT,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS suspensions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('suspend', 'ban')),
  reason_code TEXT NOT NULL,
  message_to_user TEXT NOT NULL DEFAULT '',
  internal_note TEXT NOT NULL DEFAULT '',
  until TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  lifted_by TEXT,
  lifted_at TEXT,
  lift_reason TEXT
);

CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  used_by TEXT
);

CREATE TABLE IF NOT EXISTS missions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  source TEXT NOT NULL DEFAULT 'sim' CHECK (source IN ('sim', 'real')),
  world TEXT NOT NULL,
  robot_count INTEGER NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('ok', 'part', 'stop')),
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  duration_s INTEGER NOT NULL,
  junction_count INTEGER NOT NULL DEFAULT 0,
  dead_end_count INTEGER NOT NULL DEFAULT 0,
  map_name TEXT,
  env TEXT NOT NULL DEFAULT '{}',
  map TEXT NOT NULL DEFAULT '{}',
  log TEXT NOT NULL DEFAULT '[]',
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS missions_user_started ON missions(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS mission_robots (
  mission_id INTEGER NOT NULL REFERENCES missions(id),
  robot_ns TEXT NOT NULL,
  display_name TEXT NOT NULL,
  color TEXT NOT NULL,
  reached_goal_at TEXT,
  distance_m REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (mission_id, robot_ns)
);

CREATE TABLE IF NOT EXISTS user_robot_prefs (
  user_id TEXT NOT NULL REFERENCES users(id),
  robot_ns TEXT NOT NULL,
  display_name TEXT NOT NULL,
  color TEXT NOT NULL,
  PRIMARY KEY (user_id, robot_ns)
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'red')),
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'members', 'admins')),
  starts_at TEXT,
  ends_at TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  summary TEXT NOT NULL,
  before TEXT,
  after TEXT,
  ip TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS audit_at ON audit_log(at DESC);

CREATE TRIGGER IF NOT EXISTS audit_log_no_update BEFORE UPDATE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_log_no_delete BEFORE DELETE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;

-- ===== เฟส 2 =====
CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ord INTEGER NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'members')),
  author_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id TEXT NOT NULL REFERENCES users(id),
  lesson_id INTEGER NOT NULL REFERENCES lessons(id),
  completed_at TEXT NOT NULL,
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS lesson_views (
  lesson_id INTEGER NOT NULL REFERENCES lessons(id),
  viewer TEXT NOT NULL,
  day TEXT NOT NULL,
  PRIMARY KEY (lesson_id, viewer, day)
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  topic TEXT NOT NULL,
  message TEXT NOT NULL,
  user_id TEXT,
  ip TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'done')),
  created_at TEXT NOT NULL,
  handled_by TEXT,
  handled_at TEXT
);

CREATE TABLE IF NOT EXISTS consent_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  anon_id TEXT NOT NULL,
  choices TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  at TEXT NOT NULL,
  ip TEXT
);

CREATE TABLE IF NOT EXISTS backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('auto', 'manual', 'pre-restore')),
  file TEXT,
  size_bytes INTEGER,
  ok INTEGER NOT NULL,
  error TEXT,
  restore_tested_at TEXT,
  restore_test_result TEXT
);
