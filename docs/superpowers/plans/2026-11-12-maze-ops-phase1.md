# mBot2 Maze Ops เฟส 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เว็บคอนโซลหุ่น + หลังบ้านที่ใช้งานได้จริงบน WSL เครื่องเดียว: รันซิมจากเว็บ ดูสด บันทึกภารกิจ และผู้ดูแลจัดการเว็บได้

**Architecture:** backend Express ตัวเดิมขยายเป็น monolith: SQLite (`node:sqlite`), session auth, ตัวสั่งซิมแบบ whitelist (`child_process`), recorder ภารกิจจาก telemetry เดิม, API หลังบ้าน · frontend React + react-router ตาม mockup · launch ของโค้ดหุ่นรับ `world:=`

**Tech Stack:** Node ≥22.13 (เครื่องนี้ v26 ผ่าน nvm), Express 5, ws, rclnodejs, node:sqlite, node:crypto, React 19, Vite 8, react-router-dom 7, ROS 2 Humble launch (Python)

**Spec:** `docs/superpowers/specs/2026-11-12-maze-ops-phase1-design.md`

## Global Constraints

- ไม่ commit ทั้ง `~/mbot2_web` และ `~/ros2_ws/src` จนกว่าผู้ใช้สั่ง (แทนที่ขั้น "Commit" ทุกงานด้วยการรันเทสต์)
- backend ไม่เพิ่ม dependency ใหม่ · frontend เพิ่มได้แค่ `react-router-dom`
- backend ห้ามมี publisher `/cmd_vel` หรือคำสั่งมอเตอร์ใดๆ
- ห้ามต่อค่าจากผู้ใช้เข้าสตริง shell · argv เท่านั้น
- API prefix `/api/v1` · error `{ error: { code, message, fields? } }` · list `{ items, total, page, page_size }` · `page_size ∈ {10,20,30,50}`
- สิทธิ์ตาม key ใน `docs/roles-permissions.md` · เช็กที่ server ทุก endpoint
- ข้อความ UI ภาษาไทย สั้น บอกวิธีแก้ · ธีมตาม `docs/design-tokens.md`
- ใช้ Node จาก nvm (`. ~/.nvm/nvm.sh`) ไม่ใช่ `/mnt/c/...`

## Review Focus

1. กด "รันซิม" ซ้ำเร็วๆ / สองแท็บพร้อมกัน → ต้องได้ 409 BUSY ไม่เปิด Gazebo สองชุด (Task 4 test `start twice → BUSY`)
2. backend ปิด (Ctrl+C) ระหว่างซิมวิ่ง → process gz/ros ต้องไม่ค้าง (Task 4 test `shutdown stops running sim`)
3. ROS ส่ง state แปลก (ไม่มี junctions, robots ว่าง, ค่า NaN) → recorder และแผนที่ไม่พัง (Task 5 test `recorder tolerates malformed state`)
4. ผู้ดูแลพยายามระงับ/ลดสิทธิ์ตัวเอง หรือเจ้าของคนสุดท้าย → 409/403 (Task 6 tests)
5. session ของผู้ใช้ที่ถูกระงับยังเปิด WebSocket อยู่ → ต้องโดนตัด/ปฏิเสธ (Task 7 test `suspended user socket rejected`)

---

### Task 1: launch รับ `world:=` (โค้ดหุ่น)

**Files:**
- Modify: `~/ros2_ws/src/mbot2_description/launch/two_mbot2.launch.py`
- Create: `~/ros2_ws/src/mbot2_description/launch/world_profiles.py`
- Test: `~/ros2_ws/src/mbot2_description/test/test_world_profiles.py`

**Interfaces:**
- Produces: launch arg `world` (default `mbot2_seed7_maze`) · `world_profiles.resolve(worlds_dir: str, world: str) -> dict(file, gz_name, spawns[(name,x,y,yaw)], junction_match_radius)` raise `ValueError` ถ้าชื่อผิด regex หรือไม่มีไฟล์

- [ ] เขียนเทสต์: `resolve(dir,'mbot2_seed7_maze')` ได้ `gz_name=='mbot2_seed7_maze'`, spawns เดิม, radius 0.25 · `resolve(dir,'Map1_Walled')['gz_name']=='Map1_FullyLined_16x16'` · `resolve(dir,'../x')` และ `'nope'` → ValueError
- [ ] รัน `python3 -m pytest mbot2_description/test/test_world_profiles.py` → FAIL
- [ ] เขียน `world_profiles.py` (อ่าน `<world name>` ด้วย ElementTree; spawn ของ Map* หาจากแผ่น start (-3,3) และเส้นนำเข้าใน SDF) แล้วใช้ใน launch ผ่าน `OpaqueFunction` สำหรับ world_file, bridge dynamic_pose, `world_name`, spawns, radius
- [ ] เทสต์ผ่าน · `colcon build --packages-select mbot2_description` ผ่าน · `ros2 launch mbot2_description two_mbot2.launch.py --show-args` มี `world` · pytest เดิมของ `mbot2_control` ยังผ่าน

### Task 2: ฐานข้อมูล

**Files:** Create `backend/src/db/index.js`, `backend/src/db/schema.sql`, `backend/src/db/settings.js`, `backend/src/db/audit.js` · Test `backend/test/db.test.js`

**Interfaces:**
- Produces: `openDb(path: string|':memory:') -> DatabaseSync` (สร้าง schema, `PRAGMA foreign_keys=ON`) · `getSettings(db) -> {title, tagline, registration, maintenance}` · `setSettings(db, patch) -> settings` · `writeAudit(db, {actorId, action, targetType, targetId, summary, before, after, ip, userAgent})` · `listAudit(db, {actor, action, q, from, to, page, pageSize}) -> list`

- [ ] เทสต์: schema สร้างได้ใน `:memory:` · settings ค่าเริ่มต้น `{title:'mBot2 Maze Ops', registration:'invite', maintenance:false}` · `UPDATE audit_log` และ `DELETE FROM audit_log` throw (trigger)
- [ ] FAIL → เขียน → PASS (`cd backend && npm test`)

### Task 3: บัญชีและสิทธิ์

**Files:** Create `backend/src/auth/{passwords,sessions,permissions,middleware,routes,users}.js`, `backend/scripts/create-owner.js` · Test `backend/test/auth.test.js`

**Interfaces:**
- Produces: `hashPassword(pw)->Promise<string>` / `verifyPassword(pw, hash)->Promise<bool>` · `PERMISSIONS` (key → roles) + `permissionsFor(user|null) -> string[]` · `createSession(db, userId, meta)->token` · `userForToken(db, token)->user|null` (ไม่คืนผู้ใช้ status ≠ active) · `revokeUserSessions(db, userId)` · middleware `attachUser(db)`, `requireLogin`, `requirePerm(key)` · router `/api/v1/auth/*`, `/api/v1/me`, `/api/v1/me/password` · `sendError(res, status, code, message, fields?)` ใน `backend/src/http.js`
- [ ] เทสต์: login ถูก → cookie `sid` HttpOnly; ผิด → 401 · `/me` ไม่มี cookie → `{user:null, permissions:[]}` · register ตามโหมด open/invite/closed (closed → 403 `REGISTRATION_CLOSED`, invite ผิด → 400) · ผู้ใช้ suspended login → 403 `SUSPENDED` + reason/until · `permissionsFor(member)` มี `console.use` ไม่มี `admin.access`
- [ ] FAIL → เขียน → PASS · `create-owner.js` รับ `--email --name` อ่านรหัสจาก stdin

### Task 4: ตัวสั่งซิม

**Files:** Create `backend/src/sim/{commands,worlds,runner,routes}.js` · Test `backend/test/sim.test.js`

**Interfaces:**
- Produces: `listWorlds(wsPath)->string[]` · `buildArgv({count, world, headless}, worlds) -> string[]` throw `ValidationError` · `class SimRunner(EventEmitter)` ctor `{ wsPath, spawn = child_process.spawn, kill = process.kill, worlds }` · `start({count, world, build, headless})` · `stop()` · `markLinked()` · `state() -> {state, step, steps, world, robots, started_at, error}` · events `line(text)`, `state(snapshot)` · `shutdown()` · router `/api/v1/sim/*`
- [ ] เทสต์ (spawner ปลอมที่คืน child EventEmitter มี `pid`, stdout/stderr): argv launch = `['ros2','launch','mbot2_description','two_mbot2.launch.py','robot_count:=2','headless:=true','world:=Map2']` · count 4 / world `../x` / world นอกรายการ → ValidationError · build=true spawn colcon ก่อน แล้ว launch เมื่อ exit 0 · build exit 1 + บรรทัด `File "x.py", line 12` → state error `{code:'BUILD_FAILED', file:'x.py', line:12}` · start twice → BUSY · stop ส่ง `SIGINT` ไปที่ `-pid` แล้ว `SIGTERM` เมื่อเกินเวลา (ใช้ timeout สั้นในเทสต์) · shutdown stops running sim
- [ ] FAIL → เขียน → PASS

### Task 5: บันทึกภารกิจ

**Files:** Create `backend/src/missions/{recorder,repo,routes}.js` · Test `backend/test/missions.test.js`

**Interfaces:**
- Consumes: `TelemetryStore` (team/events/paths), `SimRunner` events
- Produces: `class MissionRecorder` `begin({world, robotCount, env})`, `observe(teamData, events)`, `end(reason)`, `summary()->{result, junction_count, dead_end_count, duration_s, robots[], map, log}`, `discard()`, `status()` · `saveMission(db, userId, summary, meta)->id` · `listMissions(db, filter)` · `getMission(db, id)` · router `/api/v1/missions*`, `/api/v1/me/robot-prefs`
- [ ] เทสต์: ทุกหุ่นถึงเป้า → `ok`, บางตัว → `part`, ไม่มี → `stop` · นับ junction จาก `junctions[]` และ dead-end จาก branch `status==='BLOCKED'` · recorder tolerates malformed state (`robots` undefined, x NaN) · สมาชิก A เปิดภารกิจของ B → 403 · admin (`data.view`) เปิดได้ · list กรอง result/world/q, page_size 15 → 400
- [ ] FAIL → เขียน → PASS

### Task 6: API หลังบ้าน + โหมดปิดปรับปรุง

**Files:** Create `backend/src/admin/{users,missions,announcements,settings,audit,dashboard,routes}.js`, `backend/src/middleware/maintenance.js` · Test `backend/test/admin.test.js`

**Interfaces:** router `/api/v1/admin/*` ตาม spec ข้อ 2 หลังบ้าน · public `GET /api/v1/site`, `GET /api/v1/announcements/active`
- [ ] เทสต์: สมาชิกเรียก `/admin/*` ทุกตัว → 403 · admin ระงับสมาชิก → audit `user.suspend` + session ถูก revoke · admin ระงับ admin อื่น → 403 · ระงับตัวเอง → 409 `SELF` · ถอด owner คนสุดท้าย → 409 `LAST_OWNER` · owner ตั้ง member เป็น admin ได้ · maintenance on: member `GET /missions` → 503 `MAINTENANCE`, admin ผ่าน, `/auth/login` ผ่าน · announcement active กรองตาม audience/ช่วงวัน · audit CSV มี header
- [ ] FAIL → เขียน → PASS

### Task 7: ประกอบ app + WebSocket + ตั้งค่า

**Files:** Modify `backend/src/app.js`, `backend/src/index.js`, `backend/src/config/security.js`, `backend/package.json`, `backend/.env.example`, `backend/.gitignore` · Delete `backend/src/middleware/auth.js` · Modify tests `backend/test/api.test.js`
**Interfaces:** `createApp({ db, store, runner, recorder, origins }) -> { server, close() }` · WS ส่ง `{type:'snapshot', health, team, events, paths, sim, mission}` ทุก 500 ms และ `{type:'simlog', lines}`
- [ ] เทสต์: WS ไม่มี cookie → 401 · suspended user socket rejected · snapshot มี key `sim` และ `mission` · request เปลี่ยนข้อมูลจาก Origin อื่น → 403
- [ ] FAIL → เขียน → PASS · `npm start` เปิดได้จริง (ROS sourced) `/api/v1/site` ตอบ

### Task 8: Frontend พื้นฐาน

**Files:** Modify `frontend/package.json`, `frontend/index.html`, `frontend/src/main.jsx` · Create `frontend/src/styles/{tokens,base,components}.css`, `frontend/src/lib/{api,auth,theme,format}.js(x)`, `frontend/src/ui/*.jsx` (Button, Icon, Pill, Avatar, Field, Toggle, Segmented, Notice, Modal, Drawer, Toast, Pager, EmptyState, Skeleton, Gate), `frontend/src/layouts/{SiteLayout,ConsoleLayout,AdminLayout}.jsx`, `frontend/src/pages/{Home,Login,Register,NotFound}.jsx` · Delete `frontend/src/App.jsx`, `frontend/src/style.css`
**Interfaces:** `api(path, {method, body}) -> Promise<json>` throw `ApiError{status, code, message, fields}` · `useAuth() -> {user, permissions, can(key), login, logout, refresh}` · `useTheme()`
- [ ] `npm run build` ผ่าน · เปิดดู login/register/home ทั้งสองธีม

### Task 9: หน้าคอนโซล

**Files:** Create `frontend/src/lib/telemetry.js` (hook `useTelemetry()` ต่อ WS + reconnect 2s), `frontend/src/console/{MazeMap,RobotCards,LogList,SimProgress}.jsx`, `frontend/src/pages/console/{Connect,Control,Team,History,MissionDetail}.jsx` · ย้ายตรรกะจาก `frontend/src/RobotMap.jsx` แล้วลบไฟล์เดิม
- [ ] `npm run build` ผ่าน · ใช้กับ backend จริง: connect → control (ไม่มีซิม = Gate) · history ว่าง = EmptyState

### Task 10: หน้าหลังบ้าน

**Files:** Create `frontend/src/pages/admin/{Dashboard,Users,Roles,Missions,Announcements,Settings,Audit}.jsx`
- [ ] `npm run build` ผ่าน · ผ่าน UI: ระงับสมาชิก, เปลี่ยนบทบาท, สร้างประกาศ (เห็น banner), เปิดปิดปรับปรุง (สมาชิกเห็นหน้าปิดปรับปรุง), ดู audit

### Task 11: ทดสอบจริงและเอกสาร

**Files:** Modify `README.md`, `.claude/agents/*.md`
- [ ] รันซิมจริง headless 2 ตัว seed7 จากเว็บ → หุ่นขึ้นบนแผนที่ → จบ → บันทึก → เปิดในประวัติ · ตรวจไม่มี process `ign`/`gz`/`ros2` ค้างหลังหยุด
- [ ] ลอง Map1 1 รอบ รายงานผล
- [ ] อัปเดต README (วิธีรัน, create-owner) และ QA agents (backend สั่ง launch/stop ได้, ไม่มีคำสั่งมอเตอร์, session แทน token)
- [ ] `cd backend && npm test` ผ่านทั้งหมด · `cd frontend && npm run build` ผ่าน
