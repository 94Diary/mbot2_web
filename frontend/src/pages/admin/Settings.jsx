import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useSite } from '../../lib/site.jsx';
import { useToast } from '../../lib/toast.jsx';
import { useAsync } from '../../lib/useAsync.js';
import { Button, ConfirmModal, ErrorNotice, Notice, Segmented, Skeleton, TextInput, Textarea, ToggleRow } from '../../ui/index.js';

const TABS = [
  ['general', 'ทั่วไป', ['title', 'tagline', 'registration']],
  ['seo', 'SEO', ['description', 'noindex']],
  ['contact', 'ติดต่อ', ['contact_email', 'contact_line', 'contact_phone', 'contact_github']],
  ['privacy', 'ความเป็นส่วนตัว', ['log_retention_days', 'consent_retention_days']],
];

export function Settings() {
  const toast = useToast();
  const { refresh } = useSite();
  const s = useAsync((signal) => api('/admin/settings', { signal }), 'settings');
  const [form, setForm] = useState(null);
  const [tab, setTab] = useState('general');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmMaint, setConfirmMaint] = useState(false);
  useEffect(() => { if (s.data) setForm(s.data); }, [s.data]);

  const save = async (patch) => {
    setBusy(true);
    setError(null);
    try {
      const next = await api('/admin/settings', { method: 'PATCH', body: patch });
      s.setData(next);
      setForm(next);
      refresh();
      toast('บันทึกการตั้งค่าแล้ว');
    } catch (err) { setError(err); } finally { setBusy(false); setConfirmMaint(false); }
  };
  if (!form) return <><ErrorNotice error={s.error} onRetry={s.reload} /><Skeleton height={320} /></>;
  const keys = TABS.find(([k]) => k === tab)[2];
  const dirtyKeys = keys.filter((k) => form[k] !== s.data[k]);
  const f = error?.fields ?? {};
  const set = (key, value) => setForm({ ...form, [key]: value });
  const num = (key) => (e) => set(key, e.target.value === '' ? '' : Number(e.target.value));

  return (
    <>
      <div className="page-head"><div className="sp"><h1>ตั้งค่าเว็บ</h1><p className="sub">ทุกการเปลี่ยนบันทึกใน Audit log พร้อมค่าก่อน/หลัง</p></div></div>
      <div className="tabs" role="tablist">
        {TABS.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => { setTab(key); setError(null); }}>{label}</button>)}
      </div>
      {error && !error.fields ? <Notice tone="red">{error.message}</Notice> : null}
      <section className="card pad col" style={{ gap: 16 }}>
        {tab === 'general' ? (
          <>
            <TextInput label="ชื่อเว็บ" maxLength={60} value={form.title} error={f.title} onChange={(e) => set('title', e.target.value)} />
            <TextInput label="คำโปรย" maxLength={140} value={form.tagline} hint="แสดงในหน้าแรก" onChange={(e) => set('tagline', e.target.value)} />
            <div className="field"><span>การสมัครสมาชิก</span>
              <Segmented label="การสมัครสมาชิก" value={form.registration} onChange={(v) => set('registration', v)}
                options={[{ value: 'open', label: 'เปิด' }, { value: 'invite', label: 'ต้องมีรหัสเชิญ' }, { value: 'closed', label: 'ปิดรับ' }]} /></div>
            <p className="muted small">ภาษา: ไทย · เขตเวลา: Asia/Bangkok (UTC+7)</p>
          </>
        ) : null}
        {tab === 'seo' ? (
          <>
            <Textarea label="คำอธิบายเว็บ (meta description)" maxLength={200} value={form.description} error={f.description} hint={`${form.description.length}/200`} onChange={(e) => set('description', e.target.value)} />
            <ToggleRow title="ซ่อนจากเครื่องมือค้นหา (noindex)" description="เปิดไว้ระหว่างที่เว็บยังใช้ภายในทีม" checked={form.noindex} onChange={(v) => set('noindex', v)} />
            <div className="k">ตัวอย่างในผลค้นหา</div>
            <div className="card pad" style={{ background: 'var(--bg)' }}>
              <div style={{ color: 'var(--blue-ink)', fontSize: 17 }}>{form.title}</div>
              <div className="M small" style={{ color: 'var(--go)' }}>http://127.0.0.1:5173/</div>
              <div className="muted small">{form.description || 'ยังไม่มีคำอธิบาย'}</div>
              {form.noindex ? <Notice tone="warn">ตั้งเป็น noindex: เครื่องมือค้นหาจะไม่แสดงเว็บนี้</Notice> : null}
            </div>
          </>
        ) : null}
        {tab === 'contact' ? (
          <>
            <p className="muted">แสดงในหน้าติดต่อ เว้นว่างช่องที่ไม่ใช้</p>
            <TextInput label="อีเมลทีม" type="email" value={form.contact_email} error={f.contact_email} onChange={(e) => set('contact_email', e.target.value)} />
            <TextInput label="LINE" value={form.contact_line} maxLength={60} onChange={(e) => set('contact_line', e.target.value)} />
            <TextInput label="โทรศัพท์" value={form.contact_phone} maxLength={30} onChange={(e) => set('contact_phone', e.target.value)} />
            <TextInput label="GitHub" value={form.contact_github} maxLength={120} hint="เช่น 94Diary/mBot2" onChange={(e) => set('contact_github', e.target.value)} />
          </>
        ) : null}
        {tab === 'privacy' ? (
          <>
            <TextInput label="ระยะเก็บ log การใช้งาน (วัน)" type="number" min={30} max={3650} value={form.log_retention_days} error={f.log_retention_days} hint="30–3650 วัน · Audit log ควรเก็บอย่างน้อย 365 วัน" onChange={num('log_retention_days')} />
            <TextInput label="ระยะเก็บบันทึกความยินยอมคุกกี้ (วัน)" type="number" min={30} max={3650} value={form.consent_retention_days} error={f.consent_retention_days} hint="PDPA: อย่างน้อย 12 เดือน" onChange={num('consent_retention_days')} />
          </>
        ) : null}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button disabled={!dirtyKeys.length} onClick={() => setForm(s.data)}>ยกเลิก</Button>
          <Button variant="primary" loading={busy} disabled={!dirtyKeys.length} onClick={() => save(Object.fromEntries(dirtyKeys.map((k) => [k, form[k]])))}>บันทึก</Button>
        </div>
      </section>
      <section className="card pad col">
        <h2>โหมดปิดปรับปรุง</h2>
        <ToggleRow title="ปิดเว็บชั่วคราว" description="ผู้ใช้ทั่วไปเห็นหน้าปิดปรับปรุงและใช้คอนโซลไม่ได้ ผู้ดูแลยังเข้าได้ปกติ (เห็นแถบแดงด้านบน)"
          checked={s.data.maintenance} onChange={(on) => (on ? setConfirmMaint(true) : save({ maintenance: false }))} />
      </section>
      {confirmMaint ? (
        <ConfirmModal title="เปิดโหมดปิดปรับปรุง?" danger confirmLabel="ปิดเว็บชั่วคราว" busy={busy} onConfirm={() => save({ maintenance: true })} onClose={() => setConfirmMaint(false)}>
          <p>สมาชิกที่กำลังใช้คอนโซลจะถูกตัดการเชื่อมต่อจนกว่าจะปิดโหมดนี้</p>
        </ConfirmModal>
      ) : null}
    </>
  );
}
