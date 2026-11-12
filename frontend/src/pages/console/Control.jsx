import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogList } from '../../features/console/LogList.jsx';
import { MapLegend, MazeMap } from '../../features/console/MazeMap.jsx';
import { RobotPicker } from '../../features/console/RobotPicker.jsx';
import { robotNames } from '../../features/console/robotState.js';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { RESULT, fmtDuration } from '../../lib/format.js';
import { useRobots } from '../../lib/robots.jsx';
import { SIM_ACTIVE, useTelemetry } from '../../lib/telemetry.jsx';
import { useToast } from '../../lib/toast.jsx';
import { Button, ConfirmModal, Gate, Modal, Notice, Pill, TextInput } from '../../ui/index.js';

function useNow(active) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function MissionHeader({ sim, mission }) {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState(null);
  const [mapName, setMapName] = useState('');
  const [busy, setBusy] = useState(false);
  const running = sim.state === 'running';
  const ended = mission.phase === 'ended';
  const now = useNow(running || SIM_ACTIVE.has(sim.state));
  const since = mission.started_at ?? sim.started_at;
  const elapsed = since ? ((ended && mission.ended_at ? new Date(mission.ended_at).getTime() : now) - new Date(since).getTime()) / 1000 : 0;

  const act = async (fn, okText) => {
    setBusy(true);
    try {
      const out = await fn();
      if (okText) toast(okText);
      setDialog(null);
      return out;
    } catch (error) {
      toast(error.message, 'err');
      return null;
    } finally {
      setBusy(false);
    }
  };
  const status = ended
    ? <Pill tone={RESULT[mission.result]?.tone ?? 'gray'}>จบแล้ว · {RESULT[mission.result]?.label}</Pill>
    : running ? <Pill tone="orange"><span className="dot led" />กำลังวิ่ง</Pill>
      : sim.state === 'stopping' ? <Pill tone="warn"><span className="spin">↻</span>กำลังหยุด</Pill>
        : <Pill tone="blue"><span className="spin">↻</span>กำลังเตรียมซิม</Pill>;

  return (
    <section className="card mission-head">
      <div className="col" style={{ gap: 4 }}>
        <span className="k">ภารกิจปัจจุบัน · ซิม · <span className="M">{mission.world ?? sim.world}</span></span>
        <div className="row wrapr" style={{ gap: 10 }}>
          <h1 style={{ fontSize: 26 }}>ภารกิจใหม่</h1>
          {status}
          <span className="clock">{fmtDuration(elapsed)}</span>
        </div>
      </div>
      <span className="sp" />
      <div className="row wrapr">
        {!ended ? (
          <Button variant="danger" icon="stop" disabled={!SIM_ACTIVE.has(sim.state) || sim.state === 'stopping'} onClick={() => setDialog('end')}>จบภารกิจ</Button>
        ) : (
          <>
            {can('console.use') ? <Button variant="primary" icon="check" onClick={() => setDialog('save')}>บันทึก</Button> : null}
            <Button variant="ghostDanger" icon="trash" onClick={() => setDialog('discard')}>ทิ้งผล</Button>
          </>
        )}
      </div>
      {dialog === 'end' ? (
        <ConfirmModal title="จบภารกิจนี้?" danger confirmLabel="จบภารกิจ" busy={busy} onClose={() => setDialog(null)}
          onConfirm={() => act(() => api('/sim/stop', { method: 'POST' }), 'กำลังปิดซิม · เลือกบันทึกหรือทิ้งผลได้เลย')}>
          <p>ปิดซิมและหุ่นทุกตัว แผนที่และ log ที่ได้จนถึงตอนนี้จะเก็บไว้ให้บันทึก</p>
        </ConfirmModal>
      ) : null}
      {dialog === 'discard' ? (
        <ConfirmModal title="ทิ้งผลภารกิจนี้?" danger confirmLabel="ทิ้งผล" busy={busy} onClose={() => setDialog(null)}
          onConfirm={() => act(() => api('/mission/discard', { method: 'POST' }), 'ทิ้งผลแล้ว')}>
          <p>แผนที่และ log ของรอบนี้จะหายไป กู้คืนไม่ได้</p>
        </ConfirmModal>
      ) : null}
      {dialog === 'save' ? (
        <Modal title="บันทึกภารกิจ" onClose={() => setDialog(null)} actions={(
          <>
            <Button onClick={() => setDialog(null)}>ยกเลิก</Button>
            <Button variant="primary" loading={busy} onClick={async () => {
              const out = await act(() => api('/mission/save', { method: 'POST', body: { map_name: mapName.trim() || null } }), 'บันทึกภารกิจแล้ว');
              if (out) navigate(`/console/missions/${out.id}`);
            }}>บันทึก</Button>
          </>
        )}>
          <p className="muted">ผล: {RESULT[mission.result]?.label} · ใช้เวลา {fmtDuration(elapsed)}</p>
          <TextInput label="ตั้งชื่อแผนที่ (ไม่บังคับ)" value={mapName} maxLength={60} onChange={(e) => setMapName(e.target.value)}
            hint="ตั้งชื่อไว้ถ้าอยากหาแผนที่รอบนี้ได้ง่ายในประวัติ" />
        </Modal>
      ) : null}
    </section>
  );
}

export function Control() {
  const { sim, mission, map, logs, connection } = useTelemetry();
  const { robot } = useRobots();
  const { can } = useAuth();
  const [focus, setFocus] = useState('all');
  const active = SIM_ACTIVE.has(sim.state);

  const names = robotNames(sim.robots || mission.robot_count, map);
  const robots = names.map((ns) => ({ ns, state: map.robots?.[ns]?.state, goal: Boolean(mission.goal_at?.[ns]) }));
  const counts = useMemo(() => {
    const out = { all: logs.length };
    for (const l of logs) out[l.ns] = (out[l.ns] ?? 0) + 1;
    return out;
  }, [logs]);
  const shownLogs = focus === 'all' ? logs : logs.filter((l) => l.ns === focus);

  if (!active && mission.phase === 'idle') {
    return (
      <main className="wrap page">
        <Gate icon="plug" title="ยังไม่มีภารกิจที่กำลังทำ" action={<Button variant="primary" icon="play" to="/console/connect">ไปรันซิม</Button>}>
          {connection === 'connected' ? 'รันซิมจากหน้าเชื่อมหุ่น แล้วหน้านี้จะแสดงแผนที่และ log สดของหุ่นทุกตัว' : 'กำลังเชื่อมต่อกับ backend…'}
        </Gate>
      </main>
    );
  }
  const focusName = focus === 'all' ? 'ทุกตัว' : robot(focus).display_name;
  return (
    <main className="wrap page">
      {!can('console.use') ? <Notice tone="blue">บัญชีนี้ดูและสั่งหยุดได้ แต่บันทึกภารกิจขึ้นเว็บไม่ได้</Notice> : null}
      <MissionHeader sim={sim} mission={mission} />
      <div className="col" style={{ gap: 8 }}>
        <div className="k">เลือกหุ่นที่จะดู · กดการ์ดเพื่อสลับทั้งแผนที่และ log</div>
        <RobotPicker robots={robots} value={focus} onChange={setFocus} counts={counts} />
      </div>
      <div className="grid g2 stack-m" style={{ alignItems: 'start' }}>
        <section className="card tight col">
          <div className="row wrapr"><h2 className="sp" style={{ fontSize: 18 }}>แผนที่ · {focusName}</h2>
            <span className="muted small">ทางแยก {map.junctions?.length ?? 0} · ทางตัน {map.dead_ends?.length ?? 0}</span></div>
          <MazeMap map={map} focus={focus} live={sim.state === 'running'} />
          <MapLegend />
        </section>
        <section className="card tight col">
          <div className="row wrapr"><h2 className="sp" style={{ fontSize: 18 }}>Log สด · {focusName}</h2>
            <span className="muted small">{shownLogs.length} รายการ</span></div>
          <LogList items={shownLogs} live />
        </section>
      </div>
    </main>
  );
}
