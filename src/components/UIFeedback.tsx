/**
 * UIFeedback.tsx
 * Global Toast notification + Confirm dialog system.
 * Replaces all browser alert() and confirm() calls.
 *
 * Usage:
 *   const { showToast } = useToast();
 *   showToast('Lưu thành công!', 'success');
 *
 *   const { showConfirm } = useConfirm();
 *   const ok = await showConfirm({ title: 'Xác nhận', message: 'Bạn có chắc?', danger: true });
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X, AlertOctagon } from 'lucide-react';

// ─────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export const useToast = () => useContext(ToastContext);

// ─────────────────────────────────────────────
// CONFIRM DIALOG
// ─────────────────────────────────────────────
interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  warning?: boolean;
}

interface ConfirmContextValue {
  showConfirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue>({ showConfirm: async () => false });

export const useConfirm = () => useContext(ConfirmContext);

// ─────────────────────────────────────────────
// PROVIDER (wrap your App with this)
// ─────────────────────────────────────────────
export const UIFeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    opts: ConfirmOptions;
    resolve: (val: boolean) => void;
  } | null>(null);

  // ── Toast ──
  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3500) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type, duration }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Confirm ──
  const showConfirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setConfirmState({ open: true, opts, resolve });
    });
  }, []);

  const handleConfirmClose = (result: boolean) => {
    if (confirmState) {
      confirmState.resolve(result);
      setConfirmState(null);
    }
  };

  const toastIcons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle2 size={18} />,
    error:   <XCircle size={18} />,
    warning: <AlertTriangle size={18} />,
    info:    <Info size={18} />,
  };

  const toastColors: Record<ToastType, { bg: string; border: string; color: string; progress: string }> = {
    success: { bg: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.4)', color: '#10b981', progress: '#10b981' },
    error:   { bg: 'rgba(239,68,68,0.12)',  border: '1px solid rgba(239,68,68,0.4)',  color: '#ef4444', progress: '#ef4444' },
    warning: { bg: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', progress: '#f59e0b' },
    info:    { bg: 'rgba(79,70,229,0.12)',   border: '1px solid rgba(79,70,229,0.4)',  color: 'var(--primary)', progress: 'var(--primary)' },
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      <ConfirmContext.Provider value={{ showConfirm }}>
        {children}

        {/* ══ TOAST CONTAINER (top-right) ══ */}
        <div style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          pointerEvents: 'none',
        }}>
          {toasts.map(toast => {
            const c = toastColors[toast.type];
            return (
              <div
                key={toast.id}
                style={{
                  pointerEvents: 'all',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: 'var(--bg-primary)',
                  border: c.border,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15)',
                  minWidth: 280,
                  maxWidth: 400,
                  animation: 'toastSlideIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Icon */}
                <span style={{ color: c.color, flexShrink: 0, marginTop: 1 }}>
                  {toastIcons[toast.type]}
                </span>

                {/* Message */}
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', flex: 1, lineHeight: 1.5 }}>
                  {toast.message}
                </span>

                {/* Close button */}
                <button
                  onClick={() => removeToast(toast.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: 2, flexShrink: 0,
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  <X size={14} />
                </button>

                {/* Progress bar */}
                <div style={{
                  position: 'absolute',
                  bottom: 0, left: 0,
                  height: 3,
                  background: c.progress,
                  borderRadius: '0 0 12px 12px',
                  animation: `toastProgress ${toast.duration || 3500}ms linear forwards`,
                  opacity: 0.6,
                }} />
              </div>
            );
          })}
        </div>

        {/* ══ CONFIRM DIALOG (centered) ══ */}
        {confirmState?.open && (
          <div
            onClick={() => handleConfirmClose(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(4px)',
              zIndex: 99998,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'fadeIn 0.15s ease',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--bg-primary)',
                borderRadius: 18,
                padding: '32px 36px 28px',
                maxWidth: 420,
                width: '90vw',
                boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
                animation: 'confirmPop 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                border: confirmState.opts.danger
                  ? '1px solid rgba(239,68,68,0.3)'
                  : confirmState.opts.warning
                  ? '1px solid rgba(245,158,11,0.3)'
                  : '1px solid var(--border-color)',
              }}
            >
              {/* Icon */}
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
                background: confirmState.opts.danger
                  ? 'rgba(239,68,68,0.12)'
                  : confirmState.opts.warning
                  ? 'rgba(245,158,11,0.12)'
                  : 'rgba(79,70,229,0.12)',
              }}>
                {confirmState.opts.danger ? (
                  <AlertOctagon size={28} color="#ef4444" />
                ) : confirmState.opts.warning ? (
                  <AlertTriangle size={28} color="#f59e0b" />
                ) : (
                  <Info size={28} color="var(--primary)" />
                )}
              </div>

              {/* Title */}
              {confirmState.opts.title && (
                <h3 style={{
                  fontSize: 18, fontWeight: 800, textAlign: 'center',
                  color: 'var(--text-main)', marginBottom: 10,
                }}>
                  {confirmState.opts.title}
                </h3>
              )}

              {/* Message */}
              <p style={{
                fontSize: 14, color: 'var(--text-muted)', textAlign: 'center',
                lineHeight: 1.65, marginBottom: 28,
              }}>
                {confirmState.opts.message}
              </p>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button
                  onClick={() => handleConfirmClose(false)}
                  style={{
                    padding: '10px 24px', borderRadius: 10,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-main)',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    minWidth: 100,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                >
                  {confirmState.opts.cancelText || 'Huỷ'}
                </button>
                <button
                  onClick={() => handleConfirmClose(true)}
                  style={{
                    padding: '10px 24px', borderRadius: 10, border: 'none',
                    background: confirmState.opts.danger
                      ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                      : confirmState.opts.warning
                      ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                      : 'linear-gradient(135deg, var(--primary), #6366f1)',
                    color: '#fff',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    boxShadow: confirmState.opts.danger
                      ? '0 4px 16px rgba(239,68,68,0.4)'
                      : '0 4px 16px rgba(79,70,229,0.4)',
                    transition: 'all 0.15s ease',
                    minWidth: 100,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  {confirmState.opts.confirmText || 'Đồng Ý'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Keyframe animations */}
        <style>{`
          @keyframes toastSlideIn {
            from { opacity: 0; transform: translateX(40px) scale(0.95); }
            to   { opacity: 1; transform: translateX(0) scale(1); }
          }
          @keyframes toastProgress {
            from { width: 100%; }
            to   { width: 0%; }
          }
          @keyframes confirmPop {
            from { opacity: 0; transform: scale(0.85) translateY(20px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
        `}</style>
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
};
