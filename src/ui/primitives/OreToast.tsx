// src/ui/primitives/OreToast.tsx
import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

import { useToastStore, type ToastItem, type ToastTone } from '../../store/useToastStore';

/* ─── tone → visual map ─── */
const toneConfig: Record<ToastTone, { icon: React.ReactNode; accent: string; bg: string; border: string }> = {
  success: {
    icon: <CheckCircle2 size={18} />,
    accent: 'text-emerald-400',
    bg: 'bg-emerald-950/95',
    border: 'border-emerald-700/60',
  },
  error: {
    icon: <XCircle size={18} />,
    accent: 'text-red-400',
    bg: 'bg-red-950/95',
    border: 'border-red-700/60',
  },
  warning: {
    icon: <AlertTriangle size={18} />,
    accent: 'text-amber-400',
    bg: 'bg-amber-950/95',
    border: 'border-amber-700/60',
  },
  info: {
    icon: <Info size={18} />,
    accent: 'text-sky-400',
    bg: 'bg-sky-950/95',
    border: 'border-sky-700/60',
  },
};

/* ─── Single Toast Item ─── */
const ToastEntry: React.FC<{ item: ToastItem }> = ({ item }) => {
  const removeToast = useToastStore((s) => s.removeToast);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const cfg = toneConfig[item.tone];

  useEffect(() => {
    // mount → slide in
    requestAnimationFrame(() => setVisible(true));

    timerRef.current = window.setTimeout(() => {
      setExiting(true);
    }, item.durationMs);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [item.durationMs]);

  useEffect(() => {
    if (!exiting) return;
    const t = window.setTimeout(() => removeToast(item.id), 340);
    return () => window.clearTimeout(t);
  }, [exiting, item.id, removeToast]);

  const dismiss = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    setExiting(true);
  };

  return (
    <div
      className={`
        pointer-events-auto flex items-start gap-3 rounded border-2 px-4 py-3
        font-minecraft text-sm text-white shadow-lg
        transition-all duration-300 ease-out
        ${cfg.bg} ${cfg.border}
        ${visible && !exiting ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
      `}
      style={{ minWidth: '280px', maxWidth: '420px' }}
    >
      <span className={`mt-0.5 flex-shrink-0 ${cfg.accent}`}>{cfg.icon}</span>
      <span className="flex-1 leading-snug">{item.message}</span>
      <button
        onClick={dismiss}
        className="mt-0.5 flex-shrink-0 cursor-pointer text-white/50 transition-colors hover:text-white"
      >
        <X size={14} />
      </button>
    </div>
  );
};

/* ─── Toast Container (mount once near root) ─── */
export const OreToastContainer: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[9999] flex flex-col items-center gap-2">
      {toasts.map((t) => (
        <ToastEntry key={t.id} item={t} />
      ))}
    </div>
  );
};
