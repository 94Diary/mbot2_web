import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Icon } from '../ui/Icon.jsx';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const next = useRef(1);
  const push = useCallback((text, tone = 'ok') => {
    const id = next.current++;
    setItems((list) => [...list, { id, text, tone }]);
    setTimeout(() => setItems((list) => list.filter((item) => item.id !== id)), tone === 'err' ? 6000 : 3500);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`toast ${item.tone === 'err' ? 'err' : ''}`}>
            <Icon name={item.tone === 'err' ? 'x' : 'check'} size={16} />
            {item.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
