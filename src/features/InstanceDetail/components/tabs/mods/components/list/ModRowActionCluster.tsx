import React from 'react';
import { ArrowUpCircle, Trash2 } from 'lucide-react';

import { OreButton } from '../../../../../../../ui/primitives/OreButton';
import { OreSwitch } from '../../../../../../../ui/primitives/OreSwitch';
import type { ModListViewMode, RowAction } from '../../modListShared';

interface ModRowActionClusterProps {
  fileName: string;
  isEnabled: boolean;
  isSelected?: boolean;
  canUpgrade: boolean;
  isUpdating: boolean;
  updateVersionName?: string;
  isActionLocked: boolean;
  isRowActive?: boolean;
  viewMode?: ModListViewMode;
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
  canUpgrade,
  isUpdating,
  isActionLocked,
  isRowActive = false,
  getActionFocusKey,
  onActionArrow,
  onPreventLockedAction,
  onUpgradeMod,
  onToggleMod,
  onDeleteMod
}) => {
  // 开关显示规则：禁用时常驻显示；启用时仅在 hover 或 focus 时显示
  const switchVisibilityClass = !isEnabled
    ? 'opacity-100 pointer-events-auto'
    : isRowActive
      ? 'opacity-100 pointer-events-auto transition-opacity duration-150'
      : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity duration-150';

  // 删除按钮显示规则：仅在 hover 或 focus 时显示
  const deleteVisibilityClass = isRowActive
    ? 'opacity-100 pointer-events-auto transition-opacity duration-150'
    : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity duration-150';

  return (
    <div className={`flex w-[120px] items-center justify-end gap-2 transition-opacity ${isActionLocked ? 'opacity-70' : 'opacity-100'}`}>
      {/* 升级按钮 (有可用更新时常驻显示) */}
      {canUpgrade && (
        <OreButton
          focusKey={getActionFocusKey(fileName, 'upgrade')}
          variant="primary"
          size="sm"
          iconOnly
          loading={isUpdating}
          disabled={isUpdating}
          onArrowPress={(direction) => onActionArrow(fileName, 'upgrade', direction)}
          onClick={(event) => {
            if (onPreventLockedAction(fileName, event)) {
              return;
            }
            event.stopPropagation();
            onUpgradeMod();
          }}
          className="!h-8 !w-8 !min-h-8"
        >
          <ArrowUpCircle size={15} />
        </OreButton>
      )}

      {/* 启用/禁用 开关 */}
      <div
        className={`flex items-center justify-center shrink-0 ${switchVisibilityClass}`}
        onClick={(event) => event.stopPropagation()}
      >
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

      {/* 删除按钮 */}
      <div className={deleteVisibilityClass}>
        <OreButton
          focusKey={getActionFocusKey(fileName, 'delete')}
          variant="danger"
          size="sm"
          iconOnly
          onArrowPress={(direction) => onActionArrow(fileName, 'delete', direction)}
          onClick={(event) => {
            if (onPreventLockedAction(fileName, event)) {
              return;
            }
            event.stopPropagation();
            onDeleteMod(fileName);
          }}
          className="!h-8 !w-8 !min-h-8"
        >
          <Trash2 size={15} />
        </OreButton>
      </div>
    </div>
  );
};
