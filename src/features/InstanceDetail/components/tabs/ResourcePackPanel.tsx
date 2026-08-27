import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { DownloadCloud, FolderOpen, Loader2, Package, Trash2 } from 'lucide-react';

import { useLauncherStore } from '../../../../store/useLauncherStore';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { useInputMode } from '../../../../ui/focus/FocusProvider';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';
import { OreAssetRow } from '../../../../ui/primitives/OreAssetRow';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreConfirmDialog } from '../../../../ui/primitives/OreConfirmDialog';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';
import { OreOverlayScrollArea } from '../../../../ui/primitives/OreOverlayScrollArea';
import { useResourceManager } from '../../hooks/useResourceManager';
import { ResourceIconBox } from './ResourceIconBox';

const TOP_FOCUS_ORDER = ['btn-download-resourcepack', 'btn-open-resourcepack-folder'];
const ROW_ACTIONS = ['toggle', 'delete'] as const;
type RowAction = (typeof ROW_ACTIONS)[number];

interface PendingDeleteState {
  fileName: string;
  rowIndex: number;
}

export const ResourcePackPanel: React.FC<{ instanceId: string }> = ({ instanceId }) => {
  const { t } = useTranslation();
  const { items, isLoading, toggleItem, deleteItem, openFolder, formatSize } = useResourceManager(instanceId, 'resourcePack');
  const setActiveTab = useLauncherStore((state) => state.setActiveTab);
  const setInstanceDownloadTarget = useLauncherStore((state) => state.setInstanceDownloadTarget);
  const inputMode = useInputMode();

  const [operationRowIndex, setOperationRowIndex] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteState | null>(null);

  const getRowFocusKey = (index: number) => `rp-row-${index}`;
  const getActionFocusKey = (index: number, action: RowAction) => `rp-action-${action}-${index}`;

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

  const enabledCount = useMemo(() => items.filter((i) => i.isEnabled).length, [items]);

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-3.5 gap-3">
      {/* 顶部控制台 (Header & Global Action Bar) */}
      <div className="flex shrink-0 items-center justify-between border-[2px] border-[#1E1E1F] bg-[#313233] p-3.5 shadow-[inset_0_1px_rgba(255,255,255,0.1),inset_0_-2px_rgba(0,0,0,0.3)]">
        <div>
          <h3 className="flex items-center font-minecraft font-bold text-base text-white ore-text-shadow">
            <Package size={18} className="mr-2 text-[#E0A33A]" />
            {t('instanceDetail.resourcepacks.title', '本地资源包')}
          </h3>
          <p className="mt-1 font-minecraft text-xs text-[#D0D1D4]">
            {t('instanceDetail.resourcepacks.summary', '已启用 {{enabled}} / 共 {{count}} 个资源包 · 支持拖拽 .zip 文件安装', { enabled: enabledCount, count: items.length })}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <OreButton
            focusKey="btn-download-resourcepack"
            variant="primary"
            size="auto"
            className="!h-10 !min-h-10 px-4 font-minecraft font-bold uppercase tracking-wide text-xs"
            onArrowPress={handleTopArrow}
            onClick={() => {
              setInstanceDownloadTarget('resourcepack');
              setActiveTab('instance-mod-download');
            }}
          >
            <DownloadCloud size={16} className="mr-2" />
            {t('instanceDetail.resourcepacks.downloadBtn', '下载资源包')}
          </OreButton>

          <OreButton
            focusKey="btn-open-resourcepack-folder"
            variant="secondary"
            size="auto"
            className="!h-10 !min-h-10 px-4 font-minecraft font-bold uppercase tracking-wide text-xs"
            onArrowPress={handleTopArrow}
            onClick={openFolder}
          >
            <FolderOpen size={16} className="mr-2" />
            {t('instanceDetail.resourcepacks.openFolderBtn', '打开资源包目录')}
          </OreButton>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-ore-green" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center border-[2px] border-dashed border-[#48494A] bg-[#222224]/60 p-12 text-center select-none">
          <Package size={48} className="text-[#68696B] mb-3" />
          <span className="font-minecraft font-bold text-base text-[#D0D1D4] ore-text-shadow mb-1">
            {t('instanceDetail.resourcepacks.emptyTitle', '暂无资源包')}
          </span>
          <span className="font-minecraft text-xs text-[#8C8D90] max-w-sm leading-relaxed">
            {t('instanceDetail.resourcepacks.emptyDesc', '点击右上角「下载资源包」获取社区材质，或直接将 .zip 资源包文件拖入此窗口即可快速安装。')}
          </span>
        </div>
      ) : (
        <FocusBoundary
          id="resourcepack-list"
          trapFocus={operationRowIndex !== null}
          className="flex-1 min-h-0 flex flex-col"
        >
          <OreOverlayScrollArea className="flex-1 min-h-0" contentClassName="flex flex-col gap-2 pr-1">
            {items.map((item, index) => (
              <FocusItem
                key={item.fileName || `rp-idx-${index}`}
                focusKey={getRowFocusKey(index)}
                onEnter={() => enterRowOperation(index)}
                onArrowPress={handleRowNavigation}
              >
                {({ ref, focused }) => (
                  <div ref={ref as React.RefObject<HTMLDivElement>}>
                    <OreAssetRow
                      focusable={false}
                      focused={focused}
                      operationActive={operationRowIndex === index}
                      inactive={!item.isEnabled}
                      selected={item.isEnabled}
                      title={(item.fileName || '').replace('.zip', '').replace('.disabled', '')}
                      description={item.isDirectory ? t('instanceDetail.resourcepacks.directoryPack', '文件夹资源包') : t('instanceDetail.resourcepacks.zipPack', 'ZIP 资源包')}
                      metaItems={[
                        item.fileName || '', item.isDirectory ? t('instanceDetail.resourcepacks.directory', '文件夹') : formatSize(item.fileSize || 0),
                      ]}
                      leading={
                        <ResourceIconBox
                          item={item}
                          instanceId={instanceId}
                          resType="resourcePack"
                        />
                      }
                      trailingClassName="flex items-center space-x-2.5"
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
                            className="!h-9 !w-9 !min-h-9 !min-w-9 !px-0 flex items-center justify-center"
                            onArrowPress={(direction) => handleActionArrow(index, 'delete', direction)}
                            onClick={(event) => {
                              event.stopPropagation();
                              setPendingDelete({ fileName: item.fileName, rowIndex: index });
                            }}
                            title={t('instanceDetail.resourcepacks.deleteTitle', '删除资源包')}
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
          </OreOverlayScrollArea>
        </FocusBoundary>
      )}

      <OreConfirmDialog
        isOpen={pendingDelete !== null}
        onClose={handleCloseDeleteConfirm}
        onConfirm={handleConfirmDelete}
        title={t('instanceDetail.resourcepacks.deleteTitle', '删除资源包')}
        headline={pendingDelete ? t('instanceDetail.resourcepacks.deleteHeadline', '确认删除 "{{name}}" 吗？', { name: pendingDelete.fileName }) : undefined}
        description={t('instanceDetail.resourcepacks.deleteDesc', '这会从当前实例中永久移除该资源包文件，删除后无法通过启动器撤销。')}
        confirmLabel={t('instanceDetail.resourcepacks.deleteConfirmBtn', '确认删除')}
        cancelLabel={t('common.cancel', '取消')}
        confirmVariant="danger"
        tone="danger"
        cancelFocusKey="resourcepack-delete-cancel"
        confirmFocusKey="resourcepack-delete-confirm"
        className="w-[580px] max-w-[92vw]"
        confirmationNote={t('instanceDetail.resourcepacks.deleteNote', '删除操作不可恢复，请确认当前实例确实不再需要该资源包。')}
        confirmationNoteTone="danger"
      />
    </div>
  );
};
