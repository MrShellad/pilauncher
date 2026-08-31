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
    <div
      ref={viewerContainerRef}
      className="h-full w-full cursor-grab active:cursor-grabbing font-minecraft select-none focus:outline-none"
    />
  );
};

export default WardrobeViewer;