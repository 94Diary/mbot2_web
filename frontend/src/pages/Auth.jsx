import { useEffect, useState } from 'react';
import { LogoMark, ThemeButton } from '../features/design/Brand.jsx';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { fmtDateTime } from '../lib/format.js';
import { useSite } from '../lib/site.jsx';
import { useToast } from '../lib/toast.jsx';
import { Button, Notice, PasswordInput, TextInput } from '../ui/index.js';

const SUSPEND_REASON = { stop_others: 'สั่งหยุดหุ่นคนอื่นซ้ำๆ', unsafe: 'ใช้หุ่นไม่ปลอดภัย', spam: 'สแปม', terms: 'ผิดข้อตกลง', other: 'อื่นๆ' };

function AuthBox({ title, sub, children }) {
  return (
    <main className="authwrap">
      <div className="authbox card pad col fadeup" style={{ gap: 16, padding: 28 }}>
        <div><h1 style={{ fontSize: 28 }}>{title}</h1>{sub ? <p className="muted" style={{ marginTop: 6 }}>{sub}</p> : null}</div>
        {children}
      </div>
    </main>
  );
}

function SuspendedNotice({ detail }) {
  return (
    <Notice tone="red" title={detail.message}>
      <div>เหตุผล: {SUSPEND_REASON[detail.reason] ?? 'ไม่ระบุ'}</div>
      <div>{detail.until ? `ใช้ได้อีกครั้ง ${fmtDateTime(detail.until)}` : 'แบนถาวร'}</div>
      {detail.message_to_user ? <div>ข้อความจากผู้ดูแล: “{detail.message_to_user}”</div> : null}
      <div>ติดต่อผู้ดูแลเพื่อขออุทธรณ์</div>
    </Notice>
  );
}

function LoginStatus() {
  const [status, setStatus] = useState(null);
  useEffect(() => { api('/site/status').then(setStatus).catch(() => setStatus(null)); }, []);
  const rows = [
    ['ตัวเชื่อม ROS', status?.ros_connected ? ['พร้อม', 'var(--go)'] : ['ยังไม่เชื่อม', 'var(--warn)']],
    ['ซิม', status ? [status.sim_state === 'running' ? 'กำลังวิ่ง' : status.sim_state === 'idle' ? 'ยังไม่เปิด' : 'กำลังเตรียม', status.sim_state === 'running' ? 'var(--go)' : 'var(--ink)'] : ['—', 'var(--ink)']],
    ['หุ่นที่เชื่อมแล้ว', [`${status?.robots_online ?? 0} ตัว`, 'var(--ink)']],
    ['โหมด', ['ซิม Gazebo', 'var(--ink)']],
  ];
  return (
    <ol aria-label="ตรวจระบบก่อนเข้า" style={{ position: 'relative', listStyle: 'none', margin: 0, padding: '16px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px 24px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 16, fontFamily: 'var(--font-mono)', fontSize: 13, maxWidth: 640 }}>
      {rows.map(([k, [v, c]]) => <li key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: 'var(--ink-3)' }}>{k}</span><span style={{ color: c }}>{v}</span></li>)}
    </ol>
  );
}

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { site } = useSite();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={location.state?.from ?? '/console'} replace />;

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(form.email, form.password);
      navigate(location.state?.from ?? '/console', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  const field = { height: 48, boxSizing: 'border-box', border: '1px solid var(--line-strong)', borderRadius: 12, padding: '0 14px', font: 'inherit', color: 'var(--ink)', background: 'var(--bg)', width: '100%' };
  return (
    <div className="dz" style={{ minHeight: '100vh', display: 'flex', flexWrap: 'wrap' }}>
      <section aria-label="สถานะระบบ" style={{ flex: '1.4 1 560px', minWidth: 0, position: 'relative', overflow: 'hidden', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '40px 48px', boxSizing: 'border-box', minHeight: '100vh', gap: 32 }}>
        <svg viewBox="0 0 800 800" aria-hidden="true" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.9 }}>
          <g stroke="var(--grid)" strokeWidth="1"><path d="M0 100H800M0 200H800M0 300H800M0 400H800M0 500H800M0 600H800M0 700H800M100 0V800M200 0V800M300 0V800M400 0V800M500 0V800M600 0V800M700 0V800" /></g>
          <g stroke="var(--grid)" strokeWidth="6" fill="none" strokeLinecap="round"><path d="M200 700V500H400V300H600V200M400 500H600V600M200 500V300M600 300H700" /></g>
          <path className="trace" d="M210 700V510H410V310H610V200" stroke="#FF6B1A" strokeWidth="2" fill="none" />
          <path className="trace" d="M190 700V490H390V500H590V600" stroke="#1B9BD1" strokeWidth="2" fill="none" style={{ animationDelay: '1s' }} />
          <circle cx="610" cy="200" r="6" fill="#FF6B1A" />
          <circle cx="590" cy="600" r="6" fill="#1B9BD1" />
        </svg>
        <Link to="/" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'var(--ink)' }}>
          <span className="logobox"><LogoMark size={20} /></span>
          <span className="H" style={{ fontSize: 18 }}>{site.title}</span>
        </Link>
        <div style={{ position: 'relative', maxWidth: 560 }}>
          <h1 style={{ fontSize: 'clamp(44px, 5cqi, 64px)', lineHeight: 1, letterSpacing: '-0.02em' }}>ห้องควบคุม<br /><span style={{ color: 'var(--orange-ink)' }}>ฝูงหุ่นสำรวจ</span></h1>
          <p style={{ marginTop: 16, fontSize: 18, color: 'var(--ink-2)' }}>ดูหุ่นวาดแผนที่เขาวงกตแบบสด สั่งหยุดได้ทันที และเรียนทุกขั้นตอนตั้งแต่ติดตั้งจนหุ่นวิ่ง</p>
        </div>
        <LoginStatus />
      </section>
      <section aria-labelledby="login-title" style={{ flex: '1 1 400px', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', boxSizing: 'border-box', background: 'var(--panel)' }}>
        <form onSubmit={submit} noValidate style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <h2 id="login-title" style={{ fontSize: 32 }}>เข้าสู่ระบบ</h2>
              <p style={{ marginTop: 4, color: 'var(--ink-3)' }}>ใช้บัญชีของทีมโปรเจกต์ mBot2</p>
            </div>
            <ThemeButton />
          </div>
          {error?.code === 'SUSPENDED' ? <SuspendedNotice detail={error.detail} /> : error ? <Notice tone="red">{error.message}</Notice> : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="user" style={{ fontSize: 13, fontWeight: 500 }}>อีเมล</label>
            <input id="user" type="email" autoComplete="username" placeholder="you@team.local" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} style={field} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label htmlFor="pass" style={{ fontSize: 13, fontWeight: 500 }}>รหัสผ่าน</label>
              <Link to="/contact" style={{ fontSize: 13 }}>ลืมรหัสผ่าน</Link>
            </div>
            <input id="pass" type="password" autoComplete="current-password" required value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} style={field} />
          </div>
          <button type="submit" disabled={busy} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 52, borderRadius: 999, border: 'none', background: 'var(--orange)', color: '#07080A', fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 18, cursor: 'pointer', boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.18)' }}>
            {busy ? <span className="spin">↻</span> : null}เข้าสู่ระบบ
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--ink-4)', fontSize: 13 }}><span style={{ flex: 1, height: 1, background: 'var(--line)' }} />หรือ<span style={{ flex: 1, height: 1, background: 'var(--line)' }} /></div>
          <Link to="/console" className="btn" style={{ minHeight: 48 }}>ใช้งานต่อโดยไม่ล็อกอิน</Link>
          <p style={{ fontSize: 13, color: 'var(--ink-4)' }}>ไม่ล็อกอินก็ดูภารกิจที่กำลังวิ่ง บทเรียน และรู้จักหุ่นได้ แต่เชื่อมหุ่นและบันทึกภารกิจไม่ได้ · ยังไม่มีบัญชี <Link to="/register">สมัครด้วยรหัสเชิญ</Link></p>
        </form>
      </section>
    </div>
  );
}

export function Register() {
  const { user, register } = useAuth();
  const { site } = useSite();
  const navigate = useNavigate();
  const [form, setForm] = useState({ display_name: '', email: '', password: '', invite: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/console" replace />;
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const fields = error?.fields ?? {};

  if (site.registration === 'closed') {
    return <AuthBox title="ปิดรับสมัครชั่วคราว" sub="ตอนนี้ยังไม่เปิดรับสมาชิกใหม่ ติดต่อผู้ดูแลเพื่อขอรหัสเชิญ"><Button to="/login">กลับไปเข้าสู่ระบบ</Button></AuthBox>;
  }
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register({ ...form, invite: form.invite || undefined });
      navigate('/console', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthBox title="สมัครสมาชิก" sub={site.registration === 'invite' ? 'ต้องมีรหัสเชิญจากผู้ดูแล' : 'สร้างบัญชีเพื่อบันทึกภารกิจ'}>
      {error && !error.fields ? <Notice tone="red">{error.message}</Notice> : null}
      <form className="col" style={{ gap: 14 }} onSubmit={submit} noValidate>
        {site.registration === 'invite' ? (
          <TextInput label="รหัสเชิญ" value={form.invite} onChange={set('invite')} error={fields.invite} autoComplete="off" required />
        ) : null}
        <TextInput label="ชื่อที่แสดง" value={form.display_name} onChange={set('display_name')} error={fields.display_name} maxLength={40} required />
        <TextInput label="อีเมล" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={fields.email} required />
        <PasswordInput autoComplete="new-password" value={form.password} onChange={set('password')} error={fields.password}
          hint="อย่างน้อย 8 ตัวอักษร" required />
        <Button type="submit" variant="primary" size="lg" loading={busy}>สมัครสมาชิก</Button>
      </form>
      <p className="muted small">มีบัญชีแล้ว? <Link to="/login">เข้าสู่ระบบ</Link></p>
    </AuthBox>
  );
}

export function Account() {
  const toast = useToast();
  const [form, setForm] = useState({ current: '', next: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/me/password', { method: 'POST', body: form });
      setForm({ current: '', next: '' });
      toast('เปลี่ยนรหัสผ่านแล้ว · ออกจากระบบเครื่องอื่นให้แล้ว');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthBox title="เปลี่ยนรหัสผ่าน" sub="เปลี่ยนแล้วเครื่องอื่นที่เข้าสู่ระบบไว้จะถูกออกจากระบบ">
      <form className="col" style={{ gap: 14 }} onSubmit={submit} noValidate>
        <PasswordInput label="รหัสผ่านปัจจุบัน" autoComplete="current-password" value={form.current}
          onChange={(e) => setForm({ ...form, current: e.target.value })} error={error?.fields?.current} />
        <PasswordInput label="รหัสผ่านใหม่" autoComplete="new-password" value={form.next} hint="อย่างน้อย 8 ตัวอักษร"
          onChange={(e) => setForm({ ...form, next: e.target.value })} error={error?.fields?.next} />
        <Button type="submit" variant="primary" loading={busy}>บันทึก</Button>
      </form>
    </AuthBox>
  );
}

export function NotFound() {
  return (
    <AuthBox title="ไม่พบหน้านี้" sub="ลิงก์อาจผิดหรือหน้าถูกย้ายไปแล้ว">
      <Button variant="primary" to="/console">ไปคอนโซล</Button>
    </AuthBox>
  );
}
