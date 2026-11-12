# API ของเซิร์ฟเวอร์เว็บ

REST + JSON · prefix `/api/v1` · auth ด้วย session cookie (HttpOnly, Secure, SameSite=Lax) + CSRF token สำหรับ POST/PATCH/DELETE
สิทธิ์ที่ต้องใช้อยู่ในคอลัมน์ `perm` (ดู roles-permissions.md) — **เช็กที่ server ทุกครั้ง** ไม่มีสิทธิ์ตอบ `403`

> API ของตัวเชื่อมเครื่อง (WebSocket บน localhost) อยู่ใน agent.md เซิร์ฟเวอร์ไม่เคยคุยกับตัวเชื่อมโดยตรง

## รูปแบบทั่วไป

- รายการ: `GET …?page=1&page_size=10|20|30|50&q=&sort=` → `{ "items": [...], "total": 128, "page": 1, "page_size": 10 }`
- ผิดพลาด: `{ "error": { "code": "VALIDATION", "message": "อีเมลไม่ถูกต้อง", "fields": { "email": "…" } } }`
- รหัสที่ใช้: 400 VALIDATION · 401 UNAUTHENTICATED · 403 FORBIDDEN · 404 · 409 CONFLICT / LAST_OWNER / BUSY · 423 LOCKED · 429 RATE_LIMITED
- ทุก endpoint ที่เปลี่ยนข้อมูลในหลังบ้าน → เขียน audit_log

## Auth

| method | path | perm | หมายเหตุ |
|---|---|---|---|
| POST | /auth/register | – | `{ invite?, display_name, email, password, agree, captcha }` → ส่งอีเมลยืนยัน |
| POST | /auth/verify-email | – | `{ token }` |
| POST | /auth/login | – | `{ email, password, remember, captcha? }` · ผิด 3 ครั้งต้องมี captcha · 5 ครั้ง → 423 ล็อก 15 นาที · ถูกระงับ → 403 `{ code: "SUSPENDED", reason, until, message }` |
| POST | /auth/2fa | – | `{ code }` หลัง login สำหรับผู้ดูแล |
| POST | /auth/logout | login | |
| POST | /auth/forgot | – | ตอบ 200 ข้อความเดียวกันเสมอ · จำกัด 5 ครั้ง/ชม./IP |
| POST | /auth/reset | – | `{ token, password }` · token 30 นาที ใช้ครั้งเดียว · สำเร็จ = revoke ทุก session |
| GET | /me | – | ผู้ใช้ปัจจุบัน + permissions[] (null = ผู้เยี่ยมชม) |

## โปรไฟล์

| method | path | perm |
|---|---|---|
| PATCH | /me | login — ชื่อ ภาษา |
| POST | /me/password | login |
| POST | /me/2fa/setup · /me/2fa/enable · /me/2fa/disable | login (ผู้ดูแลปิดไม่ได้ถ้าบังคับ) |
| GET · DELETE | /me/sessions · /me/sessions/:id | login |
| GET · POST · DELETE | /me/machines · /me/machines/:id | login — บันทึก/ยกเลิกเครื่องที่จับคู่ |
| GET · PUT | /me/robot-prefs | history.own |
| GET · PUT | /me/notifications | login |
| POST | /me/export | login — ส่งลิงก์ไฟล์ข้อมูลทางอีเมล |
| DELETE | /me | login + password — soft delete 30 วัน |

## ภารกิจ

| method | path | perm | หมายเหตุ |
|---|---|---|---|
| POST | /missions | console.use | สร้างจากผลที่ตัวเชื่อม export · body = meta + `upload_urls` ที่ขอไว้ |
| POST | /missions/upload-url | console.use | ขอ presigned URL สำหรับ log.ndjson / map.json / export.zip |
| GET | /missions?mine=1&result=&world=&q=&sort=new\|old | history.own | ประวัติของตัวเอง (pager) |
| GET | /missions/:id | เจ้าของ หรือ data.view | |
| GET | /missions/:id/log?robot=&page= | เจ้าของ หรือ data.view | |
| GET | /missions/:id/map | เจ้าของ หรือ data.view | |
| PATCH | /missions/:id | เจ้าของ | ตั้งชื่อแผนที่ |
| DELETE | /missions/:id | เจ้าของ หรือ data.delete | |
| GET | /reference-maps | history.own | แผนที่ที่ใช้ซ้ำได้ |
| POST | /reference-maps | history.own | upload .json / .sdf (แปลงเป็น map.json ที่ server) |

## เนื้อหาสาธารณะ

| method | path | perm |
|---|---|---|
| GET | /lessons · /lessons/:slug | – (ร่างต้อง content.edit) |
| POST · DELETE | /lessons/:id/progress | login |
| GET | /announcements/active | – (กรองตาม audience) |
| GET | /site | – ชื่อเว็บ ติดต่อ การสมัคร โหมดปิดปรับปรุง |
| GET | /search?q= | – |
| POST | /contact | – (captcha, rate limit) |
| POST | /consent | – บันทึกความยินยอมคุกกี้ |
| GET | /agent/latest | – เวอร์ชันล่าสุด + ขั้นต่ำ + คำสั่งติดตั้ง |

## หลังบ้าน (`/admin/...`)

| method | path | perm |
|---|---|---|
| GET | /admin/dashboard?range=7d\|30d\|all | dash.view |
| GET | /admin/system | dash.view |
| GET | /admin/users?role=&status=&q=&page= | users.view |
| PATCH | /admin/users/:id | users.edit (สมาชิก) / users.admins (ผู้ดูแล) |
| POST | /admin/users/:id/suspend | users.edit / users.admins — `{ kind, reason_code, until, message, note, notify, force_logout }` |
| POST | /admin/users/:id/unsuspend | users.edit — `{ reason }` (บังคับ) |
| POST | /admin/users/:id/role | users.role — `{ role, is_owner }` · ถอด owner คนสุดท้าย = 409 LAST_OWNER |
| POST | /admin/users/:id/reset-password · /logout-all · /verify-email | users.edit |
| DELETE | /admin/users/:id | users.edit / users.admins — `{ confirm_name }` |
| POST | /admin/users/bulk | users.edit — `{ ids, action: verify\|logout\|suspend }` (ข้ามผู้ดูแลถ้าไม่ใช่เจ้าของ) |
| POST | /admin/invites | users.edit (role ≠ member ต้อง users.role) |
| GET · POST · PATCH · DELETE | /admin/lessons… | content.edit / content.delete |
| GET · POST · PATCH · DELETE | /admin/announcements… | announce.edit |
| GET | /admin/missions?user=&result=&page= | data.view |
| POST | /admin/missions/export | data.delete |
| GET · PATCH | /admin/settings | settings.edit |
| GET · PATCH | /admin/security | security.edit (GET: audit.view) |
| GET | /admin/backups | backup.run |
| POST | /admin/backups | backup.run — สำรองทันที |
| POST | /admin/backups/:id/test-restore | backup.run |
| POST | /admin/backups/:id/restore | backup.restore — `{ confirm: "กู้คืน" }` · สำรองปัจจุบันก่อนอัตโนมัติ |
| GET | /admin/audit?actor=&action=&from=&to=&q=&page= | audit.view |
| GET | /admin/audit/export.csv | audit.view |
| GET | /admin/agent | settings.edit |
| PATCH | /admin/agent | agent.release — min_version, install command |
| POST | /admin/agent/releases | agent.release |
| GET | /admin/roles | users.view — ตารางสิทธิ์ (อ่านอย่างเดียว กำหนดในโค้ด) |

## โหมดปิดปรับปรุง

เปิดอยู่ → ทุก endpoint ยกเว้น `/auth/*`, `/site` ตอบ `503 MAINTENANCE` สำหรับคนที่ไม่ใช่ผู้ดูแล
