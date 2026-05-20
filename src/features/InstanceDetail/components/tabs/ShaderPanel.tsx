import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { DownloadCloud, FolderOpen, Image as ImageIcon, Loader2, Trash2 } from 'lucide-react';

import { useLauncherStore } from '../../../../store/useLauncherStore';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { useInputMode } from '../../../../ui/focus/FocusProvider';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { OreAssetRow } from '../../../../ui/primitives/OreAssetRow';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreConfirmDialog } from '../../../../ui/primitives/OreConfirmDialog';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';
import { useResourceManager } from '../../hooks/useResourceManager';

const TOP_FOCUS_ORDER = ['btn-download-shader', 'btn-open-shader-folder'];
const ROW_ACTIONS = ['toggle', 'delete'] as const;
type RowAction = (typeof ROW_ACTIONS)[number];

interface PendingDeleteState {
  fileName: string;
  rowIndex: number;
}

export const ShaderPanel: React.FC<{ instanceId: string }> = ({ instanceId }) => {
  const { items, isLoading, toggleItem, deleteItem, openFolder, formatSize } = useResourceManager(instanceId, 'shader');
  const setActiveTab = useLauncherStore((state) => state.setActiveTab);
  const setInstanceDownloadTarget = useLauncherStore((state) => state.setInstanceDownloadTarget);
  const inputMode = useInputMode();

  const [operationRowIndex, setOperationRowIndex] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteState | null>(null);

  const getRowFocusKey = (index: number) => `shader-row-${index}`;
  const getActionFocusKey = (index: number, action: RowAction) => `shader-action-${action}-${index}`;

  const rowLevelOrder = useMemo(
    () => [...TOP_FOCUS_ORDER, ...items.map((_, index) => getRowFocusKey(index))],
    [items]
  );

  const { handleLinearArrow: handleRowNavigation } = useLinearNavigation(rowLevelOrder, rowLevelOrder[0], false);

  const enterRowOperation = useCallback((index: number) => {
    setOperationRowIndex(index);
    const firstAction = getActionFocusKey(index, 'toggle');
    window.setTimeout(() => {
      if (doesFocusableExist(firstAction)) {
        setFocus(firstAction);
      }
    }, 20);
  }, []);

  const exitRowOperation = useCallback((index: number) => {
    setOperationRowIndex(null);
    const rowKey = getRowFocusKey(index);
    window.setTimeout(() => {
      if (doesFocusableExist(rowKey)) {
        setFocus(rowKey);
      }
    }, 20);
  }, []);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && operationRowIndex !== null && pendingDelete === null) {
        exitRowOperation(operationRowIndex);
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [exitRowOperation, operationRowIndex, pendingDelete]);

  const handleTopArrow = useCallback((direction: string) => {
    if (direction === 'down') {
      const current = getCurrentFocusKey();
      const topAvailable = TOP_FOCUS_ORDER.filter(doesFocusableExist);
      if (topAvailable.length > 0 && current === topAvailable[topAvailable.length - 1]) {
        const firstRow = getRowFocusKey(0);
        if (doesFocusableExist(firstRow)) {
          setFocus(firstRow);
          return false;
        }
      }
    }

    return handleRowNavigation(direction);
  }, [handleRowNavigation]);

  const handleActionArrow = useCallback((index: number, action: RowAction, direction: string) => {
    if (inputMode === 'mouse') return true;

    if (direction === 'left' || direction === 'right') {
      const currentIndex = ROW_ACTIONS.indexOf(action);
      const nextIndex =
        direction === 'right'
          ? Math.min(ROW_ACTIONS.length - 1, currentIndex + 1)
          : Math.max(0, currentIndex - 1);
      const target = getActionFocusKey(index, ROW_ACTIONS[nextIndex]);
      if (doesFocusableExist(target)) {
        setFocus(target);
      }
      return false;
    }

    if (direction === 'up' || direction === 'down') {
      if (direction === 'up' && index === 0) {
        setOperationRowIndex(null);
        const lastTop = TOP_FOCUS_ORDER[TOP_FOCUS_ORDER.length - 1];
        window.setTimeout(() => {
          if (doesFocusableExist(lastTop)) {
            setFocus(lastTop);
          }
        }, 20);
        return false;
      }

      const nextIndex =
        direction === 'down'
          ? Math.min(items.length - 1, index + 1)
          : Math.max(0, index - 1);

      if (nextIndex !== index) {
        setOperationRowIndex(nextIndex);
        const target = getActionFocusKey(nextIndex, action);
        window.setTimeout(() => {
          if (doesFocusableExist(target)) {
            setFocus(target);
          }
        }, 20);
      }

      return false;
    }

    return false;
  }, [inputMode, items.length]);

  const restoreDeleteFocus = useCallback((rowIndex: number) => {
    const candidates = [
      getActionFocusKey(rowIndex, 'delete'),
      getActionFocusKey(Math.max(0, rowIndex - 1), 'delete'),
      getRowFocusKey(Math.max(0, rowIndex - 1)),
      TOP_FOCUS_ORDER[TOP_FOCUS_ORDER.length - 1],
    ];

    window.setTimeout(() => {
      const next = candidates.find((key) => doesFocusableExist(key));
      if (next) {
        setFocus(next);
      }
    }, 50);
  }, []);

  const handleCloseDeleteConfirm = useCallback(() => {
    if (pendingDelete) {
      restoreDeleteFocus(pendingDelete.rowIndex);
    }
    setPendingDelete(null);
  }, [pendingDelete, restoreDeleteFocus]);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;

    const { fileName, rowIndex } = pendingDelete;
    setPendingDelete(null);
    setOperationRowIndex(null);
    await deleteItem(fileName);
    restoreDeleteFocus(rowIndex);
  }, [deleteItem, pendingDelete, restoreDeleteFocus]);

  return (
    <>
      <SettingsPageLayout>
        <div className="relative flex h-full w-full flex-col">
          <div className="mb-6 flex items-center justify-between border-2 border-[#2A2A2C] bg-[#18181B] p-4">
            <div>
              <h3 className="flex items-center font-minecraft text-white">
                <ImageIcon size={18} className="mr-2 text-ore-green" />
                本地光影包
              </h3>
              <p className="mt-1 text-sm text-ore-text-muted">
                使用前请确保实例已安装 OptiFine、Iris 或 Oculus。
              </p>
            </div>

            <div className="flex items-center gap-3">
              <OreButton
                focusKey="btn-download-shader"
                variant="primary"
                size="sm"
                onArrowPress={handleTopArrow}
                onClick={() => {
                  setInstanceDownloadTarget('shader');
                  setActiveTab('instance-mod-download');
                }}
              >
                <DownloadCloud size={16} className="mr-2" />
                下载光影
              </OreButton>

              <OreButton
                focusKey="btn-open-shader-folder"
                variant="secondary"
                size="sm"
                onArrowPress={handleTopArrow}
                onClick={openFolder}
              >
                <FolderOpen size={16} className="mr-2" />
                打开光影目录
              </OreButton>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={32} className="animate-spin text-ore-green" />
            </div>
          ) : (
            <FocusBoundary
              id="shader-list"
              trapFocus={operationRowIndex !== null}
              className="custom-scrollbar grid grid-cols-1 gap-2 overflow-y-auto px-2 pb-4"
            >
              {items.map((item, index) => (
                <FocusItem
                  key={item.fileName}
                  focusKey={getRowFocusKey(index)}
                  onEnter={() => enterRowOperation(index)}
                  onArrowPress={handleRowNavigation}
                >
                  {({ ref, focused }) => (
                    <div ref={ref as any}>
                      <OreAssetRow
                        focusable={false}
                        focused={focused}
                        operationActive={operationRowIndex === index}
                        inactive={!item.isEnabled}
                        selected={item.isEnabled}
                        title={item.fileName.replace('.zip', '').replace('.disabled', '')}
                        description="本地光影包"
                        metaItems={[`文件名：${item.fileName}    大小：${formatSize(item.fileSize)}`]}
                        leading={<ImageIcon size={28} className="text-[var(--ore-downloadDetail-labelText)] drop-shadow-md" />}
                        trailingClassName="flex items-center space-x-2"
                        trailing={
                          <>
                            <OreSwitch
                              focusKey={getActionFocusKey(index, 'toggle')}
                              checked={item.isEnabled}
                              onArrowPress={(direction) => handleActionArrow(index, 'toggle', direction)}
                              onChange={() => toggleItem(item.fileName, item.isEnabled)}
                            />

                            <OreButton
                              focusKey={getActionFocusKey(index, 'delete')}
                              variant="danger"
                              size="auto"
                              className="!h-10 !min-h-10 !min-w-10 !w-10 !px-0"
                              onArrowPress={(direction) => handleActionArrow(index, 'delete', direction)}
                              onClick={(event) => {
                                event.stopPropagation();
                                setPendingDelete({ fileName: item.fileName, rowIndex: index });
                              }}
                              title="删除光影包"
                            >
                              <Trash2 size={16} />
                            </OreButton>
                          </>
                        }
                      />
                    </div>
                  )}
                </FocusItem>
              ))}
            </FocusBoundary>
          )}
        </div>
      </SettingsPageLayout>

      <OreConfirmDialog
        isOpen={pendingDelete !== null}
        onClose={handleCloseDeleteConfirm}
        onConfirm={handleConfirmDelete}
        title="删除光影包"
        headline={pendingDelete ? `确认删除 "${pendingDelete.fileName}" 吗？` : undefined}
        description="这会从当前实例中永久移除该光影包文件，删除后无法通过启动器撤销。"
        confirmLabel="确认删除"
        cancelLabel="取消"
        confirmVariant="danger"
        tone="danger"
        cancelFocusKey="shader-delete-cancel"
        confirmFocusKey="shader-delete-confirm"
        className="w-full max-w-lg"
        confirmationNote="删除操作不可恢复，请确认当前实例确实不再需要该光影包。"
        confirmationNoteTone="danger"
      />
    </>
  );
};
