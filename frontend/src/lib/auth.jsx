import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, permissions: [] });

  const refresh = useCallback(async () => {
    try {
      const me = await api('/me');
      setState({ loading: false, user: me.user, permissions: me.permissions });
    } catch {
      setState({ loading: false, user: null, permissions: [] });
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => ({
    ...state,
    can: (key) => state.permissions.includes(key),
    isAdmin: state.permissions.includes('admin.access'),
    async login(email, password) {
      const me = await api('/auth/login', { method: 'POST', body: { email, password } });
      setState({ loading: false, user: me.user, permissions: me.permissions });
      return me.user;
    },
    async register(body) {
      const me = await api('/auth/register', { method: 'POST', body });
      setState({ loading: false, user: me.user, permissions: me.permissions });
      return me.user;
    },
    async logout() {
      await api('/auth/logout', { method: 'POST' }).catch(() => {});
      setState({ loading: false, user: null, permissions: [] });
    },
    refresh,
  }), [state, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

export const ROLE_LABEL = { member: 'สมาชิก', admin: 'ผู้ดูแล', owner: 'เจ้าของระบบ', guest: 'ผู้เยี่ยมชม' };

export function roleOf(user) {
  if (!user) return 'guest';
  if (user.role === 'admin') return user.is_owner ? 'owner' : 'admin';
  return 'member';
}
