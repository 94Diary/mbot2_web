# mBot2 Maze Ops เฟส 1: คอนโซลและหลังบ้านที่ใช้งานได้จริง (design)

วันที่ 12 พ.ย. 2569 · สถานะ: รอตรวจ

## เป้าหมาย

ทำเว็บใน repo นี้ให้ **ใช้งานได้จริงบนเครื่องเดียว (WSL)** ตามหน้าตาและพฤติกรรมใน `docs/mockup/mbot2-mockup.html` และเอกสารใน `docs/` โดยเน้น 2 ส่วน:

1. **คอนโซลหุ่น**: กดรันซิมจากเว็บแล้ว Gazebo เปิดจริง เห็นความคืบหน้าและ log, แผนที่กับ log สดจากหุ่น, หยุดทุกตัว, บันทึกภารกิจ, ดูประวัติย้อนหลัง
2. **หลังบ้าน**: ผู้ดูแลจัดการผู้ใช้ ภารกิจ ประกาศ ตั้งค่าเว็บ และดู Audit log ได้จริง

**เสร็จเมื่อ:** ล็อกอินเป็นสมาชิก → รันซิม 2 ตัวบนสนามที่เลือก → เห็นหุ่นวิ่งบนแผนที่และ log สด → จบภารกิจ → บันทึก → เปิดดูในประวัติได้ · ล็อกอินเป็นแอดมิน → ระงับสมาชิก เปลี่ยนบทบาท ตั้งประกาศ เปิดโหมดปิดปรับปรุง และเห็นทุกการกระทำใน Audit log

## สิ่งที่ตกลงแล้ว (ต่างจาก docs)

| เรื่อง | docs | เฟส 1 | เหตุผล |
|---|---|---|---|
| สถาปัตยกรรม | เว็บสาธารณะ HTTPS + ตัวเชื่อม Python ที่ localhost:8765 | backend Node ตัวเดียวใน WSL เป็นทั้งเว็บเซิร์ฟเวอร์และตัวสั่งซิม | ผู้ใช้เลือก "รวมในเครื่องเดียว" เพื่อให้ทันโชว์ |
| ฐานข้อมูล | PostgreSQL + S3 | SQLite ไฟล์เดียวผ่าน `node:sqlite` · ไฟล์ภารกิจเก็บเป็น JSON ใน DB | ไม่ต้องลงอะไรเพิ่ม |
| Auth | session + 2FA + CAPTCHA + ล็อกบัญชี + อีเมล | session cookie + scrypt อย่างเดียว | ผู้ใช้สั่ง "หน้า login ทำเล่นๆ ไว้" เฟสหน้าค่อยทำให้แน่น |
| ผู้เยี่ยมชม | รันซิมได้ | ต้องล็อกอินก่อนใช้คอนโซล | ซิมรันบนเครื่องเซิร์ฟเวอร์ |
| ส่งข้อมูลหุ่น | rosbridge → roslibjs | rclnodejs ใน backend → WebSocket เดิม | มีอยู่แล้ว ไม่ต้องลง rosbridge |

ไม่อยู่ในเฟส 1: บทเรียน, หน้ารู้จักหุ่น 3D, ค้นหา, ติดต่อ, คุกกี้ PDPA, 2FA, CAPTCHA, อีเมล, ลืมรหัสผ่าน, โปรไฟล์หลายแท็บ, สำรองข้อมูล, หน้าตัวเชื่อมเครื่อง, ความปลอดภัย, หุ่นจริง, หน้าวางหุ่น, จับคู่รหัส 6 หลัก

## 1. โค้ดหุ่น (`~/ros2_ws/src`, branch `feature/mbot-for-web-agent`)

แก้ `mbot2_description/launch/two_mbot2.launch.py` อย่างเดียว ไม่แตะตรรกะการเดินของหุ่น

- เพิ่ม launch arg `world` (ค่าเริ่มต้น `mbot2_seed7_maze` = พฤติกรรมเดิมทุกอย่าง)
- ย้ายส่วนที่ขึ้นกับสนามไปใน `OpaqueFunction` เพื่ออ่านค่า arg ตอนรัน
- ชื่อโลกของ Gazebo อ่านจาก `<world name="…">` ในไฟล์ `.sdf` (Map1 และ Map1_Walled ใช้ชื่อเดียวกัน `Map1_FullyLined_16x16`)
- ตาราง `WORLD_PROFILES` ต่อสนาม: จุดวางหุ่น 3 จุด + `junction_match_radius` · สนามที่ไม่อยู่ในตารางใช้ค่าของ seed7
  - `mbot2_seed7_maze`: จุดเดิม (-1.95/-2.20/-2.45, -1.25, yaw 0) · radius 0.25
  - `Map1`, `Map1_Walled`, `Map2`: เรียงต่อจากแผ่นเริ่ม (-3.0, 3.0) · yaw และระยะห่างหาจากเส้นนำเข้าในไฟล์ SDF ตอนลงมือ · radius 0.2 (เส้นห่าง 0.4 ม.)
- ใช้ชื่อโลกที่อ่านได้ทั้งใน `world_file`, bridge `/world/<name>/dynamic_pose/info` และ parameter `world_name` ของ `maze_solver`
- ชื่อสนามต้องตรง regex `^[A-Za-z0-9_]+$` และมีไฟล์อยู่จริง ไม่งั้น launch ล้มพร้อมข้อความชัดเจน

**ความเสี่ยงที่ยอมรับ:** launch เปิดได้ทุกสนามและวางหุ่นตรงแผ่นเริ่ม แต่ไม่รับประกันว่าอัลกอริทึมจะแก้ Map1/Map2 สำเร็จ

ทดสอบ: `pytest` ของแพ็กเกจเดิมยังผ่าน · `ros2 launch … --show-args` เห็น `world` · รัน headless จริงบน seed7 และ Map1 อย่างละครั้ง

## 2. Backend (`backend/`)

ต่อยอดโค้ดเดิม · Express 5 + ws + rclnodejs · เพิ่มเฉพาะ module ในตัว Node (`node:sqlite`, `node:crypto`, `node:child_process`) · **ไม่เพิ่ม dependency ใหม่**

### โครงไฟล์

```
backend/src/
├─ app.js               # ประกอบ router + WebSocket
├─ index.js             # เปิด DB, ROS, ตัวสั่งซิม
├─ db/{index.js, schema.sql}
├─ auth/{passwords.js, sessions.js, permissions.js, routes.js, middleware.js}
├─ sim/{commands.js, runner.js, worlds.js, routes.js}
├─ missions/{recorder.js, repo.js, routes.js}
├─ admin/{users.js, missions.js, announcements.js, settings.js, audit.js, dashboard.js, routes.js}
├─ modules/telemetry/   # ของเดิม
└─ scripts/create-owner.js
```

### ฐานข้อมูล (subset ของ `docs/data-model.md`)

- `users` (id, email, display_name, password_hash, role `member|admin`, is_owner, status `active|suspended|banned|deleted`, avatar_color, created_at, last_seen_at, deleted_at)
- `sessions` (id = sha256 ของ token, user_id, created_at, last_seen_at, ip, user_agent, revoked_at)
- `suspensions` ตาม data-model
- `invites` (code, role, created_by, expires_at, used_at)
- `missions` (id, user_id, source `sim`, world, robot_count, result `ok|part|stop`, started_at, ended_at, duration_s, junction_count, dead_end_count, map_name, env JSON, map JSON, log JSON, deleted_at)
- `mission_robots` (mission_id, robot_ns, display_name, color, reached_goal_at, distance_m)
- `user_robot_prefs` (user_id, robot_ns, display_name, color)
- `announcements`, `site_settings` (key-value), `audit_log` (append-only: ไม่มีโค้ดใดสั่ง UPDATE/DELETE + trigger ใน SQLite ปฏิเสธ UPDATE/DELETE)

### Auth (ง่ายตามที่ตกลง)

- `POST /api/v1/auth/login` `{ email, password }` → cookie `sid` (HttpOnly, SameSite=Lax) · ถูกระงับ → 403 `SUSPENDED` พร้อมเหตุผลและวันหมด
- `POST /api/v1/auth/register` `{ display_name, email, password, invite? }` ตามโหมด `registration` (`open|invite|closed`) ใน site_settings
- `POST /api/v1/auth/logout` · `GET /api/v1/me` → ผู้ใช้ + `permissions[]` · `POST /api/v1/me/password`
- รหัสผ่าน: `crypto.scrypt` + salt สุ่ม · ยาวขั้นต่ำ 8
- สิทธิ์: ตาราง key ตาม `roles-permissions.md` ในโค้ด `permissions.js` · middleware `requirePerm(key)` ทุก endpoint · ไม่มีสิทธิ์ = 403
- กฎที่ทำ: เจ้าของคนสุดท้ายถูกถอดไม่ได้ (409 `LAST_OWNER`) · แก้บทบาทหรือระงับตัวเองไม่ได้ · ผู้ดูแลจัดการได้เฉพาะสมาชิก · ระงับแล้ว revoke session ทั้งหมด
- CSRF: ตรวจ `Origin` ของทุก request ที่เปลี่ยนข้อมูลด้วย origin policy เดิม + SameSite=Lax
- `npm run create-owner -- --email … --name …` สร้างเจ้าของคนแรก (ถามรหัสผ่านทาง stdin)
- ยกเลิก `MBOT2_API_TOKEN` · WebSocket ใช้ cookie session แทน subprotocol token

### ตัวสั่งซิม (`sim/`)

- **ตารางคำสั่งที่อนุญาต** ใน `commands.js` เป็นฟังก์ชันสร้าง argv เท่านั้น:
  - `build` → `colcon build --packages-select mbot2_control mbot2_description --symlink-install` (cwd = workspace)
  - `launch` → `ros2 launch mbot2_description two_mbot2.launch.py robot_count:=<2|3> headless:=<true|false> world:=<ชื่อ>`
- ตรวจค่า: `count ∈ {2,3}` · `headless`, `build` เป็น boolean · `world` ต้องอยู่ใน `worlds.list()` (อ่านชื่อไฟล์ `*.sdf` ใน `<ws>/src/mbot2_description/worlds/`) · ค่าผิด = 400 `VALIDATION`
- ห้ามต่อค่าจากผู้ใช้เข้าสตริงคำสั่ง shell · ใช้ `spawn('bash', ['-c', 'source /opt/ros/humble/setup.bash && source <ws>/install/setup.bash && exec "$@"', '_', ...argv], { detached: true })` สคริปต์ bash เป็นค่าคงที่ ส่วน argv ส่งเป็นอาร์กิวเมนต์แยก
- หนึ่งซิมต่อครั้ง: มีซิมรันอยู่ = 409 `BUSY`
- สถานะ `idle → building → launching → running → stopping → idle` + ขั้นความคืบหน้า `build|gazebo|bridge|link` (`link` = ได้ `/maze_team/state` ครั้งแรก)
- stdout/stderr แยกบรรทัด เก็บล่าสุด 400 บรรทัด ส่งทาง WebSocket
- build ล้ม: หา `File "…", line N` หรือ `…:N:` ใน log → `{ code: BUILD_FAILED, file, line, message }`
- **หยุด** = `process.kill(-pgid, 'SIGINT')` รอ 5 วินาที → `SIGTERM` → อีก 3 วินาที `SIGKILL` · backend ปิดตัว = หยุดซิมด้วย
- runner รับ `spawn` เป็นพารามิเตอร์ เพื่อให้เทสต์ใช้ spawner ปลอม
- API: `GET /api/v1/sim/worlds` · `GET /api/v1/sim/state` · `POST /api/v1/sim/start` `{ count, world, build, headless }` · `POST /api/v1/sim/stop` · สิทธิ์ `console.view` / `console.stop`
- **ยังคงไม่มี publisher `/cmd_vel` หรือคำสั่งมอเตอร์ใดๆ ใน backend** การหยุดทำด้วยการปิด process ทั้งกลุ่ม

### บันทึกภารกิจ (`missions/`)

- ภารกิจเริ่มเมื่อ sim เข้า `running` · `recorder` เก็บ: team state ล่าสุด, เส้นทางจาก `RobotPaths`, เหตุการณ์ (decision/report/trail/robot log) แปลงเป็น `{ t, ns, level, msg, kind }`, เวลาที่หุ่นแต่ละตัวถึงเป้าหมาย
- ทางแยก = `junctions` ใน state · ทางตัน = กิ่งที่สถานะ `BLOCKED` หรือเหตุการณ์ report `BLOCKED`
- "จบภารกิจ" = หยุดซิม · ผลลัพธ์: ทุกตัวถึงเป้าหมาย = `ok` · บางตัว = `part` · ไม่มี = `stop`
- "บันทึก" (`POST /api/v1/missions`, `console.use`) เก็บ meta + `map` (ฟอร์แมต `map.json`) + `log` ลง DB · "ทิ้งผล" ล้าง recorder
- env: `code_commit`/`code_branch` จาก `git -C <ws>/src rev-parse`, world, robot_count, headless
- `GET /api/v1/missions?page&page_size&q&result&world&sort` (ของตัวเอง, `history.own`) · `GET /api/v1/missions/:id` (เจ้าของ หรือ `data.view`) · `PATCH` ตั้งชื่อแผนที่ (เจ้าของ) · `DELETE` (เจ้าของ หรือ `data.delete`, soft delete)
- `GET/PUT /api/v1/me/robot-prefs` ชื่อและสีหุ่น

### หลังบ้าน (`admin/`)

ตาม `api.md` ส่วน `/admin/...` เฉพาะ: dashboard · users (list/filter/search/page, suspend/unsuspend/role/delete, invites) · missions (ทุกคน, ลบ) · announcements (CRUD) · settings (title, tagline, registration, maintenance) · audit (list/filter/page + CSV) · roles (อ่านอย่างเดียว)
- ทุก endpoint ที่เปลี่ยนข้อมูลเขียน audit_log `{ actor, action, target, summary, before, after, ip, user_agent }` ห้ามเก็บรหัสผ่านหรือ token
- `GET /api/v1/site` และ `GET /api/v1/announcements/active` เปิดให้ทุกคน
- **โหมดปิดปรับปรุง:** ทุก endpoint ยกเว้น `/auth/*`, `/site`, `/me` ตอบ 503 `MAINTENANCE` สำหรับคนที่ไม่ใช่ผู้ดูแล

### WebSocket `/ws/telemetry`

ต้องมี session · ส่งทุก 500 ms: `{ health, team, events, paths, sim: { state, step, robots, world, started_at, error }, mission: { recording, started_at } }` · ส่ง `{ type: "simlog", lines }` เมื่อมีบรรทัดใหม่

### รูปแบบ API

prefix `/api/v1` · ผิดพลาด `{ error: { code, message, fields? } }` · รายการ `{ items, total, page, page_size }` · `page_size ∈ {10,20,30,50}`

## 3. Frontend (`frontend/`)

React 19 + Vite เดิม + เพิ่ม `react-router-dom` (dependency ใหม่ตัวเดียว) · JavaScript (ไม่ย้ายไป TypeScript ในเฟสนี้)

- **ธีม:** CSS variables ทั้งหมดจาก `design-tokens.md` · `theme-dark`/`theme-light` บน root ตามระบบ + ปุ่มสลับ (จำใน localStorage) · ฟอนต์ Prompt / IBM Plex Sans Thai / IBM Plex Mono จาก Google Fonts
- **Component พื้นฐาน** (ตาม components.md ส่วน 1–4): Button, Icon, Pill, Avatar/BotAvatar, Dot, Skeleton, Field, TextInput/Select, Toggle, Segmented, Notice, Modal, Drawer, Toast, Pager, EmptyState, Gate403
- **หน้า:**
  - `/` หน้าแรกสั้นๆ (ข้อความ + ปุ่มเข้าคอนโซล) · `/login` · `/register`
  - คอนโซล (header + แถบเมนูล่างล็อก: ควบคุม · เชื่อมหุ่น · ประวัติ · หุ่นของทีม · **หยุดทุกตัว**)
    - `/console/connect` ฟอร์ม (จำนวน 2/3, สนาม, Build ใหม่, ซ่อน Gazebo, ดูคำสั่งที่จะรัน) + ความคืบหน้า 4 ขั้น + กล่องข้อความจาก Terminal · สำเร็จ → `/console/control` + toast · build ล้ม → Notice แดง ไฟล์/บรรทัด + "แก้แล้ว รันอีกครั้ง"
    - `/console/control` หัวภารกิจ (สถานะ, เวลา, สนาม) · การ์ดเลือกหุ่น (ทุกตัว + แต่ละตัว) คุมทั้งแผนที่และ log · แผนที่ SVG (เส้นสีตามหุ่น, ทางแยก •, ทางตัน ✕, เป้าหมาย, ตำแหน่งหุ่น ping, เข็มทิศ) · log สด · ปุ่ม จบภารกิจ / บันทึก / ทิ้งผล · ไม่มีภารกิจ = Gate ไปเชื่อมหุ่น · ROS หลุด = banner แดง · แบต = "ยังไม่มีข้อมูลจากหุ่น"
    - `/console/team` หุ่นของทีม: แก้ชื่อและสี (เตือนสีซ้ำ) เก็บใน robot-prefs
    - `/console/history` รายการยาวจัดกลุ่มตามวัน · ค้นหา, กรองผล, กรองสนาม, เรียง · Pager บน/ล่าง
    - `/console/missions/:id` แท็บ สรุป / แผนที่ / Log
  - หลังบ้าน (sidebar + topbar, เฉพาะผู้ดูแล): `/admin` Dashboard · `/admin/users` (ตาราง + drawer จัดการ) · `/admin/roles` · `/admin/missions` · `/admin/announcements` · `/admin/settings` · `/admin/audit`
  - สลับ "ใช้งานหุ่น / หลังบ้าน" ใน header เฉพาะผู้ดูแล · ทุกหน้าใช้ `can(perm)` จาก `/me`
- **สถานะร่วม:** Skeleton ตอนโหลด · EmptyState · error ภาษาคน · 403 Gate · banner ประกาศ · banner/หน้าปิดปรับปรุง
- **Responsive:** ตาม pages-and-flows.md (1000/900/700/640/440) · แถบเมนูล่างเป็นแท็บบนจอ ≤700px

แทนที่ `App.jsx`/`RobotMap.jsx` เดิม · ตรรกะวาดแผนที่จาก `RobotMap.jsx` ย้ายมาใช้ต่อใน component แผนที่ใหม่

## 4. ทดสอบ

- **Backend (`node:test`):** ทุก endpoint ตอบ 401/403 ถูกตามสิทธิ์ (ยิงตรง) · เจ้าของคนสุดท้าย 409 · ระงับแล้ว session ใช้ไม่ได้ · audit_log UPDATE/DELETE ถูกปฏิเสธ · sim: argv ถูกต้อง, ค่าผิด 400, `world=../x` ถูกปฏิเสธ, BUSY, หยุดส่ง signal ถึง process group (spawner ปลอม) · recorder: ผลลัพธ์ ok/part/stop, นับทางแยก/ทางตัน · โหมดปิดปรับปรุง 503 · เทสต์เดิมที่ยังเกี่ยวปรับให้ใช้ session
- **Frontend:** `npm run build` ผ่าน · ตรวจด้วยตาในเบราว์เซอร์ทุกหน้า สว่าง/มืด ที่ 390/820/1440 px
- **ปลายทาง:** รันซิมจริง headless จากเว็บ 1 รอบ บันทึก และเปิดในประวัติ

## 5. การรันและไฟล์

- `backend/.env`: `HOST`, `PORT`, `MBOT2_CORS_ORIGINS`, `MBOT2_DB_PATH` (ค่าเริ่มต้น `backend/data/mbot2.db`, git ignore), `MBOT2_WS_PATH` (ค่าเริ่มต้น `~/ros2_ws`), `MBOT2_SESSION_DAYS`
- อัปเดต `README.md`, `.env.example`, QA agents ใน `.claude/agents/` ให้ตรงกับระบบใหม่ (backend สั่ง launch/stop ได้ แต่ไม่มีคำสั่งมอเตอร์)
- **ไม่ commit ทั้งสอง repo** จนกว่าผู้ใช้สั่ง

## 6. ความเสี่ยง

| ความเสี่ยง | รับมือ |
|---|---|
| หุ่นแก้ Map1/Map2 ไม่สำเร็จ | แจ้งผลจากการรันจริง ไม่แก้อัลกอริทึม |
| RAM 7 GB กับ Gazebo 3 ตัว | ค่าเริ่มต้นในฟอร์ม = 2 ตัว · มีตัวเลือก headless |
| process ของ launch ค้างหลังหยุด | kill ทั้ง process group + SIGKILL สำรอง · ตรวจหลังหยุดว่าไม่มี `gz`/`ign` ค้าง |
| `node:sqlite` เป็น API ใหม่ | Node v26 ในเครื่องรองรับ · ระบุ `engines.node >= 22.13` |
