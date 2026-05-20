// /src/ui/primitives/OreInstanceCard.tsx
import React from 'react';
import { Play } from 'lucide-react'; // 用于选中状态的小图标，可选

export interface OreInstanceCardProps {
  id: string;
  name: string;
  mcVersion: string;
  loaderType: string; // 例如: "Fabric 0.15.7", "Forge 47.2.0", "Vanilla"
  lastPlayed: string; // 例如: "2026-02-24" 或 "今天"
  coverUrl?: string;  // 封面图 URL
  isActive?: boolean; // 是否处于选中状态
  onClick?: (id: string) => void;
  className?: string; // 控制宽高等额外样式
}

export const OreInstanceCard: React.FC<OreInstanceCardProps> = ({
  id,
  name,
  mcVersion,
  loaderType,
  lastPlayed,
  coverUrl,
  isActive = false,
  onClick,
  className = 'w-48 h-64' // 默认给一个竖向卡片的尺寸
}) => {
  return (
    <button
      onClick={() => onClick && onClick(id)}
      className={`
        ore-instance-card focus:outline-none focus-visible:ring-2 focus-visible:ring-white
        ${isActive ? 'active' : ''} 
        ${className}
      `}
    >
      {/* ================= 第一段：上部封面图 ================= */}
      <div className="ore-instance-cover-wrapper flex-shrink-0 flex items-center justify-center overflow-hidden">
        {coverUrl ? (
          <img 
            src={coverUrl} 
            alt={name} 
            className="w-full h-full object-cover opacity-90 transition-opacity hover:opacity-100" 
            draggable={false}
          />
        ) : (
          // 没有封面时的占位图 (可以放个草方块图标或者简单的文字)
          <div className="text-ore-text-muted font-minecraft text-xl opacity-30">
            NO COVER
          </div>
        )}

        {/* 选中时，可以在封面图右下角叠一个小小的绿色对勾或播放图标 */}
        {isActive && (
          <div className="absolute bottom-1 right-1 bg-ore-green border border-ore-green-shadow p-0.5 shadow-md">
            <Play size={12} fill="currentColor" className="text-white" />
          </div>
        )}
      </div>

      {/* ================= 第二段：中部实例信息 (垂直居中) ================= */}
      {/* flex-1 撑满剩余高度，内部 flex 垂直居中 */}
      <div className="flex-1 flex flex-col justify-center items-center p-3 w-full text-center">
        {/* 实例名称：大号字体，文字带阴影，超长截断 */}
        <span className="font-minecraft font-bold text-lg text-white ore-text-shadow truncate w-full">
          {name}
        </span>
        
        {/* 版本与引导器：稍小、颜色略灰 */}
        <div className="flex items-center justify-center space-x-1 mt-1 text-ore-text-muted text-xs font-minecraft tracking-wide">
          <span className="truncate max-w-[80px]">{mcVersion}</span>
          <span className="opacity-50 px-1">•</span>
          <span className="truncate max-w-[80px] text-[#A8C7FA]">{loaderType}</span> {/* 给引导器一点特有的颜色区分 */}
        </div>
      </div>

      {/* ================= 第三段：下部游玩时间 ================= */}
      {/* 底部使用略深的半透明背景区隔，字体最小 */}
      <div className="w-full bg-black/20 border-t border-black/20 py-1.5 flex justify-center items-center flex-shrink-0">
        <span className="text-[10px] text-ore-text-muted font-bold uppercase tracking-wider">
          Last Played: <span className="text-white ml-1">{lastPlayed}</span>
        </span>
      </div>
      
    </button>
  );
};