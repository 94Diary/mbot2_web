import { Link } from 'react-router-dom';
import { RESULT, dayKey, fmtDay, fmtDuration, fmtTime } from '../../lib/format.js';
import { Icon, Pill } from '../../ui/index.js';

/** Long list grouped by day (pages-and-flows.md › ประวัติของฉัน). */
export function HistoryList({ items, showOwner = false, linkTo = (m) => `/console/missions/${m.id}` }) {
  let lastDay = null;
  return (
    <div className="hlist">
      {items.map((m) => {
        const day = dayKey(m.started_at);
        const header = day !== lastDay ? <div className="hday">{fmtDay(m.started_at)}</div> : null;
        lastDay = day;
        const result = RESULT[m.result];
        return (
          <div key={m.id} style={{ display: 'contents' }}>
            {header}
            <Link className="hrow" to={linkTo(m)} style={{ '--rc': result.color }}>
              <span className="hid">#{m.id}</span>
              <span className="hmain">
                <span className="row wrapr" style={{ gap: 8 }}>
                  <Pill tone={result.tone}>{result.label}</Pill>
                  {m.map_name ? <Pill tone="blue"><Icon name="check" size={12} />{m.map_name}</Pill> : null}
                </span>
                <span className="muted" style={{ fontSize: 13.5 }}>
                  {fmtTime(m.started_at).slice(0, 5)} น. · ใช้เวลา {fmtDuration(m.duration_s)} · <span className="M" style={{ fontSize: 12.5 }}>{m.world}</span>
                  {' '}· ทางแยก {m.junction_count} · ทางตัน {m.dead_end_count}{showOwner ? ` · โดย ${m.user_name}` : ''}
                </span>
              </span>
              <span className="row hbots" style={{ gap: 4 }}>
                {(m.robots ?? []).map((r) => <span key={r.robot_ns} className="dot" title={r.display_name} style={{ color: r.color, width: 10, height: 10 }} />)}
                <span className="muted" style={{ fontSize: 12.5, marginLeft: 4 }}>{m.robot_count} ตัว</span>
              </span>
              <span className="muted"><Icon name="arrow" size={16} /></span>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
