import React from 'react';
import { ArrowUpCircle, Loader2, Trash2 } from 'lucide-react';

import { OreButton } from '../../../../../ui/primitives/OreButton';
import { OreSwitch } from '../../../../../ui/primitives/OreSwitch';
import type { ModListViewMode, RowAction } from './modListShared';

interface ModRowActionClusterProps {
  fileName: string;
  isEnabled: boolean;
  isSelected: boolean;
  canUpgrade: boolean;
  isUpdating: boolean;
  updateVersionName?: string;
  isActionLocked: boolean;
  viewMode: ModListViewMode;
  getActionFocusKey: (fileName: string, action: RowAction) => string;
  onActionArrow: (fileName: string, action: RowAction, direction: string) => boolean;
  onPreventLockedAction: (fileName: string, event?: { preventDefault?: () => void; stopPropagation?: () => void }) => boolean;
  onUpgradeMod: () => void;
  onToggleMod: (fileName: string, isEnabled: boolean) => void;
  onDeleteMod: (fileName: string) => void;
}

export const ModRowActionCluster: React.FC<ModRowActionClusterProps> = ({
  fileName,
  isEnabled,
  isSelected,
  canUpgrade,
  isUpdating,
  updateVersionName,
  isActionLocked,
  viewMode,
  getActionFocusKey,
  onActionArrow,
  onPreventLockedAction,
  onUpgradeMod,
  onToggleMod,
  onDeleteMod
}) => {
  const compactActions = viewMode === 'compact';
  const secondaryActionsClass = compactActions && !isSelected
    ? 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100'
    : 'opacity-100';

  return (
    <div className={`flex items-center gap-3 transition-opacity ${isActionLocked ? 'opacity-80' : 'opacity-100'}`}>
      {canUpgrade && (
        <OreButton
          focusKey={getActionFocusKey(fileName, 'upgrade')}
          variant="primary"
          size="auto"
          title={updateVersionName ? `升级到 ${updateVersionName}` : '升级模组'}
          disabled={isUpdating}
          onArrowPress={(direction) => onActionArrow(fileName, 'upgrade', direction)}
          onClick={(event) => {
            if (onPreventLockedAction(fileName, event)) {
              return;
            }
            event.stopPropagation();
            onUpgradeMod();
          }}
          className="!h-8 !min-h-8 !min-w-8 !w-8 !px-0"
        >
          {isUpdating ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <ArrowUpCircle size={16} />
          )}
        </OreButton>
      )}

      <div className="flex items-center justify-center" onClick={(event) => event.stopPropagation()}>
        <OreSwitch
          focusKey={getActionFocusKey(fileName, 'toggle')}
          checked={isEnabled}
          onArrowPress={(direction) => onActionArrow(fileName, 'toggle', direction)}
          onChange={() => {
            if (onPreventLockedAction(fileName)) {
              return;
            }
            onToggleMod(fileName, isEnabled);
          }}
          className="[&.is-on_.ore-switch-track]:!bg-[#FF7120] [&.is-on_.ore-switch-thumb]:!border-[#FF7120]"
        />
      </div>

      <div 
        className={`flex items-center justify-center cursor-pointer text-[#6B6D74] hover:text-white transition-colors ${secondaryActionsClass}`}
        onClick={(event) => {
          if (onPreventLockedAction(fileName, event)) {
            return;
          }
          event.stopPropagation();
          onDeleteMod(fileName);
        }}
      >
        <Trash2 size={18} />
      </div>
    </div>
  );
};
