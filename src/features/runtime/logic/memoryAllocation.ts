import type { MemoryAllocationMode, SystemMemoryStats } from '../../../types/memory';

export const MEMORY_STEP_MB = 512;
export const MIN_MEMORY_MB = 1024;
export const DEFAULT_MIN_MEMORY_MB = 1024;
export const MAX_INITIAL_MEMORY_MB = 8192;
const INITIAL_MEMORY_RATIO = 0.45;

export type MemoryPressureLevel = 'normal' | 'warning' | 'danger';
export type MemoryJvmProfile = 'small-heap' | 'standard-g1gc' | 'large-heap';

export interface MemoryAllocationInput {
  requestedMaxMemory: number;
  requestedMinMemory?: number;
  mode: MemoryAllocationMode;
}

export interface MemoryAllocationPlan {
  total: number;
  available: number;
  recommended: number;
  safeLimit: number;
  totalHardLimit: number;
  availableHardLimit: number;
  hardLimit: number;
  requestedMaxMemory: number;
  requestedMinMemory: number;
  effectiveMaxMemory: number;
  effectiveMinMemory: number;
  sliderMax: number;
  profile: MemoryJvmProfile;
  pressureLevel: MemoryPressureLevel;
  safeLimited: boolean;
  hardLimited: boolean;
}

const normalizeStat = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return MIN_MEMORY_MB;
  }

  return Math.max(MIN_MEMORY_MB, Math.round(value));
};

const roundDownToStep = (value: number, step = MEMORY_STEP_MB) => {
  if (!Number.isFinite(value) || value <= 0) {
    return MIN_MEMORY_MB;
  }

  return Math.max(MIN_MEMORY_MB, Math.floor(value / step) * step);
};

const clamp = (value: number, min: number, max: number) => {
  if (max < min) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
};

export const resolveInitialMemory = (maxMemoryMb: number) => {
  return clamp(
    roundDownToStep(maxMemoryMb * INITIAL_MEMORY_RATIO),
    MIN_MEMORY_MB,
    Math.min(maxMemoryMb, MAX_INITIAL_MEMORY_MB),
  );
};

export const getJvmProfileForMemory = (memoryMb: number): MemoryJvmProfile => {
  if (memoryMb < 4096) {
    return 'small-heap';
  }

  if (memoryMb > 12288) {
    return 'large-heap';
  }

  return 'standard-g1gc';
};

export const resolveMemoryAllocationPlan = (
  stats: SystemMemoryStats,
  input: MemoryAllocationInput,
): MemoryAllocationPlan => {
  const total = normalizeStat(stats.total);
  const available = normalizeStat(stats.available);

  const totalHardLimit = roundDownToStep(total * 0.8);
  const availableHardLimit = roundDownToStep(available * 0.8);
  const hardLimit = Math.max(MIN_MEMORY_MB, Math.min(totalHardLimit, availableHardLimit));

  const recommended = clamp(roundDownToStep(total * 0.6), MIN_MEMORY_MB, totalHardLimit);
  const safeLimit = clamp(roundDownToStep(available * 0.7), MIN_MEMORY_MB, availableHardLimit);

  const requestedMaxMemory = clamp(
    roundDownToStep(input.requestedMaxMemory || MIN_MEMORY_MB),
    MIN_MEMORY_MB,
    totalHardLimit,
  );
  const requestedMinMemory = resolveInitialMemory(requestedMaxMemory);

  const effectiveMaxMemory =
    input.mode === 'auto'
      ? clamp(Math.min(recommended, safeLimit), MIN_MEMORY_MB, hardLimit)
      : input.mode === 'force'
        ? requestedMaxMemory
        : clamp(Math.min(requestedMaxMemory, safeLimit), MIN_MEMORY_MB, hardLimit);

  const effectiveMinMemory = resolveInitialMemory(effectiveMaxMemory);
  const safeLimited =
    input.mode === 'manual' && requestedMaxMemory > safeLimit && safeLimit <= hardLimit;
  const hardLimited = input.mode === 'manual' && requestedMaxMemory > hardLimit;

  const pressureLevel: MemoryPressureLevel = hardLimited
    ? 'danger'
    : safeLimited || effectiveMaxMemory > safeLimit
      ? 'warning'
      : 'normal';

  return {
    total,
    available,
    recommended,
    safeLimit,
    totalHardLimit,
    availableHardLimit,
    hardLimit,
    requestedMaxMemory,
    requestedMinMemory,
    effectiveMaxMemory,
    effectiveMinMemory,
    sliderMax: totalHardLimit,
    profile: getJvmProfileForMemory(effectiveMaxMemory),
    pressureLevel,
    safeLimited,
    hardLimited,
  };
};
