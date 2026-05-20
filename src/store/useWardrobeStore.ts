import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WardrobeProfile, WardrobeSkinLibrary } from '../features/wardrobe/types';

interface WardrobeState {
  profiles: Record<string, WardrobeProfile>;
  libraries: Record<string, WardrobeSkinLibrary>;
  setProfile: (uuid: string, profile: WardrobeProfile) => void;
  getProfile: (uuid: string) => WardrobeProfile | undefined;
  setLibrary: (uuid: string, library: WardrobeSkinLibrary) => void;
  getLibrary: (uuid: string) => WardrobeSkinLibrary | undefined;
}

export const useWardrobeStore = create<WardrobeState>()(
  persist(
    (set, get) => ({
      profiles: {},
      libraries: {},
      setProfile: (uuid, profile) =>
        set((state) => ({
          profiles: {
            ...state.profiles,
            [uuid]: profile,
          },
        })),
      getProfile: (uuid) => get().profiles[uuid],
      setLibrary: (uuid, library) =>
        set((state) => ({
          libraries: {
            ...state.libraries,
            [uuid]: library,
          },
        })),
      getLibrary: (uuid) => get().libraries[uuid],
    }),
    {
      name: 'wardrobe-storage',
    }
  )
);
