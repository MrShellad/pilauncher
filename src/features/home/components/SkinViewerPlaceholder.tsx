// /src/features/home/components/SkinViewerPlaceholder.tsx
import React from 'react';

export const SkinViewerPlaceholder: React.FC = () => {
  return (
    <div className="absolute right-12 bottom-12 w-64 h-96 bg-black/20 border-2 border-dashed border-white/10 flex items-center justify-center rounded-lg backdrop-blur-sm">
      <span className="text-ore-text-muted text-sm font-minecraft">
        SkinView3D Canvas
      </span>
    </div>
  );
};