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
    return javas.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
  } catch (error) {
    console.error("扫描 Java 失败:", error);
    return [];
  }
};

export const testJavaRuntime = async (javaPath: string): Promise<JavaInstall> => {
  return invoke<JavaInstall>('test_java_runtime', { javaPath });
};

// 智能判断适用版本
export const getJavaRecommendation = (versionStr: string): string => {
  if (versionStr.includes('25.')) return '推荐 1.26+ / 新快照';
  if (versionStr.includes('21.') || versionStr.includes('22.')) return '推荐 1.20.5+';
  if (versionStr.includes('17.')) return '推荐 1.17 - 1.20.4';
  if (versionStr.includes('1.8.') || versionStr.includes('8.')) return '推荐 1.16.5 及以下';
  return '';
};

/**
 * 自动扫描并生成版本化路径配置
 */
export async function autoScanAndFillJava(currentMajorPaths: Record<string, string>) {
  let { valid } = await validateCachedJava();
  if (valid.length === 0) valid = await scanJava();

  if (valid.length === 0) return null;

  const newMajorPaths = { ...currentMajorPaths };
  const findBestMatch = (major: string) => {
    const matches = valid.filter((j) => {
      const v = j.version;
      if (major === '8') return v.startsWith('1.8.') || v.startsWith('8.');
      return v.startsWith(major + '.');
    });
    if (matches.length > 0) {
      return matches.sort((a, b) => b.version.localeCompare(a.version))[0].path;
    }
    return null;
  };

  const versions = ['8', '11', '16', '17', '21', '25'];
  let hasAnyMatch = false;
  versions.forEach((v) => {
    const match = findBestMatch(v);
    if (match) {
      newMajorPaths[v] = match;
      hasAnyMatch = true;
    }
  });

  const sortedValid = valid.sort((a, b) => b.version.localeCompare(a.version));
  const bestOverallPath = sortedValid[0].path;

  return {
    majorJavaPaths: newMajorPaths,
    javaPath: bestOverallPath,
    hasAnyMatch,
  };
}
