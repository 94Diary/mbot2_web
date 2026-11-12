# ตัวเชื่อมเครื่อง (agent) — สเปก

โปรแกรม Python ที่ผู้ใช้ติดตั้งใน WSL รับคำสั่งจากปุ่มบนเว็บแล้วรันคำสั่ง ROS แทนผู้ใช้
**ไม่อยู่ในเว็บ** ต้องติดตั้งลงเครื่อง เพราะเบราว์เซอร์ถูกกันไม่ให้สั่งระบบปฏิบัติการ

เทียบได้กับ: Arduino Cloud Agent, foxglove_bridge (แต่ของเรารันคำสั่ง build/launch ได้ด้วย)

## Stack

| ส่วน | ใช้ |
|---|---|
| ภาษา | Python 3.10 (มีใน Ubuntu 22.04 อยู่แล้ว) |
| WebSocket server | `websockets` (หรือ FastAPI + uvicorn) ฟังที่ `127.0.0.1:8765` |
| รันคำสั่ง | `asyncio.create_subprocess_exec` + `start_new_session=True` |
| อ่านข้อมูลหุ่น | v0–v2 ใช้ rosbridge · v3+ ใช้ `rclpy` แล้วส่งต่อผ่าน WebSocket เดียวกัน |
| เช็กไฟล์ SDF | `xml.etree.ElementTree` |
| ติดตั้ง | `pipx` + `install.sh` (ไม่ใช้ sudo) |
| เปิดอัตโนมัติ | systemd `--user` (ต้องเปิด `systemd=true` ใน `/etc/wsl.conf`) · ทางสำรอง: Task Scheduler ของ Windows สั่ง `wsl -d Ubuntu-22.04 -- mbot-agent start` |
| ค่าตั้ง | `~/.mbot-agent/config.toml` |

## โครงไฟล์

```
mbot-agent/
├─ mbot_agent/
│  ├─ __main__.py    # CLI: setup / start / stop / status / update / pair-code
│  ├─ server.py      # WebSocket, เช็ก Origin + token
│  ├─ commands.py    # ตารางคำสั่งที่อนุญาต + ตรวจ args
│  ├─ runner.py      # subprocess, stream log, หยุดทั้ง process group
│  ├─ worlds.py      # world.list / world.add
│  ├─ doctor.py      # ตรวจ ROS, Gazebo, ros2_ws, rosbridge, WSLg
│  ├─ pairing.py     # รหัส 6 หลัก → token
│  └─ export.py      # รวม log + แผนที่ ตอนจบภารกิจ
├─ install.sh
└─ pyproject.toml
```

## config.toml

```toml
workspace = "/home/<user>/ros2_ws"
allowed_origins = ["https://mbot2-maze.app"]   # dev เพิ่ม "http://localhost:5173"
port = 8765
[[paired]]
name = "คอมที่บ้าน"
token_hash = "sha256:…"      # เก็บเฉพาะ hash
created = "2026-11-12T18:00:00+07:00"
expires = "2026-12-12T18:00:00+07:00"   # ถ้าเปิดกฎจับคู่ใหม่ทุก 30 วัน
```

## การติดตั้ง (มุมผู้ใช้)

1. เปิด Ubuntu วาง: `curl -fsSL https://mbot2-maze.app/install.sh | bash`
2. สคริปต์ถามตำแหน่ง ros2_ws (Enter = `~/ros2_ws`) ติดตั้งลง `~/.mbot-agent` ตั้งให้เปิดเอง
3. กลับเว็บ กด “ตรวจหาตัวเชื่อม” → Chrome ถามสิทธิ์ → กดอนุญาต
4. ใส่รหัส 6 หลักที่ Ubuntu แสดง (เปลี่ยนทุก 2 นาที) → ได้ token

`install.sh` ต้องเปิดอ่านได้บน GitHub และหน้า “ตัวเชื่อมเครื่อง” ต้องอธิบายว่าคำสั่งทำอะไรกับเครื่อง

## การเชื่อมต่อ

```
เบราว์เซอร์                          ตัวเชื่อม
   │  WS connect (Origin: https://mbot2-maze.app)
   │ ─────────────────────────────────▶ เช็ก Origin ไม่ตรง = ปิด
   │  {"type":"hello","token":"…"}    │
   │ ─────────────────────────────────▶ token ถูก = ready / ไม่มี = need_pair
   │ ◀───────────────────────────────── {"type":"ready","version":"0.3.1","machine":{…}}
```

จับคู่:
```
→ {"type":"pair","code":"482913","name":"คอมที่บ้าน"}
← {"type":"paired","token":"<random 32 bytes>"}      # เบราว์เซอร์เก็บใน localStorage
← {"type":"error","code":"PAIR_INVALID"}             # รหัสผิดหรือหมดอายุ
```

## ข้อความ (เบราว์เซอร์ → ตัวเชื่อม)

ทุกข้อความมี `id` ให้ตอบกลับคู่กันได้

```json
{ "id": "c1", "cmd": "sim.start", "args": { "count": 3, "world": "mbot2_seed7_maze", "build": true, "headless": false, "params": { "junction_wait": 5, "max_speed": 0.15 } } }
```

| cmd | args | ทำอะไร |
|---|---|---|
| `doctor` | – | ตรวจเครื่อง คืนรายการ ok/ขาด |
| `world.list` | – | รายชื่อไฟล์ใน `<ws>/src/mbot2_description/worlds/*.sdf` |
| `world.add` | `name`, `content` (base64, ≤5 MB) | เช็ก SDF แล้วเขียนลง worlds · ชื่อไฟล์ `[a-z0-9_]+` เท่านั้น |
| `build` | – | `colcon build --packages-select mbot2_control mbot2_description --symlink-install` |
| `sim.start` | `count` 1–4, `world` ∈ world.list, `build`, `headless`, `params` | build (ถ้าเลือก) → launch → rosbridge |
| `sim.stop` | – | SIGINT ทั้ง process group รอ 5 วินาที แล้ว SIGTERM |
| `estop` | – | publish หยุดทุกตัวทันที แล้ว `sim.stop` |
| `real.scan` | – | ค้นหาหุ่นจริงในเครือข่าย (รอ launch หุ่นจริง) |
| `mission.export` | `mission_id` | คืน log + แผนที่ + env (commit, versions, params) |
| `robot.mode` | `robot`, `mode` ∈ explore/shortcut | ส่งคำสั่งเปลี่ยนโหมดให้หุ่น |

**ห้าม**รับคำสั่งหรือ path อื่นนอกตาราง · ทุก arg ต้องผ่าน whitelist/regex ก่อนสร้างคำสั่ง · ใช้ `exec` แบบส่ง argv ไม่ต่อสตริงเข้า shell

## ข้อความ (ตัวเชื่อม → เบราว์เซอร์)

```json
{ "type": "progress", "id": "c1", "step": "build|gazebo|bridge|link", "state": "run|done|fail" }
{ "type": "log", "id": "c1", "stream": "stdout|stderr", "line": "Finished <<< mbot2_control [3.4s]" }
{ "type": "result", "id": "c1", "ok": false, "error": { "code": "BUILD_FAILED", "file": "junction_manager.py", "line": 142, "message": "IndentationError" } }
{ "type": "state", "sim": "idle|starting|running|stopping", "robots": 3 }
```

v3+ (ส่งข้อมูลหุ่นแทน rosbridge):
```json
{ "type": "robot", "ns": "/mbot1", "pose": [x, y, yaw], "battery": 72, "status": "…" }
{ "type": "event", "ns": "/mbot1", "kind": "junction|dead_end|goal", "at": [x, y], "id": "J4", "branches": 3 }
{ "type": "rlog", "ns": "/mbot1", "level": "info|ok|warn|err", "t": "06:14", "msg": "…" }
```

## รหัสข้อผิดพลาด

| code | ความหมาย | ข้อความบนเว็บ |
|---|---|---|
| `ORIGIN_DENIED` | โดเมนไม่อยู่ใน allowed_origins | (ปิดการเชื่อมทันที) |
| `NEED_PAIR` / `PAIR_INVALID` | ยังไม่จับคู่ / รหัสผิด | ใส่รหัส 6 หลักใหม่ |
| `BUSY` | มีซิมรันอยู่ | จบภารกิจเดิมก่อน |
| `BUILD_FAILED` | colcon ล้ม | แสดงไฟล์ + บรรทัด + log |
| `WORLD_INVALID` | ไฟล์ไม่ใช่ SDF / ชื่อผิด | เลือกไฟล์ .sdf ที่ถูกต้อง |
| `MISSING_DEP` | doctor เจอของขาด | ลิงก์ไปบทเรียนที่เกี่ยว |
| `BRIDGE_PORT` | พอร์ต 9090 ถูกใช้ | ปิด Terminal เก่าแล้วรันใหม่ |
| `VERSION_TOO_OLD` | ต่ำกว่าเวอร์ชันขั้นต่ำ | `mbot-agent update` |

## ความปลอดภัย (ต้องมีก่อนเปิดสาธารณะ)

- bind `127.0.0.1` เท่านั้น
- เช็ก `Origin` header ทุกการเชื่อม
- token ต่อเบราว์เซอร์ เก็บ hash ฝั่งตัวเชื่อม ยกเลิกได้ (`mbot-agent unpair`, หรือจากเว็บ)
- จำกัดอัตรา: รหัสจับคู่ผิด 5 ครั้ง → ล็อก 5 นาที
- ไม่มีคำสั่งอิสระ ไม่มีการอ่าน/เขียนไฟล์นอก `worlds/` และ `~/.mbot-agent/`
- log ของตัวเชื่อมไม่เก็บ token
- อัปเดตผ่าน `mbot-agent update` ตรวจ checksum ของแพ็กเกจ

## รุ่น

| รุ่น | ขอบเขต |
|---|---|
| v0 | sim.start / sim.stop / build + stream log · ทดสอบกับหน้าเว็บ localhost |
| v1 | pairing, token, Origin check, autostart, doctor |
| v2 | world.list / world.add, params, estop |
| v3 | rclpy ส่งข้อมูลหุ่น/เหตุการณ์ทางแยกเอง แทน rosbridge, mission.export |
| v4 | real.scan + launch หุ่นจริง |
