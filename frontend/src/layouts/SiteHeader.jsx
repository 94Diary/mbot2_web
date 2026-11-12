import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useConsent } from '../features/consent/CookieConsent.jsx';
import { LogoMark, ThemeButton } from '../features/design/Brand.jsx';
import { ROLE_LABEL, roleOf, useAuth } from '../lib/auth.jsx';
import { useSite } from '../lib/site.jsx';
import { Banner, Icon } from '../ui/index.js';

/** แถบแจ้งเตือนบนสุดทุกหน้า: โหมดปิดปรับปรุง (ผู้ดูแล) + ประกาศ */
export function TopBanners() {
  const { isAdmin } = useAuth();
  const { site, announcements, dismiss } = useSite();
  return (
    <>
      {site.maintenance && isAdmin ? (
        <Banner tone="red" icon="warn">เว็บอยู่ในโหมดปิดปรับปรุง · ผู้ใช้ทั่วไปเข้าไม่ได้ <Link className="link" to="/admin/settings">ปิดโหมดนี้</Link></Banner>
      ) : null}
      {announcements.map((a) => (
        <Banner key={a.id} tone={a.level === 'red' ? 'red' : a.level} onClose={() => dismiss(a.id)}>{a.text}</Banner>
      ))}
    </>
  );
}

function UserMenu() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const initial = (user?.display_name ?? '?').trim().charAt(0).toUpperCase();
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button type="button" className={`avbtn ${user ? '' : 'guest'}`} aria-expanded={open} aria-haspopup="menu" aria-label="เมนูผู้ใช้"
        onClick={() => setOpen((o) => !o)} style={user ? { background: user.avatar_color } : undefined}>
        {user ? initial : <Icon name="user" size={18} />}
      </button>
      {open ? (
        <div role="menu" className="menu fadeup" style={{ top: 50, width: 290 }}>
          {user ? (
            <>
              <div className="row" style={{ padding: '10px 10px 12px', borderBottom: '1px solid var(--line)', marginBottom: 6 }}>
                <span className="avbtn" style={{ background: user.avatar_color, cursor: 'default' }}>{initial}</span>
                <span><strong style={{ display: 'block' }}>{user.display_name}</strong><span className="small muted">{ROLE_LABEL[roleOf(user)]}</span></span>
              </div>
              <Link role="menuitem" to="/lessons">ความคืบหน้าการเรียน</Link>
              <Link role="menuitem" to="/console/history">ภารกิจของฉัน</Link>
              <Link role="menuitem" to="/account">เปลี่ยนรหัสผ่าน</Link>
              {isAdmin ? <Link role="menuitem" to="/admin"><span className="sp">หลังบ้าน · Dashboard เว็บ</span><span className="pill orange">ผู้ดูแล</span></Link> : null}
              <button type="button" role="menuitem" onClick={async () => { await logout(); navigate('/'); }}>ออกจากระบบ</button>
            </>
          ) : (
            <>
              <div style={{ padding: 10 }}>
                <strong>ผู้เยี่ยมชม</strong>
                <p className="small muted" style={{ marginTop: 4 }}>ดูบทเรียน รู้จักหุ่น และดูภารกิจที่กำลังวิ่งได้ เข้าสู่ระบบเพื่อเชื่อมหุ่นและเก็บประวัติ</p>
              </div>
              <Link role="menuitem" to="/login" style={{ fontWeight: 600 }}>เข้าสู่ระบบ</Link>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function SiteHeader() {
  const { site } = useSite();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  return (
    <header className="dhdr">
      <div className="in">
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--ink)' }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--ink)', display: 'grid', placeItems: 'center' }}><LogoMark /></span>
          <span className="H" style={{ fontSize: 18 }}>{site.title}</span>
        </Link>
        <nav className="dnav" aria-label="เมนูหลัก">
          <NavLink to="/" end>หน้าแรก</NavLink>
          <NavLink to="/lessons">บทเรียน</NavLink>
          <NavLink to="/robot">รู้จักหุ่น</NavLink>
          <NavLink to="/console/history">ประวัติภารกิจ</NavLink>
          <NavLink to="/about">เกี่ยวกับ</NavLink>
        </nav>
        <div style={{ flex: '1 1 40px' }} />
        <form className="dsearch" role="search" onSubmit={(e) => { e.preventDefault(); navigate(`/search?q=${encodeURIComponent(q)}`); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <label className="sr" htmlFor="site-search">ค้นหา</label>
          <input id="site-search" type="search" placeholder="ค้นหาบทเรียนหรือปัญหา" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <ThemeButton />
        <Link to="/console" className="consolebtn">
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="8" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>
          <span>เปิดคอนโซลหุ่น</span>
        </Link>
        <UserMenu />
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { site } = useSite();
  const consent = useConsent();
  return (
    <footer className="dftr">
      <div className="in">
        <div style={{ maxWidth: 380 }}>
          <div className="H" style={{ fontSize: 17 }}>{site.title}</div>
          <p className="small muted" style={{ marginTop: 4 }}>{site.description}</p>
        </div>
        <nav aria-label="ลิงก์ท้ายเว็บ">
          <Link to="/lessons">บทเรียน</Link>
          <Link to="/robot">รู้จักหุ่น</Link>
          <Link to="/console">คอนโซลหุ่น</Link>
          <Link to="/console/history">ประวัติภารกิจ</Link>
          <Link to="/contact">ติดต่อทีม</Link>
          <Link to="/privacy">นโยบาย</Link>
          <button type="button" onClick={consent.reopen}>ตั้งค่าคุกกี้</button>
          {site.contact_github ? <a href={`https://github.com/${site.contact_github}`} target="_blank" rel="noreferrer noopener">โค้ดบน GitHub</a> : null}
        </nav>
      </div>
    </footer>
  );
}
