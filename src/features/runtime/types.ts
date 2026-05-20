import type { MemoryAllocationMode } from '../../types/memory';

export interface RuntimeConfig {
  useGlobalJava: boolean;
  useGlobalMemory: boolean;
  javaPath: string;
  memoryAllocationMode: MemoryAllocationMode;
  maxMemory: number;
  minMemory: number;
  jvmArgs: string;
}
