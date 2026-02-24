// /src/store/useLauncherStore.ts
import { create } from 'zustand';

// 1. 定义全局合法的路由 Tab 类型 (在这里新增了 'new-instance')
export type TabType = 'home' | 'instances' | 'downloads' | 'settings' | 'new-instance';

export interface InstanceData {
  id: string;
  name: string;
  playTime: number; 
  lastPlayed: string; 
  logoUrl?: string;
}

export interface BackgroundData {
  type: 'solid' | 'image' | 'video';
  source: string; 
  overlayColor: string;
  overlayOpacity: number;
  overlayBlur: number;
}

// 2. 定义 Store 状态和操作方法的类型
interface LauncherState {
  // 全局导航/路由状态 (将 string 替换为严格的 TabType)
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;

  // 当前选中的游戏实例状态
  currentInstance: InstanceData | null;
  setInstance: (instance: InstanceData | null) => void;

  // 背景表现状态
  background: BackgroundData;
  setBackground: (bgUpdate: Partial<BackgroundData>) => void; 

  // 系统底层交互动作
  launchGame: () => Promise<void>;
}

// 3. 创建并导出 Zustand Store
export const useLauncherStore = create<LauncherState>((set, get) => ({
  // --- 导航状态 ---
  activeTab: 'home', 
  setActiveTab: (tab) => set({ activeTab: tab }),

  // --- 实例状态 ---
  currentInstance: {
    id: '1',
    name: 'Survival 1.20.4',
    playTime: 124.5,
    lastPlayed: '2026-02-23',
  },
  setInstance: (instance) => set({ currentInstance: instance }),

  // --- 背景状态 ---
  background: {
    type: 'image',
    source: '/assets/home/wallpaer/1.png', 
    overlayColor: '#000000',
    overlayOpacity: 0.5,
    overlayBlur: 4,
  },
  setBackground: (bgUpdate) => 
    set((state) => ({ background: { ...state.background, ...bgUpdate } })),

  // --- 系统交互动作 ---
  launchGame: async () => {
    const { currentInstance } = get();
    
    if (!currentInstance) {
      console.warn("无法启动：未选择任何实例！");
      return;
    }
    
    console.log(`[Tauri IPC Mock] 正在通过 Rust 层启动游戏: ${currentInstance.name} (ID: ${currentInstance.id})...`);
  }
}));