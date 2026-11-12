import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { Button, Icon } from '../ui/index.js';

const GROUPS = [
  ['ภาพรวม', [['/admin', 'stats', 'Dashboard', 'dash.view', true], ['/admin/system', 'wifi', 'สถานะระบบ', 'dash.view']]],
  ['เนื้อหา', [['/admin/lessons', 'doc', 'บทเรียน', 'content.edit'], ['/admin/announcements', 'mega', 'ประกาศ', 'announce.edit']]],
  ['ผู้ใช้และข้อมูล', [
    ['/admin/users', 'users', 'ผู้ใช้', 'users.view'],
    ['/admin/roles', 'shield', 'บทบาทและสิทธิ์', 'users.view'],
    ['/admin/missions', 'map', 'ภารกิจและข้อมูล', 'data.view'],
    ['/admin/messages', 'mail', 'ข้อความติดต่อ', 'users.view'],
  ]],
  ['ระบบ', [
    ['/admin/machine', 'plug', 'เครื่องรันซิม', 'settings.edit'],
    ['/admin/settings', 'set', 'ตั้งค่าเว็บ', 'settings.edit'],
    ['/admin/backups', 'db', 'สำรองข้อมูล', 'backup.run'],
    ['/admin/audit', 'log', 'Audit log', 'audit.view'],
  ]],
];

export function AdminLayout() {
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <div className="adm">
      <nav className={`side ${open ? 'open' : ''}`} aria-label="เมนูหลังบ้าน">
        {GROUPS.map(([group, items]) => {
          const visible = items.filter(([, , , perm]) => can(perm));
          if (!visible.length) return null;
          return (
            <div key={group} className="col" style={{ gap: 2 }}>
              <div className="grp">{group}</div>
              {visible.map(([to, icon, label, , end]) => (
                <NavLink key={to} to={to} end={end}><Icon name={icon} size={18} />{label}</NavLink>
              ))}
            </div>
          );
        })}
      </nav>
      <div className="amain">
        <div className="abody">
          <div className="side-toggle"><Button size="sm" icon="menu" onClick={() => setOpen((o) => !o)}>เมนูหลังบ้าน</Button></div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
