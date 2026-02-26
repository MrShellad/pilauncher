// /src/ui/layout/OreBackground.tsx
import React, { useMemo } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { convertFileSrc } from '@tauri-apps/api/core';

export const OreBackground: React.FC = () => {
  const { appearance } = useSettingsStore(state => state.settings);

  const bgUrl = useMemo(() => {
    if (appearance.backgroundImage) {
      try {
        return convertFileSrc(appearance.backgroundImage);
      } catch (e) {
        console.error("转换图片路径失败:", e);
        return null;
      }
    }
    return null;
  }, [appearance.backgroundImage]);

  return (
    // ✅ 修复 1：将 -z-10 改为 z-0，防止它沉入 body 底部被浏览器的底色盖住
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      
      {/* Layer 1: 最底层纯色底 */}
      <div className="absolute inset-0 bg-[#18181B]" />

      {/* Layer 2: 自定义本地图片与模糊度 */}
      {bgUrl && (
        <img 
          src={bgUrl} 
          alt="OreLauncher Background" 
          className="absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-in-out" 
          style={{ filter: `blur(${appearance.backgroundBlur}px)` }} 
        />
      )}

      {/* Layer 3: 遮罩 (动态颜色与透明度) */}
      <div 
        className="absolute inset-0 transition-colors duration-500"
        style={{
          backgroundColor: appearance.maskColor,
          opacity: appearance.maskOpacity / 100, 
        }}
      />

      {/* Layer 4: 底部渐变黑影 */}
      {appearance.maskGradient && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80" />
      )}
      
    </div>
  );
};