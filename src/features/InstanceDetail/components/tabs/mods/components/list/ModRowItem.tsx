import React from 'react';
import { FocusItem } from '../../../../../../../ui/focus/FocusItem';
import type { ModIconSnapshot } from '../../../../../logic/modIconService';
import type { MissingDependencyInfo, ModMeta } from '../../../../../logic/modService';
import { ModRowActionCluster } from './ModRowActionCluster';
import type { ModListTheme, ModListViewMode, RowAction } from '../../modListShared';
import { ModRowView } from './ModRowView';

interface ModRowItemProps {
  mod: ModMeta;
  iconSnapshot?: ModIconSnapshot;
  missingDependencies?: MissingDependencyInfo[];
  dependentsCount?: number;
  focusedRowFileName: string | null;
  operationRowFileName: string | null;
  requiresRowOperation: boolean;
  isSelected: boolean;
  rowIndex: number;
  rowFocusKey: string;
  viewMode: ModListViewMode;
  listTheme: ModListTheme;
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
  onFocusRenderIndex?: () => void;
}

const ModRowItemComponent: React.FC<ModRowItemProps> = ({
  mod,
  iconSnapshot,
  missingDependencies,
  dependentsCount,
  focusedRowFileName,
  operationRowFileName,
  requiresRowOperation,
  isSelected,
  rowIndex,
  rowFocusKey,
  viewMode,
  listTheme,
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
  getActionFocusKey,
  onFocusRenderIndex
}) => {
  const isRowInOperationMode = operationRowFileName === mod.fileName;
  const isActionLocked = requiresRowOperation && !isRowInOperationMode;
  const isEnabled = !!mod.isEnabled;

  return (
    <FocusItem
      focusKey={rowFocusKey}
      onFocus={() => {
        onFocusRow(mod.fileName);
        onFocusRenderIndex?.();
      }}
      onEnter={() => onEnterRowOperation(mod.fileName)}
      onArrowPress={onRowArrow}
      autoScroll={false}
    >
      {({ ref, focused, hasFocusedChild }) => (
        <div ref={ref as any}>
          <ModRowView
            mod={mod}
            iconSnapshot={iconSnapshot}
            missingDependencies={missingDependencies}
            dependentsCount={dependentsCount}
            focused={focused}
            hasFocusedChild={hasFocusedChild}
            isPrimaryRow={focusedRowFileName === mod.fileName}
            isSelected={isSelected}
            isEnabled={isEnabled}
            isRowInOperationMode={isRowInOperationMode}
            rowIndex={rowIndex}
            viewMode={viewMode}
            listTheme={listTheme}
            onClick={() => onRowClick(mod)}
            onToggleSelection={onToggleSelection}
            trailing={(
              <ModRowActionCluster
                fileName={mod.fileName}
                isEnabled={isEnabled}
                isSelected={isSelected}
                canUpgrade={!!mod.hasUpdate && !!mod.updateDownloadUrl && !!mod.updateFileId && !!mod.updateFileName}
                isUpdating={!!mod.isUpdatingMod}
                updateVersionName={mod.updateVersionName}
                isActionLocked={isActionLocked}
                isRowActive={focused || hasFocusedChild || isRowInOperationMode}
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
    prev.mod.updatePlatform === next.mod.updatePlatform &&
    prev.mod.updateProjectId === next.mod.updateProjectId &&
    prev.mod.updateFileId === next.mod.updateFileId &&
    prev.mod.updateFileName === next.mod.updateFileName &&
    prev.mod.updateDownloadUrl === next.mod.updateDownloadUrl &&
    prev.mod.isUpdatingMod === next.mod.isUpdatingMod &&
    prev.mod.isFetchingNetwork === next.mod.isFetchingNetwork &&
    prev.mod.iconAbsolutePath === next.mod.iconAbsolutePath &&
    prev.mod.networkIconUrl === next.mod.networkIconUrl &&
    prev.mod.networkInfo?.title === next.mod.networkInfo?.title &&
    prev.mod.networkInfo?.description === next.mod.networkInfo?.description &&
    prev.mod.networkInfo?.icon_url === next.mod.networkInfo?.icon_url &&
    prev.mod.networkInfo?.source === next.mod.networkInfo?.source &&
    prev.missingDependencies === next.missingDependencies &&
    prev.dependentsCount === next.dependentsCount &&
    prev.iconSnapshot === next.iconSnapshot &&
    prev.focusedRowFileName === next.focusedRowFileName &&
    prev.operationRowFileName === next.operationRowFileName &&
    prev.requiresRowOperation === next.requiresRowOperation &&
    prev.isSelected === next.isSelected &&
    prev.rowIndex === next.rowIndex &&
    prev.rowFocusKey === next.rowFocusKey &&
    prev.viewMode === next.viewMode &&
    prev.listTheme === next.listTheme;
};

export const ModRowItem = React.memo(ModRowItemComponent, areRowPropsEqual);
