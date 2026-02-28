export interface RuntimeConfig {
  useGlobalJava: boolean;   // 独立的 Java 全局开关
  useGlobalMemory: boolean; // 独立的 内存 全局开关
  javaPath: string;
  maxMemory: number;
  minMemory: number;
  jvmArgs: string;
}