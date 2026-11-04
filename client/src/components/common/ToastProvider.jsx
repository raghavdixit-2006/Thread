// components/common/ToastProvider.jsx - transient feedback for actions that
// otherwise complete silently (wishlist toggle, bag changes). One live region,
// max three visible, auto-dismiss with a manual close for anything longer.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

let nextId = 1;

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}

function ToastItem({ toast, onDismiss }) {
  return (
    <div className={`toast toast-${toast.tone}`} role="status">
      <i
        className={`bi ${toast.tone === 'error' ? 'bi-exclamation-circle' : 'bi-check-circle'} toast-icon`}
        aria-hidden="true"
      />
      <p className="toast-message">{toast.message}</p>
      <button type="button" className="toast-close" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
        <i className="bi bi-x" aria-hidden="true" />
      </button>
    </div>
  );
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message, tone = 'success', duration = 3600) => {
      if (!message) return null;
      const id = nextId++;
      setToasts((current) => [...current.slice(-2), { id, message, tone }]);
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss],
  );

  useEffect(
    () => () => {
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current.clear();
    },
    [],
  );

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
