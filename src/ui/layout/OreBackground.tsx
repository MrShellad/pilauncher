// /src/ui/layout/OreBackground.tsx
import React from 'react';
import { useLauncherStore } from '../../store/useLauncherStore';

export const OreBackground: React.FC = () => {
  const bg = useLauncherStore(state => state.background);

  return (
    <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Layer 1: 最底层纯色 */}
      <div className="absolute inset-0 bg-ore-gray-900" />

      {/* Layer 2: 自定义媒体 (图片/视频) */}
      {bg.type === 'image' && (
        <img src={bg.source} alt="background" className="absolute inset-0 w-full h-full object-cover" />
      )}
      {bg.type === 'video' && (
        <video src={bg.source} autoPlay loop muted className="absolute inset-0 w-full h-full object-cover" />
      )}

      {/* Layer 3: 遮罩 (颜色、透明度、模糊) */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundColor: bg.overlayColor,
          opacity: bg.overlayOpacity,
          backdropFilter: `blur(${bg.overlayBlur}px)`,
          WebkitBackdropFilter: `blur(${bg.overlayBlur}px)`,
        }}
      />
    </div>
  );
};