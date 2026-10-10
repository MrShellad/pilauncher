import type * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type AnimationPreset = 'idle' | 'idle_sub_1' | 'idle_sub_2' | 'idle_sub_3' | 'interact';
export type AnimationLoopMode = 'repeat' | 'once';
export type SkinModelVariant = 'classic' | 'slim';
export type BackEquipmentVariant = 'cape' | 'elytra';

export interface CustomAnimationOptions {
  loop?: AnimationLoopMode;
  randomIdle?: boolean;
  weight?: number;
}

export interface ImportAnimationOptions extends CustomAnimationOptions {
  id?: string;
  clipName?: string;
}

export interface SkinEngineOptions {
  defaultSkinUrl?: string;
  targetFps?: number;
  idleFps?: number;
  width?: number;
  height?: number;
  enableRandomIdle?: boolean;
  randomIdleInterval?: [number, number];
}

export interface SkinEngineRaw {
  controls: OrbitControls;
  playerWrapper: THREE.Group;
  render: () => void;
  canvas: HTMLCanvasElement;
}
