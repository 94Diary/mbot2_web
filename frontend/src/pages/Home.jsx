import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Arrow, CircuitButton } from '../features/design/Brand.jsx';
import { RobotViewer } from '../features/robot3d/RobotViewer.jsx';
import { api } from '../lib/api.js';

const BookIcon = <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5M8 7h7" /></svg>;

const HOTSPOTS = [
  { key: 'ultrasonic', label: 'อัลตราโซนิก', to: '/robot?part=ultrasonic' },
  { key: 'cyberpi', label: 'CyberPi สมองของหุ่น', to: '/robot?part=cyberpi' },
  { key: 'wheels', label: 'ล้อ + encoder', to: '/robot?part=wheels' },
  { key: 'quadrgb', label: 'Quad RGB', to: '/robot?part=quadrgb' },
];

const SENSORS = [
  ['อัลตราโซนิก', 'วัดระยะของที่อยู่ข้างหน้า หยุดก่อนชน', <g key="u"><circle cx="8" cy="12" r="3.2" /><circle cx="16" cy="12" r="3.2" /></g>],
  ['Quad RGB', 'อ่านเส้นและสีของพื้น ใช้เดินตามเส้น', <g key="q"><rect x="4" y="9" width="16" height="6" rx="2" /><path d="M8 15v3M12 15v3M16 15v3" /></g>],
  ['Encoder ล้อ', 'นับว่าล้อหมุนไปเท่าไหร่ รู้ระยะที่เดิน', <g key="e"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2" /><path d="M12 4v4M12 16v4M4 12h4M16 12h4" /></g>],
  ['IMU', 'รู้ว่าหุ่นหันไปกี่องศา เลี้ยวได้แม่น', <g key="i"><path d="M12 4v16M4 12h16" /><path d="M16 8l-4-4-4 4" /></g>],
];

const FEATURES = [
  ['เชื่อมต่อ', 'กดรันซิม Gazebo จากเว็บ หุ่นเข้าทีมให้เอง ไม่ต้องพิมพ์คำสั่ง', 'orange',
    <svg key="c" viewBox="0 0 220 100" width="220" height="100" aria-hidden="true"><g fill="none" stroke="var(--line-strong)" strokeWidth="1.5"><circle cx="110" cy="50" r="22" /><circle cx="110" cy="50" r="40" /></g><circle cx="110" cy="50" r="6" fill="var(--ink)" /><g stroke="var(--blue)" strokeWidth="2" strokeDasharray="4 4"><path d="M110 50L160 22" /><path d="M110 50L62 76" /></g><circle cx="160" cy="22" r="7" fill="var(--orange)" /><circle cx="62" cy="76" r="7" fill="var(--blue)" /><circle cx="170" cy="74" r="7" fill="none" stroke="var(--ink-4)" strokeWidth="2" /></svg>,
    <g key="ci"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><path d="M12 12l6-6" /></g>],
  ['ติดตาม', 'ดูสถานะของหุ่นทุกตัว และแผนที่ที่วาดขึ้นจากเส้นทางที่หุ่นเดินจริง', 'blue',
    <svg key="t" viewBox="0 0 220 100" width="220" height="100" aria-hidden="true"><g stroke="var(--grid)"><path d="M20 10V90M60 10V90M100 10V90M140 10V90M180 10V90M20 50H200" /></g><path d="M30 84V50H100V20H170" fill="none" stroke="var(--path)" strokeWidth="5" strokeLinecap="round" /><path d="M100 50H150V80" fill="none" stroke="var(--path)" strokeWidth="5" strokeLinecap="round" opacity=".5" /><circle cx="170" cy="20" r="6" fill="var(--orange)" /><circle cx="150" cy="80" r="6" fill="var(--blue)" /></svg>,
    <g key="ti"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" /></g>],
  ['ควบคุม', 'จบภารกิจด้วยปุ่มเดียว และสั่งหยุดทุกตัวได้ทันทีเมื่อมีปัญหา', 'red',
    <svg key="k" viewBox="0 0 220 100" width="220" height="100" aria-hidden="true"><rect x="30" y="30" width="72" height="40" rx="20" fill="var(--blue-fill)" /><path d="M58 43v14l12-7z" fill="#fff" /><rect x="118" y="30" width="72" height="40" rx="20" fill="#E5251B" /><rect x="146" y="42" width="16" height="16" rx="3" fill="#fff" /></svg>,
    <g key="ki"><rect x="5" y="5" width="14" height="14" rx="3" /></g>],
];
const TONE = { orange: ['var(--orange-soft)', 'var(--orange-ink)'], blue: ['var(--blue-soft)', 'var(--blue-ink)'], red: ['var(--red-soft)', 'var(--red-ink)'] };

function LiveStatus() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    let active = true;
    const load = () => api('/site/status').then((s) => active && setStatus(s)).catch(() => active && setStatus(null));
    load();
    const id = setInterval(load, 5000);
    return () => { active = false; clearInterval(id); };
  }, []);
  const [text, color] = !status ? ['กำลังตรวจสถานะ…', 'var(--ink-4)']
    : !status.ros_connected ? ['ROS 2 ยังไม่เชื่อมต่อ', 'var(--warn)']
      : status.robots_online ? [`ROS เชื่อมต่อแล้ว · หุ่นออนไลน์ ${status.robots_online} ตัว`, 'var(--go)']
        : ['ROS เชื่อมต่อแล้ว · ยังไม่มีหุ่นออนไลน์', 'var(--go)'];
  return (
    <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--panel)', fontSize: 14, color: 'var(--ink-2)' }}>
      <span className="led" style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />{text}
    </span>
  );
}

const SectionKicker = ({ children }) => <span className="H" style={{ fontWeight: 600, fontSize: 15, color: 'var(--blue-ink)' }}>{children}</span>;

export function Home() {
  return (
    <main style={{ width: '100%', maxWidth: 1440, margin: '0 auto', padding: '0 24px', boxSizing: 'border-box', perspective: 1600 }}>
      <section aria-labelledby="hero-title" className="fold" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0 32px', minHeight: 680, padding: '24px 0 40px' }}>
        <div style={{ flex: '1 1 460px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <LiveStatus />
          <h1 id="hero-title" style={{ fontSize: 'clamp(44px, 5cqi, 64px)', lineHeight: 1.05, letterSpacing: '-0.02em' }}>รู้จัก mBot2<br />หุ่นที่สำรวจ<span style={{ color: 'var(--orange)' }}>เป็นทีม</span></h1>
          <p style={{ fontSize: 19, color: 'var(--ink-2)', maxWidth: 500 }}>หุ่นยนต์สองล้อตัวเล็กที่ไม่รู้แผนที่มาก่อน หลายตัวช่วยกันแบ่งทางสำรวจเขาวงกต แล้ววาดแผนที่ขึ้นมาเอง เว็บนี้คือที่เชื่อมต่อ ดู และสั่งงานพวกมัน</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '26px 36px', padding: '22px 0 0 30px' }}>
            <CircuitButton to="/console">เข้า Dashboard</CircuitButton>
            <CircuitButton to="/console/connect" variant="chip">เชื่อมหุ่น</CircuitButton>
            <CircuitButton to="/lessons" variant="ghost" icon={BookIcon}>บทเรียน</CircuitButton>
          </div>
        </div>
        <div style={{ flex: '1.3 1 520px', minWidth: 0, position: 'relative' }}>
          <div className="bob" style={{ position: 'relative', maxWidth: 640, margin: '0 auto' }}>
            <RobotViewer height={480} hotspots={HOTSPOTS} label="โมเดล 3D ของหุ่น mBot2 ที่ทีมปั้นใน Blender" />
          </div>
          <div aria-hidden="true" style={{ width: '60%', height: 40, margin: '-10px auto 0', borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(0,0,0,0.28), transparent)' }} />
        </div>
      </section>

      <section id="what" aria-labelledby="what-title" className="fold" style={{ padding: '56px 0' }}>
        <div className="rise" style={{ display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 380px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionKicker>01 · mBot2 คืออะไร</SectionKicker>
            <h2 id="what-title" style={{ fontSize: 'clamp(32px, 3.5cqi, 44px)', lineHeight: 1.1 }}>หุ่นยนต์การศึกษา<br />ที่เขียนโปรแกรมได้</h2>
            <p style={{ fontSize: 17, color: 'var(--ink-2)', maxWidth: 520 }}>mBot2 เป็นหุ่นยนต์ขับเคลื่อนสองล้อ มีบอร์ด CyberPi เป็นสมอง และมีเซนเซอร์ให้มันรับรู้รอบตัว ในโปรเจกต์นี้เราใช้มันเดินตามเส้น หาทางแยก และคุยกันผ่าน ROS 2 เพื่อแบ่งกันสำรวจ</p>
            <dl style={{ display: 'flex', gap: 28, margin: 0 }}>
              {[['ขับเคลื่อน', '2 ล้อ'], ['เซนเซอร์', '4 ชนิด'], ['ขนาด', '13 × 9.5 ซม.']].map(([k, v]) => (
                <div key={k}><dt className="small muted">{k}</dt><dd className="H" style={{ margin: 0, fontSize: 24 }}>{v}</dd></div>
              ))}
            </dl>
            <div style={{ paddingLeft: 30, paddingTop: 16 }}><CircuitButton to="/robot" variant="ghost">ดูหุ่นแบบ 3D</CircuitButton></div>
          </div>
          <div className="stag" style={{ flex: '1.2 1 480px', minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), calc(50% - 7px)))', gap: 14 }}>
            {SENSORS.map(([title, text, icon]) => (
              <div key={title} className="tile" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '18px 18px', borderRadius: 22, border: '1px solid var(--line)', background: 'var(--panel)' }}>
                <span style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--blue-soft)', color: 'var(--blue-ink)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">{icon}</svg>
                </span>
                <span><span className="H" style={{ display: 'block', fontSize: 17 }}>{title}</span><span className="small muted">{text}</span></span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="web-title" className="fold" style={{ padding: '56px 0' }}>
        <div className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 720, marginBottom: 26 }}>
          <SectionKicker>02 · เว็บนี้ทำอะไร</SectionKicker>
          <h2 id="web-title" style={{ fontSize: 'clamp(32px, 3.5cqi, 44px)', lineHeight: 1.1 }}>เชื่อม ดู และสั่ง<br />จากที่เดียว</h2>
          <p style={{ fontSize: 17, color: 'var(--ink-2)' }}>เว็บคุยกับหุ่นผ่าน ROS 2 บนเครื่องเรา ไม่ต้องพิมพ์คำสั่งเอง และมีบทเรียนสำหรับรุ่นน้องที่จะมาทำต่อ</p>
        </div>
        <div className="stag grid g3">
          {FEATURES.map(([title, text, tone, art, icon]) => (
            <div key={title} className="tile" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 22, borderRadius: 22, border: '1px solid var(--line)', background: 'var(--panel)' }}>
              <div style={{ height: 120, borderRadius: 16, background: 'var(--robot-2)', border: '1px solid var(--line-2)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>{art}</div>
              <div className="row" style={{ gap: 10 }}>
                <span style={{ width: 38, height: 38, borderRadius: 12, background: TONE[tone][0], color: TONE[tone][1], display: 'grid', placeItems: 'center' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
                </span>
                <span className="H" style={{ fontWeight: 600, fontSize: 21 }}>{title}</span>
              </div>
              <p style={{ fontSize: 15, color: 'var(--ink-3)' }}>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="start-title" className="fold" style={{ padding: '56px 0 80px' }}>
        <div className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 720, marginBottom: 26 }}>
          <SectionKicker>03 · เริ่มใช้งานยังไง</SectionKicker>
          <h2 id="start-title" style={{ fontSize: 'clamp(32px, 3.5cqi, 44px)', lineHeight: 1.1 }}>สามขั้น ก็ได้เห็นหุ่นวิ่ง</h2>
        </div>
        <ol className="stag grid g3" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {[
            ['01', 'ดูข้อมูลหุ่น', 'หมุนดูโมเดล 3D กดแต่ละชิ้นเพื่อดูว่าเซนเซอร์ไหนทำอะไร', 'รู้จักหุ่น', '/robot', 'ghost'],
            ['02', 'เชื่อมหุ่นเข้าทีม', 'กด Build แล้วเปิดซิมจากเว็บ หุ่นจะเข้าทีมให้เอง', 'เชื่อมหุ่น', '/console/connect', 'chip'],
            ['03', 'เข้า Dashboard', 'ปล่อยภารกิจ ดูหุ่นวาดแผนที่สด ๆ และหยุดได้ทุกเมื่อ', 'เข้า Dashboard', '/console', 'primary'],
          ].map(([n, title, text, cta, to, variant]) => (
            <li key={n} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 26, borderRadius: 22, border: '1px solid var(--line)', background: 'var(--panel)' }}>
              <span className="H" style={{ fontSize: 44, lineHeight: 1, color: 'var(--orange)' }}>{n}</span>
              <span className="H" style={{ fontWeight: 600, fontSize: 21 }}>{title}</span>
              <p style={{ fontSize: 15, color: 'var(--ink-3)' }}>{text}</p>
              <div style={{ paddingLeft: 30, paddingTop: 10 }}><CircuitButton to={to} variant={variant}>{cta}</CircuitButton></div>
            </li>
          ))}
        </ol>
        <div className="rise card pad row wrapr" style={{ marginTop: 18, borderStyle: 'dashed', gap: '14px 24px', borderRadius: 22 }}>
          <div className="sp" style={{ minWidth: 260 }}>
            <h3 style={{ fontSize: 20 }}>ยังไม่ได้ติดตั้ง ROS 2 ในเครื่อง?</h3>
            <p className="muted small" style={{ marginTop: 4 }}>มีบทเรียนพาตั้งแต่เครื่องเปล่าจนหุ่นวิ่งในซิม เหมาะกับรุ่นน้องที่เพิ่งเริ่ม</p>
          </div>
          <Link to="/lessons" className="cbtn cb-ghost" style={{ height: 50 }}>{BookIcon}เริ่มบทเรียน<Arrow /></Link>
        </div>
      </section>
    </main>
  );
}
