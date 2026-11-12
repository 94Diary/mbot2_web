# สิ่งที่ต้องแก้ในโค้ดหุ่น (ros2_ws)

ให้เว็บและตัวเชื่อมใช้งานได้ตามที่ออกแบบ ทีมโค้ดหุ่นต้องเปิดค่าต่างๆ ให้ปรับจากภายนอกได้ และส่งเหตุการณ์ออกมาเป็น topic
แพ็กเกจที่เกี่ยว: `mbot2_description`, `mbot2_control`

## ต้องมีก่อน (ตัวเชื่อม v0–v2)

| # | เรื่อง | ตอนนี้ | ต้องเป็น |
|---|---|---|---|
| 1 | เลือกโลกในซิม | `two_mbot2.launch.py` ล็อกโลกไว้ที่ `mbot2_seed7_maze` | รับ `world:=<ชื่อ>` (หรือ path เต็ม) |
| 2 | จำนวนหุ่น | มี `robot_count:=2\|3` แล้ว | รองรับ 1–4 |
| 3 | headless | มี `headless:=true\|false` แล้ว | คงไว้ |
| 4 | ค่าตั้งหุ่น | ฝังในโค้ด | ROS parameter: `junction_wait` (วินาที), `max_speed` (ม./วินาที) ส่งผ่าน launch |
| 5 | โฟลเดอร์ worlds | ไฟล์ใน install share | ให้ launch อ่าน worlds จาก source dir ได้ (ไฟล์ที่เพิ่มใหม่ไม่ต้อง build ใหม่) |
| 6 | rosbridge | เปิดแยกเอง | ตัวเชื่อมเปิดให้ (ไม่ต้องแก้โค้ดหุ่น) ต้องลง `ros-humble-rosbridge-suite` |

## ต้องมีเพื่อหน้าควบคุม/ประวัติ (ตัวเชื่อม v3)

ส่งต่อหุ่น (`/<ns>/…`) หรือรวมที่ topic กลาง:

| topic | ชนิด (เสนอ) | ใช้ทำ |
|---|---|---|
| `/<ns>/pose` | geometry_msgs/Pose2D หรือ Odometry | ตำแหน่งบนแผนที่ |
| `/<ns>/battery` | sensor_msgs/BatteryState | แบตบนการ์ด (ซิม = ค่าจำลอง) |
| `/<ns>/status` | std_msgs/String | ข้อความสถานะใต้ชื่อหุ่น |
| `/maze/events` | custom: `{ns, kind, x, y, id, branches}` | **ทางแยก** (kind=junction) · **ทางตัน** (dead_end) · ถึงเป้าหมาย (goal) |
| `/maze/edges` | custom: `{from, to, path[], visitor}` | เส้นที่หุ่นเดิน + ใครผ่านก่อน |
| `/<ns>/log` | custom: `{level, msg, kind}` | Log สดบนเว็บ |
| `/<ns>/cmd_mode` (sub) | std_msgs/String `explore\|shortcut` | ปุ่มโหมดบนการ์ด |
| `/team/estop` (sub) | std_msgs/Empty | หยุดทุกตัว |
| `/team/heartbeat` (sub) | std_msgs/Empty ทุก 0.5 วินาที | ถ้าขาดเกิน 1–2 วินาที **หุ่นต้องหยุดเอง** (สำคัญมากกับหุ่นจริง) |

ตอนจบภารกิจ ตัวเชื่อมจะรวมข้อมูลเหล่านี้เป็น `map.json` + `log.ndjson` (ฟอร์แมตใน data-model.md)
ถ้าโค้ดหุ่นมีแผนที่ร่วมของทีมอยู่แล้ว (shared map ของทางแยก/กิ่ง) ให้ publish ตัวนั้นออกมาตรงๆ จะง่ายที่สุด

## หุ่นจริง (ตัวเชื่อม v4)

- launch สำหรับหุ่นจริง (ยังไม่มี — ดู toRealbot.md)
- วิธีค้นหาหุ่นในวง Wi-Fi (เช่น ให้หุ่นประกาศตัว หรือรายการ IP ใน config)
- failsafe หยุดเองเมื่อขาด heartbeat
- ค่าแบตจริงจาก CyberPi

## ตรวจเครื่อง (doctor) จะเช็กอะไร

`/opt/ros/humble` · `ign gazebo` (Fortress) · `~/ros2_ws/src/mbot2_description` · `rosbridge_server` · WSLg (`$WAYLAND_DISPLAY` / `$DISPLAY`) · `git rev-parse HEAD` ของ ros2_ws
