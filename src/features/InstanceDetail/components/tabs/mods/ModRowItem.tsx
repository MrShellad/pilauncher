import React from 'react';

import { FocusItem } from '../../../../../ui/focus/FocusItem';
import type { ModIconSnapshot } from '../../../logic/modIconService';
import type { ModMeta } from '../../../logic/modService';
import { ModRowActionCluster } from './ModRowActionCluster';
import type { ModListViewMode, RowAction } from './modListShared';
import { ModRowView } from './ModRowView';

interface ModRowItemProps {
  mod: ModMeta;
  iconSnapshot?: ModIconSnapshot;
  focusedRowFileName: string | null;
  operationRowFileName: string | null;
  requiresRowOperation: boolean;
  isSelected: boolean;
  rowIndex: number;
  rowFocusKey: string;
  viewMode: ModListViewMode;
  onFocusRow: (fileName: string) => void;
  onEnterRowOperation: (fileName: string) => void;
  onRowArrow: (direction: string) => boolean;
  onRowClick: (mod: ModMeta) => void;
  onActionArrow: (fileName: string, action: RowAction, direction: string) => boolean;
  onPreventLockedAction: (fileName: string, event?: { preventDefault?: () => void; stopPropagation?: () => void }) => boolean;
  onToggleMod: (fileName: string, currentEnabled: boolean) => void;
  onUpgradeMod: (mod: ModMeta) => void;
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
  rowIndex,
  rowFocusKey,
  viewMode,
  onFocusRow,
  onEnterRowOperation,
  onRowArrow,
  onRowClick,
  onActionArrow,
  onPreventLockedAction,
  onToggleMod,
  onUpgradeMod,
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
            rowIndex={rowIndex}
            viewMode={viewMode}
            onClick={() => onRowClick(mod)}
            leading={
              (
                <div 
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[0.125rem] transition-colors cursor-pointer ${isSelected ? 'bg-[#5C8DBF]' : 'bg-[#2A2A2C] border border-[#444]'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelection(mod.fileName);
                  }}
                >
                  {isSelected && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                </div>
              )
            }
            trailing={(
              <ModRowActionCluster
                fileName={mod.fileName}
                isEnabled={isEnabled}
                isSelected={isSelected}
                canUpgrade={!!mod.hasUpdate && !!mod.updateDownloadUrl && !!mod.updateFileId && !!mod.updateFileName}
                isUpdating={!!mod.isUpdatingMod}
                updateVersionName={mod.updateVersionName}
                isActionLocked={isActionLocked}
                viewMode={viewMode}
                getActionFocusKey={getActionFocusKey}
                onActionArrow={onActionArrow}
                onPreventLockedAction={onPreventLockedAction}
                onUpgradeMod={() => onUpgradeMod(mod)}
                onToggleMod={onToggleMod}
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
    prev.mod.updateFileId === next.mod.updateFileId &&
    prev.mod.updateFileName === next.mod.updateFileName &&
    prev.mod.updateDownloadUrl === next.mod.updateDownloadUrl &&
    prev.mod.isCheckingUpdate === next.mod.isCheckingUpdate &&
    prev.mod.isUpdatingMod === next.mod.isUpdatingMod &&
    prev.mod.isFetchingNetwork === next.mod.isFetchingNetwork &&
    prev.mod.networkInfo?.title === next.mod.networkInfo?.title &&
    prev.mod.networkInfo?.description === next.mod.networkInfo?.description &&
    prev.iconSnapshot === next.iconSnapshot &&
    prev.focusedRowFileName === next.focusedRowFileName &&
    prev.operationRowFileName === next.operationRowFileName &&
    prev.requiresRowOperation === next.requiresRowOperation &&
    prev.isSelected === next.isSelected &&
    prev.rowIndex === next.rowIndex &&
    prev.rowFocusKey === next.rowFocusKey &&
    prev.viewMode === next.viewMode;
};

export const ModRowItem = React.memo(ModRowItemComponent, areRowPropsEqual);
