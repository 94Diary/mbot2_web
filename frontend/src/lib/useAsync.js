import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads data with a key; re-runs when the key changes. Keeps the last data while reloading
 * so tables do not flash empty between pages.
 */
export function useAsync(loader, key) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    loaderRef.current(controller.signal)
      .then((data) => !controller.signal.aborted && setState({ loading: false, data, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError' && !controller.signal.aborted) setState((s) => ({ ...s, loading: false, error }));
      });
    return () => controller.abort();
  }, []);

  useEffect(() => run(), [run, key]);
  return { ...state, reload: run, setData: (data) => setState((s) => ({ ...s, data })) };
}
