// สถานะจาก maze_solver (solver_parts/config.py) → ข้อความไทยบนการ์ดหุ่น
export const ROBOT_STATE = {
  SEARCH: ['กำลังหาเส้น', 'blue'],
  FOLLOW: ['วิ่งตามเส้น', 'go'],
  APPROACH_JUNCTION: ['เข้าใกล้ทางแยก', 'blue'],
  JUNCTION_PAUSE: ['หยุดที่ทางแยก', 'orange'],
  JUNCTION_SCAN: ['สแกนทางแยก', 'orange'],
  CENTERING: ['จัดตำแหน่งกลางแยก', 'orange'],
  BRANCH_CAPTURE: ['เลือกกิ่ง', 'orange'],
  TURNING: ['กำลังเลี้ยว', 'blue'],
  REACQUIRE: ['หาเส้นกลับ', 'warn'],
  ALIGN_LINE: ['จัดแนวกับเส้น', 'blue'],
  RETURNING: ['กลับไปทางแยก', 'blue'],
  LINE_LOST: ['เส้นหาย', 'red'],
  REVERSING: ['ถอยจากทางตัน', 'warn'],
  YIELDING: ['หลบให้เพื่อน', 'warn'],
  YIELD_RESUME: ['กลับมาวิ่งต่อ', 'blue'],
  YIELD_TURN: ['หันหลบ', 'warn'],
  YIELD_ESCAPE: ['ถอยหลบ', 'warn'],
  YIELD_WAIT: ['รอเพื่อนผ่าน', 'warn'],
  HOLDING: ['รอทีม', 'gray'],
  GOAL_PARKING: ['เข้าจอดที่เป้าหมาย', 'go'],
  GOAL_REACHED: ['ถึงเป้าหมาย', 'go'],
};

export function stateLabel(state) {
  if (!state) return ['ยังไม่มีข้อมูล', 'gray'];
  return ROBOT_STATE[state] ?? [state, 'gray'];
}

export const robotNames = (count, map) => {
  const names = new Set(Array.from({ length: count || 0 }, (_, i) => `mbot${i + 1}`));
  for (const ns of Object.keys(map?.robots ?? {})) names.add(ns);
  for (const ns of Object.keys(map?.paths ?? {})) names.add(ns);
  return [...names].sort();
};
