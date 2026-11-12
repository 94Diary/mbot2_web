import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Markdown } from '../../features/content/Markdown.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { fmtDateTime, fmtRelative } from '../../lib/format.js';
import { useSite } from '../../lib/site.jsx';
import { useToast } from '../../lib/toast.jsx';
import { useAsync } from '../../lib/useAsync.js';
import {
  Button, ConfirmModal, EmptyState, ErrorNotice, Notice, Pill, Segmented, Select, Skeleton, TextInput,
} from '../../ui/index.js';

const STATUS = { published: ['เผยแพร่', 'go'], draft: ['ร่าง', 'warn'] };

export function AdminLessons() {
  const { can } = useAuth();
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const [version, setVersion] = useState(0);
  const trash = filter === 'trash';
  const list = useAsync((signal) => api(`/admin/lessons${trash ? '?trash=1' : filter !== 'all' ? `?status=${filter}` : ''}`, { signal }), `${filter}${version}`);
  const [removing, setRemoving] = useState(null);
  const data = list.data;
  const act = async (fn, ok) => {
    try { await fn(); toast(ok); setVersion((v) => v + 1); } catch (err) { toast(err.message, 'err'); }
  };
  return (
    <>
      <div className="page-head">
        <div className="sp"><h1>บทเรียน</h1><p className="sub">{data ? `${data.counts.published} เผยแพร่ · ${data.counts.draft} ร่าง · ${data.counts.trash} ในถังขยะ` : 'กำลังโหลด…'}</p></div>
        <Button variant="primary" icon="plus" to="/admin/lessons/new">บทเรียนใหม่</Button>
      </div>
      <Segmented label="กรองสถานะ" value={filter} onChange={setFilter} options={[
        { value: 'all', label: 'ทั้งหมด' }, { value: 'published', label: 'เผยแพร่' }, { value: 'draft', label: 'ร่าง' }, { value: 'trash', label: 'ถังขยะ' },
      ]} />
      {trash ? <Notice tone="blue">บทเรียนในถังขยะเกิน 30 วันจะถูกลบถาวร กู้คืนได้ก่อนหน้านั้น</Notice> : null}
      <ErrorNotice error={list.error} onRetry={list.reload} />
      <section className="card tscroll">
        {!data ? <div style={{ padding: 16 }}><Skeleton height={220} /></div> : !data.items.length ? (
          <EmptyState icon="doc" title={trash ? 'ถังขยะว่าง' : 'ยังไม่มีบทเรียน'} action={!trash ? <Button variant="primary" to="/admin/lessons/new">เขียนบทแรก</Button> : null}>
            {trash ? '' : 'เขียนบทแรกเพื่อพาคนใหม่ตั้งเครื่องจนหุ่นวิ่ง'}
          </EmptyState>
        ) : (
          <table className="t">
            <thead><tr><th>#</th><th>ชื่อบทเรียน</th><th>สถานะ</th><th>ใครเห็น</th><th>อัปเดต</th><th /></tr></thead>
            <tbody>
              {data.items.map((l) => (
                <tr key={l.id}>
                  <td className="M">{l.ord}</td>
                  <td><strong>{l.title}</strong><div className="muted small">{l.summary}</div><div className="M small muted">/lessons/{l.slug}</div></td>
                  <td><Pill tone={STATUS[l.status][1]}>{STATUS[l.status][0]}</Pill></td>
                  <td className="small">{l.audience === 'members' ? 'สมาชิก' : 'ทุกคน'}</td>
                  <td className="muted small">{l.author_name ?? '—'}<div>{fmtRelative(l.updated_at)}</div></td>
                  <td>
                    <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      {trash ? (
                        can('content.delete') ? <Button size="sm" icon="refresh" onClick={() => act(() => api(`/admin/lessons/${l.id}/restore`, { method: 'POST' }), 'กู้คืนบทเรียนแล้ว')}>กู้คืน</Button> : null
                      ) : (
                        <>
                          <Button size="sm" iconOnly icon="eye" label="ดูหน้าจริง" to={`/lessons/${l.slug}`} />
                          <Button size="sm" iconOnly icon="edit" label="แก้ไข" to={`/admin/lessons/${l.id}`} />
                          {can('content.delete') ? <Button size="sm" iconOnly icon="trash" variant="ghostDanger" label="ย้ายไปถังขยะ" onClick={() => setRemoving(l)} /> : null}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {removing ? (
        <ConfirmModal title={`ย้าย “${removing.title}” ไปถังขยะ?`} danger confirmLabel="ย้ายไปถังขยะ" onClose={() => setRemoving(null)}
          onConfirm={async () => { await act(() => api(`/admin/lessons/${removing.id}`, { method: 'DELETE' }), 'ย้ายไปถังขยะแล้ว · กู้คืนได้ภายใน 30 วัน'); setRemoving(null); }}>
          <p>ผู้อ่านจะไม่เห็นบทนี้ทันที กู้คืนได้จากแท็บถังขยะภายใน 30 วัน</p>
        </ConfirmModal>
      ) : null}
    </>
  );
}

const TOOLS = [
  ['H', 'หัวข้อ', (sel) => `\n## ${sel || 'หัวข้อ'}\n`],
  ['B', 'ตัวหนา', (sel) => `**${sel || 'ข้อความ'}**`],
  ['I', 'ตัวเอียง', (sel) => `*${sel || 'ข้อความ'}*`],
  ['“ ”', 'กล่องเน้น', (sel) => `\n> ${sel || 'ข้อความเน้น'}\n`],
  ['</>', 'โค้ด', (sel) => (sel.includes('\n') || !sel ? `\n\`\`\`bash\n${sel || 'คำสั่ง'}\n\`\`\`\n` : `\`${sel}\``)],
  ['•', 'รายการ', (sel) => `\n- ${sel || 'รายการ'}\n`],
  ['ลิงก์', 'ลิงก์', (sel) => `[${sel || 'ข้อความ'}](https://)`],
  ['รูป', 'รูป', (sel) => `![${sel || 'คำอธิบายรูป'}](/models/mbot2-front34.png)`],
];
const slugify = (t) => t.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const AUTOSAVE_MS = 4000;

export function LessonEdit() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const toast = useToast();
  const { site } = useSite();
  const existing = useAsync((signal) => (isNew ? Promise.resolve(null) : api(`/admin/lessons/${id}`, { signal })), id);
  const [form, setForm] = useState(isNew ? { title: '', summary: '', body: '', slug: '', status: 'draft', audience: 'all', ord: '' } : null);
  const [savedAt, setSavedAt] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('write');
  const area = useRef(null);
  const slugTouched = useRef(!isNew);

  useEffect(() => {
    if (existing.data) { setForm({ ...existing.data }); setSavedAt(existing.data.updated_at); }
  }, [existing.data]);

  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setDirty(true); };
  const payload = (f, status) => ({
    title: f.title, summary: f.summary, body: f.body, slug: f.slug, audience: f.audience, status: status ?? f.status,
    ...(f.ord !== '' && f.ord !== undefined ? { ord: Number(f.ord) } : {}),
  });

  const save = useCallback(async (status, { auto = false } = {}) => {
    if (!form) return null;
    if (!auto) setBusy(true);
    setError(null);
    try {
      const out = isNew
        ? await api('/admin/lessons', { method: 'POST', body: payload(form, status ?? 'draft') })
        : await api(`/admin/lessons/${id}`, { method: 'PATCH', body: { ...payload(form, status), ...(auto ? { autosave: true } : {}) } });
      setForm((f) => ({ ...f, ...out, body: f.body }));
      setSavedAt(out.updated_at);
      setDirty(false);
      if (!auto) toast(status === 'published' ? 'เผยแพร่แล้ว' : 'บันทึกร่างแล้ว');
      if (isNew) navigate(`/admin/lessons/${out.id}`, { replace: true });
      return out;
    } catch (err) {
      if (!auto) setError(err);
      return null;
    } finally {
      if (!auto) setBusy(false);
    }
  }, [form, id, isNew, navigate, toast]);

  // บันทึกร่างอัตโนมัติ (เฉพาะบทที่มีอยู่แล้ว และยังเป็นร่าง หรือแค่แก้เนื้อหา)
  useEffect(() => {
    if (isNew || !dirty || !form?.title) return undefined;
    const timer = setTimeout(() => save(undefined, { auto: true }), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [form, dirty, isNew, save]);

  useEffect(() => {
    const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const insert = (make) => {
    const el = area.current;
    if (!el) return;
    const [a, b] = [el.selectionStart, el.selectionEnd];
    const text = make(form.body.slice(a, b));
    const body = form.body.slice(0, a) + text + form.body.slice(b);
    set({ body });
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = a + text.length; });
  };

  if (existing.error) return <ErrorNotice error={existing.error} onRetry={existing.reload} />;
  if (!form) return <Skeleton height={420} />;
  const f = error?.fields ?? {};
  return (
    <>
      <div className="page-head">
        <div className="sp">
          <Link to="/admin/lessons" className="small">← บทเรียนทั้งหมด</Link>
          <h1>{isNew ? 'บทเรียนใหม่' : `แก้บทเรียนบทที่ ${form.ord}`}</h1>
          <p className="sub">{dirty ? '● มีการแก้ที่ยังไม่บันทึก' : savedAt ? `บันทึกล่าสุด ${fmtDateTime(savedAt)}` : 'ยังไม่ได้บันทึก'}</p>
        </div>
        <div className="row wrapr">
          {!isNew ? <Button size="sm" icon="eye" to={`/lessons/${form.slug}`}>ดูหน้าจริง</Button> : null}
          <Button size="sm" loading={busy} onClick={() => save('draft')}>{form.status === 'published' && !isNew ? 'เปลี่ยนเป็นร่าง' : 'บันทึกร่าง'}</Button>
          <Button size="sm" variant="primary" loading={busy} onClick={() => save('published')}>{form.status === 'published' && !isNew ? 'บันทึกและเผยแพร่' : 'เผยแพร่'}</Button>
        </div>
      </div>
      {error && !error.fields ? <Notice tone="red">{error.message}</Notice> : null}
      {error?.fields ? <Notice tone="red">แก้ช่องที่มีกรอบแดงก่อนบันทึก</Notice> : null}
      <div className="grid stack-m" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', alignItems: 'start' }}>
        <div className="card pad col">
          <TextInput label="ชื่อบทเรียน" value={form.title} error={f.title} maxLength={120}
            onChange={(e) => set({ title: e.target.value, ...(slugTouched.current ? {} : { slug: slugify(e.target.value) || form.slug }) })} />
          <TextInput label="สรุปสั้นๆ" value={form.summary} error={f.summary} maxLength={80}
            hint={`แสดงบนการ์ดบทเรียนและผลค้นหา (${form.summary.length}/80)`} onChange={(e) => set({ summary: e.target.value })} />
          <div className="field">
            <div className="row"><span className="sp">เนื้อหา (markdown)</span>
              <div className="tabs" role="tablist" style={{ border: 'none' }}>
                <button type="button" role="tab" aria-selected={tab === 'write'} onClick={() => setTab('write')}>เขียน</button>
                <button type="button" role="tab" aria-selected={tab === 'preview'} onClick={() => setTab('preview')}>ตัวอย่าง</button>
              </div>
            </div>
            {tab === 'write' ? (
              <>
                <div className="mdtools" role="toolbar" aria-label="จัดรูปแบบ">
                  {TOOLS.map(([label, title, make]) => <button key={title} type="button" className="btn sm" title={title} style={{ minHeight: 30, padding: '0 10px' }} onClick={() => insert(make)}>{label}</button>)}
                </div>
                <textarea ref={area} className={`in ${f.body ? 'bad' : ''}`} value={form.body} onChange={(e) => set({ body: e.target.value })} aria-label="เนื้อหาบทเรียน" />
              </>
            ) : <div className="card pad" style={{ minHeight: 360, background: 'var(--bg)' }}><Markdown source={form.body} /></div>}
          </div>
        </div>
        <div className="col">
          <div className="card pad col">
            <div className="k">การเผยแพร่</div>
            <div className="row"><span className="sp">สถานะ</span><Pill tone={STATUS[form.status][1]}>{STATUS[form.status][0]}</Pill></div>
            <TextInput label="ลำดับบท" type="number" min={1} max={999} value={form.ord} error={f.ord} hint={isNew ? 'เว้นว่าง = ต่อท้าย' : undefined} onChange={(e) => set({ ord: e.target.value })} />
            <Select label="ใครเห็น" value={form.audience} onChange={(e) => set({ audience: e.target.value })}
              options={[{ value: 'all', label: 'ทุกคน' }, { value: 'members', label: 'สมาชิกเท่านั้น' }]} />
          </div>
          <div className="card pad col">
            <div className="k">SEO ของหน้านี้</div>
            <TextInput label="Slug" value={form.slug} error={f.slug} className="M" hint="a-z 0-9 และขีด -"
              onChange={(e) => { slugTouched.current = true; set({ slug: e.target.value.toLowerCase() }); }} />
            <small className="muted">ตัวอย่างในผลค้นหา:</small>
            <div style={{ fontSize: 13.5 }}>
              <div style={{ color: 'var(--blue-ink)' }}>{form.title || 'ชื่อบทเรียน'} · {site.title}</div>
              <div className="M small" style={{ color: 'var(--go)' }}>/lessons/{form.slug || 'slug'}</div>
              <div className="muted">{form.summary || 'สรุปสั้นๆ'}</div>
            </div>
          </div>
          {!isNew ? <p className="muted small">บันทึกร่างอัตโนมัติทุก {AUTOSAVE_MS / 1000} วินาทีหลังหยุดพิมพ์ · ปุ่ม “เผยแพร่” จึงจะบันทึกลง Audit log</p> : null}
        </div>
      </div>
    </>
  );
}
