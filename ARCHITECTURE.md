# mBot2 Multi-Robot Maze — System Architecture

เอกสารนี้อัปเดตจากภาพสถาปัตยกรรมเดิมที่มีเพียง VS Code → ROS 2 ↔ Gazebo โดยเพิ่มการตัดสินใจร่วมกันของหุ่น 2–3 ตัว และระบบเว็บสำหรับติดตามผล ข้อมูลส่วน “ปัจจุบัน” อ้างอิงจาก `two_mbot2.launch.py`, `maze_solver.py`, `team_coordinator.py` และโค้ดใน `backend/` กับ `frontend/` ณ 12 ตุลาคม 2569

## ภาพรวมระบบปัจจุบัน

```text
                 Ubuntu 22.04 / WSL + ROS 2 Humble

 Gazebo Sim Fortress (simple_branch_maze.sdf)
   ├─ หุ่นจำลอง mbot1, mbot2, [mbot3]
   ├─ เส้นดำ / แถบเหลือง / เป้าหมายสีเขียว / กำแพง
   └─ เซนเซอร์และสถานะจำลอง
             │  ros_gz_bridge: ข้อมูลเซนเซอร์เข้า ROS 2
             ▼
 ROS 2 Topics ของแต่ละหุ่น (/mbot1/..., /mbot2/..., /mbot3/...)
             │
             ├───────────────► maze_solver (Python, หนึ่ง node ต่อหุ่น)
             │                    │ ตัดสินใจตามเส้น/หลบสิ่งกีดขวาง/หาทางแยก
             │                    ├─ /mbotX/cmd_vel ─► ros_gz_bridge ─► Gazebo DiffDrive
             │                    ├─ /mbotX/trail ───────────────┐
             │                    └─ /maze_team/report ────┐     │
             │                                             ▼     │
             │                       team_coordinator (Python)   │
             │                         ├─ /maze_team/decision ──► maze_solver
             │                         └─ /maze_team/state ──────┤
             │                                                  │
             └──────────────────────────────────────────────────┤
                                                                ▼
                          WSL ~/mBot2_web/backend (Node.js + Express + rclnodejs + ws)
                          อ่าน topic อย่างเดียว; เก็บ snapshot/log ใน RAM
                              ├─ GET /api/health
                              ├─ GET /api/team
                              ├─ GET /api/events
                              └─ WS /ws/telemetry
                                        │ fetch + WebSocket
                                        ▼
                          Windows mBot2_web/frontend (React + Vite ในเบราว์เซอร์)
                          สถานะหุ่น / ทางแยก / เป้าหมาย / เหตุการณ์
```

`[mbot3]` หมายถึงเปิดเมื่อใช้ `robot_count:=3`; ค่าเริ่มต้นของ launch คือ 2 ตัว เว็บเตรียมการแสดงผลไว้ 3 ตัว แม้บางตัวจะยังไม่ออนไลน์

## หน้าที่ของแต่ละชั้นและเครื่องมือ

| ชั้น | เครื่องมือ/ไฟล์ | หน้าที่ |
|---|---|---|
| พัฒนา | VS Code, Git, Ubuntu 22.04 บน WSL | แก้โค้ดและรันเครื่องมือ Linux/ROS 2 |
| สร้างแพ็กเกจหุ่น | ROS 2 Humble, `colcon`, `ament`, Python, `mbot2_control`, `mbot2_description` | build node, robot model และ launch |
| หุ่นจำลอง/สนาม | Gazebo Sim Fortress, SDF world, URDF/Xacro, Gazebo DiffDrive | จำลอง 2–3 ตัวและสนามเส้นดำ–เหลือง–เขียว |
| เชื่อม Gazebo–ROS | `ros_gz_sim`, `ros_gz_bridge`, `robot_state_publisher` | spawn หุ่น, bridge message, เผย robot description/TF |
| พฤติกรรมรายตัว | `maze_solver` + `QuadRGBArray`, `UltrasonicSensor`, `WheelEncoder` | อ่านเซนเซอร์, ตามเส้น, ตรวจแยก/กำแพง/เป้าหมาย, ขับรถ |
| ประสานงานทีม | `team_coordinator` (Python) | รับรายงาน, จองกิ่งไม่ให้สำรวจซ้ำ, บันทึกกิ่งตัน, กระจายเป้าหมาย |
| Backend เว็บ | Node.js ใน WSL, Express, `rclnodejs`, `ws` (`~/mBot2_web/backend`) | subscribe ROS 2, แปลงเป็น REST/WebSocket แบบอ่านอย่างเดียว |
| Frontend เว็บ | React, Vite, `fetch`, Browser WebSocket, Node.js/npm (`C:\Users\knkzu\Desktop\mBot2_web\frontend`) | dashboard แสดงข้อมูลสดผ่านเบราว์เซอร์ |

ปัจจุบัน **ไม่มี** Express ที่สั่ง `/cmd_vel`, Axios, ฐานข้อมูล, ระบบบัญชีผู้ใช้, บริการคลาวด์ หรือแอปมือถือ Vite ใช้พัฒนาเว็บ; Node.js บน Ubuntu และ Windows เป็นคนละ runtime เพราะ `rclnodejs` ต้องโหลดไลบรารี ROS 2 ของ Linux

## ข้อมูลที่ไหลผ่านระบบ

| ทิศทาง | ช่องทาง | ประเภท/ความหมาย |
|---|---|---|
| Gazebo → ROS 2 → `maze_solver` | `/mbotX/quad_rgb_1/image` ถึง `_4/image`, `/mbotX/ultrasonic/scan`, `/mbotX/odom` | สีพื้น, ระยะข้างหน้า, ตำแหน่ง/การเคลื่อนที่ |
| Gazebo → ROS 2 | `/mbotX/joint_states`, `/mbotX/imu`, `/clock`, TF | สถานะจำลองที่ bridge ไว้; ไม่ใช่ทุก topic ถูกใช้ตัดสินใจโดยตรง |
| Gazebo → `maze_solver` (เฉพาะซิม) | `/world/simple_branch_maze/dynamic_pose/info` | พิกัดจริงจากซิมเพื่อให้หุ่นมีกรอบอ้างอิงร่วม; **ไม่ใช่แผนที่ล่วงหน้า** |
| `maze_solver` → Gazebo | `/mbotX/cmd_vel` (`geometry_msgs/Twist`) | ความเร็วเดินหน้าและความเร็วหมุนผ่าน bridge |
| หุ่น → ทีม | `/maze_team/report` (`std_msgs/String` JSON) | ตำแหน่ง, ขอเลือกกิ่ง, กิ่งตัน, พบเป้าหมาย |
| ทีม → หุ่น | `/maze_team/decision`, `/maze_team/state` (`std_msgs/String` JSON) | ผลเลือกกิ่งและสถานะทีม/แยก/เป้าหมาย |
| หุ่น → เว็บ | `/mbotX/trail` (`std_msgs/String` JSON) | ร่องรอยดิจิทัลของเส้นทางที่กำลังสำรวจ |
| ROS 2 → backend → เว็บ | REST `/api/*`, WebSocket `/ws/telemetry` | snapshot และเหตุการณ์; หน้าเว็บ **ไม่สั่งการหุ่น** |

หมายเหตุ: รายงาน/การตัดสินใจของทีมตอนนี้ใช้ **Topic** ที่บรรทุก JSON ใน `std_msgs/String` ไม่ใช่ ROS Service หรือ Action ส่วน Service เหมาะกับถาม–ตอบสั้น ๆ และ Action เหมาะกับงานนานที่ต้องมี progress/cancel หากเพิ่มภายหลัง

## Flow การทดลอง 1 รอบ

1. Launch เปิด world, spawn หุ่น 2 หรือ 3 ตัว, เริ่ม bridge, `team_coordinator` และ `maze_solver` แต่ละตัว
2. หุ่นอ่าน RGB เพื่อจับเส้นดำ; เจอเหลืองจึงชะลอและตรวจว่ามีทางแยก; ultrasonic ใช้ตรวจสิ่งกีดขวาง; odom/พิกัดซิมช่วยระบุตำแหน่ง
3. ที่ทางแยก หุ่นส่งคำขอผ่าน `/maze_team/report`; ตัวกลางเลือกกิ่งที่ยังไม่ถูกจองหรือไม่ได้ถูกบันทึกว่าตัน แล้วตอบ `/maze_team/decision`
4. ถ้าพบกำแพง หุ่นถอย/กลับตัว รายงานกิ่งตัน และตามเส้นกลับไปเลือกกิ่งอื่น; ระหว่างทางเผย `/mbotX/trail` เป็นร่องรอยดิจิทัล
5. ถ้าหุ่นตัวใดพบเป้าหมายสีเขียว จะรายงาน `GOAL`; ตัวกลางเผยพิกัดใน `/maze_team/state` เพื่อให้ตัวอื่นมุ่งไปรวมพล
6. Backend JS subscribe topic ของทีมและ trail แล้วส่ง REST/WebSocket ให้ React แสดงสถานะ ขณะที่การขับยังตัดสินใจใน ROS 2

## ข้อจำกัดและการต่อยอด

- Web backend เก็บข้อมูลใน RAM: ปิดแล้ว log หาย และยังไม่มีฐานข้อมูลหรือแผนที่กราฟที่คงอยู่
- หน้าเว็บแสดงรายการทางแยก/ตำแหน่ง ไม่ใช่แผนที่ภาพแบบ SLAM และไม่ได้รับภาพ RGB ดิบ
- `team_coordinator` เลือกกิ่งตามข้อมูลที่พบและทิศไปหาเป้าหมาย ไม่ใช่ shortest-path planner ทั่วทั้งเขาวงกต
- พิกัด `/world/.../dynamic_pose/info` เป็นของ Gazebo เท่านั้น หุ่นจริงต้องมี driver และระบบ localization ในกรอบร่วมก่อนใช้ตรรกะร่วมทีมแบบเดียวกัน
- การสั่งหุ่นจากเว็บ, ROS Service/Action, ฐานข้อมูล, mobile app และการเชื่อมหุ่นจริงเป็นงาน **อนาคต** ไม่ควรอธิบายว่าเสร็จแล้ว

## สรุปสั้นสำหรับนำเสนอ

“ระบบใช้ Gazebo จำลองหุ่น mBot2 สองถึงสามตัวในสนามเส้นสี ROS 2 รับข้อมูลเซนเซอร์และส่งคำสั่งขับ ตัว `maze_solver` ตัดสินใจเฉพาะหุ่นแต่ละตัว ส่วน `team_coordinator` ประสานการเลือกทางและเป้าหมายร่วมกัน เว็บ React ติดต่อ backend JavaScript/Express ที่ subscribe ROS 2 เพื่อแสดงผลสดเท่านั้น จึงแยกการควบคุมหุ่นออกจากการมอนิเตอร์ชัดเจน”
