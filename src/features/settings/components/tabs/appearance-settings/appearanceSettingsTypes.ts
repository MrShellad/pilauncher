import type { MouseEvent } from 'react';

import type { AppearanceSettings } from '@/types/settings';

export type UpdateAppearanceSetting = <K extends keyof AppearanceSettings>(
  key: K,
  value: AppearanceSettings[K],
) => void;

export type AppearanceArrowHandler = (direction: string) => boolean | void;

export interface PanoramaSetInfo {
  name: string;
  directory: string;
  faces: string[];
}

export interface AppearanceNewsCover {
  version: string;
}

export type AppearanceImageAction = (event?: MouseEvent) => void;
