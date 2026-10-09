import React from 'react';
import { motion } from 'motion/react';

export const ShimmerOverlay: React.FC = () => {
  return (
    <motion.div
      className="absolute inset-0 z-10 pointer-events-none"
      style={{
        background: 'linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.06) 20%, rgba(255, 255, 255, 0.15) 60%, rgba(255, 255, 255, 0) 100%)',
        backgroundSize: '200% 100%',
      }}
      animate={{
        x: ['-100%', '100%'],
      }}
      transition={{
        repeat: Infinity,
        duration: 1.5,
        ease: 'linear',
      }}
    />
  );
};
