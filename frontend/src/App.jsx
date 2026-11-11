import { useEffect, useState } from 'react';

const ROBOT_NAMES = ['mbot1', 'mbot2', 'mbot3'];

function eventSummary(event) {
  const data = event?.data || {};
  return data.message || data.reason || data.status || data.type || event?.type || 'ได้รับข้อมูลจาก ROS 2';
}

function formatNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '—';
}

function App() {
  const [snapshot, setSnapshot] = useState(null);
  const [connection, setConnection] = useState('connecting');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let socket;
    let retryTimer;

    async function loadInitial() {
      try {
        const [healthResponse, teamResponse, eventsResponse] = await Promise.all([
          fetch('/api/health'), fetch('/api/team'), fetch('/api/events?limit=30'),
        ]);
        if (![healthResponse, teamResponse, eventsResponse].every((response) => response.ok)) {
          throw new Error('Backend API ไม่พร้อมใช้งาน');
        }
        const [health, team, events] = await Promise.all([
          healthResponse.json(), teamResponse.json(), eventsResponse.json(),
        ]);
        if (active) {
          setSnapshot({ health, team, events: events.items || [] });
          setError('');
        }
      } catch (cause) {
        if (active) setError(cause.message);
      }
    }

    function connect() {
      if (!active) return;
      setConnection('connecting');
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
      socket = new WebSocket(`${scheme}://${window.location.host}/ws/telemetry`);
      socket.onopen = () => {
        if (active) {
          setConnection('connected');
          setError('');
        }
      };
      socket.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          if (active) setSnapshot(data);
        } catch {
          if (active) setError('ข้อมูลจาก backend ไม่ถูกต้อง');
        }
      };
      socket.onclose = () => {
        if (!active) return;
        setConnection('disconnected');
        setError('การเชื่อมต่อสดหลุด กำลังเชื่อมใหม่…');
        retryTimer = window.setTimeout(connect, 2000);
      };
      socket.onerror = () => socket.close();
    }

    loadInitial();
    connect();
    return () => {
      active = false;
      window.clearTimeout(retryTimer);
      socket?.close();
    };
  }, []);

  const health = snapshot?.health || {};
  const team = snapshot?.team?.data || {};
  const robots = team.robots || {};
  const junctions = Array.isArray(team.junctions) ? team.junctions : [];
  const events = Array.isArray(snapshot?.events) ? [...snapshot.events].reverse() : [];
  const fresh = Boolean(health.team_state_fresh);

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <div className="eyebrow">MBOT2 · ROS 2 HUMBLE</div>
          <h1>Mission Monitor</h1>
          <p>ดูสถานะทีมสำรวจเขาวงกตจาก Gazebo แบบเรียลไทม์</p>
        </div>
        <div className={`status-pill ${connection === 'connected' && fresh ? 'online' : 'offline'}`}>
          <span className="dot" />
          {connection !== 'connected' ? 'กำลังเชื่อมต่อ backend' : fresh ? 'ข้อมูลสด' : 'รอข้อมูล ROS 2'}
        </div>
      </header>

      {error && <div className="notice" role="alert">{error}</div>}

      <section className="metrics" aria-label="ภาพรวมภารกิจ">
        <div className="metric"><span>หุ่นที่รายงานตัว</span><strong>{Object.keys(robots).length}</strong><small>จาก {ROBOT_NAMES.length} ตัว</small></div>
        <div className="metric"><span>ทางแยกที่ค้นพบ</span><strong>{junctions.length}</strong><small>ข้อมูลที่หุ่นสำรวจพบ</small></div>
        <div className="metric"><span>เป้าหมาย</span><strong className="goal-state">{team.goal ? 'พบแล้ว' : 'ยังไม่พบ'}</strong><small>{team.goal ? `โดย ${team.goal.robot || 'หุ่นในทีม'}` : 'กำลังสำรวจ'}</small></div>
      </section>

      <div className="columns">
        <section className="panel">
          <div className="panel-heading"><h2>สถานะหุ่นยนต์</h2><span>ROBOT FLEET</span></div>
          <div className="robot-list">
            {ROBOT_NAMES.map((name, index) => {
              const robot = robots[name];
              return (
                <article className="robot-card" key={name}>
                  <div className="robot-icon">0{index + 1}</div>
                  <div className="robot-details">
                    <div className="robot-title"><h3>{name.toUpperCase()}</h3><span className={robot ? 'tag active' : 'tag'}>{robot ? robot.state || 'ACTIVE' : 'WAITING'}</span></div>
                    <p>{robot ? `ตำแหน่ง x ${formatNumber(robot.x)} · y ${formatNumber(robot.y)} เมตร` : 'ยังไม่มีข้อมูลตำแหน่งจาก ROS 2'}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading"><h2>ภารกิจและแผนที่</h2><span>DISCOVERY</span></div>
          {team.goal ? (
            <div className="goal-card"><span>GOAL FOUND</span><strong>เป้าหมายที่ ({formatNumber(team.goal.x)}, {formatNumber(team.goal.y)})</strong><small>ผู้พบ: {team.goal.robot || 'ไม่ระบุ'}</small></div>
          ) : (
            <div className="empty-card">ยังไม่พบเป้าหมายสีเขียว เมื่อหุ่นพบแล้วพิกัดจะแสดงที่นี่</div>
          )}
          <h3 className="subheading">ทางแยกที่รู้จัก</h3>
          {junctions.length === 0 ? <p className="muted">ยังไม่มีรายงานทางแยก</p> : (
            <div className="junction-list">{junctions.map((junction) => (
              <div className="junction" key={junction.id}>
                <span>แยก #{junction.id}</span>
                <span>x {formatNumber(junction.x)} · y {formatNumber(junction.y)}</span>
              </div>
            ))}</div>
          )}
        </section>
      </div>

      <section className="panel event-panel">
        <div className="panel-heading"><h2>บันทึกเหตุการณ์</h2><span>LIVE ACTIVITY</span></div>
        {events.length === 0 ? <p className="muted">ยังไม่มีเหตุการณ์ รอข้อมูลจากหุ่นยนต์…</p> : (
          <ul className="event-list">{events.map((event) => (
            <li key={event.id}>
              <span className="event-time">{event.received_at ? new Date(event.received_at).toLocaleTimeString('th-TH') : '—'}</span>
              <span className="event-robot">{event.robot || 'team'}</span>
              <span className="event-text">{String(eventSummary(event))}</span>
            </li>
          ))}</ul>
        )}
      </section>
      <footer>ข้อมูลจาก ROS 2 ผ่าน backend แบบอ่านอย่างเดียว · ไม่ส่งคำสั่งขับไปยังหุ่นยนต์</footer>
    </main>
  );
}

export default App;
