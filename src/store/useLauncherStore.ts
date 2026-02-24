// /src/store/useLauncherStore.ts
import { create } from 'zustand';

// 1. 定义数据结构类型
export interface InstanceData {
  id: string;
  name: string;
  playTime: number; // 单位: 小时
  lastPlayed: string; // 格式: YYYY-MM-DD
  logoUrl?: string;
}

export interface BackgroundData {
  type: 'solid' | 'image' | 'video';
  source: string; // Hex颜色、URL或本地文件路径
  overlayColor: string;
  overlayOpacity: number;
  overlayBlur: number;
}

// 2. 定义 Store 状态和操作方法的类型
interface LauncherState {
  // 全局导航/路由状态
  activeTab: string;
  setActiveTab: (tab: string) => void;

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
  activeTab: 'home', // 默认停留首页
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
    source: '/assets/bg-default.png', // 实际开发时可替换为默认背景图路径
    overlayColor: '#000000',
    overlayOpacity: 0.5,
    overlayBlur: 4,
  },
  // 支持传入部分属性进行增量更新（比如只更新 overlayBlur）
  setBackground: (bgUpdate) => 
    set((state) => ({ background: { ...state.background, ...bgUpdate } })),

  // --- 系统交互动作 ---
  launchGame: async () => {
    const { currentInstance } = get();
    
    if (!currentInstance) {
      console.warn("无法启动：未选择任何实例！");
      return;
    }
    
    // 这里预留了 Tauri v2 的 IPC 调用位置
    // 等待 Rust 后端写好后，这里会变成类似：
    // await invoke('launch_instance', { id: currentInstance.id });
    
    console.log(`[Tauri IPC Mock] 正在通过 Rust 层启动游戏: ${currentInstance.name} (ID: ${currentInstance.id})...`);
  }
}));