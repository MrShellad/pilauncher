import React from 'react';
import { RefreshCw } from 'lucide-react';

interface ModListOverlayProps {
  visible: boolean;
}

export const ModListOverlay: React.FC<ModListOverlayProps> = ({ visible }) => {
  if (!visible) {
    return null;
  }

  return (
    <div
      className="absolute right-6 top-0 z-50 flex items-center rounded-b-md border-x-[0.125rem] border-b-[0.125rem] px-3 py-1.5 shadow-lg"
      style={{
        backgroundColor: 'var(--ore-downloadDetail-surface)',
        borderColor: 'var(--ore-downloadDetail-divider)',
        boxShadow: 'var(--ore-downloadDetail-sectionShadow)'
      }}
    >
      <RefreshCw size={14} className="mr-2 animate-spin text-ore-green" />
      <span className="font-minecraft text-xs text-[var(--ore-downloadDetail-labelText)]">正在同步模组...</span>
    </div>
  );
};
