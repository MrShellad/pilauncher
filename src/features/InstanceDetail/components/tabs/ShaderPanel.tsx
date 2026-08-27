import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { DownloadCloud, FolderOpen, Image as ImageIcon, Loader2, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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

const TOP_FOCUS_ORDER = ['btn-download-shader', 'btn-open-shader-folder'];
const ROW_ACTIONS = ['toggle', 'delete'] as const;
type RowAction = (typeof ROW_ACTIONS)[number];

interface PendingDeleteState {
  fileName: string;
  rowIndex: number;
}

export const ShaderPanel: React.FC<{ instanceId: string }> = ({ instanceId }) => {
  const { t } = useTranslation();
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

  const enabledCount = useMemo(() => items.filter((i) => i.isEnabled).length, [items]);

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-3.5 gap-3">
      {/* 顶部控制台 (Header & Global Actions) */}
      <div className="flex shrink-0 items-center justify-between border-[2px] border-[#1E1E1F] bg-[#313233] p-3.5 shadow-[inset_0_1px_rgba(255,255,255,0.1),inset_0_-2px_rgba(0,0,0,0.3)]">
        <div>
          <h3 className="flex items-center font-minecraft font-bold text-base text-white ore-text-shadow">
            <ImageIcon size={18} className="mr-2 text-[#4EB8DE]" />
            {t('instanceDetail.shader.title', { defaultValue: '本地光影包' })}
          </h3>
          <p className="mt-1 font-minecraft text-xs text-[#D0D1D4]">
            {t('instanceDetail.shader.subtitle', { defaultValue: '已启用 {{enabled}} / 共 {{count}} 个光影包 · 请确保已安装 OptiFine/Iris/Oculus', enabled: enabledCount, count: items.length })}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <OreButton
            focusKey="btn-download-shader"
            variant="primary"
            size="auto"
            className="!h-10 !min-h-10 px-4 font-minecraft font-bold uppercase tracking-wide text-xs"
            onArrowPress={handleTopArrow}
            onClick={() => {
              setInstanceDownloadTarget('shader');
              setActiveTab('instance-mod-download');
            }}
          >
            <DownloadCloud size={16} className="mr-2" />
            {t('instanceDetail.shader.downloadShader', { defaultValue: '下载光影' })}
          </OreButton>

          <OreButton
            focusKey="btn-open-shader-folder"
            variant="secondary"
            size="auto"
            className="!h-10 !min-h-10 px-4 font-minecraft font-bold uppercase tracking-wide text-xs"
            onArrowPress={handleTopArrow}
            onClick={openFolder}
          >
            <FolderOpen size={16} className="mr-2" />
            {t('instanceDetail.shader.openShaderFolder', { defaultValue: '打开光影目录' })}
          </OreButton>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-ore-green" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center border-[2px] border-dashed border-[#48494A] bg-[#222224]/60 p-12 text-center select-none">
          <ImageIcon size={48} className="text-[#68696B] mb-3" />
          <span className="font-minecraft font-bold text-base text-[#D0D1D4] ore-text-shadow mb-1">
            {t('instanceDetail.shader.emptyTitle', { defaultValue: '暂无光影包' })}
          </span>
          <span className="font-minecraft text-xs text-[#8C8D90] max-w-sm leading-relaxed">
            {t('instanceDetail.shader.emptyDesc', { defaultValue: '点击右上角「下载光影」获取社区光影包，或直接将 .zip 文件拖入此窗口即可快速安装。' })}
          </span>
        </div>
      ) : (
        <FocusBoundary
          id="shader-list"
          trapFocus={operationRowIndex !== null}
          className="flex-1 min-h-0 flex flex-col"
        >
          <OreOverlayScrollArea className="flex-1 min-h-0" contentClassName="flex flex-col gap-2 pr-1">
            {items.map((item, index) => (
              <FocusItem
                key={item.fileName || `shader-idx-${index}`}
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
                      description={item.isDirectory ? t('instanceDetail.shader.folderShaderPack', { defaultValue: '文件夹光影包' }) : t('instanceDetail.shader.zipShaderPack', { defaultValue: 'ZIP 光影包' })}
                      metaItems={[item.fileName || '', formatSize(item.fileSize || 0)]}
                      leading={
                        <ResourceIconBox
                          item={item}
                          instanceId={instanceId}
                          resType="shader"
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
                            title={t('instanceDetail.shader.deleteShaderPack', { defaultValue: '删除光影包' })}
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
        title={t('instanceDetail.shader.deleteShaderPack', { defaultValue: '删除光影包' })}
        headline={pendingDelete ? t('instanceDetail.shader.deleteConfirmHeadline', { defaultValue: '确认删除 "{{fileName}}" 吗？', fileName: pendingDelete.fileName }) : undefined}
        description={t('instanceDetail.shader.deleteConfirmDescription', { defaultValue: '这会从当前实例中永久移除该光影包文件，删除后无法通过启动器撤销。' })}
        confirmLabel={t('instanceDetail.shader.confirmDelete', { defaultValue: '确认删除' })}
        cancelLabel={t('instanceDetail.shader.cancel', { defaultValue: '取消' })}
        confirmVariant="danger"
        tone="danger"
        cancelFocusKey="shader-delete-cancel"
        confirmFocusKey="shader-delete-confirm"
        className="w-[580px] max-w-[92vw]"
        confirmationNote={t('instanceDetail.shader.deleteConfirmNote', { defaultValue: '删除操作不可恢复，请确认当前实例确实不再需要该光影包。' })}
        confirmationNoteTone="danger"
      />
    </div>
  );
};
