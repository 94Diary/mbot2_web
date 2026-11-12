import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { useAuth } from './auth.jsx';

export const DEFAULT_ROBOTS = {
  mbot1: { display_name: 'MBOT-1', color: '#FF6B1A' },
  mbot2: { display_name: 'MBOT-2', color: '#1B9BD1' },
  mbot3: { display_name: 'MBOT-3', color: '#B6E33C' },
};
export const SWATCHES = ['#FF6B1A', '#1B9BD1', '#B6E33C', '#8B7CF6', '#FF5FA2', '#2EC4B6', '#FFD23F', '#E5484D'];

const RobotContext = createContext(null);

/** Per-user robot display names and colours (web only; ROS namespaces never change). */
export function RobotPrefsProvider({ children }) {
  const { user, can } = useAuth();
  const [prefs, setPrefs] = useState({});

  useEffect(() => {
    if (!user || !can('history.own')) { setPrefs({}); return; }
    api('/me/robot-prefs').then(setPrefs).catch(() => setPrefs({}));
  }, [user, can]);

  const save = useCallback(async (next) => {
    const saved = await api('/me/robot-prefs', { method: 'PUT', body: next });
    setPrefs(saved);
    return saved;
  }, []);

  const value = useMemo(() => {
    const robot = (ns) => ({ ns, ...(DEFAULT_ROBOTS[ns] ?? { display_name: ns.toUpperCase(), color: '#8B7CF6' }), ...(prefs[ns] ?? {}) });
    return { prefs, save, robot };
  }, [prefs, save]);
  return <RobotContext.Provider value={value}>{children}</RobotContext.Provider>;
}

export function useRobots() {
  return useContext(RobotContext);
}

export const robotIndex = (ns) => Number(String(ns).replace(/\D/g, '')) || 0;
