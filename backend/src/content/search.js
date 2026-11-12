// ค้นหา: บทเรียนที่เผยแพร่ + หน้าในเว็บ + ปัญหาที่เจอบ่อย (pages-and-flows.md › ค้นหา)
const PAGES = [
  ['page', 'รู้จักหุ่น', 'ชิ้นส่วนของ mBot2 แบบ 3D: อัลตราโซนิก Quad RGB ล้อ CyberPi', '/robot', 'เซนเซอร์ sensor ultrasonic rgb motor cyberpi imu caster'],
  ['page', 'คอนโซลหุ่น', 'รันซิม ดูแผนที่และ log สด บันทึกภารกิจ', '/console', 'console sim gazebo ซิม แผนที่ log'],
  ['page', 'ติดต่อทีม', 'อีเมล LINE และฟอร์มติดต่อ', '/contact', 'contact ติดต่อ ถาม'],
  ['page', 'เกี่ยวกับโปรเจกต์', 'ฝูงหุ่นสำรวจเขาวงกต เทคโนโลยีที่ใช้ และทีม', '/about', 'about ros gazebo ทีม'],
  ['page', 'นโยบายความเป็นส่วนตัว', 'เก็บข้อมูลอะไร นานแค่ไหน สิทธิ์ของคุณ', '/privacy', 'privacy pdpa คุกกี้ cookie'],
];
const FAQ = [
  ['help', 'ปุ่มรันซิมกดไม่ได้', 'มีซิมรันอยู่แล้ว หรือ backend ยังไม่ได้ source ROS 2', '/lessons/troubleshooting', 'run sim busy ros'],
  ['help', 'หุ่นหมุนหาเส้นไม่หยุด', 'เซนเซอร์สีไม่เห็นเส้น สนามอาจไม่มี Sensors plugin', '/lessons/troubleshooting', 'line lost rgb search'],
  ['help', 'build ไม่ผ่าน', 'ดูไฟล์และบรรทัดที่ผิดในหน้าเชื่อมหุ่น แก้แล้วรันอีกครั้ง', '/lessons/troubleshooting', 'colcon build error package'],
  ['help', 'เว็บขึ้นว่า ROS 2 ยังไม่เชื่อม', 'ต้อง source /opt/ros/humble/setup.bash ก่อน npm start', '/lessons/run-console', 'ros not connected rclnodejs topic'],
];

const norm = (text) => String(text ?? '').toLowerCase();

/** Returns [{ kind: 'lesson'|'page'|'help', title, summary, href }] ranked by where the words match. */
export function search(db, query, { loggedIn = false, limit = 30 } = {}) {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lessons = db.prepare(`SELECT slug, title, summary, body, audience FROM lessons
    WHERE deleted_at IS NULL AND status = 'published' ORDER BY ord`).all()
    .filter((l) => loggedIn || l.audience === 'all')
    .map((l) => ({ kind: 'lesson', title: l.title, summary: l.summary, href: `/lessons/${l.slug}`, head: `${l.title} ${l.summary}`, rest: l.body }));
  const statics = [...PAGES, ...FAQ].map(([kind, title, summary, href, keywords]) => ({
    kind, title, summary, href, head: `${title} ${summary}`, rest: keywords,
  }));
  return [...lessons, ...statics]
    .map((item) => {
      const head = norm(item.head);
      const rest = norm(item.rest);
      let score = 0;
      for (const w of words) {
        if (head.includes(w)) score += 3;
        else if (rest.includes(w)) score += 1;
        else return null;
      }
      return { score, item };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => ({ kind: item.kind, title: item.title, summary: item.summary, href: item.href }));
}
