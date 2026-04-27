import React from 'react';
import { CheckSquare, Square, Trash2 } from 'lucide-react';

import { OreButton } from '../../../../../ui/primitives/OreButton';
import { OreSwitch } from '../../../../../ui/primitives/OreSwitch';
import type { RowAction } from './modListShared';

interface ModRowActionClusterProps {
  fileName: string;
  isEnabled: boolean;
  isSelected: boolean;
  isActionLocked: boolean;
  getActionFocusKey: (fileName: string, action: RowAction) => string;
  onActionArrow: (fileName: string, action: RowAction, direction: string) => boolean;
  onPreventLockedAction: (fileName: string, event?: { preventDefault?: () => void; stopPropagation?: () => void }) => boolean;
  onToggleMod: (fileName: string, isEnabled: boolean) => void;
  onToggleSelection: (fileName: string) => void;
  onDeleteMod: (fileName: string) => void;
}

export const ModRowActionCluster: React.FC<ModRowActionClusterProps> = ({
  fileName,
  isEnabled,
  isSelected,
  isActionLocked,
  getActionFocusKey,
  onActionArrow,
  onPreventLockedAction,
  onToggleMod,
  onToggleSelection,
  onDeleteMod
}) => {
  return (
    <div className={`grid grid-cols-[58px_40px_40px] items-center gap-2 ${isActionLocked ? 'opacity-90' : 'opacity-100'}`}>
      <div className="flex h-10 w-[58px] items-center justify-center" onClick={(event) => event.stopPropagation()}>
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
        focusKey={getActionFocusKey(fileName, 'select')}
        variant={isSelected ? 'primary' : 'secondary'}
        size="auto"
        onArrowPress={(direction) => onActionArrow(fileName, 'select', direction)}
        onClick={(event) => {
          if (onPreventLockedAction(fileName, event)) {
            return;
          }

          event.stopPropagation();
          onToggleSelection(fileName);
        }}
        className={`!h-10 !min-h-10 !min-w-10 !w-10 !px-0 ${isSelected ? 'text-white' : ''}`}
      >
        {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
      </OreButton>

      <OreButton
        focusKey={getActionFocusKey(fileName, 'delete')}
        variant="danger"
        size="auto"
        onArrowPress={(direction) => onActionArrow(fileName, 'delete', direction)}
        onClick={(event) => {
          if (onPreventLockedAction(fileName, event)) {
            return;
          }

          event.stopPropagation();
          onDeleteMod(fileName);
        }}
        className="!h-10 !min-h-10 !min-w-10 !w-10 !px-0"
      >
        <Trash2 size={16} />
      </OreButton>
    </div>
  );
};
