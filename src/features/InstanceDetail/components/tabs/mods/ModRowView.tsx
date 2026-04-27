import React from 'react';
import { ArrowUpCircle, Blocks, Loader2 } from 'lucide-react';

import { OreAssetRow } from '../../../../../ui/primitives/OreAssetRow';
import type { ModIconSnapshot } from '../../../logic/modIconService';
import type { ModMeta } from '../../../logic/modService';
import { getModDisplayDescription, getModDisplayName, getModFormattedSize } from './modListShared';

interface ModRowViewProps {
  mod: ModMeta;
  iconSnapshot?: ModIconSnapshot;
  focused: boolean;
  hasFocusedChild: boolean;
  isPrimaryRow: boolean;
  isSelected: boolean;
  isEnabled: boolean;
  isRowInOperationMode: boolean;
  trailing: React.ReactNode;
  onClick: () => void;
}

export const ModRowView: React.FC<ModRowViewProps> = ({
  mod,
  iconSnapshot,
  focused,
  hasFocusedChild,
  isPrimaryRow,
  isSelected,
  isEnabled,
  isRowInOperationMode,
  trailing,
  onClick
}) => {
  const displayName = getModDisplayName(mod);
  const displayDesc = getModDisplayDescription(mod);
  const formattedSize = getModFormattedSize(mod);

  const iconUrl = iconSnapshot?.src || null;
  const isIconLoading = iconSnapshot?.status === 'loading' || (!!mod.isFetchingNetwork && !iconUrl);

  return (
    <OreAssetRow
      focusable={false}
      focused={focused}
      hasFocusedChild={hasFocusedChild}
      inactive={!isEnabled}
      selected={isSelected}
      operationActive={isRowInOperationMode}
      onClick={onClick}
      leading={(
        <div className="relative h-full w-full">
          {iconUrl ? (
            <img src={iconUrl} alt="icon" className="h-full w-full object-cover" />
          ) : (
            <div
              className={`flex h-full w-full items-center justify-center ${
                isIconLoading
                  ? 'animate-pulse bg-[radial-gradient(circle_at_top,rgba(62,180,137,0.3),rgba(0,0,0,0.12)_58%)]'
                  : 'bg-[linear-gradient(135deg,rgba(255,255,255,0.14),rgba(0,0,0,0.08))]'
              }`}
            >
              {isIconLoading ? (
                <Loader2 size={16} className="animate-spin text-ore-green" />
              ) : (
                <Blocks size={28} className="text-[var(--ore-downloadDetail-labelText)] drop-shadow-md" />
              )}
            </div>
          )}

          {isIconLoading && !iconUrl && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-transparent via-ore-green to-transparent opacity-80" />
          )}
        </div>
      )}
      title={displayName}
      titleClassName={isPrimaryRow ? 'brightness-100' : ''}
      badges={(
        <>
          {mod.version && (
            <span
              className="flex-shrink-0 border-[2px] px-2 py-0.5 font-mono text-[10px] text-[#D0D1D4]"
              style={{
                backgroundColor: 'var(--ore-downloadDetail-base)',
                borderColor: 'var(--ore-downloadDetail-divider)'
              }}
            >
              v{mod.version}
            </span>
          )}

          {mod.isCheckingUpdate && (
            <span className="ml-2 flex items-center text-[10px] text-[#6B4F00]">
              <Loader2 size={12} className="mr-1 animate-spin" />
              检查更新中...
            </span>
          )}

          {mod.hasUpdate && (
            <span
              title={`Available update: ${mod.updateVersionName}`}
              className="ml-2 flex items-center border-[2px] bg-[#24563C] px-2 py-0.5 text-[10px] text-white"
              style={{ borderColor: 'var(--ore-downloadDetail-divider)' }}
            >
              <ArrowUpCircle size={12} className="mr-1" />
              可更新
            </span>
          )}
        </>
      )}
      description={displayDesc}
      metaItems={[`文件名：${mod.fileName}    大小：${formattedSize}`]}
      trailingClassName=""
      trailing={trailing}
    />
  );
};
