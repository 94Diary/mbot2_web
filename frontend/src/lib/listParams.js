import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Filters live in the URL so a filtered history can be bookmarked and survives refresh. */
export function useListParams(defaults) {
  const [params, setParams] = useSearchParams();
  const value = { ...defaults, ...Object.fromEntries(params) };
  const update = (patch, resetPage = true) => {
    const next = { ...value, ...patch, ...(resetPage && !('page' in patch) ? { page: 1 } : {}) };
    const clean = Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== '' && v !== undefined && String(v) !== String(defaults[k])));
    setParams(clean, { replace: true });
  };
  return [value, update];
}

export function useDebounced(value, ms = 300) {
  const [out, setOut] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setOut(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return out;
}
