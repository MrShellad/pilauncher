// src/features/Download/stores/useDownloadLayoutStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DownloadLayoutState {
  forceDoubleColumn: boolean;
  setForceDoubleColumn: (force: boolean) => void;
  toggleForceDoubleColumn: () => void;
}

export const useDownloadLayoutStore = create<DownloadLayoutState>()(
  persist(
    (set) => ({
      forceDoubleColumn: false,
      setForceDoubleColumn: (forceDoubleColumn) => set({ forceDoubleColumn }),
      toggleForceDoubleColumn: () => set((state) => ({ forceDoubleColumn: !state.forceDoubleColumn })),
    }),
    {
      name: 'pilauncher-download-layout-preferences',
    }
  )
);
