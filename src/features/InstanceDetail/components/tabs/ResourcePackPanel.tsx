import React, { useCallback, useMemo } from 'react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { DownloadCloud, FolderOpen, Loader2, Package, Power, Trash2 } from 'lucide-react';

import { useLauncherStore } from '../../../../store/useLauncherStore';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { OreAssetRow } from '../../../../ui/primitives/OreAssetRow';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { useResourceManager } from '../../hooks/useResourceManager';

const TOP_FOCUS_ORDER = ['btn-download-resourcepack', 'btn-open-resourcepack-folder'];

export const ResourcePackPanel: React.FC<{ instanceId: string }> = ({ instanceId }) => {
  const { items, isLoading, toggleItem, deleteItem, openFolder, formatSize } = useResourceManager(instanceId, 'resourcePack');
  const setActiveTab = useLauncherStore((state) => state.setActiveTab);
  const setInstanceDownloadTarget = useLauncherStore((state) => state.setInstanceDownloadTarget);

  // 全部焦点：顶部 2 个按钮 + 每行 2 个操作按钮
  const fullFocusOrder = useMemo(() => [
    ...TOP_FOCUS_ORDER,
    ...items.flatMap((_, i) => [`resourcepack-btn-toggle-${i}`, `resourcepack-btn-delete-${i}`])
  ], [items]);

  const { handleLinearArrow } = useLinearNavigation(fullFocusOrder, fullFocusOrder[0], false);

  // 顶部按钮：末尾向下跳入列表
  const handleTopArrow = useCallback((direction: string) => {
    if (direction === 'down') {
      const available = fullFocusOrder.filter((k) => doesFocusableExist(k));
      const current = getCurrentFocusKey();
      const topAvailable = TOP_FOCUS_ORDER.filter((k) => doesFocusableExist(k));
      if (topAvailable.length > 0 && current === topAvailable[topAvailable.length - 1]) {
        const firstRow = available.find((k) => !TOP_FOCUS_ORDER.includes(k));
        if (firstRow) { setFocus(firstRow); return false; }
      }
    }
    return handleLinearArrow(direction);
  }, [fullFocusOrder, handleLinearArrow]);

  // 列表按钮：第一个向上跳回顶部
  const handleRowArrow = useCallback((direction: string) => {
    if (direction === 'up') {
      const available = fullFocusOrder.filter((k) => doesFocusableExist(k));
      const current = getCurrentFocusKey();
      const firstRow = available.find((k) => !TOP_FOCUS_ORDER.includes(k));
      if (current && firstRow && current === firstRow) {
        const topAvailable = TOP_FOCUS_ORDER.filter((k) => doesFocusableExist(k));
        const target = topAvailable[topAvailable.length - 1];
        if (target) { setFocus(target); return false; }
      }
    }
    return handleLinearArrow(direction);
  }, [fullFocusOrder, handleLinearArrow]);

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
            trapFocus={false}
            className="grid grid-cols-1 gap-2 overflow-y-auto px-2 pb-4 xl:grid-cols-2 custom-scrollbar"
          >
            {items.map((item, i) => (
              <OreAssetRow
                key={i}
                focusable={false}
                inactive={!item.isEnabled}
                selected={item.isEnabled}
                title={item.fileName.replace('.zip', '').replace('.disabled', '')}
                badges={(
                  <span
                    className={`flex-shrink-0 border-[2px] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] ${
                      item.isEnabled ? 'bg-[#24563C] text-white' : 'bg-[#313233] text-[#D0D1D4]'
                    }`}
                    style={{ borderColor: 'var(--ore-downloadDetail-divider)' }}
                  >
                    {item.isEnabled ? '已启用' : '已禁用'}
                  </span>
                )}
                description={item.isDirectory ? '文件夹资源包' : 'ZIP 资源包'}
                metaItems={[
                  item.fileName,
                  item.isDirectory ? '文件夹' : formatSize(item.fileSize),
                  new Date(item.modifiedAt).toLocaleDateString()
                ]}
                leading={<Package size={26} className="text-[var(--ore-downloadDetail-labelText)] drop-shadow-md" />}
                trailingClassName="flex items-center space-x-2"
                trailing={(
                  <>
                    <OreButton
                      focusKey={`resourcepack-btn-toggle-${i}`}
                      variant={item.isEnabled ? 'secondary' : 'ghost'}
                      size="auto"
                      className="!h-10 !min-h-10 !min-w-10 !w-10 !px-0"
                      onArrowPress={handleRowArrow}
                      onClick={() => toggleItem(item.fileName, item.isEnabled)}
                      title={item.isEnabled ? '点击禁用' : '点击启用'}
                    >
                      <Power size={16} className={item.isEnabled ? 'text-ore-green' : 'text-gray-400'} />
                    </OreButton>

                    <OreButton
                      focusKey={`resourcepack-btn-delete-${i}`}
                      variant="danger"
                      size="auto"
                      className="!h-10 !min-h-10 !min-w-10 !w-10 !px-0"
                      onArrowPress={handleRowArrow}
                      onClick={() => deleteItem(item.fileName)}
                      title="删除资源包"
                    >
                      <Trash2 size={16} />
                    </OreButton>
                  </>
                )}
              />
            ))}
          </FocusBoundary>
        )}
      </div>
    </SettingsPageLayout>
  );
};
