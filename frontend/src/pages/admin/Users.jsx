import { useEffect, useState } from 'react';
import { api, query } from '../../lib/api.js';
import { ROLE_LABEL, roleOf, useAuth } from '../../lib/auth.jsx';
import { fmtDateTime, fmtRelative } from '../../lib/format.js';
import { useToast } from '../../lib/toast.jsx';
import { useAsync } from '../../lib/useAsync.js';
import {
  Button, ConfirmModal, Drawer, EmptyState, ErrorNotice, KeyValue, Modal, Notice, Pager, Pill, SearchBox, Segmented, Select,
  Skeleton, TextInput, Textarea, ToggleRow, UserAvatar,
} from '../../ui/index.js';
import { useDebounced, useListParams } from '../../lib/listParams.js';

const STATUS = { active: ['ใช้งาน', 'go'], suspended: ['ถูกระงับ', 'warn'], banned: ['แบน', 'red'] };
const ROLE_TONE = { member: 'gray', admin: 'blue', owner: 'orange' };

function SuspendForm({ user, options, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ kind: 'suspend', reason_code: 'spam', days: 7, message: '', note: '', force_logout: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async () => {
    setBusy(true);
    try {
      onDone(await api(`/admin/users/${user.id}/suspend`, { method: 'POST', body: form }));
      toast(`${form.kind === 'ban' ? 'แบน' : 'ระงับ'} ${user.display_name} แล้ว`);
    } catch (err) { setError(err); } finally { setBusy(false); }
  };
  return (
    <section className="card pad col" style={{ background: 'var(--raise)' }}>
      <h3>ระงับหรือแบน</h3>
      {error ? <Notice tone="red">{error.message}</Notice> : null}
      <Segmented label="ชนิด" value={form.kind} onChange={(kind) => setForm({ ...form, kind })} options={[{ value: 'suspend', label: 'ระงับชั่วคราว' }, { value: 'ban', label: 'แบนถาวร' }]} />
      <Select label="เหตุผล" value={form.reason_code} onChange={(e) => setForm({ ...form, reason_code: e.target.value })}
        options={Object.entries(options.reasons).map(([value, label]) => ({ value, label }))} />
      {form.kind === 'suspend' ? (
        <Segmented label="ระยะเวลา" value={form.days} onChange={(days) => setForm({ ...form, days })} options={options.days.map((d) => ({ value: d, label: `${d} วัน` }))} />
      ) : null}
      <Textarea label="ข้อความถึงผู้ใช้" hint="แสดงตอนผู้ใช้พยายามเข้าสู่ระบบ" maxLength={500} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
      <Textarea label="บันทึกภายใน" hint="ผู้ใช้ไม่เห็น" maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
      <ToggleRow title="บังคับออกจากระบบทุกเครื่อง" checked={form.force_logout} onChange={(force_logout) => setForm({ ...form, force_logout })} />
      <Button variant="danger" loading={busy} onClick={submit} style={{ alignSelf: 'flex-end' }}>{form.kind === 'ban' ? 'แบน' : 'ระงับ'}</Button>
    </section>
  );
}

function UserDrawer({ id, options, onClose, onChanged }) {
  const { user: me, can } = useAuth();
  const toast = useToast();
  const detail = useAsync((signal) => api(`/admin/users/${id}`, { signal }), id);
  const [dialog, setDialog] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const u = detail.data;
  const update = (next) => { detail.setData(next); onChanged(); };
  const act = async (fn, ok) => {
    setBusy(true);
    try { const out = await fn(); toast(ok); setDialog(null); setText(''); return out ?? true; } catch (err) { toast(err.message, 'err'); return null; } finally { setBusy(false); }
  };
  if (!u) return <Drawer title="ผู้ใช้" onClose={onClose}><ErrorNotice error={detail.error} /><Skeleton height={200} /></Drawer>;
  const self = u.id === me.id;
  const manageable = !self && (u.role === 'member' || can('users.admins'));
  const role = roleOf(u);
  const active = u.suspensions.find((s) => !s.lifted_at);

  return (
    <Drawer title={u.display_name} onClose={onClose}>
      <div className="row"><UserAvatar user={u} size={52} /><div className="sp"><strong>{u.email}</strong><div className="row wrapr" style={{ gap: 6, marginTop: 4 }}>
        <Pill tone={ROLE_TONE[role]}>{ROLE_LABEL[role]}</Pill><Pill tone={STATUS[u.status][1]}>{STATUS[u.status][0]}</Pill></div></div></div>
      <KeyValue label="สมัครเมื่อ">{fmtDateTime(u.created_at)}</KeyValue>
      <KeyValue label="ใช้งานล่าสุด">{fmtRelative(u.last_seen_at)}</KeyValue>
      {self ? <Notice tone="blue">นี่คือบัญชีของคุณ · จัดการตัวเองจากหน้านี้ไม่ได้</Notice> : null}
      {!self && !manageable ? <Notice tone="blue">ดูอย่างเดียว · ผู้ดูแลจัดการได้เฉพาะบัญชีสมาชิก</Notice> : null}
      {active ? (
        <Notice tone="warn" title={`${active.kind === 'ban' ? 'แบนถาวร' : `ระงับถึง ${fmtDateTime(active.until)}`}`}>
          <div>เหตุผล: {options.reasons[active.reason_code]} · โดย {active.created_by_name}</div>
          {active.message_to_user ? <div>ข้อความถึงผู้ใช้: {active.message_to_user}</div> : null}
          {active.internal_note ? <div>บันทึกภายใน: {active.internal_note}</div> : null}
        </Notice>
      ) : null}
      {manageable && can('users.edit') && u.status !== 'active' ? (
        <section className="card pad col" style={{ background: 'var(--raise)' }}>
          <h3>ยกเลิกการระงับ</h3>
          <TextInput label="เหตุผล (บังคับ)" value={text} onChange={(e) => setText(e.target.value)} />
          <Button variant="primary" loading={busy} disabled={!text.trim()} style={{ alignSelf: 'flex-end' }}
            onClick={async () => { const out = await act(() => api(`/admin/users/${u.id}/unsuspend`, { method: 'POST', body: { reason: text } }), 'ยกเลิกการระงับแล้ว'); if (out) update(out); }}>ยกเลิกการระงับ</Button>
        </section>
      ) : null}
      {manageable && can('users.edit') && u.status === 'active' ? <SuspendForm user={u} options={options} onDone={update} /> : null}
      {!self && can('users.role') ? (
        <section className="card pad col" style={{ background: 'var(--raise)' }}>
          <h3>บทบาท</h3>
          <Segmented label="บทบาท" value={role} onChange={async (next) => {
            const body = { role: next === 'member' ? 'member' : 'admin', is_owner: next === 'owner' };
            const out = await act(() => api(`/admin/users/${u.id}/role`, { method: 'POST', body }), `เปลี่ยนเป็น${ROLE_LABEL[next]}แล้ว`);
            if (out) update(out);
          }} options={['member', 'admin', 'owner'].map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
          <small className="muted">ต้องมีเจ้าของระบบอย่างน้อย 1 คนเสมอ</small>
        </section>
      ) : null}
      {manageable && can('users.edit') ? <Button variant="ghostDanger" icon="trash" onClick={() => setDialog('delete')}>ลบบัญชี</Button> : null}
      {u.suspensions.length ? (
        <section className="col"><h3>ประวัติการระงับ</h3>{u.suspensions.map((s) => (
          <div key={s.id} className="kv"><span>{s.kind === 'ban' ? 'แบน' : 'ระงับ'} · {options.reasons[s.reason_code]}<div className="small muted">{fmtDateTime(s.created_at)} โดย {s.created_by_name}</div></span>
            <span className="small muted">{s.lifted_at ? `ยกเลิก: ${s.lift_reason}` : 'มีผลอยู่'}</span></div>))}</section>
      ) : null}
      {dialog === 'delete' ? (
        <ConfirmModal title={`ลบบัญชี ${u.display_name}?`} danger confirmLabel="ลบบัญชี" busy={busy} onClose={() => setDialog(null)}
          onConfirm={async () => { if (await act(() => api(`/admin/users/${u.id}`, { method: 'DELETE', body: { confirm_name: text } }), 'ลบบัญชีแล้ว')) { onChanged(); onClose(); } }}>
          <p>พิมพ์ชื่อ <strong>{u.display_name}</strong> เพื่อยืนยัน · ภารกิจของผู้ใช้ยังอยู่ในระบบ</p>
          <TextInput label="ชื่อผู้ใช้" value={text} onChange={(e) => setText(e.target.value)} />
        </ConfirmModal>
      ) : null}
    </Drawer>
  );
}

function InviteModal({ onClose }) {
  const { can } = useAuth();
  const toast = useToast();
  const [role, setRole] = useState('member');
  const [invite, setInvite] = useState(null);
  const [busy, setBusy] = useState(false);
  const list = useAsync((signal) => api('/admin/invites', { signal }), invite?.code ?? 'list');
  const create = async () => {
    setBusy(true);
    try { setInvite(await api('/admin/invites', { method: 'POST', body: { role } })); } catch (err) { toast(err.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Modal title="เชิญผู้ใช้" onClose={onClose} actions={<Button onClick={onClose}>ปิด</Button>}>
      <p className="muted">สร้างรหัสเชิญ (ใช้ได้ครั้งเดียว ภายใน 7 วัน) แล้วส่งให้คนที่จะสมัคร</p>
      {can('users.role') ? <Segmented label="บทบาท" value={role} onChange={setRole} options={[{ value: 'member', label: 'สมาชิก' }, { value: 'admin', label: 'ผู้ดูแล' }]} /> : null}
      <Button variant="primary" icon="plus" loading={busy} onClick={create}>สร้างรหัสเชิญ</Button>
      {invite ? (
        <Notice tone="go" title="รหัสเชิญ" action={<Button size="sm" icon="copy" onClick={() => navigator.clipboard?.writeText(invite.code).then(() => toast('คัดลอกแล้ว'))}>คัดลอก</Button>}>
          <span className="M" style={{ fontSize: 22, letterSpacing: '0.1em' }}>{invite.code}</span>
        </Notice>
      ) : null}
      <h3>รหัสล่าสุด</h3>
      {(list.data?.items ?? []).slice(0, 6).map((i) => (
        <div key={i.code} className="kv"><span className="M">{i.code}</span><span className="small muted">{i.used_at ? `ใช้แล้วโดย ${i.used_by_name}` : new Date(i.expires_at) < new Date() ? 'หมดอายุ' : `ยังไม่ใช้ · ${ROLE_LABEL[i.role]}`}</span></div>
      ))}
    </Modal>
  );
}

export function Users() {
  const [p, update] = useListParams({ q: '', role: '', status: '', page: 1, page_size: 10 });
  const [search, setSearch] = useState(p.q);
  const q = useDebounced(search);
  useEffect(() => { if (q !== p.q) update({ q }); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const [version, setVersion] = useState(0);
  const list = useAsync((signal) => api(`/admin/users${query(p)}`, { signal }), JSON.stringify(p) + version);
  const options = useAsync((signal) => api('/admin/suspend-options', { signal }), 'opts');
  const [open, setOpen] = useState(null);
  const [inviting, setInviting] = useState(false);
  const { can } = useAuth();
  const data = list.data;
  return (
    <>
      <div className="page-head">
        <div className="sp"><h1>ผู้ใช้</h1><p className="sub">ค้นหา ระงับ เปลี่ยนบทบาท · ทุกการกระทำบันทึกใน Audit log</p></div>
        {can('users.edit') ? <Button variant="primary" icon="plus" onClick={() => setInviting(true)}>เชิญผู้ใช้</Button> : null}
      </div>
      <div className="toolbar">
        <SearchBox value={search} onChange={setSearch} placeholder="ค้นหาชื่อหรืออีเมล" />
        <Segmented label="บทบาท" value={p.role} onChange={(role) => update({ role })} options={[{ value: '', label: 'ทุกบทบาท' }, { value: 'member', label: 'สมาชิก' }, { value: 'admin', label: 'ผู้ดูแล' }, { value: 'owner', label: 'เจ้าของ' }]} />
        <Segmented label="สถานะ" value={p.status} onChange={(status) => update({ status })} options={[{ value: '', label: 'ทุกสถานะ' }, { value: 'active', label: 'ใช้งาน' }, { value: 'suspended', label: 'ระงับ' }, { value: 'banned', label: 'แบน' }]} />
      </div>
      <ErrorNotice error={list.error} onRetry={list.reload} />
      <section className="card">
        {!data ? <div className="col" style={{ padding: 16 }}>{[0, 1, 2].map((i) => <Skeleton key={i} height={44} />)}</div> : data.total === 0 ? (
          <EmptyState icon="users" title="ไม่พบผู้ใช้">ลองเปลี่ยนคำค้นหรือตัวกรอง</EmptyState>
        ) : (
          <div className="tscroll">
            <table className="t">
              <thead><tr><th>ผู้ใช้</th><th>บทบาท</th><th>สถานะ</th><th>ภารกิจ</th><th>ใช้งานล่าสุด</th></tr></thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id} className="clickable" onClick={() => setOpen(u.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(u.id)}>
                    <td><span className="row" style={{ gap: 10 }}><UserAvatar user={u} /><span><strong>{u.display_name}</strong><div className="small muted">{u.email}</div></span></span></td>
                    <td><Pill tone={ROLE_TONE[roleOf(u)]}>{ROLE_LABEL[roleOf(u)]}</Pill></td>
                    <td><Pill tone={STATUS[u.status][1]}>{STATUS[u.status][0]}</Pill></td>
                    <td className="M">{u.mission_count}</td>
                    <td className="muted">{fmtRelative(u.last_seen_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {data ? <Pager page={Number(p.page)} pageSize={Number(p.page_size)} total={data.total} onChange={({ page, pageSize }) => update({ page, page_size: pageSize }, false)} /> : null}
      {open && options.data ? <UserDrawer id={open} options={options.data} onClose={() => setOpen(null)} onChanged={() => setVersion((v) => v + 1)} /> : null}
      {inviting ? <InviteModal onClose={() => setInviting(false)} /> : null}
    </>
  );
}
