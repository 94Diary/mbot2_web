import { badRequest } from '../http.js';

// ตารางคำสั่งที่อนุญาตทั้งหมด · ห้ามเพิ่มคำสั่งที่รับค่าอิสระ
export const ROBOT_COUNTS = [2, 3];
export const BUILD_ARGV = Object.freeze([
  'colcon', 'build', '--packages-select', 'mbot2_control', 'mbot2_description', '--symlink-install',
]);

export function launchArgv({ count, world, headless }) {
  return ['ros2', 'launch', 'mbot2_description', 'two_mbot2.launch.py',
    `robot_count:=${count}`, `headless:=${headless ? 'true' : 'false'}`, `world:=${world}`];
}

/** Validates a start request against the allowed table; returns clean options or throws 400. */
export function validateStart(body, worlds) {
  const input = body ?? {};
  const fields = {};
  const count = Number(input.count);
  if (!ROBOT_COUNTS.includes(count)) fields.count = 'จำนวนหุ่นต้องเป็น 2 หรือ 3';
  if (typeof input.world !== 'string' || !worlds.includes(input.world)) fields.world = 'เลือกสนามจากรายการ';
  for (const key of ['build', 'headless']) {
    if (input[key] !== undefined && typeof input[key] !== 'boolean') fields[key] = 'ต้องเป็นเปิด/ปิด';
  }
  if (Object.keys(fields).length) throw badRequest('ตั้งค่าซิมไม่ถูกต้อง', fields);
  return { count, world: input.world, build: Boolean(input.build), headless: Boolean(input.headless) };
}

/** Human-readable preview for the "ดูคำสั่งที่จะรัน" panel. */
export function previewCommands(options) {
  return [...(options.build ? [BUILD_ARGV.join(' ')] : []), launchArgv(options).join(' ')];
}

const BUILD_ERROR_PATTERNS = [
  /File "([^"]+)", line (\d+)/,
  /([\w./-]+\.(?:py|cpp|hpp|h|c|xml|txt|xacro|cmake)):(\d+)/,
];

/** Finds the first "file:line" in failed build output, plus the error line itself. */
export function parseBuildError(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    for (const pattern of BUILD_ERROR_PATTERNS) {
      const match = lines[i].match(pattern);
      if (match) {
        const message = lines.slice(i, i + 4).find((line) => /error|Error|ERROR/.test(line)) ?? lines[i];
        return { file: match[1].split('/').at(-1), line: Number(match[2]), message: message.trim().slice(0, 300) };
      }
    }
  }
  const last = lines.findLast((line) => /error|failed/i.test(line));
  return { file: null, line: null, message: (last ?? 'colcon build ล้มเหลว').trim().slice(0, 300) };
}
