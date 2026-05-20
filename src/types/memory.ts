export type MemoryAllocationMode = 'auto' | 'manual' | 'force';

export interface SystemMemoryStats {
  total: number;
  available: number;
}
