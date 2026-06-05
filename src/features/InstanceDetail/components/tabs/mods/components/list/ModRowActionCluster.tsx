import React from 'react';
import { ArrowUpCircle, Loader2, Trash2 } from 'lucide-react';

import { OreButton } from '../../../../../../../ui/primitives/OreButton';
import { OreSwitch } from '../../../../../../../ui/primitives/OreSwitch';
import type { ModListViewMode, RowAction } from '../../modListShared';

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
  isSelected: _isSelected,
  canUpgrade,
  isUpdating,
  updateVersionName,
  isActionLocked,
  viewMode: _viewMode,
  getActionFocusKey,
  onActionArrow,
  onPreventLockedAction,
  onUpgradeMod,
  onToggleMod,
  onDeleteMod
}) => {
  const actionVisibilityClass = isEnabled
    ? 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity duration-150'
    : 'opacity-100 pointer-events-auto';

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

      <div className={`flex items-center justify-center ${actionVisibilityClass}`} onClick={(event) => event.stopPropagation()}>
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
        />
      </div>

      <OreButton
        focusKey={getActionFocusKey(fileName, 'delete')}
        variant="danger"
        size="auto"
        title="鍒犻櫎妯＄粍"
        onArrowPress={(direction) => onActionArrow(fileName, 'delete', direction)}
        onClick={(event) => {
          if (onPreventLockedAction(fileName, event)) {
            return;
          }
          event.stopPropagation();
          onDeleteMod(fileName);
        }}
        className={`!h-8 !min-h-8 !min-w-8 !w-8 !px-0 ${actionVisibilityClass}`}
      >
        <Trash2 size={18} />
      </OreButton>
    </div>
  );
};
