# mBot2 Maze Ops

เว็บคอนโซลและห้องเรียนของฝูงหุ่น mBot2 สำรวจเขาวงกต: กดรันซิม Gazebo จากเว็บ ดูแผนที่และ log ของหุ่นแบบสด
บันทึกภารกิจไว้ดูย้อนหลัง บทเรียน 13 บท หน้ารู้จักหุ่นแบบ 3D และหลังบ้านครบ (ผู้ใช้ บทเรียน ประกาศ ข้อความติดต่อ
สถานะระบบ เครื่องรันซิม สำรองข้อมูล ตั้งค่าเว็บ Audit log)

- เฟส 2 (หน้าสาธารณะ บทเรียน 3D หลังบ้านที่เหลือ): [spec](docs/superpowers/specs/2026-11-12-maze-ops-phase2-design.md)

- ระบบเฟส 1 ทั้งหมด **รันบนเครื่องเดียว (Ubuntu 22.04 / WSL)** ดูเหตุผลและขอบเขตใน
  [docs/superpowers/specs/2026-11-12-maze-ops-phase1-design.md](docs/superpowers/specs/2026-11-12-maze-ops-phase1-design.md)
- ภาพรวมการออกแบบทั้งหมด (mockup, บทบาท, API เต็ม) อยู่ใน [docs/](docs/README.md)
- สถาปัตยกรรม ROS 2 ↔ เว็บ: [ARCHITECTURE.md](ARCHITECTURE.md)

## สถาปัตยกรรม

```
React + Vite (frontend/)  ──fetch /api/v1, WS /ws/telemetry──▶  Express (backend/)
                                                                  ├─ auth/      บัญชี session cookie + สิทธิ์ตาม docs/roles-permissions.md
                                                                  ├─ sim/       ตัวสั่งซิม: รันได้เฉพาะ colcon build / ros2 launch ที่อนุญาต
                                                                  ├─ console/   ประสานซิม ↔ telemetry ↔ recorder
                                                                  ├─ missions/  บันทึกภารกิจ + map model เดียวใช้ทั้งสดและย้อนหลัง
                                                                  ├─ admin/     หลังบ้าน (ผู้ใช้ ประกาศ ตั้งค่า dashboard)
                                                                  ├─ content/   บทเรียน + ค้นหา (โครง 13 บทใส่ให้ตอนตารางว่าง)
                                                                  ├─ contact/   ฟอร์มติดต่อ + ความยินยอมคุกกี้ (PDPA)
                                                                  ├─ system/    สถานะระบบ เครื่องรันซิม สำรอง/กู้คืน (03:00 ทุกวัน)
                                                                  ├─ modules/telemetry/  rclnodejs subscribe topic ของทีม (อ่านอย่างเดียว)
                                                                  └─ db/        SQLite (node:sqlite) · audit_log แก้/ลบไม่ได้
                                                                        │ child_process (process group)
                                                                        ▼
                                                    ros2 launch mbot2_description two_mbot2.launch.py world:=…
```

backend **ไม่มี** publisher `/cmd_vel` หรือคำสั่งมอเตอร์ใดๆ ปุ่ม "หยุดทุกตัว" ปิด process ของ launch ทั้งกลุ่ม

## ต้องมีในเครื่อง

- Ubuntu 22.04 (WSL2) + ROS 2 Humble + Gazebo Fortress
- โค้ดหุ่นใน `~/ros2_ws` ที่ build แล้ว (branch ที่ launch รับ `world:=`)
- Node.js ≥ 22.13 **ใน Ubuntu** (เช่นผ่าน nvm) · Node ของ Windows โหลดไลบรารี ROS ของ Linux ไม่ได้

## ตั้งค่าครั้งแรก

```bash
cd ~/mbot2_web/backend
npm ci
cp .env.example .env          # แก้ MBOT2_WS_PATH ให้ชี้ ros2_ws ของเครื่องนี้
npm run create-owner -- --email you@example.com --name "ชื่อของคุณ"   # ถามรหัสผ่านทาง stdin

cd ~/mbot2_web/frontend
npm ci
```

ฐานข้อมูลอยู่ที่ `backend/data/mbot2.db` และไฟล์สำรองที่ `backend/backups/` (git ignore ทั้งคู่) · สมาชิกคนอื่นสมัครด้วยรหัสเชิญจากหลังบ้าน › ผู้ใช้ › เชิญผู้ใช้

## รันทุกครั้ง (2 terminal)

```bash
# Terminal 1: backend (ต้อง source ROS ก่อน)
cd ~/mbot2_web/backend
source /opt/ros/humble/setup.bash && source ~/ros2_ws/install/setup.bash
npm start

# Terminal 2: frontend
cd ~/mbot2_web/frontend
npm run dev
```

เปิด http://127.0.0.1:5173 → เข้าสู่ระบบ → คอนโซล › เชื่อมหุ่น → รันซิม
ไม่ต้องเปิด Gazebo เอง เว็บสั่ง `ros2 launch` ให้ · กด Ctrl+C ที่ backend จะปิดซิมที่รันอยู่ก่อนปิดตัว

## ทดสอบ

```bash
cd backend && npm test        # node:test: auth, สิทธิ์ 401/403, ตัวสั่งซิม (spawner ปลอม), ภารกิจ, หลังบ้าน, WebSocket
cd frontend && npm run build
```

## API (สรุป · prefix `/api/v1`)

| กลุ่ม | endpoint |
|---|---|
| บัญชี | `POST /auth/login` · `POST /auth/register` · `POST /auth/logout` · `GET /me` · `POST /me/password` |
| ซิม | `GET /sim/worlds` · `GET /sim/state` · `POST /sim/preview` · `POST /sim/start` · `POST /sim/stop` |
| ภารกิจ | `GET /mission/current` · `POST /mission/save` · `POST /mission/discard` · `GET/PATCH/DELETE /missions/:id` · `GET /missions` · `GET/PUT /me/robot-prefs` |
| telemetry | `GET /telemetry/{health,team,paths,goals,topics,events,logs}` · `WS /ws/telemetry` |
| หลังบ้าน | `/admin/{dashboard,users,invites,roles,missions,announcements,settings,audit}` |
| สาธารณะ | `GET /site` · `GET /site/status` · `GET /announcements/active` · `GET /lessons` · `GET /lessons/:slug` · `POST/DELETE /lessons/:id/progress` · `GET /search` · `POST /contact` · `POST /consent` |
| หลังบ้าน (เฟส 2) | `/admin/{lessons,messages,system,machine,backups}` |

ผิดพลาดตอบ `{ "error": { "code", "message", "fields?" } }` · รายการตอบ `{ items, total, page, page_size }` (page_size 10/20/30/50)

## ข้อจำกัดเฟส 1

- เว็บและซิมอยู่เครื่องเดียว bind `127.0.0.1` เท่านั้น ยังไม่ใช่เว็บสาธารณะ (ไม่มี HTTPS, 2FA, CAPTCHA ตอนล็อกอิน, อีเมล, ลืมรหัสผ่าน)
- บทเรียนเป็นโครงหัวข้อ ทีมเติมเนื้อหาในหลังบ้าน › บทเรียน
- สำรองข้อมูลอยู่ในเครื่องเดียวกับเว็บ ควรคัดลอก `backend/backups/` ไปเก็บที่อื่นเป็นระยะ
- แบตเตอรี่และการสลับโหมดสำรวจ/ตัดทางรอโค้ดหุ่นส่ง topic เพิ่ม (docs/robot-code-changes.md)
- หุ่นจริงยังไม่รองรับ
