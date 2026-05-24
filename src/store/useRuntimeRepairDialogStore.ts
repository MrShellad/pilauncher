import { create } from 'zustand';
import type { MissingRuntime } from '../types/runtimeRepair';

interface RuntimeRepairPrompt {
  id: number;
  issues: string[];
  repair: MissingRuntime;
}

interface RuntimeRepairDialogStore {
  prompt: RuntimeRepairPrompt | null;
  promptRepair: (issues: string[], repair: MissingRuntime) => Promise<boolean>;
  resolvePrompt: (accepted: boolean) => void;
}

let nextPromptId = 1;
let pendingResolve: ((accepted: boolean) => void) | null = null;

export const useRuntimeRepairDialogStore = create<RuntimeRepairDialogStore>((set) => ({
  prompt: null,
  promptRepair: (issues, repair) =>
    new Promise<boolean>((resolve) => {
      if (pendingResolve) {
        pendingResolve(false);
      }

      pendingResolve = resolve;
      set({
        prompt: {
          id: nextPromptId,
          issues,
          repair,
        },
      });
      nextPromptId += 1;
    }),
  resolvePrompt: (accepted) => {
    const resolve = pendingResolve;
    pendingResolve = null;
    set({ prompt: null });
    resolve?.(accepted);
  },
}));
