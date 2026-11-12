import { api } from '../../lib/api.js';
import { ROLE_LABEL } from '../../lib/auth.jsx';
import { useAsync } from '../../lib/useAsync.js';
import { ErrorNotice, Skeleton } from '../../ui/index.js';

const RULES = [
  'ต้องมีเจ้าของอย่างน้อย 1 คนเสมอ (แนะนำ 2)',
  'ผู้ดูแลจัดการได้เฉพาะบัญชีสมาชิก',
  'ไม่มีใครแก้บทบาทหรือระงับตัวเองได้',
  'Audit log ไม่มีใครลบหรือแก้ได้ รวมถึงเจ้าของ',
  'API เช็กสิทธิ์ทุกครั้ง การซ่อนปุ่มไม่ใช่ความปลอดภัย',
];

export function Roles() {
  const r = useAsync((signal) => api('/admin/roles', { signal }), 'roles');
  const data = r.data;
  return (
    <>
      <div className="page-head"><div className="sp"><h1>บทบาทและสิทธิ์</h1><p className="sub">กำหนดในโค้ด (อ่านอย่างเดียว) ตาม docs/roles-permissions.md</p></div></div>
      <ErrorNotice error={r.error} onRetry={r.reload} />
      {!data ? <Skeleton height={400} /> : (
        <>
          <div className="grid g4">
            {data.roles.map((role) => (
              <div key={role.key} className="card pad col" style={{ gap: 4 }}>
                <span className="k">{role.key}</span><h3>{ROLE_LABEL[role.key]}</h3>
                <span className="muted small">{role.count === null ? 'ไม่ได้เข้าสู่ระบบ' : `${role.count} คน`} · {role.permissions.length} สิทธิ์</span>
              </div>
            ))}
          </div>
          <section className="card pad col"><h2>กฎ</h2><ul style={{ margin: 0, paddingLeft: 20 }}>{RULES.map((t) => <li key={t}>{t}</li>)}</ul></section>
          <section className="card tscroll">
            <table className="t permtable">
              <thead><tr><th>สิทธิ์</th><th>key</th>{data.roles.map((role) => <th key={role.key} className="c">{ROLE_LABEL[role.key]}</th>)}</tr></thead>
              <tbody>
                {data.permissions.map((perm) => (
                  <tr key={perm.key}>
                    <td>{perm.label}</td><td className="M small muted">{perm.key}</td>
                    {data.roles.map((role) => (role.permissions.includes(perm.key)
                      ? <td key={role.key} className="yes" aria-label="มีสิทธิ์">✓</td>
                      : <td key={role.key} className="no" aria-label="ไม่มีสิทธิ์">–</td>))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </>
  );
}
