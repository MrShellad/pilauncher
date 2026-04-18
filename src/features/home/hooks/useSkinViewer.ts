// src/features/home/hooks/useSkinViewer.ts
// ════════════════════════════════════════════════════════════════
// React 逻辑层：将 SkinEngine 与 React 生命周期桥接。
// 负责 canvas DOM 挂载/卸载、账号皮肤联动、可见性暂停、尺寸响应。
// 不包含任何 UI / 样式逻辑。
// ════════════════════════════════════════════════════════════════

import { useEffect, useRef, useCallback } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { useAccountStore } from '../../../store/useAccountStore';
import { useLauncherStore } from '../../../store/useLauncherStore';
import { SkinEngine, type AnimationPreset } from '../engine/SkinEngine';

const DEFAULT_SKIN_URL = 'https://minotar.net/skin/Steve.png';

export interface UseSkinViewerReturn {
  /** 挂载到容器 div 的 ref */
  containerRef: React.RefObject<HTMLDivElement>;
  /** 切换到指定动画 */
  playAnimation: (id: AnimationPreset | string) => void;
  /** 获取引擎实例（高级用途） */
  getEngine: () => SkinEngine | null;
}

export const loadAccountSkin = async (engine: SkinEngine, currentAccount: unknown) => {
  const account = currentAccount as any;
  const uuid = account?.uuid ?? '';
  const cacheBuster = account?.skinUrl?.split('?t=')[1] || 'init';
  const skinKey = uuid ? `${uuid}:${cacheBuster}` : 'default:steve';

  if (!account) {
    await engine.loadSkin(skinKey, DEFAULT_SKIN_URL);
    return;
  }

  try {
    const basePath = await invoke<string | null>('get_base_directory');
    if (basePath) {
      const separator = basePath.includes('\\') ? '\\' : '/';
      const localSkinPath = `${basePath}${separator}runtime${separator}accounts${separator}${account.uuid}${separator}skin.png`;
      const assetUrl = `${convertFileSrc(localSkinPath)}?t=${cacheBuster}`;
      await engine.loadSkin(skinKey, assetUrl);
      return;
    }
  } catch (e) {
    console.warn('[useSkinViewer] 加载本地皮肤失败，尝试网络兜底:', e);
  }

  try {
    await engine.loadSkin(skinKey, `https://minotar.net/skin/${account.name}.png`);
  } catch {
    await engine.loadSkin(skinKey, DEFAULT_SKIN_URL);
  }
};

/**
 * 将 SkinEngine 桥接到 React 组件。
 *
 * @param visibleTab - 当 activeTab 匹配此值时才渲染（默认 'home'）
 */
export function useSkinViewer(visibleTab = 'home'): UseSkinViewerReturn {
  const containerRef = useRef<HTMLDivElement>(null!);

  // ─── Store 订阅 ──────────────────────────────────────────────
  const { accounts, activeAccountId } = useAccountStore();
  const currentAccount = accounts.find(acc => acc.uuid === activeAccountId);

  const activeTab = useLauncherStore(state => state.activeTab);
  const isVisible = activeTab === visibleTab;

  // ─── 1. 挂载 / 卸载 canvas ───────────────────────────────────
  useEffect(() => {
    const engine = SkinEngine.getOrCreate();
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
    if (!engine || engine.isDisposed) return;
    
    void loadAccountSkin(engine, currentAccount);
  }, [currentAccount]);

  // ─── 5. 对外暴露的方法 ──────────────────────────────────────
  const playAnimation = useCallback((id: AnimationPreset | string) => {
    SkinEngine.current?.playAnimation(id);
  }, []);

  const getEngine = useCallback(() => {
    return SkinEngine.current;
  }, []);

  return { containerRef, playAnimation, getEngine };
}
