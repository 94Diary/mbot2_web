import { useEffect, useRef } from 'react';
import { LOG_LEVEL, fmtTime } from '../../lib/format.js';
import { useRobots } from '../../lib/robots.jsx';
import { BotAvatar, EmptyState, Icon, Pill } from '../../ui/index.js';

const fmtT = (t) => {
  if (!Number.isFinite(t)) return '';
  const s = Math.floor(t);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** items: [{ ns, level, msg, at? (iso) | t? (seconds since start) }] — newest at the bottom, auto-scroll when live. */
export function LogList({ items, live = false, emptyText = 'log จะขึ้นที่นี่เมื่อหุ่นเริ่มวิ่ง' }) {
  const { robot } = useRobots();
  const box = useRef(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = box.current;
    if (live && el && stick.current) el.scrollTop = el.scrollHeight;
  }, [items, live]);
  if (!items.length) return <EmptyState icon="log" title="ยังไม่มี log">{emptyText}</EmptyState>;
  return (
    <div className="loglist" ref={box} onScroll={(e) => {
      const el = e.currentTarget;
      stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    }}>
      {items.map((item, i) => {
        const isRobot = /^mbot\d+$/.test(item.ns);
        const info = isRobot ? robot(item.ns) : null;
        const level = LOG_LEVEL[item.level] ?? LOG_LEVEL.info;
        return (
          <div className="logrow" key={item.id ?? i}>
            <span className="t">{item.at ? fmtTime(item.at) : fmtT(item.t)}</span>
            {info ? <BotAvatar robot={info} size={28} /> : <span className="av bot" style={{ width: 28, height: 28, background: 'var(--raise)', color: 'var(--ink-3)' }}><Icon name="users" size={14} /></span>}
            <div className="sp">
              <div className="row" style={{ gap: 8 }}><strong style={{ fontSize: 14 }}>{info?.display_name ?? 'ทีม'}</strong><Pill tone={level.tone}>{level.label}</Pill></div>
              <div style={{ fontSize: 14.5, color: 'var(--ink-2)' }}>{item.msg}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
