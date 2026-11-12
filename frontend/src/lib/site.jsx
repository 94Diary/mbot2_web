import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, onApiError } from './api.js';
import { useAuth } from './auth.jsx';

const SiteContext = createContext(null);

/** Public site settings + active announcements + maintenance state for the whole app. */
export function SiteProvider({ children }) {
  const { user } = useAuth();
  const [site, setSite] = useState({ title: 'mBot2 Maze Ops', tagline: '', registration: 'invite', maintenance: false });
  const [announcements, setAnnouncements] = useState([]);
  const [dismissed, setDismissed] = useState(() => new Set());

  const refresh = useCallback(() => {
    api('/site').then(setSite).catch(() => {});
    api('/announcements/active').then((r) => setAnnouncements(r.items)).catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh, user]);
  useEffect(() => onApiError((error) => {
    if (error.code === 'MAINTENANCE') setSite((s) => ({ ...s, maintenance: true }));
  }), []);
  useEffect(() => { document.title = site.title; }, [site.title]);

  const value = useMemo(() => ({
    site,
    announcements: announcements.filter((a) => !dismissed.has(a.id)),
    dismiss: (id) => setDismissed((s) => new Set(s).add(id)),
    refresh,
  }), [site, announcements, dismissed, refresh]);
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export const useSite = () => useContext(SiteContext);
