import { useCallback, useState } from 'react';

const KEY = 'mbot2.theme';

function current() {
  return document.documentElement.classList.contains('theme-light') ? 'light' : 'dark';
}

export function useTheme() {
  const [theme, setTheme] = useState(current);
  const toggle = useCallback(() => {
    const next = current() === 'dark' ? 'light' : 'dark';
    document.documentElement.className = `theme-${next}`;
    try { localStorage.setItem(KEY, next); } catch { /* storage may be blocked */ }
    setTheme(next);
  }, []);
  return { theme, toggle };
}
