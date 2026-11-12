import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button.jsx';

function useEscape(onClose) {
  useEffect(() => {
    const handler = (event) => { if (event.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
}

function useFocusFirst(ref) {
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector('input, select, textarea, button:not([aria-label="ปิด"])')?.focus();
    return () => previous?.focus?.();
  }, [ref]);
}

export function Modal({ title, children, onClose, actions, labelledBy }) {
  const ref = useRef(null);
  useEscape(onClose);
  useFocusFirst(ref);
  return createPortal(
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy ?? 'modal-title'} ref={ref}>
        <h2 id="modal-title">{title}</h2>
        {children}
        {actions ? <div className="actions">{actions}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ title, children, onClose }) {
  const ref = useRef(null);
  useEscape(onClose);
  useFocusFirst(ref);
  return createPortal(
    <>
      <div className="drawer-ov" onMouseDown={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="row"><h2 className="sp">{title}</h2><Button iconOnly icon="x" label="ปิด" onClick={onClose} /></div>
        {children}
      </aside>
    </>,
    document.body,
  );
}

/** Two-button confirmation; `danger` makes the confirm button red. */
export function ConfirmModal({ title, children, confirmLabel = 'ยืนยัน', danger = false, busy = false, onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose} actions={(
      <>
        <Button onClick={onClose}>ยกเลิก</Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={onConfirm}>{confirmLabel}</Button>
      </>
    )}>
      {children}
    </Modal>
  );
}
