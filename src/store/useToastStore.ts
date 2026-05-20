// src/store/useToastStore.ts
import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  tone: ToastTone;
  message: string;
  durationMs: number;
}

interface ToastStore {
  toasts: ToastItem[];
  addToast: (tone: ToastTone, message: string, durationMs?: number) => void;
  removeToast: (id: string) => void;
}

let _nextId = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (tone, message, durationMs = 3000) => {
    const id = `toast-${Date.now()}-${_nextId++}`;
    const item: ToastItem = { id, tone, message, durationMs };
    set((state) => ({ toasts: [...state.toasts, item] }));
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));
