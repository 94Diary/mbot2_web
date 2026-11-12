# Data model (ฝั่งเซิร์ฟเวอร์เว็บ)

ข้อมูลที่อยู่บนเครื่องผู้ใช้ (โค้ดหุ่น, worlds, token ตัวเชื่อม) **ไม่อยู่ในฐานข้อมูลนี้**
เวลาเก็บเป็น `timestamptz` (ISO 8601) แสดงผลเป็นเวลาไทย

## users
| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| id | uuid | |
| email | citext unique | |
| display_name | text ≤40 | |
| password_hash | text | argon2id |
| role | enum `member`, `admin` | ผู้เยี่ยมชมไม่มีแถว |
| is_owner | bool | ต้อง role=admin · ต้องมี owner ≥1 เสมอ |
| status | enum `unverified`, `active`, `suspended`, `banned`, `deleted` | |
| email_verified_at | timestamptz? | |
| totp_secret | text? (เข้ารหัส) | บังคับเมื่อ role=admin |
| avatar_color | text | |
| locale | text default `th` | |
| created_at, last_seen_at, deleted_at | timestamptz | deleted_at + 30 วัน = ลบจริง |

## suspensions
| ฟิลด์ | ชนิด |
|---|---|
| id, user_id | uuid |
| kind | enum `suspend`, `ban` |
| reason_code | text (dropdown) |
| message_to_user | text |
| internal_note | text |
| until | timestamptz? (null = ถาวร) |
| created_by, created_at | |
| lifted_by, lifted_at, lift_reason | ? |

## sessions
id · user_id · created_at · last_seen_at · ip · user_agent · remember (bool) · revoked_at
ใช้แสดง “อุปกรณ์ที่เข้าสู่ระบบ” และบังคับออก

## paired_machines
| ฟิลด์ | หมายเหตุ |
|---|---|
| id, user_id | |
| name | “คอมที่บ้าน” |
| agent_version, os_info | รายงานจากตัวเชื่อมตอนจับคู่/เชื่อม |
| first_paired_at, last_used_at, revoked_at | |

> token จริงอยู่ในเบราว์เซอร์และตัวเชื่อม เซิร์ฟเวอร์เก็บแค่รายการเครื่องไว้แสดงในโปรไฟล์และนับเวอร์ชันในหลังบ้าน

## user_robot_prefs
user_id · robot_ns (`/mbot1`) · display_name · color — ชื่อและสีหุ่นที่ผู้ใช้ตั้ง (ผู้เยี่ยมชมเก็บใน localStorage)

## missions
| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| id | serial | แสดงเป็น #id |
| user_id | uuid | |
| source | enum `sim`, `real` | |
| world | text | ชื่อโลก หรือชื่อสนามจริง |
| robot_count | int | |
| result | enum `ok`, `part`, `stop` | ครบ / บางตัว / หยุดฉุกเฉิน |
| started_at, ended_at | timestamptz | |
| duration_s | int | |
| junction_count, dead_end_count | int | |
| map_name | text? | ตั้งชื่อแล้ว = ใช้เป็นแผนที่อ้างอิง/ตัดทางรอบหน้าได้ |
| env | jsonb | `{ code_commit, code_branch, agent_version, machine_name, params: { junction_wait, max_speed } }` |
| files | jsonb | key ของไฟล์ใน storage: `log.ndjson`, `map.json`, `export.zip` |
| deleted_at | timestamptz? | |

index: (user_id, started_at desc), (result), (world)

## mission_robots
mission_id · robot_ns · display_name · color · reached_goal_at? · distance_m · battery_end

## map.json (ไฟล์ ใน storage)
```json
{
  "version": 1,
  "frame": "world",
  "start": [x, y],
  "goal": { "center": [x, y], "size": [w, h] },
  "junctions": [{ "id": "J1", "at": [x, y], "branches": 3, "first_by": "/mbot1" }],
  "dead_ends": [{ "at": [x, y], "by": "/mbot2" }],
  "edges": [{ "from": "J1", "to": "J2", "path": [[x, y], …], "visitors": ["/mbot1", "/mbot3"] }],
  "exits": [[[x1, y1], [x2, y2]]]
}
```
`visitors[0]` = หุ่นตัวแรกที่ผ่าน → ใช้กำหนดสีเส้น

## log.ndjson (ไฟล์)
หนึ่งบรรทัดต่อเหตุการณ์: `{ "t": 374.2, "ns": "/mbot1", "level": "info|ok|warn|err", "msg": "…", "kind": "junction|dead_end|goal|mode|battery|line_lost|…" }`

## reference_maps
id · user_id · name · source (`mission`, `upload_json`, `upload_sdf`) · mission_id? · file_key · created_at

## lessons
id · order · slug · title · summary · body (markdown) · status (`draft`, `published`) · audience (`all`, `members`) · author_id · updated_at · deleted_at

## lesson_progress
user_id · lesson_id · completed_at

## announcements
id · text · level (`info`, `warn`, `red`) · audience (`all`, `members`, `admins`) · starts_at · ends_at · enabled · created_by

## site_settings (แถวเดียว / key-value)
title · tagline · description · contact_email · contact_line · contact_phone · registration (`open`, `invite`, `closed`) · default_role · indexable (bool) · og_image_key · maintenance (bool) · locale · timezone · log_retention_days · consent_retention_days

## security_settings
force_https · admin_2fa · password_min_len · lockout_attempts · lockout_minutes · captcha_after · session_idle_minutes · agent_repair_days (30) · agent_min_version

## invites
code · email · role · created_by · expires_at (7 วัน) · used_at

## audit_log (append-only)
| ฟิลด์ | หมายเหตุ |
|---|---|
| id | bigserial |
| at | timestamptz |
| actor_id | uuid? (null = system) |
| action | เช่น `user.suspend`, `role.change`, `settings.update`, `backup.restore`, `agent.pair`, `auth.failed` |
| target_type, target_id | |
| summary | ข้อความอ่านง่าย |
| before, after | jsonb |
| ip, user_agent | |

- DB user ของแอปมีสิทธิ์ INSERT/SELECT อย่างเดียว · ไม่มี UPDATE/DELETE
- เก็บ ≥1 ปี · ห้ามเก็บรหัสผ่าน token หรือ secret

## consent_records (PDPA)
id · user_id? · anon_id · choices (`{ necessary: true, prefs: bool, analytics: bool }`) · policy_version · at · ip — เก็บ ≥12 เดือน

## backups
id · at · kind (`auto`, `manual`) · size_bytes · locations (`[local, external, cloud]`) · immutable (bool) · ok · error · restore_tested_at?

## agent_releases
version · released_at · notes · checksum · min_supported (bool)
