import { Fragment, useEffect, useState } from 'react';
import { api, query } from '../../lib/api.js';
import { fmtDateTime } from '../../lib/format.js';
import { useAsync } from '../../lib/useAsync.js';
import { Button, EmptyState, ErrorNotice, Pager, Pill, SearchBox, Select, Skeleton } from '../../ui/index.js';
import { useDebounced, useListParams } from '../../lib/listParams.js';

const ACTIONS = [
  ['', 'ทุกการกระทำ'], ['user.', 'ผู้ใช้'], ['role.', 'บทบาท'], ['settings.', 'ตั้งค่า'], ['announce.', 'ประกาศ'],
  ['sim.', 'ซิม'], ['mission.', 'ภารกิจ'], ['invite.', 'รหัสเชิญ'], ['auth.', 'เข้าสู่ระบบไม่สำเร็จ'],
];

function Json({ value }) {
  if (value === null || value === undefined) return <span className="muted">—</span>;
  return <pre className="terminal" style={{ margin: 0, maxHeight: 180 }}>{JSON.stringify(value, null, 2)}</pre>;
}

export function Audit() {
  const [p, update] = useListParams({ q: '', action: '', page: 1, page_size: 20 });
  const [search, setSearch] = useState(p.q);
  const q = useDebounced(search);
  useEffect(() => { if (q !== p.q) update({ q }); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = useAsync((signal) => api(`/admin/audit${query(p)}`, { signal }), JSON.stringify(p));
  const [open, setOpen] = useState(null);
  const data = list.data;
  return (
    <>
      <div className="page-head">
        <div className="sp"><h1>Audit log</h1><p className="sub">ใคร ทำอะไร กับอะไร เมื่อไหร่ · ลบหรือแก้ไม่ได้</p></div>
        <Button icon="dl" onClick={() => { window.location.href = `/api/v1/admin/audit/export.csv${query({ q: p.q, action: p.action })}`; }}>ส่งออก CSV</Button>
      </div>
      <div className="toolbar">
        <SearchBox value={search} onChange={setSearch} placeholder="ค้นหาข้อความหรือชื่อผู้ทำ" />
        <div style={{ minWidth: 220 }}><Select label={null} aria-label="กรองการกระทำ" value={p.action} onChange={(e) => update({ action: e.target.value })} options={ACTIONS.map(([value, label]) => ({ value, label }))} /></div>
      </div>
      <ErrorNotice error={list.error} onRetry={list.reload} />
      <section className="card">
        {!data ? <div className="col" style={{ padding: 16 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={40} />)}</div> : !data.total ? (
          <EmptyState icon="log" title="ไม่พบรายการ">ลองเปลี่ยนคำค้นหรือตัวกรอง</EmptyState>
        ) : (
          <div className="tscroll">
            <table className="t">
              <thead><tr><th>เวลา</th><th>ผู้ทำ</th><th>การกระทำ</th><th>รายละเอียด</th></tr></thead>
              <tbody>
                {data.items.map((a) => (
                  <Fragment key={a.id}>
                    <tr className="clickable" tabIndex={0} aria-expanded={open === a.id} onClick={() => setOpen(open === a.id ? null : a.id)}
                      onKeyDown={(e) => e.key === 'Enter' && setOpen(open === a.id ? null : a.id)}>
                      <td className="M small" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(a.at)}</td>
                      <td>{a.actor_name ?? <span className="muted">ระบบ / ไม่ทราบ</span>}</td>
                      <td><Pill tone={a.action.startsWith('auth.') ? 'warn' : 'gray'}>{a.action}</Pill></td>
                      <td>{a.summary}</td>
                    </tr>
                    {open === a.id ? (
                      <tr><td colSpan={4} style={{ background: 'var(--line-2)' }}>
                        <div className="grid g2">
                          <div className="col" style={{ gap: 6 }}><span className="k">ก่อน</span><Json value={a.before} /></div>
                          <div className="col" style={{ gap: 6 }}><span className="k">หลัง</span><Json value={a.after} /></div>
                        </div>
                        <div className="muted small" style={{ marginTop: 8 }}>IP {a.ip ?? '—'} · {a.user_agent ?? '—'} · เป้าหมาย {a.target_type ?? '—'} {a.target_id ?? ''}</div>
                      </td></tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {data ? <Pager page={Number(p.page)} pageSize={Number(p.page_size)} total={data.total} onChange={({ page, pageSize }) => update({ page, page_size: pageSize }, false)} /> : null}
    </>
  );
}
