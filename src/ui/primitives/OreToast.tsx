// src/ui/primitives/OreToast.tsx
import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

import { useToastStore, type ToastItem, type ToastTone } from '../../store/useToastStore';

/* ─── tone → visual map ─── */
const toneConfig: Record<ToastTone, { icon: React.ReactNode; accent: string }> = {
  success: {
    icon: <CheckCircle2 size="1.5rem" />,
    accent: 'text-[#34d399]', // bright green
  },
  error: {
    icon: <XCircle size="1.5rem" />,
    accent: 'text-[#f87171]', // bright red
  },
  warning: {
    icon: <AlertTriangle size="1.5rem" />,
    accent: 'text-[#fbbf24]', // bright gold
  },
  info: {
    icon: <Info size="1.5rem" />,
    accent: 'text-[#60a5fa]', // bright blue
  },
};

/* ─── Calculate Duration ─── */
const getDuration = (item: ToastItem): number => {
  // If custom duration is provided (not store default 3000), respect it
  if (item.durationMs !== 3000) {
    return item.durationMs;
  }
  // Otherwise, use tone-based default durations:
  if (item.tone === 'success' || item.tone === 'info') {
    return 1800; // Short: 1.5s - 2.0s
  }
  if (item.tone === 'warning') {
    return 3200; // Medium: 3.0s - 3.5s
  }
  if (item.tone === 'error') {
    return 0; // Sticky / manual dismiss only
  }
  return 3000;
};

/* ─── Single Toast Item ─── */
const ToastEntry: React.FC<{ item: ToastItem }> = ({ item }) => {
  const removeToast = useToastStore((s) => s.removeToast);
  const timerRef = useRef<number | null>(null);

  const cfg = toneConfig[item.tone];

  const dismiss = () => {
    removeToast(item.id);
  };

  useEffect(() => {
    const duration = getDuration(item);
    if (duration > 0) {
      timerRef.current = window.setTimeout(() => {
        dismiss();
      }, duration);
    }

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [item]);

  return (
    <motion.div
      role={item.tone === 'error' ? 'alert' : 'status'}
      layout
      initial={{ y: 50, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 50, opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
      className="pointer-events-auto flex items-start gap-4 rounded-lg border-2 border-[#2563eb] bg-[#0b1329]/95 px-5 py-4 text-[#e0e9fe] shadow-[0_8px_32px_rgba(37,99,235,0.25)] backdrop-blur-md font-sans text-[1.25rem] leading-normal"
      style={{ minWidth: '24rem', maxWidth: '38rem' }}
    >
      <span className={`mt-0.5 flex-shrink-0 ${cfg.accent}`}>{cfg.icon}</span>
      <span className="flex-1 leading-snug break-words">
        {item.message.split('\n').map((line, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <br />}
            {line}
          </React.Fragment>
        ))}
      </span>
      <button
        onClick={dismiss}
        aria-label="关闭通知"
        className="mt-0.5 flex-shrink-0 cursor-pointer text-white/50 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
      >
        <X size="1.25rem" />
      </button>
    </motion.div>
  );
};

/* ─── Toast Container (mount once near root) ─── */
export const OreToastContainer: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div 
      role="log" 
      aria-live="polite" 
      aria-label="通知区域" 
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[9999] flex flex-col items-center gap-3"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <ToastEntry key={t.id} item={t} />
        ))}
      </AnimatePresence>
    </div>
  );
};
