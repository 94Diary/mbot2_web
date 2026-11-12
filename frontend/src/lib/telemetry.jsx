import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

const MAX_LOGS = 1000;
const MAX_LINES = 400;
const RETRY_MS = 2000;
const TelemetryContext = createContext(null);

const EMPTY_SNAPSHOT = {
  health: null,
  sim: { state: 'idle', steps: {}, world: null, robots: 0, started_at: null, error: null },
  mission: { phase: 'idle', goal_at: {} },
  map: { junctions: [], dead_ends: [], paths: {}, robots: {}, goal: null },
};

/**
 * One WebSocket for the whole console: live snapshot (sim, mission, map, health),
 * the robot log, and the Terminal lines of the running command.
 */
export function TelemetryProvider({ children }) {
  const [connection, setConnection] = useState('connecting');
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [logs, setLogs] = useState([]);
  const [lines, setLines] = useState([]);
  const [lastDataAt, setLastDataAt] = useState(null);
  // null = ยังไม่เคยเห็น snapshot (เพิ่งต่อ) จึงไม่ล้าง log ที่ได้จาก hello
  const lastSim = useRef(null);

  useEffect(() => {
    let active = true;
    let socket;
    let retry;

    const connect = () => {
      if (!active) return;
      setConnection((c) => (c === 'connected' ? 'reconnecting' : c));
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
      socket = new WebSocket(`${scheme}://${window.location.host}/ws/telemetry`, ['mbot2.telemetry.v1']);
      socket.onopen = () => active && setConnection('connected');
      socket.onmessage = (event) => {
        if (!active) return;
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === 'hello') {
          lastSim.current = null;
          setLogs(message.logs ?? []);
          setLines(message.lines ?? []);
        } else if (message.type === 'log') {
          setLogs((list) => [...list, ...message.items].slice(-MAX_LOGS));
        } else if (message.type === 'simlog') {
          setLines((list) => [...list, ...message.lines].slice(-MAX_LINES));
        } else if (message.type === 'snapshot') {
          // ซิมใหม่เริ่ม: ล้าง log/Terminal ของรอบก่อน
          if (lastSim.current === 'idle' && message.sim.state !== 'idle') {
            setLogs([]);
            setLines((list) => list.slice(-20));
          }
          lastSim.current = message.sim.state;
          setSnapshot(message);
          if (message.health?.team_state_fresh) setLastDataAt(Date.now());
        }
      };
      socket.onclose = (event) => {
        if (!active) return;
        setConnection(event.code === 4401 ? 'ended' : 'disconnected');
        if (event.code !== 4401) retry = setTimeout(connect, RETRY_MS);
      };
      socket.onerror = () => socket.close();
    };
    connect();
    return () => {
      active = false;
      clearTimeout(retry);
      socket?.close();
    };
  }, []);

  const value = useMemo(() => ({ connection, ...snapshot, logs, lines, lastDataAt }), [connection, snapshot, logs, lines, lastDataAt]);
  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
}

export function useTelemetry() {
  const value = useContext(TelemetryContext);
  if (!value) throw new Error('useTelemetry must be used inside <TelemetryProvider>');
  return value;
}

export const SIM_ACTIVE = new Set(['building', 'launching', 'running', 'stopping']);
