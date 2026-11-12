export const PAGE_SIZES = [10, 20, 30, 50];

function pageList(page, pages) {
  const set = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i && sorted[i] - sorted[i - 1] > 1) out.push('…');
    out.push(sorted[i]);
  }
  return out;
}

/** Shows "x–y จาก N", page buttons and a 10/20/30/50 per-page picker. Hidden when total ≤ 10. */
export function Pager({ page, pageSize, total, onChange }) {
  if (total <= PAGE_SIZES[0]) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className="pager" aria-label="เปลี่ยนหน้า">
      <span className="muted">{from}–{to} จาก {total}</span>
      <span className="sp" />
      <div className="pages">
        <button type="button" className="pgb" disabled={page <= 1} onClick={() => onChange({ page: page - 1, pageSize })} aria-label="หน้าก่อน">‹</button>
        {pageList(page, pages).map((p, i) => (p === '…'
          ? <span key={`gap-${i}`} className="muted" style={{ alignSelf: 'center' }}>…</span>
          : <button key={p} type="button" className="pgb" aria-current={p === page ? 'page' : undefined} onClick={() => onChange({ page: p, pageSize })}>{p}</button>))}
        <button type="button" className="pgb" disabled={page >= pages} onClick={() => onChange({ page: page + 1, pageSize })} aria-label="หน้าถัดไป">›</button>
      </div>
      <label className="row" style={{ gap: 8 }}>
        <span className="muted">ต่อหน้า</span>
        <select value={pageSize} onChange={(e) => onChange({ page: 1, pageSize: Number(e.target.value) })}>
          {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
    </nav>
  );
}
