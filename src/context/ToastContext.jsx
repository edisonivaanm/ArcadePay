import { createContext, useCallback, useContext, useState } from 'react';
import { createPortal } from 'react-dom';

const ToastContext = createContext(null);

const ICONS = { success: '✅', error: '❌', info: 'ℹ️' };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type, leaving: false }]);

    // Start exit animation slightly before removal
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
      );
    }, duration - 400);

    // Remove from DOM
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {createPortal(
        <div style={{
          position: 'fixed', bottom: '2rem', left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '0.6rem', zIndex: 99999, pointerEvents: 'none',
        }}>
          {toasts.map((t) => (
            <div
              key={t.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.75rem 1.25rem',
                background: t.type === 'error'
                  ? 'linear-gradient(135deg,#7f1d1d,#991b1b)'
                  : 'linear-gradient(135deg,#064e3b,#065f46)',
                border: `1px solid ${t.type === 'error' ? '#ef444455' : '#10b98155'}`,
                borderRadius: '999px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
                backdropFilter: 'blur(12px)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.92rem',
                whiteSpace: 'nowrap',
                animation: t.leaving
                  ? 'toastOut 0.35s ease forwards'
                  : 'toastIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
                pointerEvents: 'auto',
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>{ICONS[t.type]}</span>
              {t.message}
            </div>
          ))}
        </div>,
        document.body
      )}

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(16px) scale(0.92); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes toastOut {
          from { opacity: 1; transform: translateY(0)   scale(1);    }
          to   { opacity: 0; transform: translateY(8px) scale(0.95); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
