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
  modInfos: GamepadModInfo[];
  promptDownload: (instanceId: string, modInfos: GamepadModInfo[]) => Promise<GamepadModInfo | null>;
  resolvePrompt: (selectedMod: GamepadModInfo | null) => void;
  closePrompt: () => void;
}

export const useGamepadModStore = create<GamepadModStore>((set, get) => ({
  isOpen: false,
  instanceId: null,
  modInfos: [],
  resolvePrompt: () => {}, // placeholder
  
  promptDownload: (instanceId, modInfos) => {
    return new Promise((resolve) => {
      set({
        isOpen: true,
        instanceId,
        modInfos,
        resolvePrompt: Object.assign((selectedMod: GamepadModInfo | null) => {
          set({ isOpen: false });
          resolve(selectedMod);
        }, { _isResolver: true })
      });
    });
  },
  
  closePrompt: () => {
    const { resolvePrompt } = get();
    resolvePrompt(null);
  }
}));
