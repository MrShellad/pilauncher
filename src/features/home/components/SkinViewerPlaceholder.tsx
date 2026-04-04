// src/features/home/components/SkinViewerPlaceholder.tsx
// ════════════════════════════════════════════════════════════════
// 纯 UI 壳：仅负责渲染展示容器。
// 所有引擎管理和业务逻辑由 SkinEngine / useSkinViewer 处理。
// 随机待机动画由 SkinEngine 自动循环播放，无需鼠标交互。
// ════════════════════════════════════════════════════════════════

import React from 'react';
import { useSkinViewer } from '../hooks/useSkinViewer';

export const SkinViewerPlaceholder: React.FC = () => {
  const { containerRef } = useSkinViewer('home');

  return (
    <div
      ref={containerRef}
      className="absolute right-4 md:right-8 lg:right-12 bottom-12 w-[25vw] min-w-[180px] max-w-[320px] h-[50vh] min-h-[300px] max-h-[500px] flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
    />
  );
};