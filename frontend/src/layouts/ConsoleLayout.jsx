import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { SIM_ACTIVE, TelemetryProvider, useTelemetry } from '../lib/telemetry.jsx';
import { useToast } from '../lib/toast.jsx';
import { fmtTime } from '../lib/format.js';
import { Banner, ConfirmModal, Icon, Pill } from '../ui/index.js';

const TABS = [
  ['/console/control', 'ctrl', 'ควบคุม'],
  ['/console/connect', 'plug', 'เชื่อมหุ่น'],
  ['/console/history', 'hist', 'ประวัติ'],
  ['/console/team', 'bot', 'หุ่นของทีม'],
];

function LinkStatus() {
  const { connection, health, sim } = useTelemetry();
  if (connection !== 'connected') return <Pill tone="red"><span className="dot" />เว็บหลุดจาก backend</Pill>;
  if (!health?.ros_node_running) return <Pill tone="warn"><span className="dot" />ROS 2 ยังไม่เชื่อม</Pill>;
  if (sim.state === 'running') return <Pill tone="go"><span className="dot led" />หุ่นออนไลน์ {sim.robots} ตัว</Pill>;
  if (SIM_ACTIVE.has(sim.state)) return <Pill tone="orange"><span className="spin">↻</span>กำลังเตรียมซิม</Pill>;
  return <Pill tone="gray"><span className="dot" />ไม่มีซิมรันอยู่</Pill>;
}

function ConsoleBanners() {
  const { connection, health, sim, lastDataAt } = useTelemetry();
  if (connection === 'ended') {
    return <Banner tone="red" icon="lock">หมดเวลาเข้าสู่ระบบหรือบัญชีถูกระงับ · <a className="link" href="/login">เข้าสู่ระบบอีกครั้ง</a></Banner>;
  }
  if (connection !== 'connected' && connection !== 'connecting') {
    return (
      <Banner tone="red" icon="plug">
        เว็บขาดการเชื่อมต่อกับ backend · ปุ่มหยุดทุกตัวจะใช้ไม่ได้จนกว่าจะเชื่อมใหม่ · กำลังลองใหม่ <span className="spin">↻</span>
      </Banner>
    );
  }
  if (health && !health.ros_node_running) {
    return <Banner tone="warn" icon="wifi">backend ยังไม่ได้ต่อ ROS 2 · source ROS ก่อน npm start ใน backend ({health.ros_error ?? 'ไม่ทราบสาเหตุ'})</Banner>;
  }
  if (sim.state === 'running' && health && !health.team_state_fresh && lastDataAt) {
    return <Banner tone="red" icon="wifi">ข้อมูลจากหุ่นหยุดที่ {fmtTime(new Date(lastDataAt).toISOString())} · กำลังรอข้อมูลใหม่ <span className="spin">↻</span></Banner>;
  }
  return null;
}

function StopAll() {
  const { sim, connection } = useTelemetry();
  const { can } = useAuth();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const active = SIM_ACTIVE.has(sim.state) && sim.state !== 'stopping';
  const stop = async () => {
    setBusy(true);
    try {
      await api('/sim/stop', { method: 'POST' });
      toast('สั่งหยุดทุกตัวแล้ว กำลังปิดซิม');
      setConfirm(false);
    } catch (error) {
      toast(error.message, 'err');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button type="button" className="estop" disabled={!active || connection !== 'connected' || !can('console.stop')} onClick={() => setConfirm(true)}>
        <Icon name="stop" /><span className="lbl">หยุดทุกตัว</span>
      </button>
      {confirm ? (
        <ConfirmModal title="หยุดหุ่นทุกตัว?" danger confirmLabel="หยุดทุกตัว" busy={busy} onConfirm={stop} onClose={() => setConfirm(false)}>
          <p>ปิดซิมทั้งชุด (Gazebo, bridge และหุ่นทุกตัว) ภารกิจนี้จะจบทันที แล้วเลือกบันทึกหรือทิ้งผลได้ที่หน้าควบคุม</p>
        </ConfirmModal>
      ) : null}
    </>
  );
}

function ConsoleShell() {
  return (
    <>
      <ConsoleBanners />
      <div className="wrap row wrapr" style={{ paddingTop: 18 }}>
        <span className="k">คอนโซลหุ่น</span>
        <span className="sp" />
        <LinkStatus />
      </div>
      <div className="conbody"><Outlet /></div>
      <nav className="cnav" aria-label="เมนูคอนโซล">
        <div className="wrap">
          {TABS.map(([to, icon, label]) => (
            <NavLink key={to} to={to}><Icon name={icon} /><span className="lbl">{label}</span></NavLink>
          ))}
          <span className="sp" />
          <StopAll />
        </div>
      </nav>
    </>
  );
}

export function ConsoleLayout() {
  return <TelemetryProvider><ConsoleShell /></TelemetryProvider>;
}
