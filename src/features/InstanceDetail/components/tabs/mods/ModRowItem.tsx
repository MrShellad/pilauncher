import React from 'react';

import { FocusItem } from '../../../../../ui/focus/FocusItem';
import type { ModIconSnapshot } from '../../../logic/modIconService';
import type { ModMeta } from '../../../logic/modService';
import { ModRowActionCluster } from './ModRowActionCluster';
import type { RowAction } from './modListShared';
import { ModRowView } from './ModRowView';

interface ModRowItemProps {
  mod: ModMeta;
  iconSnapshot?: ModIconSnapshot;
  focusedRowFileName: string | null;
  operationRowFileName: string | null;
  requiresRowOperation: boolean;
  isSelected: boolean;
  rowFocusKey: string;
  onFocusRow: (fileName: string) => void;
  onEnterRowOperation: (fileName: string) => void;
  onRowArrow: (direction: string) => boolean;
  onRowClick: (mod: ModMeta) => void;
  onActionArrow: (fileName: string, action: RowAction, direction: string) => boolean;
  onPreventLockedAction: (fileName: string, event?: { preventDefault?: () => void; stopPropagation?: () => void }) => boolean;
  onToggleMod: (fileName: string, currentEnabled: boolean) => void;
  onToggleSelection: (fileName: string) => void;
  onDeleteMod: (fileName: string) => void;
  getActionFocusKey: (fileName: string, action: RowAction) => string;
}

const ModRowItemComponent: React.FC<ModRowItemProps> = ({
  mod,
  iconSnapshot,
  focusedRowFileName,
  operationRowFileName,
  requiresRowOperation,
  isSelected,
  rowFocusKey,
  onFocusRow,
  onEnterRowOperation,
  onRowArrow,
  onRowClick,
  onActionArrow,
  onPreventLockedAction,
  onToggleMod,
  onToggleSelection,
  onDeleteMod,
  getActionFocusKey
}) => {
  const isRowInOperationMode = operationRowFileName === mod.fileName;
  const isActionLocked = requiresRowOperation && !isRowInOperationMode;
  const isEnabled = !!mod.isEnabled;

  return (
    <FocusItem
      focusKey={rowFocusKey}
      onFocus={() => onFocusRow(mod.fileName)}
      onEnter={() => onEnterRowOperation(mod.fileName)}
      onArrowPress={onRowArrow}
    >
      {({ ref, focused, hasFocusedChild }) => (
        <div ref={ref as React.RefObject<HTMLDivElement>}>
          <ModRowView
            mod={mod}
            iconSnapshot={iconSnapshot}
            focused={focused}
            hasFocusedChild={hasFocusedChild}
            isPrimaryRow={focusedRowFileName === mod.fileName}
            isSelected={isSelected}
            isEnabled={isEnabled}
            isRowInOperationMode={isRowInOperationMode}
            onClick={() => onRowClick(mod)}
            trailing={(
              <ModRowActionCluster
                fileName={mod.fileName}
                isEnabled={isEnabled}
                isSelected={isSelected}
                isActionLocked={isActionLocked}
                getActionFocusKey={getActionFocusKey}
                onActionArrow={onActionArrow}
                onPreventLockedAction={onPreventLockedAction}
                onToggleMod={onToggleMod}
                onToggleSelection={onToggleSelection}
                onDeleteMod={onDeleteMod}
              />
            )}
          />
        </div>
      )}
    </FocusItem>
  );
};

const areRowPropsEqual = (prev: ModRowItemProps, next: ModRowItemProps) => {
  return prev.mod.fileName === next.mod.fileName &&
    prev.mod.name === next.mod.name &&
    prev.mod.description === next.mod.description &&
    prev.mod.version === next.mod.version &&
    prev.mod.fileSize === next.mod.fileSize &&
    prev.mod.isEnabled === next.mod.isEnabled &&
    prev.mod.hasUpdate === next.mod.hasUpdate &&
    prev.mod.updateVersionName === next.mod.updateVersionName &&
    prev.mod.isCheckingUpdate === next.mod.isCheckingUpdate &&
    prev.mod.isFetchingNetwork === next.mod.isFetchingNetwork &&
    prev.mod.networkInfo?.title === next.mod.networkInfo?.title &&
    prev.mod.networkInfo?.description === next.mod.networkInfo?.description &&
    prev.iconSnapshot === next.iconSnapshot &&
    prev.focusedRowFileName === next.focusedRowFileName &&
    prev.operationRowFileName === next.operationRowFileName &&
    prev.requiresRowOperation === next.requiresRowOperation &&
    prev.isSelected === next.isSelected &&
    prev.rowFocusKey === next.rowFocusKey;
};

export const ModRowItem = React.memo(ModRowItemComponent, areRowPropsEqual);
