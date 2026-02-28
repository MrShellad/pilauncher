// src/features/runtime/logic/javaDetector.ts
import { invoke } from '@tauri-apps/api/core';

export interface JavaInstall {
  version: string;
  path: string;
}

export interface JavaValidationResult {
  valid: JavaInstall[];
  missing: JavaInstall[];
}

export const validateCachedJava = async (): Promise<JavaValidationResult> => {
  try {
    return await invoke<JavaValidationResult>('validate_java_cache');
  } catch (error) {
    console.error("验证 Java 缓存失败:", error);
    return { valid: [], missing: [] };
  }
};

export const scanJava = async (): Promise<JavaInstall[]> => {
  try {
    const javas = await invoke<JavaInstall[]>('scan_java_environments');
    return javas.sort((a, b) => b.version.localeCompare(a.version));
  } catch (error) {
    console.error("扫描 Java 失败:", error);
    return [];
  }
};

// 智能判断适用版本
export const getJavaRecommendation = (versionStr: string): string => {
  if (versionStr.includes('21.') || versionStr.includes('22.')) return '推荐 1.20.5+';
  if (versionStr.includes('17.')) return '推荐 1.17 - 1.20.4';
  if (versionStr.includes('1.8.') || versionStr.includes('8.')) return '推荐 1.16.5 及以下';
  return '';
};