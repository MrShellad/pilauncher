// /src/features/home/components/SkinViewerPlaceholder.tsx
import React, { useEffect, useRef } from 'react';
import { SkinViewer, IdleAnimation, WalkingAnimation } from 'skinview3d';

export const SkinViewerPlaceholder: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<SkinViewer | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // 1. 初始化 3D 渲染器
    const viewer = new SkinViewer({
      canvas: canvasRef.current,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      // 替换为实际皮肤 URL
      skin: 'https://minotar.net/skin/Steve.png', 
    });

    viewerRef.current = viewer;

    // 2. 基础配置与默认动作 (Idle) - 【修复点：使用 new 赋值】
    viewer.animation = new IdleAnimation();
    viewer.autoRotate = true;
    viewer.autoRotateSpeed = 0.5;

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
      if (viewerRef.current) {
        // 【修复点：直接操作 animation.paused】
        if (viewerRef.current.animation) viewerRef.current.animation.paused = true;
        viewerRef.current.autoRotate = false;
      }
    };

    const handleResume = () => {
      if (!document.hidden && viewerRef.current) {
        if (viewerRef.current.animation) viewerRef.current.animation.paused = false;
        viewerRef.current.autoRotate = true;
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

  // 6. 动作扩展示例 - 【修复点：直接赋新动作实例】
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