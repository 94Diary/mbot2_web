import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Markdown, renderInline } from '../../features/content/Markdown.jsx';
import { CATEGORIES, blocksToMarkdown, categoryOf, splitLesson } from '../../features/content/lessonModel.js';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useToast } from '../../lib/toast.jsx';
import { useAsync } from '../../lib/useAsync.js';
import { Button, EmptyState, ErrorNotice, Gate, Skeleton } from '../../ui/index.js';

const Check = ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>;

/** /lessons → บทถัดไปที่ยังไม่จบ (ดีไซน์ไม่มีหน้ารายการแยก รายการอยู่ในแถบซ้ายของหน้าอ่าน) */
export function LessonsIndex() {
  const { user } = useAuth();
  const list = useAsync((signal) => api('/lessons', { signal }), user?.id ?? 'guest');
  if (list.error) return <main className="cmain"><ErrorNotice error={list.error} onRetry={list.reload} /></main>;
  if (!list.data) return <main className="cmain"><Skeleton height={400} /></main>;
  const done = new Set(list.data.completed);
  const items = list.data.items.filter((l) => l.status === 'published');
  if (!items.length) return <main className="cmain"><div className="zone"><EmptyState icon="doc" title="ยังไม่มีบทเรียน">ทีมยังไม่ได้เผยแพร่บทเรียน</EmptyState></div></main>;
  const next = items.find((l) => !done.has(l.id)) ?? items[0];
  return <Navigate to={`/lessons/${next.slug}`} replace />;
}

function useStepChecks(slug, count) {
  const key = `mbot2.lesson.${slug}`;
  const read = () => {
    try { return new Set(JSON.parse(localStorage.getItem(key)) ?? []); } catch { return new Set(); }
  };
  const [checked, setChecked] = useState(read);
  useEffect(() => { setChecked(read()); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (i) => setChecked((prev) => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    try { localStorage.setItem(key, JSON.stringify([...next].filter((n) => n < count))); } catch { /* storage blocked */ }
    return next;
  });
  return [checked, toggle];
}

function CodeBox({ code }) {
  const toast = useToast();
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--robot-3)' }}>
      <pre style={{ margin: 0, flex: 1, padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: 13.5, overflowX: 'auto', color: 'var(--ink)' }}><code>{code}</code></pre>
      <button type="button" onClick={() => navigator.clipboard?.writeText(code).then(() => toast('คัดลอกคำสั่งแล้ว'))}
        style={{ border: 'none', borderLeft: '1px solid var(--line)', background: 'var(--robot-2)', color: 'var(--ink-3)', padding: '0 14px', font: 'inherit', fontSize: 13, cursor: 'pointer' }}>คัดลอก</button>
    </div>
  );
}

function Step({ index, step, done, onToggle }) {
  const text = step.blocks.filter((b) => b.type !== 'code');
  const codes = step.blocks.filter((b) => b.type === 'code');
  return (
    <li style={{ display: 'flex', gap: 18, padding: '22px 0', borderTop: index ? '1px solid var(--line-2)' : 'none' }}>
      <button type="button" onClick={onToggle} aria-pressed={done} aria-label={`${done ? 'ยกเลิกติ๊ก' : 'ติ๊กว่าทำเสร็จ'} ขั้นที่ ${index + 1}`}
        style={{ width: 44, height: 44, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer', font: 'inherit', fontWeight: 700, fontSize: 16, border: done ? 'none' : '2px solid var(--orange)', background: done ? 'var(--go)' : 'transparent', color: done ? '#07080A' : 'var(--orange-ink)' }}>
        {done ? <Check size={18} /> : index + 1}
      </button>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10, opacity: done ? 0.75 : 1 }}>
        <h2 style={{ fontSize: 21 }}>{step.title}</h2>
        {text.length ? <Markdown source={blocksToMarkdown(text)} className="prose" /> : null}
        {codes.map((c, i) => <CodeBox key={i} code={c.text} />)}
      </div>
    </li>
  );
}

function TroubleList({ blocks }) {
  // รายการรูปแบบ “**อาการ** วิธีแก้” หรือ “`อาการ` วิธีแก้”
  const items = blocks.flatMap((b) => (b.type === 'list' ? b.items : b.type === 'p' ? [b.text] : []));
  return (
    <div className="col" style={{ gap: 12 }}>
      {items.map((it, i) => {
        const m = it.match(/^(\*\*[^*]+\*\*|`[^`]+`)\s*[:—-]?\s*(.*)$/);
        return (
          <div key={i}>
            {m ? <div style={{ color: 'var(--warn)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>{m[1].replace(/[*`]/g, '')}</div> : null}
            <div style={{ fontSize: 14.5, color: 'var(--ink-2)' }}>{renderInline(m ? m[2] : it, `t${i}`)}</div>
          </div>
        );
      })}
    </div>
  );
}

export function Lesson() {
  const { slug } = useParams();
  const { user, can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const list = useAsync((signal) => api('/lessons', { signal }), user?.id ?? 'guest');
  const lesson = useAsync((signal) => api(`/lessons/${slug}`, { signal }), `${slug}:${user?.id ?? ''}`);
  const [busy, setBusy] = useState(false);
  const l = lesson.data;
  const parts = useMemo(() => (l ? splitLesson(l.body) : null), [l]);
  const [checked, toggle] = useStepChecks(slug, parts?.steps.length ?? 0);
  // เปลี่ยนบท = เปลี่ยนแค่เนื้อหา (ข้อมูลบทเดิมค้างไว้จนบทใหม่มา) แล้วเลื่อนกลับขึ้นบนแบบไม่มีแอนิเมชัน
  useEffect(() => { if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'instant' }); }, [slug]);

  if (lesson.error?.status === 404) {
    return <main className="cmain"><Gate icon="doc" title="ไม่พบบทเรียนนี้" action={<Button to="/lessons">บทเรียนทั้งหมด</Button>}>บทเรียนอาจถูกย้ายหรือยังไม่เผยแพร่</Gate></main>;
  }
  if (lesson.error?.status === 401) {
    return <main className="cmain"><Gate icon="lock" title="บทเรียนนี้สำหรับสมาชิก" action={<Button variant="primary" onClick={() => navigate('/login', { state: { from: `/lessons/${slug}` } })}>เข้าสู่ระบบ</Button>}>เข้าสู่ระบบเพื่ออ่านบทเรียนนี้</Gate></main>;
  }

  const items = list.data?.items ?? [];
  const published = items.filter((x) => x.status === 'published');
  const done = new Set(list.data?.completed ?? []);
  const doneCount = published.filter((x) => done.has(x.id)).length;
  const completed = l ? done.has(l.id) || l.completed : false;
  const stepsDone = parts ? parts.steps.filter((_, i) => checked.has(i)).length : 0;

  const toggleDone = async () => {
    setBusy(true);
    try {
      await api(`/lessons/${l.id}/progress`, { method: completed ? 'DELETE' : 'POST' });
      lesson.setData({ ...l, completed: !completed });
      list.reload();
      toast(completed ? 'ยกเลิกสถานะเรียนจบแล้ว' : 'บันทึกว่าเรียนจบบทนี้แล้ว');
    } catch (error) { toast(error.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <div style={{ width: '100%', maxWidth: 1440, margin: '0 auto', padding: '18px 24px 40px', boxSizing: 'border-box' }}>
      <div className="row wrapr" style={{ gap: '12px 32px', marginBottom: 18 }}>
        <div><div className="small muted">หมวด{l ? categoryOf(l.ord) : ''}</div><div className="H" style={{ fontSize: 22 }}>บทที่ {l?.ord ?? '–'} จาก {published.length || '–'}</div></div>
        <div style={{ flex: '0 1 420px', minWidth: 200 }}>
          <div className="row small muted" style={{ justifyContent: 'space-between' }}><span>ความคืบหน้าทั้งคอร์ส</span><span className="M">{doneCount} / {published.length} บท</span></div>
          <div className="progressbar" style={{ marginTop: 6 }}><div className="bar-in" style={{ width: `${published.length ? (doneCount / published.length) * 100 : 0}%` }} /></div>
        </div>
        {parts?.steps.length ? <div className="small muted">ขั้นในบทนี้ <strong style={{ color: 'var(--ink)' }}>{stepsDone} / {parts.steps.length}</strong></div> : null}
        {!user ? <span className="small muted">ผู้เยี่ยมชม · <Link to="/login">เข้าสู่ระบบ</Link> เพื่อเก็บความคืบหน้า</span> : null}
      </div>
      <div className="lessongrid">
        <nav aria-label="บทเรียนทั้งหมด" className="zone" style={{ padding: '14px 10px', alignSelf: 'start', position: 'sticky', top: 84 }}>
          {CATEGORIES.map(([cat]) => {
            const inCat = items.filter((x) => categoryOf(x.ord) === cat);
            if (!inCat.length) return null;
            return (
              <div key={cat} style={{ marginBottom: 6 }}>
                <div className="small muted" style={{ padding: '8px 10px 4px' }}>{cat}</div>
                {inCat.map((x) => {
                  const active = x.slug === slug;
                  const isDone = done.has(x.id);
                  return (
                    <Link key={x.id} to={`/lessons/${x.slug}`} aria-current={active ? 'page' : undefined}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, textDecoration: 'none', fontSize: 14.5, color: active ? '#14161A' : 'var(--ink-2)', background: active ? 'var(--orange)' : 'transparent', fontWeight: active ? 600 : 400, boxShadow: active ? 'inset 0 -3px 0 rgba(0,0,0,.18)' : 'none' }}>
                      <span style={{ width: 22, height: 22, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', fontSize: 11.5, fontWeight: 700,
                        background: isDone ? 'var(--go)' : active ? '#14161A' : 'transparent', color: isDone ? '#07080A' : active ? 'var(--orange)' : 'var(--ink-3)', border: isDone || active ? 'none' : '1.5px solid var(--line-strong)' }}>
                        {isDone ? <Check size={12} /> : x.ord}
                      </span>
                      <span className="sp">{x.title}</span>
                      {x.status === 'draft' ? <span className="pill warn" style={{ fontSize: 11 }}>ร่าง</span> : null}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <article className="zone" style={{ minWidth: 0 }}>
          {!l || !parts ? <div style={{ padding: 24 }}><ErrorNotice error={lesson.error} onRetry={lesson.reload} /><Skeleton height={36} width="70%" /><Skeleton height={300} style={{ marginTop: 12 }} /></div> : (
            <>
              <header style={{ padding: '24px 26px', borderBottom: '1px solid var(--line-2)' }}>
                <h1 style={{ fontSize: 'clamp(28px, 3cqi, 36px)' }}>{l.title}</h1>
                <p style={{ marginTop: 6, color: 'var(--ink-2)', fontSize: 16 }}>{l.summary}</p>
                {can('content.edit') ? <Link to={`/admin/lessons/${l.id}`} className="small" style={{ display: 'inline-block', marginTop: 8 }}>แก้บทเรียนนี้</Link> : null}
              </header>
              <div style={{ padding: '18px 26px 8px' }}>
                {parts.notice ? <div style={{ padding: '12px 16px', borderRadius: 14, background: 'var(--orange-soft)', border: '1px solid var(--orange-line)', color: 'var(--orange-soft-ink)', fontSize: 14.5 }}>{renderInline(parts.notice, 'n')}</div> : null}
                {parts.intro.length ? <div style={{ marginTop: 12 }}><Markdown source={blocksToMarkdown(parts.intro)} /></div> : null}
                <ol style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
                  {parts.steps.map((s, i) => <Step key={`${slug}-${i}`} index={i} step={s} done={checked.has(i)} onToggle={() => toggle(i)} />)}
                </ol>
              </div>
              <footer className="row wrapr" style={{ padding: '16px 26px 22px', borderTop: '1px solid var(--line-2)', gap: 12 }}>
                {l.prev ? <Link className="btn" to={`/lessons/${l.prev.slug}`}>← {l.prev.title}</Link> : null}
                <span className="sp" />
                {user && l.status === 'published' ? <Button variant={completed ? 'default' : 'blue'} loading={busy} onClick={toggleDone}>{completed ? 'เรียนจบแล้ว ✓' : 'เรียนจบบทนี้'}</Button> : null}
                {l.next ? <Link className="btn primary" to={`/lessons/${l.next.slug}`}>{l.next.title} →</Link> : null}
              </footer>
            </>
          )}
        </article>

        <aside aria-label="ตัวช่วย" className="col" style={{ gap: 16, alignSelf: 'start', position: 'sticky', top: 84 }}>
          <section className="zone" style={{ borderColor: 'var(--go-line)', overflow: 'hidden' }}>
            <div className="zone-h" style={{ background: 'var(--go-soft)' }}><h2 className="zone-t" style={{ color: 'var(--go)', fontSize: 16 }}>สิ่งที่ควรเห็นเมื่อสำเร็จ</h2></div>
            <div className="zone-b">
              {parts?.success?.blocks.length ? <Markdown source={blocksToMarkdown(parts.success.blocks)} /> : <p className="small muted">บทนี้ยังไม่ได้ระบุ · ผู้ดูแลเพิ่มหัวข้อ “## สิ่งที่ควรเห็นเมื่อสำเร็จ” ในเนื้อหาได้</p>}
              <Link to="/console/connect" className="small" style={{ display: 'inline-block', marginTop: 8 }}>ไปลองที่คอนโซล</Link>
            </div>
          </section>
          <section className="zone">
            <div className="zone-h"><h2 className="zone-t" style={{ fontSize: 16 }}>ถ้าไม่เป็นแบบนี้</h2></div>
            <div className="zone-b">
              {parts?.trouble?.blocks.length ? <TroubleList blocks={parts.trouble.blocks} /> : <p className="small muted">ดูปัญหาที่เจอบ่อยใน <Link to="/lessons/troubleshooting">บทแก้ปัญหา</Link> หรือ <Link to="/contact">ถามทีม</Link></p>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
