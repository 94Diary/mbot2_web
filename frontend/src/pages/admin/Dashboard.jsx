import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { RESULT, fmtRelative } from '../../lib/format.js';
import { useAsync } from '../../lib/useAsync.js';
import { ErrorNotice, Icon, Notice, Pill, Segmented, Skeleton, Stat } from '../../ui/index.js';

const SIM_TEXT = { idle: ['ไม่มีซิมรันอยู่', 'gray'], building: ['กำลัง build', 'orange'], launching: ['กำลังเปิดซิม', 'orange'], running: ['ซิมกำลังวิ่ง', 'go'], stopping: ['กำลังหยุด', 'warn'] };

function Chart({ days }) {
  const max = Math.max(1, ...days.map((d) => d.missions));
  return (
    <div>
      <div className="chart" role="img" aria-label={`ภารกิจต่อวัน ${days.length} วันล่าสุด สูงสุด ${max} ภารกิจ`}>
        {days.map((d) => (
          <div key={d.day} className="bar" title={`${d.day}: ${d.missions} ภารกิจ (ครบ ${d.ok})`} style={{ height: `${Math.max(2, (d.missions / max) * 100)}%`, opacity: d.missions ? 1 : 0.25 }}>
            {d.ok ? <div className="ok" style={{ height: `${(d.ok / d.missions) * 100}%` }} /> : null}
          </div>
        ))}
      </div>
      <div className="row muted small" style={{ marginTop: 6 }}>
        <span>{days[0]?.day}</span><span className="sp" /><span>{days.at(-1)?.day}</span>
      </div>
      <div className="legend" style={{ marginTop: 6 }}><span><span className="dot" style={{ color: 'var(--orange)' }} /> ทุกภารกิจ</span><span><span className="dot" style={{ color: 'var(--go)' }} /> ครบทุกตัว</span></div>
    </div>
  );
}

export function Dashboard() {
  const [range, setRange] = useState('7d');
  const d = useAsync((signal) => api(`/admin/dashboard?range=${range}`, { signal }), range);
  const data = d.data;
  const sim = data?.sim ? SIM_TEXT[data.sim.state] ?? [data.sim.state, 'gray'] : null;
  return (
    <>
      <div className="page-head">
        <div className="sp"><h1>Dashboard</h1><p className="sub">ภาพรวมการใช้งานเว็บและภารกิจ</p></div>
        <Segmented label="ช่วงเวลา" value={range} onChange={setRange} options={[{ value: '7d', label: '7 วัน' }, { value: '30d', label: '30 วัน' }, { value: 'all', label: 'ทั้งหมด' }]} />
      </div>
      <ErrorNotice error={d.error} onRetry={d.reload} />
      {!data ? <div className="grid g4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={110} />)}</div> : (
        <>
          <div className="grid g4">
            <Stat label="ผู้ใช้ทั้งหมด" value={data.kpi.users} />
            <Stat label="ใช้งานใน 7 วัน" value={data.kpi.active_7d} />
            <Stat label="คนอ่านบทเรียน" value={data.kpi.lesson_readers} hint={`ภารกิจสัปดาห์นี้ ${data.kpi.missions_week}`} />
            <Stat label={`ภารกิจ (${range === 'all' ? 'ทั้งหมด' : range === '7d' ? '7 วัน' : '30 วัน'})`} value={data.kpi.missions_range}
              hint={data.results.map((r) => `${RESULT[r.result].label} ${r.n}`).join(' · ') || 'ยังไม่มี'} />
          </div>
          <div className="grid g2 stack-m" style={{ alignItems: 'start' }}>
            <section className="card pad col"><h2>ภารกิจต่อวัน</h2><Chart days={data.per_day} /></section>
            <section className="card pad col">
              <h2>ต้องจัดการ</h2>
              {data.todo.length ? data.todo.map((t) => (
                <Link key={t.kind} to={t.link} className="row" style={{ color: 'var(--ink)', textDecoration: 'none', borderTop: '1px solid var(--line-2)', paddingTop: 10 }}>
                  <Icon name="warn" size={18} /><span className="sp">{t.text}</span><Icon name="arrow" size={16} />
                </Link>
              )) : <Notice tone="go">ไม่มีเรื่องค้าง</Notice>}
              <div className="row" style={{ borderTop: '1px solid var(--line-2)', paddingTop: 10 }}>
                <span className="sp muted">ซิมบนเครื่องนี้</span><Pill tone={sim[1]}>{sim[0]}{data.sim.world ? ` · ${data.sim.world}` : ''}</Pill>
              </div>
            </section>
          </div>
          <div className="grid g2 stack-m" style={{ alignItems: 'start' }}>
            <section className="card pad col">
              <div className="row"><h2 className="sp">บทเรียนยอดนิยม</h2><Link to="/admin/lessons">จัดการบทเรียน</Link></div>
              {data.lessons.length ? data.lessons.map((l) => (
                <div key={l.slug} className="kv"><Link to={`/lessons/${l.slug}`}>{l.title}</Link><strong>{l.views} ครั้ง</strong></div>
              )) : <p className="muted">ยังไม่มีคนอ่านในช่วงนี้</p>}
              <h2 style={{ marginTop: 8 }}>สนามที่ใช้บ่อย</h2>
              {data.worlds.length ? data.worlds.map((w) => (
                <div key={w.world} className="kv"><span className="M">{w.world}</span><strong>{w.n} ภารกิจ</strong></div>
              )) : <p className="muted">ยังไม่มีภารกิจในช่วงนี้</p>}
            </section>
            <section className="card pad col">
              <div className="row"><h2 className="sp">กิจกรรมล่าสุด</h2><Link to="/admin/audit">ดูทั้งหมด</Link></div>
              {data.recent.map((a) => (
                <div key={a.id} className="kv"><span>{a.summary}<div className="small muted">{a.actor_name ?? 'ระบบ'} · {fmtRelative(a.at)}</div></span><Pill tone="gray">{a.action}</Pill></div>
              ))}
            </section>
          </div>
        </>
      )}
    </>
  );
}
