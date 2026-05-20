import React from 'react';

export interface WardrobeViewerProps {
  currentAccountName?: string;
  onBack: () => void;
  viewerContainerRef: React.Ref<HTMLDivElement>;
}

export const WardrobeViewer: React.FC<WardrobeViewerProps> = ({
  viewerContainerRef,
}) => {
  return (
    <div className="w-full h-full relative flex-1 min-h-[40vh] font-minecraft">
      <div ref={viewerContainerRef} className="w-full h-full absolute inset-0 cursor-grab active:cursor-grabbing" />
    </div>
  );
};
