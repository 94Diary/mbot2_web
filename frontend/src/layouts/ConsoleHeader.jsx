// หัวเว็บแบบเดิม ใช้กับคอนโซลและหลังบ้าน (หน้าสาธารณะใช้ SiteHeader ตามดีไซน์ใหม่)
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ROLE_LABEL, roleOf, useAuth } from '../lib/auth.jsx';
import { useSite } from '../lib/site.jsx';
import { useTheme } from '../lib/theme.js';
import { Banner, Button, Icon, UserAvatar } from '../ui/index.js';

function UserMenu() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div className="usermenu" ref={ref}>
      <button type="button" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}>
        <UserAvatar user={user} size={32} />
        <span className="hide-m">{user.display_name}</span>
      </button>
      {open ? (
        <div className="menu" role="menu">
          <div className="who"><strong>{user.display_name}</strong><div className="muted small">{user.email} · {ROLE_LABEL[roleOf(user)]}</div></div>
          <Link role="menuitem" to="/console/history" onClick={() => setOpen(false)}><Icon name="hist" size={18} />ประวัติของฉัน</Link>
          <Link role="menuitem" to="/account" onClick={() => setOpen(false)}><Icon name="key" size={18} />เปลี่ยนรหัสผ่าน</Link>
          {isAdmin ? <Link role="menuitem" to="/admin" onClick={() => setOpen(false)}><Icon name="shield" size={18} />หลังบ้าน</Link> : null}
          <button type="button" role="menuitem" onClick={async () => { await logout(); navigate('/'); }}><Icon name="logout" size={18} />ออกจากระบบ</button>
        </div>
      ) : null}
    </div>
  );
}

export function ConsoleHeader() {
  const { user, isAdmin } = useAuth();
  const [menu, setMenu] = useState(false);
  const { site, announcements, dismiss } = useSite();
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();
  const inAdmin = pathname.startsWith('/admin');
  useEffect(() => setMenu(false), [pathname]);
  return (
    <>
      {site.maintenance && isAdmin ? (
        <Banner tone="red" icon="warn">เว็บอยู่ในโหมดปิดปรับปรุง · ผู้ใช้ทั่วไปเข้าไม่ได้ <Link className="link" to="/admin/settings">ปิดโหมดนี้</Link></Banner>
      ) : null}
      {announcements.map((a) => (
        <Banner key={a.id} tone={a.level === 'red' ? 'red' : a.level} onClose={() => dismiss(a.id)}>{a.text}</Banner>
      ))}
      <header className="hdr">
        <div className="wrap">
          <Link to="/" className="logo" aria-label={`${site.title} หน้าแรก`}>
            <i><Icon name="bot" size={20} /></i>
            <span>{site.title}</span>
          </Link>
          {!inAdmin ? (
            <nav className="nav" aria-label="เมนูหลัก">
              <NavLink to="/" end>หน้าแรก</NavLink>
              <NavLink to="/lessons">บทเรียน</NavLink>
              <NavLink to="/robot">รู้จักหุ่น</NavLink>
              <NavLink to="/console">คอนโซล</NavLink>
            </nav>
          ) : null}
          <span className="sp" />
          {!inAdmin ? <Link to="/search" className="searchbox hide-m" style={{ minWidth: 200, textDecoration: 'none' }}><Icon name="search" size={18} />ค้นหาบทเรียน หน้า ปัญหา</Link> : null}
          {!inAdmin ? <Button iconOnly icon="search" label="ค้นหา" to="/search" className="only-m" /> : null}
          {!inAdmin ? <Button iconOnly icon="menu" label="เมนู" className="only-m" onClick={() => setMenu((m) => !m)} aria-expanded={menu} /> : null}
          {isAdmin ? (
            <nav className="modeswitch hide-m" aria-label="สลับมุมมอง">
              <NavLink to="/console" className={({ isActive }) => (isActive || !inAdmin ? 'active' : '')}>ใช้งานหุ่น</NavLink>
              <NavLink to="/admin">หลังบ้าน</NavLink>
            </nav>
          ) : null}
          <Button iconOnly icon="theme" label={theme === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'} onClick={toggle} />
          {user ? <UserMenu /> : <Button variant="chip" size="sm" to="/login">เข้าสู่ระบบ</Button>}
        </div>
        {menu ? (
          <nav className="drawer-nav fadeup" aria-label="เมนูหลัก (มือถือ)">
            <NavLink to="/" end>หน้าแรก</NavLink>
            <NavLink to="/lessons">บทเรียน</NavLink>
            <NavLink to="/robot">รู้จักหุ่น</NavLink>
            <NavLink to="/console">คอนโซล</NavLink>
            <NavLink to="/contact">ติดต่อ</NavLink>
            {isAdmin ? <NavLink to="/admin">หลังบ้าน</NavLink> : null}
          </nav>
        ) : null}
      </header>
    </>
  );
}

