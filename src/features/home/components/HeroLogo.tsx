// /src/features/home/components/HeroLogo.tsx
import React from 'react';
// 1. 引入 motion 和 Token
import { motion } from 'framer-motion';
import { OreMotionTokens } from '../../../style/tokens/motion';

const logoFiles = import.meta.glob('../../../assets/home/herologo/*.{png,jpg,jpeg,webp,svg,gif}', { 
  eager: true, 
  import: 'default' 
});

export const HeroLogo: React.FC = () => {
  const logoPaths = Object.values(logoFiles) as string[];
  const defaultLogo = logoPaths.length > 0 ? logoPaths[0] : null;

  return (
    // 2. 将 div 改为 motion.div
    <motion.div 
      // 3. 重要：移除 pointer-events-none，添加 cursor-pointer 指示可交互
      className="w-96 h-32 flex items-center justify-center select-none cursor-pointer"
      // 4. 应用悬停动画 Token
      whileHover={OreMotionTokens.subtleHover}
    >
      {defaultLogo ? (
        <img 
          src={defaultLogo} 
          alt="Minecraft Logo" 
          // 保持原有的 drop-shadow-2xl，Framer Motion 的 scale 会自然放大这个阴影
          className="w-full h-full object-contain drop-shadow-2xl" 
        />
      ) : (
        <h1 className="text-6xl font-minecraft font-bold tracking-tighter text-white drop-shadow-xl ore-text-shadow">
          MINECRAFT
        </h1>
      )}
    </motion.div>
  );
};