// โครงบทเรียน 13 บทจาก docs/pages-and-flows.md · ทีมเติมเนื้อหาจริงในหลังบ้าน
// (ใส่เฉพาะตอนตาราง lessons ว่าง จึงไม่ทับสิ่งที่ทีมแก้แล้ว)
import { nowIso } from '../db/index.js';

const LESSONS = [
  ['intro', 'รู้จักโปรเจกต์', 'หุ่นทำอะไร และทำไมต้องเป็นฝูง', 'published',
    ['ภาพรวมของโปรเจกต์', 'หุ่น mBot2 หนึ่งตัวทำอะไรได้บ้าง', 'ทำไมใช้หลายตัวช่วยกันสำรวจ', 'เว็บนี้ช่วยอะไร']],
  ['install-wsl', 'ติดตั้ง WSL และ Ubuntu', 'เตรียมเครื่อง Windows ให้รัน Linux', 'published',
    ['สิ่งที่ต้องมี', 'เปิด WSL2', 'ติดตั้ง Ubuntu 22.04', 'ตรวจว่าใช้ได้', 'ปัญหาที่พบบ่อย']],
  ['install-ros2', 'ติดตั้ง ROS 2 และ Gazebo', 'Humble กับ Fortress ตามเวอร์ชันของทีม', 'published',
    ['เวอร์ชันที่ทีมใช้', 'ติดตั้ง ROS 2 Humble', 'ติดตั้ง Gazebo Fortress และ ros_gz', 'ตรวจว่าใช้ได้', 'ปัญหาที่พบบ่อย']],
  ['first-build', 'ดึงโค้ดทีมและ build ครั้งแรก', 'git clone ลง ~/ros2_ws แล้ว colcon build', 'published',
    ['โครงสร้าง ~/ros2_ws', 'ดึงโค้ดจาก GitHub', 'colcon build', 'source setup.bash', 'ตรวจว่า build ผ่าน']],
  ['run-console', 'เปิดเว็บคอนโซลบนเครื่อง', 'รัน backend และ frontend ให้ปุ่มบนเว็บสั่งซิมได้', 'published',
    ['เว็บคุยกับ ROS ยังไง', 'ติดตั้ง Node.js ใน Ubuntu', 'ตั้งค่า backend/.env', 'รัน backend และ frontend', 'ตรวจว่าเชื่อม ROS แล้ว']],
  ['first-sim', 'รันซิมครั้งแรกจากเว็บ', 'กดรัน ดูหุ่นวาดแผนที่ แล้วบันทึกผล', 'published',
    ['เลือกจำนวนหุ่นและสนาม', 'อ่านความคืบหน้าและข้อความจาก Terminal', 'อ่านแผนที่และ log สด', 'จบภารกิจและบันทึก', 'เปิดดูในประวัติ']],
  ['ros-basics', 'Topic, node และ namespace', 'หุ่นคุยกันยังไงใน ROS 2', 'published',
    ['node คืออะไร', 'topic และ message', 'namespace /mbot1 /mbot2', 'คำสั่ง ros2 topic ที่ใช้บ่อย']],
  ['sensors', 'อ่านเซนเซอร์ของหุ่น', 'อัลตราโซนิก, Quad RGB, encoder, IMU', 'published',
    ['อัลตราโซนิก', 'Quad RGB', 'Encoder ล้อ', 'IMU', 'ดูค่าจริงในซิม']],
  ['junction-decision', 'หุ่นตัดสินใจที่ทางแยกยังไง', 'สแกนหากิ่ง แล้วถามทีมว่าไปทางไหน', 'published',
    ['ตรวจเจอทางแยก', 'สแกนหากิ่ง', 'ขอกิ่งจากทีม', 'ทางตันและการถอยกลับ']],
  ['team-map', 'แผนที่ร่วมของทีม', 'จุด กิ่ง และทางตันที่ทุกตัวใช้ร่วมกัน', 'published',
    ['ชนิดของจุดในแผนที่', 'กิ่งและสถานะ', 'การจองกิ่ง', 'อ่าน /maze_team/state']],
  ['yielding', 'หลบกันเมื่อวิ่งสวนทาง', 'ใครถอย ใครรอ และรอนานแค่ไหน', 'draft',
    ['เมื่อไหร่ถือว่าสวนทาง', 'ใครเป็นฝ่ายหลบ', 'สถานะ YIELD ต่างๆ']],
  ['to-real-robot', 'ย้ายจากซิมไปหุ่นจริง', 'สิ่งที่ต้องรู้และต้องแก้จาก toRealbot', 'draft',
    ['ซิมต่างจากหุ่นจริงตรงไหน', 'สิ่งที่ต้องแก้ในโค้ด', 'ความปลอดภัยเมื่อใช้หุ่นจริง']],
  ['troubleshooting', 'แก้ปัญหาที่เจอบ่อย', 'อาการ สาเหตุ และวิธีแก้', 'published',
    ['ปุ่มรันซิมกดไม่ได้', 'หุ่นหมุนหาเส้นไม่หยุด', 'build ไม่ผ่าน', 'เว็บขึ้นว่า ROS 2 ยังไม่เชื่อม']],
];

function outline(summary, sections) {
  const parts = [`> ${summary}`, '', '_โครงบทเรียน · ทีมเติมเนื้อหาในหลังบ้าน › บทเรียน_'];
  for (const heading of sections) parts.push('', `## ${heading}`, '', '(เนื้อหาส่วนนี้ยังไม่ได้เขียน)');
  return parts.join('\n');
}

export function seedLessons(db) {
  if (db.prepare('SELECT COUNT(*) AS n FROM lessons').get().n > 0) return 0;
  const now = nowIso();
  const insert = db.prepare(`INSERT INTO lessons (ord, slug, title, summary, body, status, audience, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'all', ?, ?)`);
  LESSONS.forEach(([slug, title, summary, status, sections], i) => {
    insert.run(i + 1, slug, title, summary, outline(summary, sections), status, now, now);
  });
  return LESSONS.length;
}
