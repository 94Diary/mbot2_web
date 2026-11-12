import { useEffect, useRef } from 'react';
import { Icon } from '../../ui/index.js';

const STEPS = [
  ['build', 'Build โค้ด', 'colcon build'],
  ['gazebo', 'เปิด Gazebo', 'โหลดสนามและหุ่น'],
  ['bridge', 'เชื่อม bridge', 'ros_gz_bridge'],
  ['link', 'เชื่อมเว็บ', 'รอข้อมูลทีมชุดแรก'],
];
const STATE_TEXT = { wait: 'รอ', run: 'กำลังทำ', done: 'เสร็จ', fail: 'ล้มเหลว', skip: 'ข้าม' };

export function SimProgress({ steps }) {
  return (
    <ol className="steps" aria-label="ความคืบหน้าการรันซิม" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {STEPS.map(([key, title, sub], i) => {
        const state = steps?.[key] ?? 'wait';
        return (
          <li key={key} className="step" data-state={state}>
            <span className="row" style={{ gap: 8 }}>
              <span className="k">ขั้น {i + 1}</span>
              <span className="sp" />
              {state === 'run' ? <span className="spin" aria-hidden>↻</span> : state === 'done' ? <Icon name="check" size={16} /> : state === 'fail' ? <Icon name="x" size={16} /> : null}
            </span>
            <strong>{title}</strong>
            <span className="muted small">{sub} · {STATE_TEXT[state]}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function TerminalBox({ lines, maxHeight = 320 }) {
  const box = useRef(null);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [lines]);
  return (
    <div className="terminal" ref={box} style={{ maxHeight }} role="log" aria-label="ข้อความจาก Terminal">
      {lines.length ? lines.map((line, i) => (
        <div key={i} className={line.startsWith('$ ') ? 'cmd' : /error|failed|Traceback/i.test(line) ? 'err' : undefined}>{line}</div>
      )) : <span style={{ opacity: 0.6 }}>ยังไม่มีข้อความ</span>}
    </div>
  );
}
