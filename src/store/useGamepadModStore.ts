import { create } from 'zustand';

interface GamepadModInfo {
  id: string;
  name: string;
  slug: string;
  fileName: string;
  downloadUrl: string;
}

// ✅ 弹窗模式：首次安装 / 有可用更新
type PromptMode = 'install' | 'update';

interface GamepadModStore {
  isOpen: boolean;
  instanceId: string | null;
  modInfos: GamepadModInfo[];
  promptMode: PromptMode;
  localFileName: string | null;   // 本地缓存版本文件名
  remoteFileName: string | null;  // 远端最新版本文件名
  promptDownload: (
    instanceId: string,
    modInfos: GamepadModInfo[],
    mode: PromptMode,
    localFileName?: string | null,
    remoteFileName?: string | null
  ) => Promise<GamepadModInfo | null>;
  resolvePrompt: (selectedMod: GamepadModInfo | null) => void;
  closePrompt: () => void;
}

export const useGamepadModStore = create<GamepadModStore>((set, get) => ({
  isOpen: false,
  instanceId: null,
  modInfos: [],
  promptMode: 'install',
  localFileName: null,
  remoteFileName: null,
  resolvePrompt: () => {}, // placeholder
  
  promptDownload: (instanceId, modInfos, mode, localFileName = null, remoteFileName = null) => {
    return new Promise((resolve) => {
      set({
        isOpen: true,
        instanceId,
        modInfos,
        promptMode: mode,
        localFileName,
        remoteFileName,
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
