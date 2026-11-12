import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SimProgress, TerminalBox } from '../../features/console/SimProgress.jsx';
import { api } from '../../lib/api.js';
import { SIM_ACTIVE, useTelemetry } from '../../lib/telemetry.jsx';
import { useToast } from '../../lib/toast.jsx';
import { useAsync } from '../../lib/useAsync.js';
import { Button, ErrorNotice, Notice, Segmented, Select, Skeleton, ToggleRow } from '../../ui/index.js';

const SUPPORTED = { mbot2_seed7_maze: 'สนามหลักของทีม (seed 7)', Map1: 'ตาราง 16×16 ชุด 1', Map1_Walled: 'ตาราง 16×16 ชุด 1 มีกำแพง', Map2: 'ตาราง 16×16 ชุด 2 (2 เป้าหมาย)' };

function SimForm({ worlds, disabled, onStarted }) {
  const toast = useToast();
  const [form, setForm] = useState({ count: 2, world: worlds[0] ?? '', build: false, headless: false });
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setPreview(null); };

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await api('/sim/start', { method: 'POST', body: form });
      onStarted(form);
    } catch (err) {
      setError(err);
      toast(err.message, 'err');
    } finally {
      setBusy(false);
    }
  };
  const showCommands = async () => {
    try {
      setPreview((await api('/sim/preview', { method: 'POST', body: form })).commands);
    } catch (err) {
      setError(err);
    }
  };

  return (
    <section className="card pad col" style={{ gap: 16 }}>
      <h2>รันซิม</h2>
      <div className="field">
        <span>จำนวนหุ่น</span>
        <Segmented label="จำนวนหุ่น" value={form.count} onChange={(count) => set({ count })}
          options={[{ value: 2, label: '2 ตัว' }, { value: 3, label: '3 ตัว (ใช้แรมเยอะ)' }]} />
      </div>
      <Select label="สนามในซิม" value={form.world} onChange={(e) => set({ world: e.target.value })}
        hint="ไฟล์ .sdf ใน mbot2_description/worlds"
        error={error?.fields?.world}
        options={worlds.map((w) => ({ value: w, label: `${w}${SUPPORTED[w] ? ` · ${SUPPORTED[w]}` : ''}` }))} />
      <div className="col" style={{ gap: 4 }}>
        <ToggleRow title="Build ใหม่ก่อนรัน" description="เปิดเมื่อแก้โค้ดหุ่น (colcon build ราว 10–60 วินาที)"
          checked={form.build} onChange={(build) => set({ build })} />
        <ToggleRow title="ซ่อนหน้าต่าง Gazebo (headless)" description="ประหยัดเครื่อง หุ่นยังวิ่งและแผนที่บนเว็บยังขึ้นปกติ"
          checked={form.headless} onChange={(headless) => set({ headless })} />
      </div>
      {form.world !== 'mbot2_seed7_maze' ? (
        <Notice tone="warn">สนามนี้เปิดได้และวางหุ่นที่แผ่นเริ่มแล้ว แต่อัลกอริทึมของหุ่นจูนมากับ seed 7 ผลการสำรวจอาจไม่ครบ</Notice>
      ) : null}
      {preview ? <TerminalBox lines={preview.map((c) => `$ ${c}`)} maxHeight={140} /> : null}
      <div className="row wrapr">
        <Button variant="primary" size="lg" icon="play" loading={busy} disabled={disabled} onClick={start}>
          {`รันซิม ${form.count} ตัว`}
        </Button>
        <Button variant="default" icon="terminal" onClick={showCommands}>ดูคำสั่งที่จะรัน</Button>
      </div>
    </section>
  );
}

export function Connect() {
  const { sim, lines, mission } = useTelemetry();
  const navigate = useNavigate();
  const toast = useToast();
  const worlds = useAsync((signal) => api('/sim/worlds', { signal }), 'worlds');
  const [watching, setWatching] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const retry = async () => {
    setRetrying(true);
    try {
      await api('/sim/start', { method: 'POST', body: lastRun });
      setWatching(true);
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setRetrying(false);
    }
  };
  const active = SIM_ACTIVE.has(sim.state);
  const prev = useRef(sim.state);

  useEffect(() => {
    if (watching && prev.current !== 'running' && sim.state === 'running') {
      toast(`ซิมพร้อมแล้ว หุ่นวิ่งอยู่ ${sim.robots} ตัว`);
      navigate('/console/control');
    }
    prev.current = sim.state;
  }, [sim.state, sim.robots, watching, navigate, toast]);

  const error = sim.error;
  const items = worlds.data?.items ?? [];
  const showProgress = active || error || watching;
  const termLines = useMemo(() => lines.slice(-200), [lines]);

  return (
    <main className="wrap page">
      <div className="page-head">
        <div className="sp"><h1>เชื่อมหุ่น</h1><p className="sub">เลือกจำนวนหุ่นและสนาม แล้วกดรัน · เว็บจะพาไปหน้าควบคุมเองเมื่อหุ่นพร้อม</p></div>
      </div>
      <Segmented label="แหล่งหุ่น" value="sim" onChange={() => {}} options={[
        { value: 'sim', label: 'ซิม (Gazebo)' },
        { value: 'real', label: 'หุ่นจริง · เร็วๆ นี้', disabled: true, title: 'ยังไม่มี launch สำหรับหุ่นจริง' },
      ]} />
      {mission.phase === 'ended' ? (
        <Notice tone="warn" title="ภารกิจที่แล้วยังไม่ได้บันทึก" action={<Button size="sm" to="/console/control">ไปบันทึก</Button>}>
          ถ้ารันซิมใหม่ ผลของรอบที่แล้วจะถูกทิ้ง
        </Notice>
      ) : null}
      <ErrorNotice error={worlds.error} onRetry={worlds.reload} />
      <div className="grid g2 stack-m" style={{ alignItems: 'start' }}>
        {worlds.loading && !worlds.data ? <Skeleton height={420} /> : items.length ? (
          <SimForm worlds={items} disabled={active} onStarted={(form) => { setLastRun(form); setWatching(true); }} />
        ) : (
          <Notice tone="red" title="ไม่พบไฟล์สนาม">ตรวจว่า build โค้ดหุ่นแล้ว (~/ros2_ws/install/mbot2_description/share/.../worlds) หรือค่า MBOT2_WS_PATH ใน backend/.env</Notice>
        )}
        <section className="card pad col" style={{ gap: 14 }}>
          <div className="row"><h2 className="sp">ความคืบหน้า</h2>{active ? <Button size="sm" to="/console/control" icon="arrow">ไปหน้าควบคุม</Button> : null}</div>
          {showProgress ? <SimProgress steps={sim.steps} /> : <p className="muted">กดรันซิมแล้วขั้นตอนจะขึ้นที่นี่</p>}
          {error ? (
            <Notice tone="red" title={error.code === 'BUILD_FAILED' ? 'Build ไม่ผ่าน' : 'รันซิมไม่สำเร็จ'}
              action={lastRun ? <Button size="sm" icon="refresh" loading={retrying} onClick={retry}>แก้แล้ว รันอีกครั้ง</Button> : null}>
              {error.file ? <div className="M">{error.file}{error.line ? ` บรรทัด ${error.line}` : ''}</div> : null}
              <div>{error.message}</div>
              {error.code === 'BUILD_FAILED' ? <div>แก้ไฟล์ใน VS Code แล้วกดรันใหม่โดยเปิด “Build ใหม่ก่อนรัน”</div> : null}
            </Notice>
          ) : null}
          <div className="k">ข้อความจาก Terminal</div>
          <TerminalBox lines={termLines} />
          <p className="muted small">รันบนเครื่องนี้ผ่าน backend · รันได้เฉพาะ colcon build และ ros2 launch ของทีมเท่านั้น</p>
        </section>
      </div>
    </main>
  );
}
