import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface ModListOverlayProps {
  visible: boolean;
  label?: string;
}

export const ModListOverlay: React.FC<ModListOverlayProps> = ({
  visible,
  label = '正在同步模组...'
}) => {
  const [shouldRender, setShouldRender] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      return;
    }

    const timer = setTimeout(() => setShouldRender(false), 180);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className={`absolute right-6 top-0 z-50 flex items-center rounded-b-md border-x-[0.125rem] border-b-[0.125rem] px-3 py-1.5 shadow-lg transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        backgroundColor: 'var(--ore-downloadDetail-surface)',
        borderColor: 'var(--ore-downloadDetail-divider)',
        boxShadow: 'var(--ore-downloadDetail-sectionShadow)'
      }}
    >
      <RefreshCw size={14} className="mr-2 animate-spin text-ore-green" />
      <span className="text-[1.0625rem] text-[var(--ore-downloadDetail-labelText)]">{label}</span>
    </div>
  );
};
