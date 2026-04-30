// src/features/home/hooks/useSkinViewer.ts
// ════════════════════════════════════════════════════════════════
// React 逻辑层：将 SkinEngine 与 React 生命周期桥接。
// 负责 canvas DOM 挂载/卸载、账号皮肤联动、可见性暂停、尺寸响应。
// 不包含任何 UI / 样式逻辑。
// ════════════════════════════════════════════════════════════════

import { useEffect, useRef, useCallback, useState } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { useAccountStore } from '../../../store/useAccountStore';
import { useLauncherStore } from '../../../store/useLauncherStore';
import { SkinEngine, type AnimationPreset } from '../engine/SkinEngine';

const DEFAULT_SKIN_URL = 'https://minotar.net/skin/Steve.png';

interface SkinViewerAccount {
  uuid?: string;
  name?: string;
  skinUrl?: string | null;
  metadata?: {
    model?: string | null;
  } | null;
}

export interface UseSkinViewerReturn {
  /** 挂载到容器 div 的 ref */
  containerRef: React.RefObject<HTMLDivElement>;
  /** 切换到指定动画 */
  playAnimation: (id: AnimationPreset | string) => void;
  /** 获取引擎实例（高级用途） */
  getEngine: () => SkinEngine | null;
  /** 皮肤是否已加载完毕 */
  isSkinLoaded: boolean;
}

export const detectSkinModel = (url: string): Promise<'classic' | 'slim'> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (img.width !== 64 || img.height !== 64) {
        resolve('classic');
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve('classic');
        return;
      }
      ctx.drawImage(img, 0, 0);

      // 检测 slim 透明列：
      // 右臂区域中 x=54,55 并且 y=20~31 的列
      // 对于 classic (4px 宽)，这些像素有颜色。
      // 对于 slim (3px 宽)，全透明。
      const imgData = ctx.getImageData(54, 20, 2, 12);
      let isSlim = true;
      for (let i = 3; i < imgData.data.length; i += 4) {
        if (imgData.data[i] !== 0) { // 不是全透明
          isSlim = false;
          break;
        }
      }
      resolve(isSlim ? 'slim' : 'classic');
    };
    img.onerror = () => resolve('classic');
    img.src = url;
  });
};

const stripSkinUrlQuery = (url?: string | null) => (url || '').split('?')[0].trim();

const appendCacheBuster = (url: string, cacheBuster: string) => {
  if (!cacheBuster || cacheBuster === 'init') return url;
  return `${url}${url.includes('?') ? '&' : '?'}t=${encodeURIComponent(cacheBuster)}`;
};

const toLoadableSkinUrl = (url?: string | null, cacheBuster = 'init') => {
  const rawUrl = stripSkinUrlQuery(url);
  if (!rawUrl) return '';

  if (/^(https?:|asset:|data:|blob:)/i.test(rawUrl)) {
    return appendCacheBuster(rawUrl, cacheBuster);
  }

  return appendCacheBuster(convertFileSrc(rawUrl), cacheBuster);
};

export const loadAccountSkin = async (engine: SkinEngine, currentAccount: unknown) => {
  const account = currentAccount as SkinViewerAccount | null;
  const uuid = account?.uuid ?? '';
  const cacheBuster = account?.skinUrl?.split('?t=')[1] || 'init';
  const skinKey = uuid ? `${uuid}:${cacheBuster}` : 'default:steve';

  if (!account) {
    await engine.loadSkin(skinKey, DEFAULT_SKIN_URL, 'classic');
    return;
  }

  // 优先级 1：读 metadata (有 Mojang profile 时：metadata.model == "slim" → slim, else → classic)
  let metadataModel: 'classic' | 'slim' | null = null;
  if (account.metadata && account.metadata.model) {
    metadataModel = account.metadata.model === 'slim' ? 'slim' : 'classic';
  }

  try {
    if (uuid) {
      const cachedSkinPath = await invoke<string>('ensure_account_skin', {
        uuid,
        skinUrl: stripSkinUrlQuery(account.skinUrl)
      });
      const cachedSkinUrl = appendCacheBuster(convertFileSrc(cachedSkinPath), cacheBuster);
      const modelToLoad = metadataModel || await detectSkinModel(cachedSkinUrl);
      await engine.loadSkin(skinKey, cachedSkinUrl, modelToLoad);
      return;
    }
  } catch (e) {
    console.warn('[useSkinViewer] 加载账号皮肤缓存失败，尝试账号皮肤 URL:', e);
  }

  const accountSkinUrl = toLoadableSkinUrl(account.skinUrl, cacheBuster);
  if (accountSkinUrl) {
    try {
      const modelToLoad = metadataModel || await detectSkinModel(accountSkinUrl);
      await engine.loadSkin(skinKey, accountSkinUrl, modelToLoad);
      return;
    } catch (e) {
      console.warn('[useSkinViewer] 加载账号皮肤 URL 失败，尝试网络兜底:', e);
    }
  }

  try {
    const fallbackName = account.name || uuid;
    if (!fallbackName) throw new Error('Missing account name for skin fallback');
    const netUrl = `https://minotar.net/skin/${encodeURIComponent(fallbackName)}.png`;
    const modelToLoad = metadataModel || await detectSkinModel(netUrl);
    await engine.loadSkin(skinKey, netUrl, modelToLoad);
  } catch {
    await engine.loadSkin(skinKey, DEFAULT_SKIN_URL, 'classic');
  }
};

/**
 * 将 SkinEngine 桥接到 React 组件。
 *
 * @param visibleTab - 当 activeTab 匹配此值时才渲染（默认 'home'）
 */
export function useSkinViewer(visibleTab = 'home'): UseSkinViewerReturn {
  const containerRef = useRef<HTMLDivElement>(null!);
  const [isSkinLoaded, setIsSkinLoaded] = useState(false);

  // ─── Store 订阅 ──────────────────────────────────────────────
  const { accounts, activeAccountId, isHydrated } = useAccountStore();
  const currentAccount = accounts.find(acc => acc.uuid === activeAccountId);

  const activeTab = useLauncherStore(state => state.activeTab);
  const isVisible = activeTab === visibleTab;

  // ─── 1. 挂载 / 卸载 canvas ───────────────────────────────────
  useEffect(() => {
    const engine = SkinEngine.getOrCreate({ enableRandomIdle: false });
    engine.playAnimation('wave');
    const container = containerRef.current;
    if (!container) return;

    // 将引擎的 canvas 挂到 DOM
    container.appendChild(engine.canvas);

    // 同步尺寸（canvas 内部分辨率 = 容器像素尺寸，保持 1:1 对齐）
    engine.setSize(container.clientWidth, container.clientHeight);

    // 响应式尺寸
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const eng = SkinEngine.current;
        if (eng && !eng.isDisposed) {
          eng.setSize(entry.contentRect.width, entry.contentRect.height);
        }
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      // 仅从 DOM 移除 canvas，不销毁引擎
      if (container.contains(engine.canvas)) {
        container.removeChild(engine.canvas);
      }
    };
  }, []);

  // ─── 2. 标签页可见性 → 暂停 / 恢复渲染 ──────────────────────
  useEffect(() => {
    const engine = SkinEngine.current;
    if (!engine || engine.isDisposed) return;

    if (isVisible && !document.hidden) {
      engine.startRenderLoop();
    } else {
      engine.stopRenderLoop();
    }
  }, [isVisible]);

  // ─── 3. 窗口级 visibility / focus ────────────────────────────
  useEffect(() => {
    const handlePause = () => {
      SkinEngine.current?.stopRenderLoop();
    };
    const handleResume = () => {
      const engine = SkinEngine.current;
      if (isVisible && engine && !engine.isDisposed) {
        engine.startRenderLoop();
      }
    };
    const handleVisibilityChange = () => {
      document.hidden ? handlePause() : handleResume();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handlePause);
    window.addEventListener('focus', handleResume);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handlePause);
      window.removeEventListener('focus', handleResume);
    };
  }, [isVisible]);

  // ─── 4. 账号变化 → 加载皮肤（去重） ─────────────────────────
  useEffect(() => {
    const engine = SkinEngine.current;
    if (!engine || engine.isDisposed || !isHydrated) return;
    
    setIsSkinLoaded(false);
    void loadAccountSkin(engine, currentAccount).then(() => {
      setIsSkinLoaded(true);
    });
  }, [currentAccount, isHydrated]);

  // ─── 5. 对外暴露的方法 ──────────────────────────────────────
  const playAnimation = useCallback((id: AnimationPreset | string) => {
    SkinEngine.current?.playAnimation(id);
  }, []);

  const getEngine = useCallback(() => {
    return SkinEngine.current;
  }, []);

  return { containerRef, playAnimation, getEngine, isSkinLoaded };
}
