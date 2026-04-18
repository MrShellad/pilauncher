import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WardrobeProfile } from '../features/wardrobe/types';

interface WardrobeState {
  profiles: Record<string, WardrobeProfile>;
  setProfile: (uuid: string, profile: WardrobeProfile) => void;
  getProfile: (uuid: string) => WardrobeProfile | undefined;
}

export const useWardrobeStore = create<WardrobeState>()(
  persist(
    (set, get) => ({
      profiles: {},
      setProfile: (uuid, profile) =>
        set((state) => ({
          profiles: {
            ...state.profiles,
            [uuid]: profile,
          },
        })),
      getProfile: (uuid) => get().profiles[uuid],
    }),
    {
      name: 'wardrobe-storage',
    }
  )
);
