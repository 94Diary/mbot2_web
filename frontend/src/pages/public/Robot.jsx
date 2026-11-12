import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RobotViewer } from '../../features/robot3d/RobotViewer.jsx';
import { PARTS, partByKey } from '../../features/robot3d/parts.js';
import { useToast } from '../../lib/toast.jsx';

const TABS = [['overview', 'ภาพรวม'], ['topic', 'Topic'], ['code', 'โค้ด'], ['spec', 'สเปก']];

function PartPanel({ part, onPrev, onNext }) {
  const [tab, setTab] = useState('overview');
  const toast = useToast();
  const echo = part.topic ? `ros2 topic echo ${part.topic.split(' · ')[0].replace('mbotN', 'mbot1').replace('..4', '')}` : null;
  return (
    <div key={part.key} className="zone panel-in" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row">
        <span className="zone-k sp">ชิ้นส่วน {part.num} / {PARTS.length}</span>
        <button type="button" className="sqbtn" aria-label="ชิ้นก่อนหน้า" onClick={onPrev} style={{ width: 34, height: 34 }}>‹</button>
        <button type="button" className="sqbtn" aria-label="ชิ้นถัดไป" onClick={onNext} style={{ width: 34, height: 34 }}>›</button>
      </div>
      <div><h2 style={{ fontSize: 26 }}>{part.name}</h2><p style={{ color: 'var(--orange-ink)', fontWeight: 600 }}>{part.short}</p></div>
      <div className="seg" role="tablist" aria-label="หัวข้อ">
        {TABS.map(([k, label]) => <button key={k} type="button" role="tab" aria-checked={tab === k} aria-selected={tab === k} onClick={() => setTab(k)}>{label}</button>)}
      </div>
      {tab === 'overview' ? (
        <div className="col" style={{ gap: 12 }}>
          <p style={{ color: 'var(--ink-2)' }}>{part.what}</p>
          <div><h3 style={{ fontSize: 15 }}>หุ่นเอาไปใช้ตัดสินใจ</h3><p className="muted">{part.use}</p></div>
          <div className="notice warn" style={{ fontSize: 14 }}><div><strong>ซิมกับหุ่นจริงต่างกัน</strong><div>{part.real}</div></div></div>
        </div>
      ) : null}
      {tab === 'topic' ? (
        part.topic ? (
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px' }}>
            {[['Topic', part.topic], ['ชนิดข้อมูล', part.type], ['ความถี่', part.rate], ['ไฟล์', part.file]].map(([k, v]) => (
              <div key={k} style={{ display: 'contents' }}><dt className="muted">{k}</dt><dd className="M" style={{ margin: 0, fontSize: 13.5, wordBreak: 'break-all' }}>{v}</dd></div>
            ))}
          </dl>
        ) : <p className="muted">ชิ้นนี้ไม่ได้ส่งข้อมูลเข้า ROS โดยตรง · ไฟล์ที่เกี่ยวข้อง <span className="M">{part.file}</span></p>
      ) : null}
      {tab === 'code' ? (
        <div className="col" style={{ gap: 8 }}>
          <p className="muted small">ตัวอย่างย่อเพื่อดูแนวคิด ค่าคงที่ใช้ชื่อเดียวกับโค้ดของทีม ({part.file})</p>
          <pre className="terminal" style={{ margin: 0 }}><code>{part.code}</code></pre>
        </div>
      ) : null}
      {tab === 'spec' ? (
        <div className="col" style={{ gap: 0 }}>
          {part.specs.map(([k, v]) => <div key={k} className="kv"><span>{k}</span><strong>{v}</strong></div>)}
          {echo ? (
            <div className="col" style={{ gap: 6, marginTop: 12 }}>
              <span className="zone-k">ดูค่าจริงในซิม</span>
              <div className="row" style={{ gap: 8 }}>
                <pre className="terminal sp" style={{ margin: 0 }}>{echo}</pre>
                <button type="button" className="btn sm" onClick={() => navigator.clipboard?.writeText(echo).then(() => toast('คัดลอกคำสั่งแล้ว'))}>คัดลอก</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function Robot() {
  const [params, setParams] = useSearchParams();
  const selected = partByKey(params.get('part'))?.key ?? null;
  const setSelected = (key) => setParams(key ? { part: key } : {}, { replace: true });
  const [exploded, setExploded] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const part = partByKey(selected);
  const step = (d) => {
    const i = PARTS.findIndex((p) => p.key === selected);
    setSelected(PARTS[(i + d + PARTS.length) % PARTS.length].key);
  };
  return (
    <main style={{ position: 'relative', width: '100%', maxWidth: 1440, margin: '0 auto', padding: '24px 24px 32px', boxSizing: 'border-box', minHeight: 'calc(100vh - 140px)', display: 'grid', gridTemplateColumns: 'minmax(220px, 260px) minmax(0, 1fr) minmax(300px, 400px)', gap: 24 }} className="robotpage">
      <div className="col" style={{ gap: 20, justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(36px, 4cqi, 48px)', lineHeight: 1.05 }}>รู้จักหุ่น<br /><span style={{ color: 'var(--orange)' }}>mBot2</span></h1>
          <p style={{ marginTop: 10, color: 'var(--ink-2)' }}>กดชิ้นส่วนบนโมเดลเพื่อยกขึ้นมาดูใกล้ ๆ ว่ามันทำอะไร และส่งข้อมูลให้ ROS ทางไหน</p>
        </div>
        <nav aria-label="ชิ้นส่วนของหุ่น" className="col" style={{ gap: 8 }}>
          {PARTS.map((p) => (
            <button key={p.key} type="button" onClick={() => setSelected(selected === p.key ? null : p.key)} aria-pressed={selected === p.key}
              style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44, padding: '0 14px 0 8px', borderRadius: 999, border: `1px solid ${selected === p.key ? 'var(--orange)' : 'var(--line)'}`, background: selected === p.key ? 'var(--orange-soft)' : 'var(--panel)', color: 'var(--ink)', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
              <span style={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13, background: selected === p.key ? 'var(--orange)' : 'var(--raise)', color: selected === p.key ? '#14161A' : 'var(--ink-2)' }}>{p.num}</span>
              {p.name}
            </button>
          ))}
        </nav>
      </div>
      <section aria-label="โมเดล 3D ของหุ่น" style={{ position: 'relative', minHeight: 560, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <RobotViewer interactive selected={selected} onSelect={setSelected} explodeAll={exploded} viewResetKey={resetKey}
            height="100%" label="โมเดล 3D ของ mBot2 กดชิ้นส่วนเพื่อดูรายละเอียด" />
        </div>
        <div className="row wrapr" style={{ justifyContent: 'center', gap: 12, paddingTop: 12 }}>
          <div className="seg" role="radiogroup" aria-label="มุมมองชิ้นส่วน">
            <button type="button" role="radio" aria-checked={!exploded} onClick={() => setExploded(false)}>ประกอบ</button>
            <button type="button" role="radio" aria-checked={exploded} onClick={() => setExploded(true)}>แยกชิ้นส่วน</button>
          </div>
          {selected ? <button type="button" className="btn sm" onClick={() => setSelected(null)}>ดูทั้งตัว</button> : null}
          <button type="button" className="btn sm" onClick={() => setResetKey((k) => k + 1)}>มุมมองเริ่มต้น</button>
          <span className="small muted">ลากเพื่อหมุน เลื่อนเพื่อซูม</span>
        </div>
      </section>
      <aside>
        {part ? <PartPanel part={part} onPrev={() => step(-1)} onNext={() => step(1)} /> : (
          <div className="zone panel-in" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 style={{ fontSize: 22 }}>หุ่นหนึ่งตัวมีอะไรบ้าง</h2>
            <p style={{ color: 'var(--ink-2)' }}>mBot2 ในโปรเจกต์นี้ใช้เซนเซอร์แค่ที่ตัวจริงมี ไม่มี LiDAR และไม่มีแผนที่ล่วงหน้า ทุกอย่างที่รู้มาจาก 4 อย่างนี้</p>
            {PARTS.slice(0, 5).filter((p) => p.key !== 'cyberpi').map((p) => (
              <button key={p.key} type="button" onClick={() => setSelected(p.key)} style={{ textAlign: 'left', border: 'none', borderTop: '1px solid var(--line-2)', background: 'none', color: 'var(--ink)', padding: '10px 0', font: 'inherit', cursor: 'pointer' }}>
                <strong>{p.name}</strong> <span className="muted">{p.short}</span>
              </button>
            ))}
            <p style={{ color: 'var(--orange-ink)', fontWeight: 600, fontSize: 14 }}>กดชิ้นส่วนบนโมเดล หรือเลือกจากรายการทางซ้าย</p>
          </div>
        )}
      </aside>
    </main>
  );
}
