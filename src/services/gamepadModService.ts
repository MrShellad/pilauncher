// /src/services/gamepadModService.ts
// 手柄 Mod 动态版本解析服务
// 启动器启动时从 Modrinth / CurseForge API 拉取版本信息，缓存到内存

import { invoke } from '@tauri-apps/api/core';
import { fetchCurseForgeVersions } from '../features/Download/logic/curseforgeApi';
import { hasCurseForgeApiKey } from '../features/Download/logic/curseforgeApi';
import type { OreProjectVersion } from '../features/InstanceDetail/logic/modrinthApi';
import gamepadConfig from '../assets/config/gamepad.json';

// ==========================================
// 1. 类型定义
// ==========================================

/** gamepad.json 中的 mod 注册条目 */
interface GamepadModEntry {
  name: string;
  source: 'modrinth' | 'curseforge';
  slug?: string;           // Modrinth slug
  curseforgeId?: string;   // CurseForge mod ID
  loaders: string[];       // 该条目支持的 loader 列表
}

/** 解析后的 mod 信息（含下载链接） */
export interface ResolvedGamepadMod {
  name: string;
  fileName: string;
  downloadUrl: string;
  source: 'modrinth' | 'curseforge';
}

/** gamepad.json 的根结构 */
interface GamepadConfig {
  mods: GamepadModEntry[];
}

// ==========================================
// 2. 内存缓存
// ==========================================

// 缓存键: `{mcVersion}_{loaderType}`, 值: 解析后的 mod 信息
const resolvedCache = new Map<string, ResolvedGamepadMod>();

// 是否已初始化
let initialized = false;

// ==========================================
// 3. API 调用封装
// ==========================================

/** 通过 Modrinth API (经 Rust 后端) 获取项目版本列表 */
async function fetchModrinthVersionsForGamepad(
  slug: string,
  gameVersion?: string,
  loader?: string
): Promise<OreProjectVersion[]> {
  try {
    return await invoke<OreProjectVersion[]>('get_ore_project_versions', {
      projectId: slug,
      gameVersion: gameVersion || null,
      loader: loader || null,
    });
  } catch (err) {
    console.warn(`[GamepadMod] Modrinth 版本查询失败 (${slug}):`, err);
    return [];
  }
}

/** 通过 CurseForge API (前端直接调用) 获取项目版本列表 */
async function fetchCurseForgeVersionsForGamepad(
  curseforgeId: string,
  gameVersion?: string,
  loader?: string
): Promise<OreProjectVersion[]> {
  if (!hasCurseForgeApiKey()) {
    console.warn('[GamepadMod] CurseForge API Key 未配置，跳过 CurseForge 查询');
    return [];
  }
  try {
    return await fetchCurseForgeVersions(curseforgeId, gameVersion, loader);
  } catch (err) {
    console.warn(`[GamepadMod] CurseForge 版本查询失败 (${curseforgeId}):`, err);
    return [];
  }
}

// ==========================================
// 4. 核心逻辑
// ==========================================

/**
 * 为某个 mod 条目拉取所有版本，并将每个 (mcVersion, loader) 组合的最新版本存入缓存。
 * 只处理该条目声明支持的 loaders。
 */
async function resolveModEntry(entry: GamepadModEntry): Promise<void> {
  let allVersions: OreProjectVersion[] = [];

  if (entry.source === 'modrinth' && entry.slug) {
    // Modrinth: 不传 gameVersion/loader 过滤，拉取全量
    allVersions = await fetchModrinthVersionsForGamepad(entry.slug);
  } else if (entry.source === 'curseforge' && entry.curseforgeId) {
    // CurseForge: 也拉取全量 (不传过滤参数)
    allVersions = await fetchCurseForgeVersionsForGamepad(entry.curseforgeId);
  }

  if (allVersions.length === 0) return;

  // 遍历每个版本，按 (mcVersion, loader) 组合缓存最新的文件
  // allVersions 已按日期降序排列（最新在前), 所以第一个命中的就是最新版本
  const supportedLoaders = new Set(entry.loaders.map(l => l.toLowerCase()));

  for (const version of allVersions) {
    if (!version.download_url || !version.file_name) continue;

    const versionLoaders = (version.loaders || []).map(l => l.toLowerCase());
    const versionGameVersions = version.game_versions || [];

    for (const mcVersion of versionGameVersions) {
      for (const loader of versionLoaders) {
        // 只处理该条目声明支持的 loader
        if (!supportedLoaders.has(loader)) continue;

        const cacheKey = `${mcVersion}_${loader}`;
        // 只存第一个命中的（最新版本）
        if (!resolvedCache.has(cacheKey)) {
          resolvedCache.set(cacheKey, {
            name: entry.name,
            fileName: version.file_name,
            downloadUrl: version.download_url,
            source: entry.source,
          });
        }
      }
    }
  }
}

/**
 * 启动器启动时调用：从 Modrinth/CurseForge API 拉取所有手柄 mod 的版本信息。
 * 并行请求，失败静默忽略（离线容错）。
 */
export async function initGamepadModRegistry(): Promise<void> {
  if (initialized) return;

  const config = gamepadConfig as GamepadConfig;
  if (!config.mods || config.mods.length === 0) {
    console.log('[GamepadMod] gamepad.json 中没有配置任何 mod');
    initialized = true;
    return;
  }

  console.log(`[GamepadMod] 开始初始化手柄 Mod 注册表，共 ${config.mods.length} 个条目...`);

  // 去重：同一个 slug/curseforgeId 只需要请求一次，但不同 loader 组合需要合并
  const uniqueEntries = deduplicateEntries(config.mods);

  // 并行请求所有 mod 的版本
  await Promise.allSettled(uniqueEntries.map(entry => resolveModEntry(entry)));

  initialized = true;
  console.log(`[GamepadMod] 注册表初始化完成，缓存 ${resolvedCache.size} 个版本组合`);
}

/**
 * 将共享同一个 slug/ID 的条目合并 loaders，减少 API 调用次数。
 */
function deduplicateEntries(entries: GamepadModEntry[]): GamepadModEntry[] {
  const map = new Map<string, GamepadModEntry>();
  for (const entry of entries) {
    const key = entry.source === 'modrinth'
      ? `modrinth:${entry.slug}`
      : `curseforge:${entry.curseforgeId}`;
    const existing = map.get(key);
    if (existing) {
      // 合并 loaders
      const merged = new Set([...existing.loaders, ...entry.loaders]);
      existing.loaders = Array.from(merged);
    } else {
      map.set(key, { ...entry, loaders: [...entry.loaders] });
    }
  }
  return Array.from(map.values());
}

/**
 * 根据 MC 版本和加载器类型，查找已缓存的手柄 mod 信息。
 * 如果缓存为空（未初始化或没有对应版本），返回 null。
 */
export function resolveGamepadMod(
  mcVersion: string,
  loaderType: string
): ResolvedGamepadMod | null {
  const cacheKey = `${mcVersion}_${loaderType.toLowerCase()}`;
  return resolvedCache.get(cacheKey) || null;
}

/**
 * 针对特定 MC 版本和加载器，实时从 API 拉取（用于缓存未命中时的 fallback）。
 * 遍历 gamepad.json 中匹配该 loader 的所有 mod 条目，尝试找到可用版本。
 */
export async function resolveGamepadModOnDemand(
  mcVersion: string,
  loaderType: string
): Promise<ResolvedGamepadMod | null> {
  const config = gamepadConfig as GamepadConfig;
  const loader = loaderType.toLowerCase();

  // 找到所有支持该 loader 的 mod 条目
  const candidates = config.mods.filter(entry =>
    entry.loaders.some(l => l.toLowerCase() === loader)
  );

  for (const entry of candidates) {
    let versions: OreProjectVersion[] = [];

    if (entry.source === 'modrinth' && entry.slug) {
      versions = await fetchModrinthVersionsForGamepad(entry.slug, mcVersion, loader);
    } else if (entry.source === 'curseforge' && entry.curseforgeId) {
      versions = await fetchCurseForgeVersionsForGamepad(entry.curseforgeId, mcVersion, loader);
    }

    if (versions.length > 0) {
      const best = versions[0]; // 已按日期降序排列
      if (best.download_url && best.file_name) {
        const resolved: ResolvedGamepadMod = {
          name: entry.name,
          fileName: best.file_name,
          downloadUrl: best.download_url,
          source: entry.source,
        };
        // 存入缓存
        const cacheKey = `${mcVersion}_${loader}`;
        resolvedCache.set(cacheKey, resolved);
        return resolved;
      }
    }
  }

  return null;
}
