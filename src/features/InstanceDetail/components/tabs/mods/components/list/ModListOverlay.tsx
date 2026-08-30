import React, { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

import { OreProgressBar } from '../../../../../../../ui/primitives/OreProgressBar';
import { type ModListTheme } from '../../modListShared';

interface ModListOverlayProps {
  visible: boolean;
  label?: string;
  current?: number;
  total?: number;
  percent?: number;
  onCancel?: () => void;
  listTheme?: ModListTheme;
  isBatchModeActive?: boolean;
}

export const ModListOverlay: React.FC<ModListOverlayProps> = ({
  visible,
  label = '正在检查模组更新...',
  current = 0,
  total = 0,
  percent,
  onCancel,
  listTheme = 'dark',
  isBatchModeActive = false
}) => {
  const [shouldRender, setShouldRender] = useState(visible);

  if (visible && !shouldRender) {
    setShouldRender(true);
  }

  useEffect(() => {
    if (visible) {
      return;
    }

    const timer = setTimeout(() => setShouldRender(false), 240);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!shouldRender && !visible) {
    return null;
  }

  const calculatedPercent =
    typeof percent === 'number'
      ? Math.max(0, Math.min(100, percent))
      : total > 0
      ? Math.round(Math.max(0, Math.min(100, (current / total) * 100)))
      : 0;

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 z-40 flex justify-center px-6 transition-all duration-200 ease-out ${
        isBatchModeActive ? 'bottom-20' : 'bottom-5'
      } ${visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}
    >
      <div
        className={`pointer-events-auto flex w-full min-w-[20rem] max-w-[28rem] flex-col gap-2 border-[0.1875rem] border-[#1E1E1F] px-4 py-2.5 transition-all duration-200 ${
          listTheme === 'light'
            ? 'bg-[#D0D1D4] text-[#111214] shadow-[0_1rem_2.25rem_rgba(0,0,0,0.3),inset_0_0.125rem_0_rgba(255,255,255,0.7),inset_0_-0.25rem_0_#A9ABAE]'
            : 'bg-[#313233] text-white shadow-[0_1rem_2.25rem_rgba(0,0,0,0.5),inset_0_0.125rem_0_rgba(255,255,255,0.14),inset_0_-0.25rem_0_rgba(0,0,0,0.28)]'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <RefreshCw size={15} className="shrink-0 animate-spin text-[#57D38C]" />
            <span className="font-minecraft text-sm font-bold truncate leading-tight">
              {label}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            {total > 0 && (
              <span className="font-minecraft text-xs font-bold text-[#57D38C] leading-tight">
                {current}/{total} ({calculatedPercent}%)
              </span>
            )}

            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                title="取消检查"
                className={`flex h-6 w-6 items-center justify-center border border-[#1E1E1F] shadow-[inset_0_-0.125rem_0_rgba(0,0,0,0.25)] transition-colors ${
                  listTheme === 'light'
                    ? 'bg-[#C2C4C9] text-[#313233] hover:bg-[#DDE0E3] hover:text-[#111214]'
                    : 'bg-[#48494A] text-[#D0D1D4] hover:bg-[#58585A] hover:text-white'
                }`}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <OreProgressBar
          percent={calculatedPercent}
          size="sm"
          showPercentage={false}
          className="!space-y-0 w-full"
        />
      </div>
    </div>
  );
};
