import { useEffect, useState } from 'react';
import { MazeMap } from '../../features/console/MazeMap.jsx';
import { stateLabel } from '../../features/console/robotState.js';
import { useAuth } from '../../lib/auth.jsx';
import { DEFAULT_ROBOTS, SWATCHES, useRobots } from '../../lib/robots.jsx';
import { useTelemetry } from '../../lib/telemetry.jsx';
import { useToast } from '../../lib/toast.jsx';
import { BotAvatar, Button, KeyValue, Notice, Pill, TextInput } from '../../ui/index.js';

const NAMES = Object.keys(DEFAULT_ROBOTS);

function RobotEditor({ ns }) {
  const { robot, prefs, save } = useRobots();
  const toast = useToast();
  const info = robot(ns);
  const [name, setName] = useState(info.display_name);
  const [color, setColor] = useState(info.color);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setName(info.display_name); setColor(info.color); }, [info.display_name, info.color]);
  const clash = NAMES.filter((other) => other !== ns && robot(other).color.toUpperCase() === color.toUpperCase());

  const submit = async () => {
    setBusy(true);
    try {
      const next = Object.fromEntries(NAMES.map((n) => [n, { display_name: robot(n).display_name, color: robot(n).color }]));
      next[ns] = { display_name: name, color };
      await save({ ...Object.fromEntries(Object.entries(prefs)), ...next });
      toast('บันทึกชื่อและสีแล้ว');
    } catch (error) {
      toast(error.message, 'err');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card pad col" style={{ background: 'var(--raise)' }}>
      <strong>ชื่อและสีบนเว็บ</strong>
      <small className="muted">เปลี่ยนแค่การแสดงผลบนเว็บ ไม่เปลี่ยน namespace /{ns} ใน ROS</small>
      <TextInput label="ชื่อหุ่น" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
      <div className="field">
        <span>สี</span>
        <div className="row wrapr" role="radiogroup" aria-label="สีหุ่น">
          {SWATCHES.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={c === color.toUpperCase()} aria-label={c} onClick={() => setColor(c)}
              style={{ width: 32, height: 32, borderRadius: 10, background: c, border: c === color.toUpperCase() ? '3px solid var(--ink)' : '1px solid var(--line)' }} />
          ))}
          <input type="color" value={color} onChange={(e) => setColor(e.target.value.toUpperCase())} aria-label="เลือกสีเอง" style={{ width: 40, height: 34, border: 'none', background: 'none' }} />
        </div>
      </div>
      {clash.length ? <Notice tone="warn">สีซ้ำกับ {clash.map((n) => robot(n).display_name).join(', ')} บนแผนที่จะแยกยาก</Notice> : null}
      <Button variant="primary" size="sm" loading={busy} onClick={submit} style={{ alignSelf: 'flex-end' }} disabled={!name.trim()}>บันทึก</Button>
    </div>
  );
}

export function Team() {
  const { robot } = useRobots();
  const { can } = useAuth();
  const { map, mission } = useTelemetry();
  const [ns, setNs] = useState('mbot1');
  const info = robot(ns);
  const pose = map.robots?.[ns];
  const [label, tone] = mission.goal_at?.[ns] ? ['ถึงเป้าหมาย', 'go'] : stateLabel(pose?.state);
  const solo = { ...map, paths: { [ns]: map.paths?.[ns] ?? [] }, robots: pose ? { [ns]: pose } : {} };
  return (
    <main className="wrap page">
      <div className="page-head"><div className="sp"><h1>หุ่นของทีม</h1><p className="sub">สถานะสดและการตั้งชื่อ/สีของแต่ละตัว</p></div></div>
      <div className="row wrapr">
        {NAMES.map((n) => (
          <Button key={n} size="sm" variant={n === ns ? 'primary' : 'default'} onClick={() => setNs(n)}>
            <span className="dot" style={{ color: n === ns ? '#14161A' : robot(n).color }} />{robot(n).display_name}
          </Button>
        ))}
      </div>
      <div className="grid g2 stack-m" style={{ alignItems: 'start' }}>
        <div className="card pad col">
          <div className="row"><BotAvatar robot={info} size={64} /><div className="sp"><h2 style={{ fontSize: 26 }}>{info.display_name}</h2><span className="M muted">/{ns}</span></div></div>
          <KeyValue label="สถานะ"><Pill tone={tone}>{label}</Pill></KeyValue>
          <KeyValue label="ตำแหน่ง">{pose ? <span className="M">{pose.x.toFixed(2)}, {pose.y.toFixed(2)} ม.</span> : '—'}</KeyValue>
          <KeyValue label="ทิศที่หัน">{Number.isFinite(pose?.heading) ? `${Math.round((pose.heading * 180) / Math.PI)}°` : '—'}</KeyValue>
          <KeyValue label="แบตเตอรี่"><span className="muted">หุ่นยังไม่ส่งค่า</span></KeyValue>
          <KeyValue label="โหมด"><span className="muted">สำรวจ (สลับโหมดได้เมื่อหุ่นรองรับ)</span></KeyValue>
          {can('history.own') ? <RobotEditor ns={ns} /> : null}
        </div>
        <div className="card tight col"><h2 style={{ fontSize: 18 }}>ทางที่ {info.display_name} ผ่านรอบนี้</h2><MazeMap map={solo} live /></div>
      </div>
    </main>
  );
}
