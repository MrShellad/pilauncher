import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

import type { OnlineServer } from '../features/multiplayer/types';

export type TabType =
  | 'home'
  | 'news'
  | 'instances'
  | 'multiplayer'
  | 'downloads'
  | 'library'
  | 'settings'
  | 'new-instance'
  | 'instance-detail'
  | 'instance-mod-download';

export type DetailTabType =
  | 'overview'
  | 'basic'
  | 'java'
  | 'saves'
  | 'mods'
  | 'resourcepacks'
  | 'shaders'
  | 'export';

export type InstanceDownloadTarget = 'mod' | 'resourcepack' | 'shader';

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

interface LauncherState {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;

  unreadNewsCount: number;
  setUnreadNewsCount: (count: number) => void;

  currentInstance: InstanceData | null;
  setInstance: (instance: InstanceData | null) => void;

  selectedInstanceId: string | null;
  setSelectedInstanceId: (id: string | null) => void;

  pendingServerBinding: OnlineServer | null;
  setPendingServerBinding: (server: OnlineServer | null) => void;

  instanceDetailTab: DetailTabType;
  setInstanceDetailTab: (tab: DetailTabType) => void;

  instanceDownloadTarget: InstanceDownloadTarget;
  setInstanceDownloadTarget: (target: InstanceDownloadTarget) => void;

  background: BackgroundData;
  setBackground: (bgUpdate: Partial<BackgroundData>) => void;

  launchGame: () => Promise<void>;
}

const initialBackground: BackgroundData = {
  type: 'image',
  source: '/assets/home/wallpaer/1.webp',
  overlayColor: '#000000',
  overlayOpacity: 0.5,
  overlayBlur: 4,
};

export const useLauncherStore = create<LauncherState>()(
  subscribeWithSelector((set, get) => ({
    activeTab: 'home',
    setActiveTab: (tab) => set({ activeTab: tab }),

    unreadNewsCount: 4,
    setUnreadNewsCount: (count) => set({ unreadNewsCount: count }),

    currentInstance: {
      id: '1',
      name: 'Survival 1.20.4',
      playTime: 124.5,
      lastPlayed: '2026-02-23',
    },
    setInstance: (instance) => set({ currentInstance: instance }),

    selectedInstanceId: null,
    setSelectedInstanceId: (id) => set({ selectedInstanceId: id }),

    pendingServerBinding: null,
    setPendingServerBinding: (server) => set({ pendingServerBinding: server }),

    instanceDetailTab: 'overview',
    setInstanceDetailTab: (tab) => set({ instanceDetailTab: tab }),

    instanceDownloadTarget: 'mod',
    setInstanceDownloadTarget: (target) => set({ instanceDownloadTarget: target }),

    background: initialBackground,
    setBackground: (bgUpdate) =>
      set((state) => ({
        background: {
          ...state.background,
          ...bgUpdate,
        },
      })),

    launchGame: async () => {
      const { currentInstance } = get();

      if (!currentInstance) {
        console.warn('Cannot launch game: no instance is selected.');
        return;
      }

      console.warn(
        '[LauncherStore] launchGame is only a mock state action. Use the useGameLaunch hook for the real launch flow.',
      );
      console.log(
        `[Tauri IPC Mock] Pretend launching ${currentInstance.name} (ID: ${currentInstance.id})...`,
      );
    },
  })),
);
