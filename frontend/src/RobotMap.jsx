import { useEffect, useRef, useState } from 'react';

const COLORS = ['#60dbfa', '#f7b95d', '#c6a2ff', '#f78ca8', '#74dfa2'];

function validPoint(point) {
  return Number.isFinite(point?.[0]) && Number.isFinite(point?.[1]);
}

function drawMap(canvas, paths, team, names, colorFor, fresh) {
  const { width, height } = canvas.getBoundingClientRect();
  if (!width || !height) return;
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const robots = team.robots || {};
  const junctions = (team.junctions || []).filter(({ x, y }) => validPoint([x, y]));
  const goal = team.goal;
  const points = [
    ...Object.values(paths).flat().filter(validPoint),
    ...Object.values(robots).map(({ x, y }) => [x, y]).filter(validPoint),
    ...junctions.map(({ x, y }) => [x, y]),
  ];
  if (validPoint([goal?.x, goal?.y])) points.push([goal.x, goal.y]);
  if (!points.length) return;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const scale = Math.min(Math.max(width - 96, 1) / Math.max(maxX - minX, 1),
    Math.max(height - 76, 1) / Math.max(maxY - minY, 1));
  const screenX = (x) => width / 2 + (x - centerX) * scale;
  const screenY = (y) => height / 2 - (y - centerY) * scale;

  const step = Math.max(1, Math.ceil(36 / scale));
  ctx.strokeStyle = '#23364a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = Math.ceil((centerX - width / (2 * scale)) / step) * step; screenX(x) < width; x += step) {
    ctx.moveTo(screenX(x), 0);
    ctx.lineTo(screenX(x), height);
  }
  for (let y = Math.ceil((centerY - height / (2 * scale)) / step) * step; screenY(y) > 0; y += step) {
    ctx.moveTo(0, screenY(y));
    ctx.lineTo(width, screenY(y));
  }
  ctx.stroke();
  ctx.font = '12px Inter, sans-serif';
  ctx.fillStyle = '#a3b9cf';
  ctx.fillText(step + ' ม. / ช่อง', 14, height - 14);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const name of names) {
    ctx.strokeStyle = colorFor(name);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let drawing = false;
    for (const point of paths[name] || []) {
      if (!validPoint(point)) {
        drawing = false;
        continue;
      }
      const [x, y] = point;
      if (drawing) ctx.lineTo(screenX(x), screenY(y));
      else ctx.moveTo(screenX(x), screenY(y));
      drawing = true;
    }
    ctx.stroke();
  }

  for (const junction of junctions) {
    const x = screenX(junction.x);
    const y = screenY(junction.y);
    ctx.fillStyle = '#adc1d5';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(junction.id, x + 7, y - 7);
  }
  if (validPoint([goal?.x, goal?.y])) {
    const x = screenX(goal.x);
    const y = screenY(goal.y);
    ctx.fillStyle = '#5ce4a3';
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x + 8, y);
    ctx.lineTo(x, y + 8);
    ctx.lineTo(x - 8, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillText('เป้าหมาย', x + 12, y - 8);
  }
  for (const name of names) {
    const pose = robots[name];
    const point = validPoint([pose?.x, pose?.y]) ? [pose.x, pose.y] : paths[name]?.at(-1);
    if (!validPoint(point)) continue;
    const x = screenX(point[0]);
    const y = screenY(point[1]);
    ctx.globalAlpha = fresh && pose ? 1 : 0.55;
    ctx.fillStyle = colorFor(name);
    ctx.beginPath();
    if (Number.isFinite(pose?.heading)) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-pose.heading);
      ctx.moveTo(10, 0);
      ctx.lineTo(-6, -6);
      ctx.lineTo(-6, 6);
      ctx.closePath();
      ctx.restore();
    } else {
      ctx.arc(x, y, 4, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillText(name, x + 12, y + 15);
    ctx.globalAlpha = 1;
  }
}

export default function RobotMap({ token, team, fresh }) {
  const canvas = useRef(null);
  const [history, setHistory] = useState(null);
  const [selected, setSelected] = useState('');
  const [colors, setColors] = useState({});
  const [error, setError] = useState('');
  const paths = history?.run_id === (team.run_id ?? null) ? history.robots : {};
  const names = [...new Set([...Object.keys(paths), ...Object.keys(team.robots || {})])].sort();
  const active = names.includes(selected) ? selected : '';
  const visible = active ? [active] : names;

  useEffect(() => {
    let stopped = false;
    let timer;
    const controller = new AbortController();

    async function poll() {
      try {
        const response = await fetch('/api/paths', {
          headers: { Authorization: 'Bearer ' + token },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('โหลดเส้นทางจาก backend ไม่สำเร็จ');
        const data = await response.json();
        if (!stopped) {
          setHistory(data);
          setError('');
        }
      } catch (cause) {
        if (!stopped) setError(cause.message);
      } finally {
        if (!stopped) timer = window.setTimeout(poll, 1000);
      }
    }

    poll();
    return () => {
      stopped = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [token]);

  useEffect(() => {
    const element = canvas.current;
    const redraw = () => drawMap(element, paths, team, visible,
      (name) => colors[name] || COLORS[names.indexOf(name) % COLORS.length], fresh);
    redraw();
    const observer = new ResizeObserver(redraw);
    observer.observe(element);
    return () => observer.disconnect();
  }, [paths, team, visible, names, colors, fresh]);

  return (
    <section className="panel map-panel">
      <div className="panel-heading">
        <h2>เส้นทางที่หุ่นเดิน</h2>
        <span>{fresh ? 'ข้อมูลสด' : 'รอข้อมูลสด'}</span>
      </div>
      <div className="map-controls">
        <label>แสดงหุ่น
          <select value={active} onChange={(event) => setSelected(event.target.value)}>
            <option value="">ทุกตัว</option>
            {names.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <div className="map-colors">
          {visible.map((name) => (
            <label key={name}>
              <input type="color" aria-label={'สีเส้นทาง ' + name}
                value={colors[name] || COLORS[names.indexOf(name) % COLORS.length]}
                onChange={(event) => setColors({ ...colors, [name]: event.target.value })} />
              {name}
            </label>
          ))}
        </div>
      </div>
      {error && <p className="map-error" role="status">{error}</p>}
      <div className="map-viewport">
        <canvas ref={canvas} aria-label="แผนที่เส้นทางหุ่น เหนืออยู่ด้านบน ตะวันออกอยู่ด้านขวา" role="img" />
        <span className="map-north">เหนือ ↑</span>
        <span className="map-west">ตก</span>
        <span className="map-east">ออก</span>
        <span className="map-south">ใต้ ↓</span>
        {!names.length && <p className="map-empty">รอพิกัดหุ่นจาก ROS 2</p>}
      </div>
    </section>
  );
}
