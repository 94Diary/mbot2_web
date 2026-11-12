import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LogList } from '../../features/console/LogList.jsx';
import { MapLegend, MazeMap } from '../../features/console/MazeMap.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { RESULT, fmtDateTime, fmtDuration } from '../../lib/format.js';
import { useToast } from '../../lib/toast.jsx';
import { useAsync } from '../../lib/useAsync.js';
import {
  BotAvatar, Button, ConfirmModal, ErrorNotice, Gate, KeyValue, Modal, Pill, Segmented, Skeleton, Stat, TextInput,
} from '../../ui/index.js';

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

const csvCell = (v) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replaceAll('"', '""')}"` : String(v ?? ''));

export function MissionDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const mission = useAsync((signal) => api(`/missions/${id}`, { signal }), id);
  const [tab, setTab] = useState('summary');
  const [focus, setFocus] = useState('all');
  const [dialog, setDialog] = useState(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const m = mission.data;

  const robots = useMemo(() => (m?.robots ?? []).map((r) => ({ ns: r.robot_ns, display_name: r.display_name, color: r.color, ...r })), [m]);
  if (mission.error?.status === 403 || mission.error?.status === 404) {
    return <main className="wrap page"><Gate icon="lock" title={mission.error.status === 404 ? 'ไม่พบภารกิจนี้' : 'ภารกิจนี้เป็นของผู้ใช้อื่น'} action={<Button to="/console/history">กลับไปประวัติ</Button>} /></main>;
  }
  if (!m) return <main className="wrap page"><ErrorNotice error={mission.error} onRetry={mission.reload} /><Skeleton height={40} width="40%" /><Skeleton height={360} /></main>;

  const mine = m.user_id === user?.id;
  const result = RESULT[m.result];
  const logs = focus === 'all' ? m.log : m.log.filter((l) => l.ns === focus);
  const pickOptions = [{ value: 'all', label: 'ทุกตัว' }, ...robots.map((r) => ({ value: r.robot_ns, label: r.display_name, dot: r.color }))];

  const rename = async () => {
    setBusy(true);
    try {
      mission.setData(await api(`/missions/${m.id}`, { method: 'PATCH', body: { map_name: name.trim() || null } }));
      toast('ตั้งชื่อแผนที่แล้ว');
      setDialog(null);
    } catch (error) { toast(error.message, 'err'); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api(`/missions/${m.id}`, { method: 'DELETE' });
      toast(`ลบภารกิจ #${m.id} แล้ว`);
      navigate(mine ? '/console/history' : '/admin/missions');
    } catch (error) { toast(error.message, 'err'); setBusy(false); }
  };

  return (
    <main className="wrap page">
      <Button size="sm" icon="back" onClick={() => navigate(-1)} style={{ alignSelf: 'flex-start' }}>กลับ</Button>
      <div className="page-head">
        <div className="sp col" style={{ gap: 6 }}>
          <span className="k">ภารกิจ · ซิม · <span className="M">{m.world}</span>{!mine ? ` · ของ ${m.user_name}` : ''}</span>
          <div className="row wrapr"><h1>#{m.id}</h1><Pill tone={result.tone}>{result.label}</Pill>{m.map_name ? <Pill tone="blue">{m.map_name}</Pill> : null}</div>
          <span className="muted">{fmtDateTime(m.started_at)} · ใช้เวลา {fmtDuration(m.duration_s)}</span>
        </div>
        <div className="row wrapr">
          {mine ? <Button icon="edit" onClick={() => { setName(m.map_name ?? ''); setDialog('rename'); }}>ตั้งชื่อแผนที่</Button> : null}
          <Button icon="dl" onClick={() => download(`mission-${m.id}-map.json`, JSON.stringify(m.map, null, 2), 'application/json')}>map.json</Button>
          <Button variant="ghostDanger" icon="trash" onClick={() => setDialog('delete')}>ลบ</Button>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {[['summary', 'สรุป'], ['map', 'แผนที่'], ['log', `Log (${m.log.length})`]].map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>
      {tab !== 'summary' ? <Segmented label="เลือกหุ่น" value={focus} onChange={setFocus} options={pickOptions} /> : null}
      {tab === 'summary' ? (
        <>
          <div className="grid g4">
            <Stat label="ผล" value={result.label} tone={result.tone === 'red' ? 'red-ink' : result.tone} />
            <Stat label="เวลา" value={fmtDuration(m.duration_s)} />
            <Stat label="ทางแยก" value={m.junction_count} />
            <Stat label="ทางตัน" value={m.dead_end_count} tone="red-ink" />
          </div>
          <div className="grid g2 stack-m" style={{ alignItems: 'start' }}>
            <section className="card pad col">
              <h2>หุ่นแต่ละตัว</h2>
              {robots.map((r) => (
                <div key={r.robot_ns} className="row" style={{ borderTop: '1px solid var(--line-2)', paddingTop: 10 }}>
                  <BotAvatar robot={{ ns: r.robot_ns, color: r.color }} />
                  <div className="sp"><strong>{r.display_name}</strong><div className="muted small">ระยะที่วิ่ง {r.distance_m.toFixed(2)} ม.</div></div>
                  {r.reached_goal_at ? <Pill tone="go">ถึงเป้าหมาย</Pill> : <Pill tone="gray">ไม่ถึง</Pill>}
                </div>
              ))}
            </section>
            <section className="card pad col">
              <h2>สภาพแวดล้อม</h2>
              <KeyValue label="สนาม"><span className="M">{m.world}</span></KeyValue>
              <KeyValue label="จำนวนหุ่น">{m.robot_count} ตัว</KeyValue>
              <KeyValue label="commit โค้ดหุ่น"><span className="M">{m.env.code_commit ?? '—'}</span></KeyValue>
              <KeyValue label="branch"><span className="M">{m.env.code_branch ?? '—'}</span></KeyValue>
              <KeyValue label="Gazebo">{m.env.headless ? 'headless' : 'มีหน้าต่าง'}</KeyValue>
              <KeyValue label="จบเพราะ">{m.env.end_reason === 'crashed' ? 'ซิมหยุดเอง' : 'กดจบภารกิจ'}</KeyValue>
            </section>
          </div>
        </>
      ) : null}
      {tab === 'map' ? <section className="card tight col"><MazeMap map={m.map} focus={focus} label={`แผนที่ภารกิจ #${m.id}`} colors={Object.fromEntries(robots.map((r) => [r.robot_ns, r.color]))} /><MapLegend /></section> : null}
      {tab === 'log' ? (
        <section className="card tight col">
          <div className="row"><span className="sp muted small">{logs.length} รายการ · เวลานับจากเริ่มภารกิจ</span>
            <Button size="sm" icon="dl" onClick={() => download(`mission-${m.id}-log.csv`, `﻿t,robot,level,kind,message\n${m.log.map((l) => [l.t, l.ns, l.level, l.kind, l.msg].map(csvCell).join(',')).join('\n')}`, 'text/csv')}>CSV</Button></div>
          <LogList items={logs} emptyText="ไม่มี log ของหุ่นตัวนี้" />
        </section>
      ) : null}
      {dialog === 'rename' ? (
        <Modal title="ตั้งชื่อแผนที่" onClose={() => setDialog(null)} actions={<><Button onClick={() => setDialog(null)}>ยกเลิก</Button><Button variant="primary" loading={busy} onClick={rename}>บันทึก</Button></>}>
          <TextInput label="ชื่อแผนที่" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} hint="เว้นว่างเพื่อลบชื่อ" />
        </Modal>
      ) : null}
      {dialog === 'delete' ? (
        <ConfirmModal title={`ลบภารกิจ #${m.id}?`} danger confirmLabel="ลบ" busy={busy} onConfirm={remove} onClose={() => setDialog(null)}>
          <p>ภารกิจจะหายจากประวัติ{!mine ? ` ของ ${m.user_name}` : ''} การลบถูกบันทึกใน Audit log</p>
        </ConfirmModal>
      ) : null}
    </main>
  );
}
