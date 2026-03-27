import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { DownloadCloud, FolderOpen, Loader2, Package, Trash2 } from 'lucide-react';

import { useLauncherStore } from '../../../../store/useLauncherStore';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { useInputMode } from '../../../../ui/focus/FocusProvider';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { OreAssetRow } from '../../../../ui/primitives/OreAssetRow';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';
import { useResourceManager } from '../../hooks/useResourceManager';

const TOP_FOCUS_ORDER = ['btn-download-resourcepack', 'btn-open-resourcepack-folder'];
const ROW_ACTIONS = ['toggle', 'delete'] as const;
type RowAction = (typeof ROW_ACTIONS)[number];

export const ResourcePackPanel: React.FC<{ instanceId: string }> = ({ instanceId }) => {
  const { items, isLoading, toggleItem, deleteItem, openFolder, formatSize } = useResourceManager(instanceId, 'resourcePack');
  const setActiveTab = useLauncherStore((state) => state.setActiveTab);
  const setInstanceDownloadTarget = useLauncherStore((state) => state.setInstanceDownloadTarget);
  const inputMode = useInputMode();

  const [operationRowIndex, setOperationRowIndex] = useState<number | null>(null);

  // 焦点键生成器
  const getRowFocusKey = (index: number) => `rp-row-${index}`;
  const getActionFocusKey = (index: number, action: RowAction) => `rp-action-${action}-${index}`;

  // 1. 顶层/行级 焦点序列
  const rowLevelOrder = useMemo(() => [
    ...TOP_FOCUS_ORDER,
    ...items.map((_, i) => getRowFocusKey(i))
  ], [items]);

  const { handleLinearArrow: handleRowNavigation } = useLinearNavigation(rowLevelOrder, rowLevelOrder[0], false);

  // 2. 进入行内操作模式
  const enterRowOperation = useCallback((index: number) => {
    setOperationRowIndex(index);
    const firstAction = getActionFocusKey(index, 'toggle');
    window.setTimeout(() => {
      if (doesFocusableExist(firstAction)) {
        setFocus(firstAction);
      }
    }, 20);
  }, []);

  // 3. 退出行内操作模式
  const exitRowOperation = useCallback((index: number) => {
    setOperationRowIndex(null);
    const rowKey = getRowFocusKey(index);
    window.setTimeout(() => {
      if (doesFocusableExist(rowKey)) {
        setFocus(rowKey);
      }
    }, 20);
  }, []);

  // 处理 Escape 退出操作模式
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && operationRowIndex !== null) {
        exitRowOperation(operationRowIndex);
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [operationRowIndex, exitRowOperation]);

  // 4. 重载顶部按钮导航
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

  // 5. 行内按钮导航
  const handleActionArrow = useCallback((index: number, action: RowAction, direction: string) => {
    if (inputMode === 'mouse') return true;

    if (direction === 'left' || direction === 'right') {
      const idx = ROW_ACTIONS.indexOf(action);
      const nextIdx = direction === 'right'
        ? Math.min(ROW_ACTIONS.length - 1, idx + 1)
        : Math.max(0, idx - 1);
      const target = getActionFocusKey(index, ROW_ACTIONS[nextIdx]);
      if (doesFocusableExist(target)) setFocus(target);
      return false;
    }

    if (direction === 'up' || direction === 'down') {
      if (direction === 'up' && index === 0) {
        setOperationRowIndex(null);
        const lastTop = TOP_FOCUS_ORDER[TOP_FOCUS_ORDER.length - 1];
        window.setTimeout(() => {
          if (doesFocusableExist(lastTop)) setFocus(lastTop);
        }, 20);
        return false;
      }

      const nextIndex = direction === 'down'
        ? Math.min(items.length - 1, index + 1)
        : Math.max(0, index - 1);

      if (nextIndex !== index) {
        setOperationRowIndex(nextIndex);
        const target = getActionFocusKey(nextIndex, action);
        window.setTimeout(() => {
          if (doesFocusableExist(target)) setFocus(target);
        }, 20);
      }
      return false;
    }

    return false;
  }, [items.length, inputMode]);

  return (
    <SettingsPageLayout>
      <div className="relative flex h-full w-full flex-col">
        {/* 顶部控件 */}
        <div className="mb-6 flex items-center justify-between border-2 border-[#2A2A2C] bg-[#18181B] p-4">
          <div>
            <h3 className="flex items-center font-minecraft text-white">
              <Package size={18} className="mr-2 text-ore-green" />
              本地资源包
            </h3>
            <p className="mt-1 text-sm text-ore-text-muted">共 {items.length} 个资源包，支持拖拽 zip 到列表安装。</p>
          </div>

          <div className="flex items-center gap-3">
            <OreButton
              focusKey="btn-download-resourcepack"
              variant="primary"
              size="sm"
              onArrowPress={handleTopArrow}
              onClick={() => {
                setInstanceDownloadTarget('resourcepack');
                setActiveTab('instance-mod-download');
              }}
            >
              <DownloadCloud size={16} className="mr-2" />
              下载资源包
            </OreButton>

            <OreButton
              focusKey="btn-open-resourcepack-folder"
              variant="secondary"
              size="sm"
              onArrowPress={handleTopArrow}
              onClick={openFolder}
            >
              <FolderOpen size={16} className="mr-2" />
              打开资源包目录
            </OreButton>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={32} className="animate-spin text-ore-green" />
          </div>
        ) : (
          <FocusBoundary
            id="resourcepack-list"
            trapFocus={operationRowIndex !== null}
            className="grid grid-cols-1 gap-2 overflow-y-auto px-2 pb-4 custom-scrollbar"
          >
            {items.map((item, i) => (
              <FocusItem
                key={i}
                focusKey={getRowFocusKey(i)}
                onEnter={() => enterRowOperation(i)}
                onArrowPress={handleRowNavigation}
              >
                {({ ref, focused }) => (
                  <div ref={ref as any}>
                    {(() => {
                      const cacheKey = item.modifiedAt || item.fileSize || item.fileName;
                      const iconUrl = item.iconAbsolutePath
                        ? `${convertFileSrc(item.iconAbsolutePath)}?t=${cacheKey}`
                        : undefined;

                      return (
                        <OreAssetRow
                          focusable={false}
                          focused={focused}
                          operationActive={operationRowIndex === i}
                          inactive={!item.isEnabled}
                          selected={item.isEnabled}
                          title={item.fileName.replace('.zip', '').replace('.disabled', '')}
                          description={item.isDirectory ? '文件夹资源包' : 'ZIP 资源包'}
                          metaItems={[`文件名：${item.fileName}    大小：${item.isDirectory ? '文件夹' : formatSize(item.fileSize)}`]}
                          leading={
                            iconUrl ? (
                              <img src={iconUrl} alt="icon" className="h-full w-full object-cover" />
                            ) : (
                              <Package size={28} className="text-[var(--ore-downloadDetail-labelText)] drop-shadow-md" />
                            )
                          }
                      trailingClassName="flex items-center space-x-2"
                      trailing={(
                        <>
                          <OreSwitch
                            focusKey={getActionFocusKey(i, 'toggle')}
                            checked={item.isEnabled}
                            onArrowPress={(dir) => handleActionArrow(i, 'toggle', dir)}
                            onChange={() => toggleItem(item.fileName, item.isEnabled)}
                          />

                          <OreButton
                            focusKey={getActionFocusKey(i, 'delete')}
                            variant="danger"
                            size="auto"
                            className="!h-10 !min-h-10 !min-w-10 !w-10 !px-0"
                            onArrowPress={(dir) => handleActionArrow(i, 'delete', dir)}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteItem(item.fileName);
                            }}
                            title="删除资源包"
                          >
                            <Trash2 size={16} />
                          </OreButton>
                        </>
                      )}
                    />
                  );
                })()}
              </div>
                )}
              </FocusItem>
            ))}
          </FocusBoundary>
        )}
      </div>
    </SettingsPageLayout>
  );
};
