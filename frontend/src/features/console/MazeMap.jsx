import { useMemo } from 'react';
import { useRobots } from '../../lib/robots.jsx';

const W = 640;
const PAD = 44;
const ok = (p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);

/** World metres → SVG pixels, fitted to everything on the map (north up). */
function useProjection(map) {
  return useMemo(() => {
    const pts = [
      ...Object.values(map.paths ?? {}).flat().filter(ok),
      ...Object.values(map.robots ?? {}).map((r) => [r.x, r.y]).filter(ok),
      ...(map.junctions ?? []).map((j) => j.at).filter(ok),
      ...(map.dead_ends ?? []).map((d) => d.at).filter(ok),
      ...(map.goal && ok(map.goal.at) ? [map.goal.at] : []),
      ...(ok(map.start) ? [map.start] : []),
    ];
    if (!pts.length) return null;
    let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [x, y] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    const scale = (W - PAD * 2) / Math.max(spanX, spanY * 1.25);
    const H = Math.max(320, Math.min(560, spanY * scale + PAD * 2));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return {
      H, scale,
      x: (x) => W / 2 + (x - cx) * scale,
      y: (y) => H / 2 - (y - cy) * scale,
      minX: cx - W / 2 / scale, maxX: cx + W / 2 / scale, minY: cy - H / 2 / scale, maxY: cy + H / 2 / scale,
    };
  }, [map]);
}

function polylines(points) {
  const runs = [];
  let run = [];
  for (const p of points ?? []) {
    if (!ok(p)) { if (run.length) runs.push(run); run = []; } else run.push(p);
  }
  if (run.length) runs.push(run);
  return runs;
}

/**
 * Live or saved maze map (map model from the backend). `focus` = 'all' or a robot ns;
 * other robots fade out. Junction = ● · dead end = ✕ (docs/decisions.md §4).
 */
export function MazeMap({ map, focus = 'all', live = false, label = 'แผนที่เขาวงกตที่หุ่นวาด', colors = null }) {
  const { robot } = useRobots();
  const colorOf = (ns) => colors?.[ns] ?? robot(ns).color;
  const proj = useProjection(map);
  if (!proj) {
    return (
      <div className="mapbox" style={{ display: 'grid', placeItems: 'center', minHeight: 320 }}>
        <p className="muted small">ยังไม่มีข้อมูลแผนที่ · แผนที่จะขึ้นเมื่อหุ่นเริ่มส่งตำแหน่ง</p>
      </div>
    );
  }
  const { x, y, H, scale } = proj;
  const step = scale > 120 ? 0.25 : scale > 50 ? 0.5 : 1;
  const grid = [];
  for (let gx = Math.ceil(proj.minX / step) * step; gx <= proj.maxX; gx += step) grid.push(<line key={`x${gx}`} x1={x(gx)} y1={0} x2={x(gx)} y2={H} />);
  for (let gy = Math.ceil(proj.minY / step) * step; gy <= proj.maxY; gy += step) grid.push(<line key={`y${gy}`} x1={0} y1={y(gy)} x2={W} y2={y(gy)} />);
  const dim = (ns) => (focus === 'all' || focus === ns ? 1 : 0.18);
  const names = Object.keys(map.paths ?? {}).sort();
  const start = ok(map.start) ? map.start : map.paths?.mbot1?.find(ok);

  return (
    <div className="mapbox">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <g stroke="var(--grid)" strokeWidth="1">{grid}</g>
        {names.map((ns) => polylines(map.paths[ns]).map((run, i) => (
          <polyline key={`${ns}-${i}`} points={run.map(([px, py]) => `${x(px)},${y(py)}`).join(' ')} fill="none"
            stroke={colorOf(ns)} strokeWidth={Math.max(4, Math.min(10, scale * 0.05))} strokeLinecap="round" strokeLinejoin="round" opacity={dim(ns)} />
        )))}
        {start ? (
          <g transform={`translate(${x(start[0])} ${y(start[1])})`}>
            <rect x="-22" y="-26" width="44" height="18" rx="6" fill="var(--ink)" />
            <text y="-13" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--bg)">START</text>
          </g>
        ) : null}
        {map.goal ? (
          <g transform={`translate(${x(map.goal.at[0])} ${y(map.goal.at[1])})`}>
            <rect x="-20" y="-14" width="40" height="28" rx="8" fill="#E5484D" opacity=".35" />
            <text y="-20" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--red-ink)">เป้าหมาย</text>
          </g>
        ) : null}
        {(map.junctions ?? []).filter((j) => ok(j.at)).map((j, i) => (
          <g key={`j${j.id ?? i}`}>
            <circle cx={x(j.at[0])} cy={y(j.at[1])} r="8" fill="var(--bg)" stroke="var(--ink)" strokeWidth="3" />
            {j.id !== null ? <text x={x(j.at[0]) + 12} y={y(j.at[1]) - 10} fontSize="11" fill="var(--ink-3)" fontFamily="IBM Plex Mono">J{j.id}</text> : null}
          </g>
        ))}
        {(map.dead_ends ?? []).filter((d) => ok(d.at)).map((d, i) => {
          const [cx, cy] = [x(d.at[0]), y(d.at[1])];
          return <path key={`d${i}`} d={`M${cx - 7} ${cy - 7}l14 14M${cx + 7} ${cy - 7}l-14 14`} stroke="var(--red-ink)" strokeWidth="3.5" strokeLinecap="round" />;
        })}
        {Object.entries(map.robots ?? {}).filter(([, r]) => ok([r.x, r.y])).map(([ns, r]) => {
          const color = colorOf(ns);
          const heading = Number.isFinite(r.heading) ? r.heading : null;
          return (
            <g key={ns} transform={`translate(${x(r.x)} ${y(r.y)})`} opacity={dim(ns)}>
              {live ? <circle r="20" fill={color} opacity=".25" className="ping" /> : null}
              {heading !== null ? <path d="M20 0L10 -6V6z" fill={color} transform={`rotate(${(-heading * 180) / Math.PI})`} /> : null}
              <circle r="13" fill={color} stroke="var(--bg)" strokeWidth="3" />
              <text y="4.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="#14161A">{ns.replace(/\D/g, '')}</text>
            </g>
          );
        })}
        <g transform={`translate(${W - 34} 34)`}>
          <circle r="20" fill="var(--panel)" stroke="var(--line-strong)" />
          <path d="M0 -14L5 0H-5z" fill="var(--orange)" />
          <text y="14" textAnchor="middle" fontSize="9" fill="var(--ink-3)">N</text>
        </g>
        <text x="12" y={H - 12} fontSize="11" fill="var(--ink-4)" fontFamily="IBM Plex Mono">ช่องละ {step} ม.</text>
      </svg>
    </div>
  );
}

export function MapLegend() {
  return (
    <div className="legend">
      <span>● ทางแยก</span>
      <span style={{ color: 'var(--red-ink)' }}>✕ ทางตัน</span>
      <span>สีเส้น = หุ่นที่ลากเส้นนั้น</span>
      <span>▲ หัวหุ่น = ทิศที่หัน</span>
    </div>
  );
}
