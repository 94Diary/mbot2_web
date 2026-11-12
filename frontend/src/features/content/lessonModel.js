import { parseBlocks } from './Markdown.jsx';

// หมวดบทเรียนในดีไซน์ (ตามลำดับบท)
export const CATEGORIES = [
  ['เริ่มต้น', 1, 6],
  ['ROS 2 พื้นฐาน', 7, 8],
  ['ระบบทีม', 9, 11],
  ['หุ่นจริง', 12, 999],
];
export const categoryOf = (ord) => CATEGORIES.find(([, a, b]) => ord >= a && ord <= b)?.[0] ?? 'อื่นๆ';

const SUCCESS = /^สิ่งที่ควรเห็น/;
const TROUBLE = /^ถ้าไม่เป็นแบบนี้/;

/**
 * แยก markdown ของบทเรียนเป็นส่วนตามดีไซน์:
 * notice = quote แรก · steps = ทุกหัวข้อ ## (เนื้อหา + โค้ดที่คัดลอกได้)
 * success = ## สิ่งที่ควรเห็นเมื่อสำเร็จ · trouble = ## ถ้าไม่เป็นแบบนี้ (รายการ “**อาการ** วิธีแก้”)
 */
export function splitLesson(body) {
  const blocks = parseBlocks(body);
  const out = { notice: null, intro: [], steps: [], success: null, trouble: null };
  let current = null;
  for (const b of blocks) {
    if (b.type === 'heading' && b.level <= 2) {
      if (SUCCESS.test(b.text)) current = out.success = { title: b.text, blocks: [] };
      else if (TROUBLE.test(b.text)) current = out.trouble = { title: b.text, blocks: [] };
      else { current = { title: b.text, blocks: [] }; out.steps.push(current); }
      continue;
    }
    if (!current) {
      if (b.type === 'quote' && !out.notice) out.notice = b.text;
      else out.intro.push(b);
      continue;
    }
    current.blocks.push(b);
  }
  return out;
}

/** blocks → markdown again (ใช้กับ <Markdown> ของแต่ละขั้น) */
export function blocksToMarkdown(blocks) {
  return blocks.map((b) => {
    switch (b.type) {
      case 'heading': return `${'#'.repeat(b.level)} ${b.text}`;
      case 'code': return `\`\`\`${b.lang}\n${b.text}\n\`\`\``;
      case 'quote': return `> ${b.text}`;
      case 'hr': return '---';
      case 'list': return b.items.map((it, i) => `${b.ordered ? `${i + 1}.` : '-'} ${it}`).join('\n');
      default: return b.text;
    }
  }).join('\n\n');
}
