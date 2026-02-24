// /src/features/home/components/HeroLogo.tsx
import React from 'react';
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
    <motion.div 
      // 【关键改动】：响应式容器尺寸
      // 宽度：小窗占60vw -> 中窗占45vw -> 大窗/最大化占35vw。最小不低于250px，最大不超过600px
      // 高度：阶梯式增长，配合 img 的 object-contain 让图片完美等比放大
      className="flex items-center justify-center select-none cursor-pointer w-[60vw] md:w-[45vw] lg:w-[35vw] min-w-[500px] max-w-[1000px] h-20 md:h-28 lg:h-40 xl:h-48"
      whileHover={OreMotionTokens.subtleHover}
    >
      {defaultLogo ? (
        <img 
          src={defaultLogo} 
          alt="Minecraft Logo" 
          // object-contain 是神来之笔：无论外层高宽比怎么变，图片都会保持原比例缩放并居中
          className="w-full h-full object-contain drop-shadow-2xl" 
        />
      ) : (
        // 【关键改动】：文本字号也要响应式 (text-4xl -> 6xl -> 7xl -> 8xl)
        <h1 className="font-minecraft font-bold tracking-tighter text-white drop-shadow-xl ore-text-shadow text-4xl md:text-6xl lg:text-7xl xl:text-8xl">
          MINECRAFT
        </h1>
      )}
    </motion.div>
  );
};