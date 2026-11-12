import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, query } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { fmtDateTime, fmtRelative } from '../../lib/format.js';
import { useToast } from '../../lib/toast.jsx';
import { useAsync } from '../../lib/useAsync.js';
import {
  Button, ConfirmModal, EmptyState, ErrorNotice, Icon, KeyValue, Notice, Pager, Pill, Segmented, Skeleton, TextInput,
} from '../../ui/index.js';

const bytes = (n) => {
  if (!Number.isFinite(n)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v < 10 && i ? 1 : 0)} ${units[i]}`;
};
const duration = (s) => (s < 3600 ? `${Math.floor(s / 60)} นาที` : s < 86400 ? `${Math.floor(s / 3600)} ชม.` : `${Math.floor(s / 86400)} วัน`);
const SIM = { idle: 'ไม่มีซิมรันอยู่', building: 'กำลัง build', launching: 'กำลังเปิดซิม', running: 'ซิมกำลังวิ่ง', stopping: 'กำลังหยุด' };

function StatusCard({ name, ok, warn, text }) {
  const tone = ok ? 'go' : warn ? 'warn' : 'red';
  return (
    <div className="card pad col" style={{ gap: 6 }}>
      <div className="row"><span className={`dot ${ok ? 'led' : ''}`} style={{ color: `var(--${tone === 'red' ? 'red-ink' : tone})` }} /><strong className="sp">{name}</strong>
        <Pill tone={tone}>{ok ? 'ปกติ' : warn ? 'ควรตรวจ' : 'มีปัญหา'}</Pill></div>
      <span className="muted M" style={{ fontSize: 12.5 }}>{text}</span>
    </div>
  );
}

export function SystemStatus() {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 30000); return () => clearInterval(id); }, []);
  const s = useAsync((signal) => api('/admin/system', { signal }), tick);
  const d = s.data;
  const backupAge = d?.backup ? (Date.now() - new Date(d.backup.at).getTime()) / 3600000 : null;
  const diskPct = d?.disk ? d.disk.free_bytes / d.disk.total_bytes : null;
  return (
    <>
      <div className="page-head"><div className="sp"><h1>สถานะระบบ</h1><p className="sub">เครื่องนี้ (เว็บ + ซิม) · เช็กทุก 30 วินาที</p></div>
        <Button size="sm" icon="refresh" onClick={() => setTick((t) => t + 1)}>ตรวจตอนนี้</Button></div>
      <ErrorNotice error={s.error} onRetry={s.reload} />
      {!d ? <div className="grid g3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height={96} />)}</div> : (
        <>
          <div className="grid g3">
            <StatusCard name="เว็บเซิร์ฟเวอร์" ok text={`ทำงาน ${duration(d.server.uptime_s)} · Node ${d.server.node}`} />
            <StatusCard name="ฐานข้อมูล" ok={d.database.ok} text={`SQLite · ${bytes(d.database.size_bytes)}`} />
            <StatusCard name="ดิสก์" ok={diskPct === null || diskPct > 0.15} warn text={d.disk ? `ว่าง ${bytes(d.disk.free_bytes)} จาก ${bytes(d.disk.total_bytes)}` : 'อ่านไม่ได้'} />
            <StatusCard name="ROS 2" ok={d.ros.ros_node_running} text={d.ros.ros_node_running ? (d.ros.team_state_fresh ? 'เชื่อมแล้ว · ได้ข้อมูลทีมสด' : 'เชื่อมแล้ว · ยังไม่มีข้อมูลทีม') : (d.ros.ros_error ?? 'ยังไม่เชื่อม')} />
            <StatusCard name="ซิม" ok={!d.sim.error} warn text={`${SIM[d.sim.state]}${d.sim.world ? ` · ${d.sim.world}` : ''}${d.sim.error ? ` · ล่าสุดล้ม: ${d.sim.error.code}` : ''}`} />
            <StatusCard name="สำรองข้อมูลล่าสุด" ok={backupAge !== null && backupAge < 26 && d.backup.ok} warn
              text={d.backup ? `${fmtRelative(d.backup.at)} · ${d.backup.ok ? 'สำเร็จ' : 'ล้มเหลว'}` : 'ยังไม่เคยสำรอง'} />
          </div>
          <section className="card pad col">
            <div className="row"><h2 className="sp" style={{ fontSize: 18 }}>24 ชั่วโมงล่าสุด</h2><Link to="/admin/missions">ดูภารกิจทั้งหมด</Link></div>
            <div className="grid g4">
              {[['ภารกิจที่บันทึก', d.missions_24h.saved], ['ผู้ใช้ที่รัน', `${d.missions_24h.users} คน`], ['ข้อความติดต่อใหม่', d.messages_new], ['ไฟล์ฐานข้อมูล', bytes(d.database.size_bytes)]].map(([a, v]) => (
                <div key={a}><div className="k">{a}</div><div className="H" style={{ fontSize: 24 }}>{v}</div></div>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}

export function Machine() {
  const m = useAsync((signal) => api('/admin/machine', { signal }), 'machine');
  const d = m.data;
  return (
    <>
      <div className="page-head"><div className="sp"><h1>เครื่องรันซิม</h1><p className="sub">ซิมรันบนเครื่องเดียวกับเว็บ · ค่านี้มาจาก backend/.env และโค้ดหุ่น</p></div></div>
      <Notice tone="blue">สถาปัตยกรรมเฟสนี้ไม่ใช้ “ตัวเชื่อมเครื่อง” แยก: backend สั่ง colcon/ros2 launch ให้เอง และรันได้เฉพาะคำสั่งในตารางด้านล่าง</Notice>
      <ErrorNotice error={m.error} onRetry={m.reload} />
      {!d ? <Skeleton height={300} /> : (
        <div className="grid g2 stack-m" style={{ alignItems: 'start' }}>
          <section className="card pad col">
            <h2 style={{ fontSize: 18 }}>workspace ของโค้ดหุ่น</h2>
            <KeyValue label="ตำแหน่ง"><span className="M">{d.ws_path}</span></KeyValue>
            <KeyValue label="build แล้ว">{d.built ? <Pill tone="go">มี install/setup.bash</Pill> : <Pill tone="red">ยังไม่ได้ build</Pill>}</KeyValue>
            <KeyValue label="ROS distro">{d.ros_distro ?? <span className="muted">backend ไม่ได้ source ROS</span>}</KeyValue>
            <KeyValue label="branch"><span className="M">{d.git.code_branch ?? '—'}</span></KeyValue>
            <KeyValue label="commit"><span className="M">{d.git.code_commit ?? '—'}</span></KeyValue>
            <KeyValue label="สนามที่ใช้ได้">{d.worlds.length ? d.worlds.join(', ') : <span className="muted">ไม่พบ</span>}</KeyValue>
            <KeyValue label="จำนวนหุ่น">{d.robot_counts.join(' หรือ ')} ตัว</KeyValue>
          </section>
          <section className="card pad col">
            <h2 style={{ fontSize: 18 }}>คำสั่งที่ backend ยอมรัน (อ่านอย่างเดียว)</h2>
            {d.commands.map((c) => (
              <div key={c.name} className="col" style={{ gap: 4, borderTop: '1px solid var(--line-2)', paddingTop: 10 }}>
                <div className="row"><Pill tone="ink">{c.name}</Pill><span className="muted small">{c.when}</span></div>
                <div className="terminal" style={{ maxHeight: 'none' }}>{c.argv}</div>
              </div>
            ))}
            <p className="muted small">ไม่มีช่องพิมพ์คำสั่งอิสระ ทุกค่าตรวจกับรายการที่อนุญาตก่อนสร้างคำสั่ง และไม่ส่งคำสั่งมอเตอร์ (/cmd_vel) จากเว็บ</p>
          </section>
        </div>
      )}
    </>
  );
}

const KIND = { auto: 'อัตโนมัติ', manual: 'สำรองทันที', 'pre-restore': 'ก่อนกู้คืน' };

export function Backups() {
  const { can } = useAuth();
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const list = useAsync((signal) => api('/admin/backups', { signal }), version);
  const [busy, setBusy] = useState(null);
  const [restoring, setRestoring] = useState(null);
  const [confirm, setConfirm] = useState('');
  const items = list.data?.items;
  const lastTest = items?.find((b) => b.restore_tested_at);
  const run = async (key, fn, ok) => {
    setBusy(key);
    try { const out = await fn(); toast(typeof ok === 'function' ? ok(out) : ok); setVersion((v) => v + 1); return out; } catch (err) { toast(err.message, 'err'); return null; } finally { setBusy(null); }
  };
  return (
    <>
      <div className="page-head">
        <div className="sp"><h1>สำรองข้อมูล</h1><p className="sub">อัตโนมัติทุกวัน 03:00 · เก็บย้อนหลัง 30 วัน · {list.data?.dir ?? ''}</p></div>
        <Button variant="primary" icon="db" loading={busy === 'run'} onClick={() => run('run', () => api('/admin/backups', { method: 'POST' }), 'สำรองข้อมูลแล้ว')}>สำรองตอนนี้</Button>
      </div>
      <section className="card pad col">
        <h2 style={{ fontSize: 18 }}>กฎ 3-2-1-1-0</h2>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {[['1', 'สำเนาในเครื่อง', 'backend/backups/', true], ['1', 'สื่อต่างกัน', 'ยังไม่มีไดรฟ์ภายนอก', false], ['0', 'นอกสถานที่', 'ยังไม่มีคลาวด์', false], ['0', 'แก้ไม่ได้', 'ยังไม่มีที่เก็บแบบล็อก', false],
            [lastTest?.restore_test_result?.ok ? '0' : '?', 'ผิดพลาดตอนกู้', lastTest ? `ทดสอบล่าสุด ${fmtRelative(lastTest.restore_tested_at)}` : 'ยังไม่เคยทดสอบ', Boolean(lastTest?.restore_test_result?.ok)]].map(([n, t, d, ok]) => (
            <div key={t} className="card pad col" style={{ gap: 2, background: 'var(--raise)' }}>
              <span className="H" style={{ fontSize: 30, color: ok ? 'var(--go)' : 'var(--warn)' }}>{n}</span><strong style={{ fontSize: 14 }}>{t}</strong><span className="muted" style={{ fontSize: 12.5 }}>{d}</span>
            </div>
          ))}
        </div>
        <Notice tone="warn">ตอนนี้สำรองไว้ในเครื่องเดียวกับเว็บเท่านั้น ถ้าเครื่องเสียข้อมูลจะหายทั้งหมด ควรคัดลอกโฟลเดอร์ backups ไปเก็บที่อื่นเป็นระยะ และทดสอบกู้ทุก 3 เดือน</Notice>
      </section>
      <ErrorNotice error={list.error} onRetry={list.reload} />
      <section className="card tscroll">
        {!items ? <div style={{ padding: 16 }}><Skeleton height={160} /></div> : !items.length ? (
          <EmptyState icon="db" title="ยังไม่เคยสำรองข้อมูล" action={<Button variant="primary" onClick={() => run('run', () => api('/admin/backups', { method: 'POST' }), 'สำรองข้อมูลแล้ว')}>สำรองครั้งแรก</Button>}>ระบบจะสำรองอัตโนมัติตอน 03:00 ทุกวัน</EmptyState>
        ) : (
          <table className="t">
            <thead><tr><th>เมื่อ</th><th>แบบ</th><th>ขนาด</th><th>ไฟล์</th><th>ผล</th><th /></tr></thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(b.at)}</td>
                  <td className="muted">{KIND[b.kind]}</td>
                  <td className="M">{bytes(b.size_bytes)}</td>
                  <td className="M small">{b.file}</td>
                  <td>
                    <Pill tone={b.ok ? 'go' : 'red'}>{b.ok ? 'สำเร็จ' : 'ล้มเหลว'}</Pill>{' '}
                    {b.restore_test_result ? <Pill tone={b.restore_test_result.ok ? 'blue' : 'red'}>{b.restore_test_result.ok ? 'ทดสอบกู้ผ่าน' : 'ทดสอบกู้ไม่ผ่าน'}</Pill> : null}
                    {b.error ? <div className="muted small">{b.error}</div> : null}
                  </td>
                  <td>
                    {b.ok ? (
                      <div className="row" style={{ gap: 6 }}>
                        <Button size="sm" loading={busy === `t${b.id}`} onClick={() => run(`t${b.id}`, () => api(`/admin/backups/${b.id}/test-restore`, { method: 'POST' }),
                          (r) => (r.ok ? `ทดสอบกู้ผ่าน · ผู้ใช้ ${r.users} · ภารกิจ ${r.missions} · บทเรียน ${r.lessons}` : 'ทดสอบกู้ไม่ผ่าน'))}>ทดสอบกู้</Button>
                        {can('backup.restore') ? <Button size="sm" variant="ghostDanger" onClick={() => { setConfirm(''); setRestoring(b); }}>กู้คืน</Button> : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {restoring ? (
        <ConfirmModal title={`กู้คืนข้อมูลจาก ${fmtDateTime(restoring.at)}?`} danger confirmLabel="กู้คืน" busy={busy === 'restore'} onClose={() => setRestoring(null)}
          onConfirm={async () => {
            const out = await run('restore', () => api(`/admin/backups/${restoring.id}/restore`, { method: 'POST', body: { confirm } }), 'กู้คืนข้อมูลแล้ว · รีโหลดหน้าเพื่อดูข้อมูลล่าสุด');
            if (out) setRestoring(null);
          }}>
          <p>ข้อมูลผู้ใช้ ภารกิจ บทเรียน ประกาศ และตั้งค่าจะกลับไปเป็นของรอบนั้น ระบบจะสำรองข้อมูลปัจจุบันไว้ก่อนอัตโนมัติ · Audit log และคนที่เข้าสู่ระบบอยู่จะไม่ถูกกู้ทับ</p>
          <TextInput label="พิมพ์ “กู้คืน” เพื่อยืนยัน" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </ConfirmModal>
      ) : null}
    </>
  );
}

export function Messages() {
  const { can } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState('new');
  const [page, setPage] = useState({ page: 1, pageSize: 10 });
  const [version, setVersion] = useState(0);
  const list = useAsync((signal) => api(`/admin/messages${query({ status, page: page.page, page_size: page.pageSize })}`, { signal }), `${status}${page.page}${page.pageSize}${version}`);
  const [open, setOpen] = useState(null);
  const data = list.data;
  const update = async (m, next) => {
    try { await api(`/admin/messages/${m.id}`, { method: 'PATCH', body: { status: next } }); toast(next === 'done' ? 'ปิดเรื่องแล้ว' : 'เปิดเรื่องใหม่แล้ว'); setVersion((v) => v + 1); } catch (err) { toast(err.message, 'err'); }
  };
  const remove = async (m) => {
    try { await api(`/admin/messages/${m.id}`, { method: 'DELETE' }); toast('ลบข้อความแล้ว'); setVersion((v) => v + 1); } catch (err) { toast(err.message, 'err'); }
  };
  return (
    <>
      <div className="page-head"><div className="sp"><h1>ข้อความติดต่อ</h1><p className="sub">{data ? `ใหม่ ${data.unread} ข้อความ` : ''} · จากฟอร์มหน้าติดต่อ</p></div></div>
      <Segmented label="สถานะ" value={status} onChange={(s) => { setStatus(s); setPage({ page: 1, pageSize: page.pageSize }); }}
        options={[{ value: 'new', label: 'ใหม่' }, { value: 'done', label: 'จัดการแล้ว' }, { value: '', label: 'ทั้งหมด' }]} />
      <ErrorNotice error={list.error} onRetry={list.reload} />
      {!data ? <Skeleton height={200} /> : !data.total ? (
        <div className="card"><EmptyState icon="mail" title={status === 'new' ? 'ไม่มีข้อความใหม่' : 'ไม่มีข้อความ'}>ข้อความจากหน้าติดต่อจะขึ้นที่นี่</EmptyState></div>
      ) : (
        <div className="col">
          {data.items.map((m) => (
            <section key={m.id} className="card pad col" style={{ gap: 8 }}>
              <button type="button" className="row" style={{ border: 'none', background: 'none', color: 'var(--ink)', textAlign: 'left', padding: 0 }} onClick={() => setOpen(open === m.id ? null : m.id)} aria-expanded={open === m.id}>
                <Icon name="mail" />
                <span className="sp"><strong>{m.topic}</strong> · {m.name} <span className="muted small">&lt;{m.email}&gt;</span></span>
                <Pill tone={m.status === 'new' ? 'orange' : 'gray'}>{m.status === 'new' ? 'ใหม่' : 'จัดการแล้ว'}</Pill>
                <span className="muted small">{fmtRelative(m.created_at)}</span>
              </button>
              {open === m.id ? (
                <>
                  <p style={{ whiteSpace: 'pre-wrap', color: 'var(--ink-2)' }}>{m.message}</p>
                  {m.handled_by_name ? <p className="muted small">จัดการโดย {m.handled_by_name} · {fmtDateTime(m.handled_at)}</p> : null}
                  <div className="row wrapr">
                    <Button size="sm" icon="mail" onClick={() => { window.location.href = `mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.topic}`)}`; }}>ตอบทางอีเมล</Button>
                    <Button size="sm" variant={m.status === 'new' ? 'primary' : 'default'} icon="check" onClick={() => update(m, m.status === 'new' ? 'done' : 'new')}>{m.status === 'new' ? 'จัดการแล้ว' : 'เปิดใหม่'}</Button>
                    {can('data.delete') ? <Button size="sm" variant="ghostDanger" icon="trash" onClick={() => remove(m)}>ลบ</Button> : null}
                  </div>
                </>
              ) : null}
            </section>
          ))}
          <Pager page={page.page} pageSize={page.pageSize} total={data.total} onChange={setPage} />
        </div>
      )}
    </>
  );
}
