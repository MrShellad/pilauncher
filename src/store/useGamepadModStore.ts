import { create } from 'zustand';

interface GamepadModInfo {
  id: string;
  name: string;
  slug: string;
  fileName: string;
  downloadUrl: string;
}

interface GamepadModStore {
  isOpen: boolean;
  instanceId: string | null;
  modInfo: GamepadModInfo | null;
  promptDownload: (instanceId: string, modInfo: GamepadModInfo) => Promise<boolean>;
  resolvePrompt: (shouldDownload: boolean) => void;
  closePrompt: () => void;
}

export const useGamepadModStore = create<GamepadModStore>((set, get) => ({
  isOpen: false,
  instanceId: null,
  modInfo: null,
  resolvePrompt: () => {}, // placeholder
  
  promptDownload: (instanceId, modInfo) => {
    return new Promise((resolve) => {
      set({
        isOpen: true,
        instanceId,
        modInfo,
        resolvePrompt: Object.assign((shouldDownload: boolean) => {
          set({ isOpen: false });
          resolve(shouldDownload);
        }, { _isResolver: true })
      });
    });
  },
  
  closePrompt: () => {
    const { resolvePrompt } = get();
    resolvePrompt(false);
  }
}));
