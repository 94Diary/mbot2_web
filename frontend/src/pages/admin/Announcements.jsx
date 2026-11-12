import { useState } from 'react';
import { api } from '../../lib/api.js';
import { fmtDateTime } from '../../lib/format.js';
import { useSite } from '../../lib/site.jsx';
import { useToast } from '../../lib/toast.jsx';
import { useAsync } from '../../lib/useAsync.js';
import {
  Banner, Button, ConfirmModal, EmptyState, ErrorNotice, Modal, Notice, Pill, Segmented, Skeleton, Textarea, TextInput, Toggle,
} from '../../ui/index.js';

const LEVELS = [{ value: 'info', label: 'ข้อมูล' }, { value: 'warn', label: 'เตือน' }, { value: 'red', label: 'ด่วน' }];
const AUDIENCE = [{ value: 'all', label: 'ทุกคน' }, { value: 'members', label: 'สมาชิก' }, { value: 'admins', label: 'ผู้ดูแล' }];
const toLocal = (iso) => (iso ? new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 16) : '');
const fromLocal = (v) => (v ? new Date(`${v}:00+07:00`).toISOString() : null);

function Editor({ item, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    text: item?.text ?? '', level: item?.level ?? 'info', audience: item?.audience ?? 'all',
    starts_at: toLocal(item?.starts_at), ends_at: toLocal(item?.ends_at), enabled: item?.enabled ?? true,
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const body = { ...form, starts_at: fromLocal(form.starts_at), ends_at: fromLocal(form.ends_at) };
    try {
      await api(item ? `/admin/announcements/${item.id}` : '/admin/announcements', { method: item ? 'PATCH' : 'POST', body });
      toast(item ? 'แก้ประกาศแล้ว' : 'สร้างประกาศแล้ว');
      onSaved();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };
  return (
    <Modal title={item ? 'แก้ประกาศ' : 'ประกาศใหม่'} onClose={onClose} actions={<><Button onClick={onClose}>ยกเลิก</Button><Button variant="primary" loading={busy} onClick={save}>บันทึก</Button></>}>
      {error && !error.fields ? <Notice tone="red">{error.message}</Notice> : null}
      <Textarea label="ข้อความ" maxLength={280} value={form.text} error={error?.fields?.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
      <div className="field"><span>ระดับ</span><Segmented label="ระดับ" value={form.level} onChange={(level) => setForm({ ...form, level })} options={LEVELS} /></div>
      <div className="field"><span>ใครเห็น</span><Segmented label="ใครเห็น" value={form.audience} onChange={(audience) => setForm({ ...form, audience })} options={AUDIENCE} /></div>
      <div className="grid g2">
        <TextInput label="เริ่ม (ไม่บังคับ)" type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
        <TextInput label="สิ้นสุด (ไม่บังคับ)" type="datetime-local" value={form.ends_at} error={error?.fields?.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
      </div>
      <div className="k">ตัวอย่าง</div>
      {form.text ? <Banner tone={form.level === 'red' ? 'red' : form.level}>{form.text}</Banner> : <p className="muted small">พิมพ์ข้อความเพื่อดูตัวอย่าง</p>}
    </Modal>
  );
}

export function Announcements() {
  const { refresh } = useSite();
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const list = useAsync((signal) => api('/admin/announcements', { signal }), version);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const changed = () => { setVersion((v) => v + 1); refresh(); setEditing(null); setRemoving(null); };
  const toggle = async (item) => {
    try { await api(`/admin/announcements/${item.id}`, { method: 'PATCH', body: { enabled: !item.enabled } }); changed(); } catch (err) { toast(err.message, 'err'); }
  };
  const items = list.data?.items;
  return (
    <>
      <div className="page-head">
        <div className="sp"><h1>ประกาศ</h1><p className="sub">แถบประกาศบนสุดของเว็บ · เลือกกลุ่มผู้เห็นและช่วงเวลาได้</p></div>
        <Button variant="primary" icon="plus" onClick={() => setEditing('new')}>ประกาศใหม่</Button>
      </div>
      <ErrorNotice error={list.error} onRetry={list.reload} />
      {!items ? <Skeleton height={160} /> : !items.length ? (
        <div className="card"><EmptyState icon="mega" title="ยังไม่มีประกาศ" action={<Button variant="primary" onClick={() => setEditing('new')}>สร้างประกาศแรก</Button>}>ใช้แจ้งปิดปรับปรุง กิจกรรม หรือเรื่องด่วน</EmptyState></div>
      ) : items.map((a) => (
        <section key={a.id} className="card pad col" style={{ opacity: a.enabled ? 1 : 0.6 }}>
          <Banner tone={a.level === 'red' ? 'red' : a.level}>{a.text}</Banner>
          <div className="row wrapr">
            <Pill tone="gray">{AUDIENCE.find((x) => x.value === a.audience).label}</Pill>
            <span className="muted small sp">{a.starts_at || a.ends_at ? `${a.starts_at ? fmtDateTime(a.starts_at) : 'ตอนนี้'} – ${a.ends_at ? fmtDateTime(a.ends_at) : 'ไม่กำหนด'}` : 'แสดงตลอดเมื่อเปิด'}</span>
            <span className="row" style={{ gap: 8 }}><span className="small">{a.enabled ? 'เปิด' : 'ปิด'}</span><Toggle checked={a.enabled} label="เปิดประกาศ" onChange={() => toggle(a)} /></span>
            <Button size="sm" icon="edit" onClick={() => setEditing(a)}>แก้</Button>
            <Button size="sm" variant="ghostDanger" icon="trash" onClick={() => setRemoving(a)}>ลบ</Button>
          </div>
        </section>
      ))}
      {editing ? <Editor item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={changed} /> : null}
      {removing ? (
        <ConfirmModal title="ลบประกาศนี้?" danger confirmLabel="ลบ" onClose={() => setRemoving(null)}
          onConfirm={async () => { try { await api(`/admin/announcements/${removing.id}`, { method: 'DELETE' }); toast('ลบประกาศแล้ว'); changed(); } catch (err) { toast(err.message, 'err'); } }}>
          <p>“{removing.text}”</p>
        </ConfirmModal>
      ) : null}
    </>
  );
}
