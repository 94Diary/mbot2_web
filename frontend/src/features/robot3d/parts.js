// 6 ชิ้นส่วนตามดีไซน์ “รู้จักหุ่น” · ลำดับตรงกับกลุ่มใน groupOf() (0 อัลตราโซนิก … 5 ตัวถัง)
// ข้อมูล topic/อัตรา/ไฟล์ มาจาก ~/ros2_ws (urdf/mbot2.urdf.xacro, solver_parts/config.py)
export const PARTS = [
  {
    key: 'ultrasonic', num: 1, name: 'อัลตราโซนิก', short: 'เห็นของข้างหน้า',
    what: 'ยิงคลื่นเสียงออกไปข้างหน้าแล้วจับเวลาที่สะท้อนกลับ เพื่อรู้ระยะของสิ่งที่อยู่ตรงหน้า 3–300 ซม.',
    use: 'ถ้ามีของขวางใกล้กว่า 0.25 ม. หุ่นจะหยุดและถอยกลับ ใช้ตรวจกำแพงปลายทางตัน',
    real: 'ในซิมจำลองด้วย gpu_lidar ลำแสงแคบ ๆ ค่าจึงนิ่งกว่าเซนเซอร์จริงที่มีสัญญาณรบกวนจากพื้นผิว',
    topic: '/mbotN/ultrasonic/scan', type: 'sensor_msgs/LaserScan', rate: '10 Hz', file: 'modules/sensors/ultrasonic_sensor.py',
    code: 'OBSTACLE_STOP_DISTANCE_M = 0.25\n\nif scan.front_distance() < OBSTACLE_STOP_DISTANCE_M:\n    self._change_state(REVERSING)',
    specs: [['ระยะวัด', '3–300 ซม.'], ['หยุดเมื่อใกล้กว่า', '0.25 ม.'], ['อัปเดต', '10 ครั้ง/วินาที']],
  },
  {
    key: 'quadrgb', num: 2, name: 'Quad RGB', short: 'อ่านเส้นและสีพื้น',
    what: 'กล้องสีเล็ก ๆ 4 ตัวใต้หุ่น อ่านว่าพื้นตรงนั้นเป็นสีอะไร ดำ ขาว เหลือง หรือแดง',
    use: 'ใช้เดินตามเส้นดำ รู้ว่ากำลังเข้าทางแยกเมื่อเจอแถบเหลือง และรู้ว่าถึงเป้าหมายเมื่อเจอพื้นสีแดง',
    real: 'หุ่นจริงต้องปรับเทียบแสงก่อนใช้ ในซิมแสงคงที่จึงอ่านสีได้แม่นทุกครั้ง',
    topic: '/mbotN/quad_rgb_1..4/image', type: 'sensor_msgs/Image', rate: '15 Hz', file: 'modules/sensors/quad_rgb_sensor.py',
    code: 'if self.sensors.any_black():\n    follow_line()\nif self.sensors.any_green():\n    self._change_state(GOAL_PARKING)',
    specs: [['จำนวนจุดวัด', '4 จุด'], ['สีที่แยกได้', 'ดำ ขาว เหลือง แดง เขียว'], ['อัปเดต', '15 ครั้ง/วินาที']],
  },
  {
    key: 'wheels', num: 3, name: 'ล้อและ encoder', short: 'นับระยะที่เดิน',
    what: 'มอเตอร์สองตัวขับล้อซ้ายขวา แต่ละตัวมี encoder นับว่าล้อหมุนไปกี่องศา',
    use: 'รวมการหมุนของสองล้อเป็นตำแหน่งและระยะทาง (odometry) หุ่นเลี้ยวด้วยการให้สองล้อหมุนเร็วไม่เท่ากัน',
    real: 'ล้อจริงลื่นได้บนพื้นเรียบ ระยะสะสมจึงคลาด ในซิมเว็บใช้พิกัดจาก Gazebo ช่วยจัดตำแหน่ง',
    topic: '/mbotN/odom · /mbotN/cmd_vel', type: 'nav_msgs/Odometry · geometry_msgs/Twist', rate: '50 Hz', file: 'modules/utils/encoder.py',
    code: 'FORWARD_SPEED = 0.55\nMAX_TURN = 0.5\n\ntwist.linear.x = FORWARD_SPEED\ntwist.angular.z = clamp(error * TURN_GAIN, MAX_TURN)',
    specs: [['ขับเคลื่อน', '2 ล้อ (differential)'], ['ความเร็วเดินหน้า', '0.55 (สัดส่วน)'], ['เลี้ยวสูงสุด', '0.5 rad/s']],
  },
  {
    key: 'cyberpi', num: 4, name: 'บอร์ดควบคุม CyberPi', short: 'สมองของหุ่น',
    what: 'บอร์ดหลักที่มีจอ ปุ่ม จอยสติก และ Wi-Fi รันโปรแกรมควบคุมหุ่นและคุยกับเครื่องที่รัน ROS',
    use: 'ในซิมสมองของหุ่นคือ node maze_solver หนึ่งตัวต่อหุ่น ตัดสินใจตามเซนเซอร์แล้วส่งคำสั่งความเร็วให้ล้อ',
    real: 'หุ่นจริงต้องมี driver บน CyberPi ที่ส่งข้อมูลเซนเซอร์เข้า ROS ซึ่งยังไม่ได้ทำในโปรเจกต์นี้',
    topic: '/maze_team/report · /mbotN/trail', type: 'std_msgs/String (JSON)', rate: 'ตามเหตุการณ์', file: 'maze_solver.py',
    code: "self.cmd_pub = self.create_publisher(Twist, 'cmd_vel', 10)\nself.trail_pub = self.create_publisher(String, 'trail', 10)",
    specs: [['ภาษา', 'Python (rclpy)'], ['node ต่อหุ่น', '1 (maze_solver)'], ['ตัดสินใจร่วม', 'team_coordinator']],
  },
  {
    key: 'imu', num: 5, name: 'IMU', short: 'รู้ว่าหมุนไปเท่าไหร่',
    what: 'ไจโรและตัววัดความเร่งบนบอร์ด บอกว่าหุ่นหมุนไปกี่องศาและเอียงหรือไม่',
    use: 'ใช้ตอนเลี้ยวที่ทางแยก ให้หยุดหมุนเมื่อถึงมุมที่ต้องการ (คลาดได้ไม่เกิน 0.07 rad)',
    real: 'IMU จริงมีค่าลอย (drift) ต้องรีเซ็ตเป็นระยะ ในซิมค่าแม่นตลอด',
    topic: '/mbotN/imu', type: 'sensor_msgs/Imu', rate: '50 Hz', file: 'solver_parts/control_loop.py',
    code: 'TURN_TOLERANCE_RAD = 0.07\n\nif abs(angle_error) < TURN_TOLERANCE_RAD:\n    self._change_state(FOLLOW)',
    specs: [['แกน', 'ไจโร 3 แกน + ความเร่ง 3 แกน'], ['ความแม่นตอนเลี้ยว', '±0.07 rad (≈4°)'], ['อัปเดต', '50 ครั้ง/วินาที']],
  },
  {
    key: 'body', num: 6, name: 'ตัวถังและล้อหน้า', short: 'โครงอะลูมิเนียม',
    what: 'โครงอะลูมิเนียมอะโนไดซ์สีฟ้า ล้อหน้าเป็นลูกบอลหมุนอิสระ และแบตเตอรี่ใต้บอร์ด',
    use: 'ไม่ได้ส่งข้อมูลเข้า ROS แต่ขนาดตัวถังกำหนดว่าหุ่นต้องเริ่มเลี้ยวห่างจากทางแยกแค่ไหน',
    real: 'แบตเตอรี่จริงลดลงระหว่างวิ่ง เว็บจะแสดงแบตได้เมื่อโค้ดหุ่นส่งค่ามา',
    topic: null, type: null, rate: null, file: 'urdf/mbot2.urdf.xacro',
    code: '<!-- urdf: base_link + caster + 2 wheels -->\nWHEEL_X_OFFSET_M = -0.015  # แกนล้ออยู่หลัง base_link',
    specs: [['ขนาด', '13 × 9.5 ซม.'], ['ล้อหน้า', 'ลูกบอลหมุนอิสระ'], ['แบตเตอรี่', 'ยังไม่ส่งค่าเข้า ROS']],
  },
];

export const partByKey = (key) => PARTS.find((p) => p.key === key) ?? null;

/**
 * กลุ่มของ mesh จากชื่อ object ใน Blender (กฎเดียวกับตัวดู 3D ในดีไซน์) · ชื่อที่ไม่เข้ากลุ่มไหนนับเป็นตัวถัง
 * จึงกดได้ทุกชิ้นบนโมเดล ไม่มีชิ้นที่กดแล้วเงียบ
 */
const PREFIXES = [
  ['ultrasonic', ['Eye', 'SensorBody', 'SensorBracket', 'BracketScrew', 'Cable_Sensor']],
  ['quadrgb', ['QuadRGB', 'RGB_led', 'Cable_RGB']],
  ['wheels', ['Tire', 'Hub', 'Motor', 'Gearbox', 'Axle']],
  ['imu', ['CyberPiBoard']],
  ['cyberpi', ['CyberPi', 'Screen', 'Btn', 'Joystick', 'OnOff', 'USB_C', 'Battery', 'Shield', 'Port', 'Capacitor', 'Chip']],
];
export function groupOf(name = '') {
  return PREFIXES.find(([, list]) => list.some((p) => name.startsWith(p)))?.[0] ?? 'body';
}
