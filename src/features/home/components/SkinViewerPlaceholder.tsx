// src/features/home/components/SkinViewerPlaceholder.tsx
import React, { useEffect, useRef } from 'react';
import { SkinViewer, IdleAnimation, WalkingAnimation } from 'skinview3d';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { useAccountStore } from '../../../store/useAccountStore';

export const SkinViewerPlaceholder: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<SkinViewer | null>(null);

  // ✅ 获取当前活跃的账号
  const { accounts, activeAccountId } = useAccountStore();
  const currentAccount = accounts.find(acc => acc.uuid === activeAccountId);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // 1. 初始化 3D 渲染器
    const viewer = new SkinViewer({
      canvas: canvasRef.current,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      skin: 'https://minotar.net/skin/Steve.png', 
    });

    viewerRef.current = viewer;

    // 2. 基础配置与默认动作 (Idle)
    viewer.animation = new IdleAnimation();
    // ✅ 去掉转动动画，默认为 false 即面朝用户
    viewer.autoRotate = false; 

    // 3. 自适应模型大小
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        viewer.width = entry.contentRect.width;
        viewer.height = entry.contentRect.height;
      }
    });
    resizeObserver.observe(containerRef.current);

    // 4. 性能优化：窗口最小化、切换页面、失去焦点时自动暂停渲染
    const handlePause = () => {
      if (viewerRef.current?.animation) {
        viewerRef.current.animation.paused = true;
      }
    };

    const handleResume = () => {
      if (!document.hidden && viewerRef.current?.animation) {
        viewerRef.current.animation.paused = false;
      }
    };

    const handleVisibilityChange = () => {
      document.hidden ? handlePause() : handleResume();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handlePause);
    window.addEventListener('focus', handleResume);

    // 5. 卸载清理
    return () => {
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handlePause);
      window.removeEventListener('focus', handleResume);
      viewer.dispose();
    };
  }, []);

  // ✅ 新增：核心联动模块。当账户切换时，实时拉取本地对应目录的皮肤！
  useEffect(() => {
    if (!viewerRef.current) return;
    const viewer = viewerRef.current;

    const loadSkin = async () => {
      if (!currentAccount) {
        viewer.loadSkin('https://minotar.net/skin/Steve.png');
        return;
      }

      try {
        const basePath = await invoke<string | null>('get_base_directory');
        if (basePath) {
          const separator = basePath.includes('\\') ? '\\' : '/';
          const localSkinPath = `${basePath}${separator}runtime${separator}accounts${separator}${currentAccount.uuid}${separator}skin.png`;
          
          // ✅ 核心修复：提取账户库中随皮肤更新才变化的时间戳，否则默认为 'init'
          const cacheBuster = currentAccount.skinUrl?.split('?t=')[1] || 'init';
          
          // 只有当用户真正修改皮肤时，cacheBuster 才会改变，否则 WebView 会瞬间从 RAM 中读取！
          const assetUrl = `${convertFileSrc(localSkinPath)}?t=${cacheBuster}`;
          
          await viewer.loadSkin(assetUrl);
          return; 
        }
      } catch (e) {
        console.warn("加载本地皮肤模型失败，准备尝试网络兜底:", e);
      }

      // 如果由于某种原因（比如刚创建离线号，后台还没下载完），走网络 fallback
      try {
        await viewer.loadSkin(`https://minotar.net/skin/${currentAccount.name}.png`);
      } catch (err) {
        viewer.loadSkin('https://minotar.net/skin/Steve.png'); // 终极断网兜底
      }
    };

    loadSkin();
  }, [currentAccount]); // 监听当前账号变化

  // 6. 动作扩展示例
  const handleMouseEnter = () => {
    if (!viewerRef.current) return;
    viewerRef.current.animation = new WalkingAnimation(); 
  };

  const handleMouseLeave = () => {
    if (!viewerRef.current) return;
    viewerRef.current.animation = new IdleAnimation();
  };

  return (
    <div 
      ref={containerRef}
      className="absolute right-4 md:right-8 lg:right-12 bottom-12 w-[25vw] min-w-[180px] max-w-[320px] h-[50vh] min-h-[300px] max-h-[500px] flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <canvas ref={canvasRef} className="outline-none pointer-events-auto drop-shadow-2xl" />
    </div>
  );
};