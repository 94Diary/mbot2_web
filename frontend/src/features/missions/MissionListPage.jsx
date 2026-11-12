import { useEffect, useState } from 'react';
import { HistoryList } from './HistoryList.jsx';
import { api, query } from '../../lib/api.js';
import { useAsync } from '../../lib/useAsync.js';
import { useDebounced, useListParams } from '../../lib/listParams.js';
import { Button, EmptyState, ErrorNotice, Pager, SearchBox, Segmented, Skeleton } from '../../ui/index.js';

const RESULTS = [{ value: '', label: 'ทั้งหมด' }, { value: 'ok', label: 'ครบ' }, { value: 'part', label: 'บางตัว' }, { value: 'stop', label: 'หยุด' }];

export function MissionListPage({ endpoint, title, sub, showOwner = false, linkTo, extraFilters }) {
  const [p, update] = useListParams({ q: '', result: '', world: '', sort: 'new', page: 1, page_size: 10 });
  const [search, setSearch] = useState(p.q);
  const q = useDebounced(search);
  useEffect(() => { if (q !== p.q) update({ q }); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const key = JSON.stringify(p);
  const list = useAsync((signal) => api(`${endpoint}${query(p)}`, { signal }), key);
  const data = list.data;
  const pager = data ? <Pager page={Number(p.page)} pageSize={Number(p.page_size)} total={data.total} onChange={({ page, pageSize }) => update({ page, page_size: pageSize }, false)} /> : null;

  return (
    <main className={showOwner ? 'col' : 'wrap page'} style={{ gap: 18 }}>
      <div className="page-head"><div className="sp"><h1>{title}</h1><p className="sub">{sub}</p></div></div>
      <div className="toolbar">
        <SearchBox value={search} onChange={setSearch} placeholder="ค้นหา #รอบ หรือชื่อแผนที่" />
        <Segmented label="กรองผล" value={p.result} onChange={(result) => update({ result })} options={RESULTS} />
        <select className="in" style={{ width: 'auto', minHeight: 42 }} aria-label="กรองสนาม" value={p.world} onChange={(e) => update({ world: e.target.value })}>
          <option value="">ทุกสนาม</option>
          {(data?.worlds ?? []).map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
        <select className="in" style={{ width: 'auto', minHeight: 42 }} aria-label="เรียงลำดับ" value={p.sort} onChange={(e) => update({ sort: e.target.value })}>
          <option value="new">ใหม่ก่อน</option>
          <option value="old">เก่าก่อน</option>
        </select>
        {extraFilters}
      </div>
      <ErrorNotice error={list.error} onRetry={list.reload} />
      {!data && list.loading ? <div className="col">{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={68} />)}</div> : null}
      {data && data.total === 0 ? (
        <div className="card">
          <EmptyState icon="hist" title={p.q || p.result || p.world ? 'ไม่พบภารกิจที่ตรงกับตัวกรอง' : 'ยังไม่มีภารกิจที่บันทึก'}
            action={p.q || p.result || p.world ? <Button onClick={() => { setSearch(''); update({ q: '', result: '', world: '' }); }}>ล้างตัวกรอง</Button> : !showOwner ? <Button variant="primary" to="/console/connect">ไปรันซิม</Button> : null}>
            {showOwner ? '' : 'จบภารกิจแล้วกดบันทึก ภารกิจจะมาอยู่ที่นี่'}
          </EmptyState>
        </div>
      ) : null}
      {data && data.total > 0 ? (
        <>
          {pager}
          <div style={{ opacity: list.loading ? 0.6 : 1 }}><HistoryList items={data.items} showOwner={showOwner} linkTo={linkTo} /></div>
          {pager}
        </>
      ) : null}
    </main>
  );
}
