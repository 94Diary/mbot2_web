import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useSite } from '../../lib/site.jsx';
import { Button, EmptyState, Icon, Notice, Select, TextInput, Textarea } from '../../ui/index.js';
import { useDebounced } from '../../lib/listParams.js';

function DocPage({ k, title, version, sections }) {
  return (
    <main className="wrap col" style={{ gap: 16, paddingTop: 28, paddingBottom: 56, maxWidth: 820 }}>
      <span className="k">{k}</span>
      <h1 style={{ fontSize: 36 }}>{title}</h1>
      {version ? <p className="muted">{version}</p> : null}
      {sections.map(([h, body]) => (
        <section key={h} className="col" style={{ gap: 6 }}>
          <h2 style={{ fontSize: 20 }}>{h}</h2>
          <div style={{ color: 'var(--ink-2)' }}>{body}</div>
        </section>
      ))}
    </main>
  );
}

export function About() {
  return (
    <DocPage k="เกี่ยวกับ" title="เกี่ยวกับโปรเจกต์" sections={[
      ['ฝูงหุ่นสำรวจเขาวงกต', 'หุ่น mBot2 หลายตัวเดินตามเส้นพร้อมกัน แบ่งกันไปคนละกิ่ง จำทางแยกและทางตัน แล้วช่วยกันหาพื้นที่เป้าหมาย โดยไม่มีตัวไหนรู้แผนที่มาก่อน'],
      ['เทคโนโลยี', 'ROS 2 Humble บน WSL2 (Ubuntu 22.04), Gazebo Fortress, เว็บ React + Node.js ที่ต่อ ROS 2 ผ่าน rclnodejs และ SQLite เก็บบัญชี บทเรียน และประวัติภารกิจ'],
      ['ทีม', 'ทีมผู้พัฒนาโปรเจกต์ mBot2 และรุ่นน้องที่จะรับช่วงต่อ ติดต่อทีมได้ที่หน้าติดต่อ'],
      ['โค้ด', <span key="c">โค้ดหุ่นอยู่ใน <span className="M">~/ros2_ws</span> (แพ็กเกจ <span className="M">mbot2_control</span>, <span className="M">mbot2_description</span>) · อ่านวิธีเริ่มได้ใน <Link to="/lessons">บทเรียน</Link></span>],
    ]} />
  );
}

export function Privacy() {
  return (
    <DocPage k="นโยบาย" title="นโยบายความเป็นส่วนตัว" version="ฉบับวันที่ 12 พ.ย. 2569 · เวอร์ชัน 1.2" sections={[
      ['เราเก็บข้อมูลอะไร', 'ชื่อที่แสดง อีเมล บทบาท ประวัติภารกิจ log ของหุ่น ความคืบหน้าบทเรียน ข้อความที่ส่งผ่านฟอร์มติดต่อ และการกระทำบนเว็บ (เช่น รันซิม แก้ตั้งค่า) พร้อมเวลาและ IP'],
      ['เก็บไปทำไม', 'เพื่อให้เข้าสู่ระบบได้ เก็บความคืบหน้าการเรียน ย้อนดูภารกิจ ตอบคำถามที่ส่งมา และตรวจสอบย้อนหลังเมื่อมีปัญหา'],
      ['เก็บนานแค่ไหน', 'log การใช้งานเก็บตามที่ผู้ดูแลตั้ง (ค่าเริ่มต้น 1 ปี) ประวัติภารกิจเก็บจนกว่าคุณจะลบ บันทึกความยินยอมคุกกี้เก็บอย่างน้อย 12 เดือน'],
      ['คุกกี้', 'คุกกี้จำเป็นใช้จำการเข้าสู่ระบบ คุกกี้จำการตั้งค่าและสถิติใช้เมื่อคุณยินยอมเท่านั้น เปลี่ยนใจได้ทุกเมื่อจาก “ตั้งค่าคุกกี้” ด้านล่างของทุกหน้า'],
      ['สิทธิ์ของคุณ', 'ขอดู ขอแก้ ขอดาวน์โหลด หรือขอลบข้อมูลของคุณได้ โดยติดต่อทีมผ่านหน้าติดต่อ'],
    ]} />
  );
}

export function Terms() {
  return (
    <DocPage k="ข้อตกลง" title="ข้อตกลงการใช้งาน" version="ฉบับวันที่ 12 พ.ย. 2569 · เวอร์ชัน 1.0" sections={[
      ['ใช้หุ่นอย่างปลอดภัย', 'อย่าสั่งหยุดหรือรบกวนภารกิจของคนอื่นโดยไม่จำเป็น และใช้หุ่นจริงตามคำแนะนำในบทเรียนเสมอ'],
      ['บัญชี', 'รักษารหัสผ่านของคุณเอง อย่าใช้บัญชีร่วมกับคนอื่น ผู้ดูแลระงับบัญชีที่ใช้ผิดข้อตกลงได้ และคุณขออุทธรณ์ได้ผ่านหน้าติดต่อ'],
      ['เนื้อหา', 'บทเรียนและโค้ดของทีมใช้เพื่อการศึกษา ถ้านำไปเผยแพร่ต่อ ให้อ้างอิงที่มา'],
      ['การเปลี่ยนแปลง', 'ทีมอาจปรับข้อตกลงนี้ และจะแจ้งผ่านประกาศบนเว็บก่อนมีผล'],
    ]} />
  );
}

const SUGGEST = ['ROS', 'Gazebo', 'เซนเซอร์', 'build', 'ทางแยก'];
const KIND = { lesson: 'บทเรียน', page: 'หน้า', help: 'ช่วยเหลือ' };

export function Search() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const debounced = useDebounced(q, 250);
  const [result, setResult] = useState(null);
  useEffect(() => {
    setParams(debounced ? { q: debounced } : {}, { replace: true });
    if (!debounced.trim()) { setResult(null); return undefined; }
    const controller = new AbortController();
    api(`/search?q=${encodeURIComponent(debounced)}`, { signal: controller.signal }).then(setResult).catch(() => {});
    return () => controller.abort();
  }, [debounced, setParams]);
  return (
    <main className="wrap col" style={{ gap: 16, paddingTop: 28, paddingBottom: 56, maxWidth: 860 }}>
      <h1 style={{ fontSize: 32 }}>ค้นหา</h1>
      <label className="searchbox" style={{ minHeight: 54, fontSize: 17, width: '100%' }}>
        <Icon name="search" /><span className="sr">คำค้นหา</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="เช่น ROS, Gazebo, เซนเซอร์, หุ่นไม่เดิน" autoFocus maxLength={100} />
      </label>
      <div className="row wrapr muted small">ลองค้น: {SUGGEST.map((s) => <button key={s} type="button" className="pill gray" style={{ border: 'none' }} onClick={() => setQ(s)}>{s}</button>)}</div>
      {result && result.items.length ? (
        <>
          <p className="muted">พบ {result.items.length} รายการสำหรับ “{result.q}”</p>
          {result.items.map((r) => (
            <Link key={`${r.kind}${r.href}${r.title}`} to={r.href} className="card pad col lessoncard" style={{ gap: 4 }}>
              <span className="k">{KIND[r.kind]}</span><span className="H" style={{ fontSize: 17 }}>{r.title}</span><span className="muted small">{r.summary}</span>
            </Link>
          ))}
        </>
      ) : null}
      {result && !result.items.length ? (
        <div className="card"><EmptyState icon="search" title={`ไม่พบ “${result.q}”`} action={<><Button to="/lessons">ดูบทเรียนทั้งหมด</Button><Button variant="primary" to="/contact">ถามทีม</Button></>}>
          ลองคำที่สั้นลง หรือดูบทเรียนทั้งหมด ถ้ายังไม่เจอ ส่งคำถามมาที่ทีมได้
        </EmptyState></div>
      ) : null}
    </main>
  );
}

const TOPICS = ['ถามเรื่องบทเรียน', 'แจ้งปัญหาเว็บ', 'ขอสิทธิ์ใช้งาน', 'อื่นๆ'];

export function Contact() {
  const { site } = useSite();
  const { user } = useAuth();
  const empty = { name: user?.display_name ?? '', email: user?.email ?? '', topic: TOPICS[0], message: '', human: false, website: '' };
  const [form, setForm] = useState(empty);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const f = error?.fields ?? {};
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/contact', { method: 'POST', body: form });
      setSent(true);
    } catch (err) { setError(err); } finally { setBusy(false); }
  };
  const channels = [['mail', 'อีเมล', site.contact_email], ['bell', 'LINE', site.contact_line], ['user', 'โทร', site.contact_phone], ['globe', 'GitHub', site.contact_github]].filter(([, , v]) => v);
  return (
    <main className="wrap grid g2 stack-m" style={{ gap: 24, paddingTop: 28, paddingBottom: 56, alignItems: 'start' }}>
      <div className="col">
        <span className="k">ติดต่อ</span>
        <h1 style={{ fontSize: 36 }}>ติดต่อทีม</h1>
        <p className="muted">ถามเรื่องบทเรียน แจ้งปัญหา หรือขอสิทธิ์ใช้งาน ปกติตอบภายใน 1 วันทำการ</p>
        {channels.length ? (
          <div className="card pad col">{channels.map(([icon, label, value]) => (
            <div key={label} className="row"><Icon name={icon} /><span className="muted" style={{ width: 70 }}>{label}</span><strong>{value}</strong></div>
          ))}</div>
        ) : null}
      </div>
      <div className="card pad col">
        {sent ? (
          <>
            <Notice tone="go">ส่งข้อความแล้ว ทีมจะตอบกลับทางอีเมลที่ให้ไว้</Notice>
            <Button onClick={() => { setForm(empty); setSent(false); }}>ส่งอีกข้อความ</Button>
          </>
        ) : (
          <form className="col" style={{ gap: 14 }} onSubmit={submit} noValidate>
            {error && !error.fields ? <Notice tone="red">{error.message}</Notice> : null}
            <TextInput label="ชื่อ" autoComplete="name" value={form.name} onChange={set('name')} error={f.name} maxLength={80} />
            <TextInput label="อีเมลสำหรับตอบกลับ" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={f.email} />
            <Select label="เรื่อง" value={form.topic} onChange={set('topic')} error={f.topic} options={TOPICS.map((t) => ({ value: t, label: t }))} />
            <Textarea label="ข้อความ" value={form.message} onChange={set('message')} error={f.message} maxLength={4000} />
            <input type="text" name="website" value={form.website} onChange={set('website')} tabIndex={-1} autoComplete="off" aria-hidden="true"
              style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} />
            <label className="check" style={{ padding: '12px 14px', border: `1px solid ${f.human ? 'var(--red-ink)' : 'var(--line-strong)'}`, borderRadius: 14, background: 'var(--bg)' }}>
              <input type="checkbox" checked={form.human} onChange={set('human')} /><span className="sp">ฉันไม่ใช่บอท</span><span className="muted M" style={{ fontSize: 11 }}>CAPTCHA</span>
            </label>
            {f.human ? <span className="small" style={{ color: 'var(--red-ink)' }}>{f.human}</span> : null}
            <Button type="submit" variant="primary" size="lg" loading={busy}>ส่งข้อความ</Button>
          </form>
        )}
      </div>
    </main>
  );
}
