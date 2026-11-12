import { useRobots } from '../../lib/robots.jsx';
import { BotAvatar, Icon, Pill } from '../../ui/index.js';
import { stateLabel } from './robotState.js';

/**
 * The single robot selector (decisions.md §4): one choice drives both the map and the log.
 * robots: [{ ns, state, goal }]
 */
export function RobotPicker({ robots, value, onChange, counts = {} }) {
  const { robot } = useRobots();
  return (
    <div className="botpick" style={{ '--bots': Math.max(1, robots.length) }} role="radiogroup" aria-label="เลือกหุ่นที่จะดู">
      <button type="button" className="card botcard" aria-pressed={value === 'all'} onClick={() => onChange('all')}>
        <span className="k">ภาพรวม</span>
        <strong className="H" style={{ fontSize: 20 }}>ทุกตัว</strong>
        <span className="muted small">{robots.length} ตัว · {counts.all ?? 0} log</span>
      </button>
      {robots.map(({ ns, state, goal }) => {
        const info = robot(ns);
        const [label, tone] = goal ? ['ถึงเป้าหมาย', 'go'] : stateLabel(state);
        return (
          <button key={ns} type="button" className="card botcard" aria-pressed={value === ns} style={{ '--bc': info.color }} onClick={() => onChange(ns)}>
            <span className="row" style={{ gap: 10 }}>
              <BotAvatar robot={info} size={36} />
              <span className="sp col" style={{ gap: 0 }}>
                <strong>{info.display_name}</strong>
                <span className="M muted small">/{ns}</span>
              </span>
              <span className="muted small row" style={{ gap: 4 }} title="แบตเตอรี่: หุ่นยังไม่ส่งค่านี้"><Icon name="battery" size={16} />—</span>
            </span>
            <span className="row wrapr" style={{ gap: 6 }}>
              <Pill tone={tone}>{label}</Pill>
              <Pill tone="gray">โหมดสำรวจ</Pill>
            </span>
          </button>
        );
      })}
    </div>
  );
}
