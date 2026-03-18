import React from 'react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { DownloadCloud, FolderOpen, Image as ImageIcon, Loader2, Power, Trash2 } from 'lucide-react';

import { useLauncherStore } from '../../../../store/useLauncherStore';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreList } from '../../../../ui/primitives/OreList';
import { useResourceManager } from '../../hooks/useResourceManager';

export const ShaderPanel: React.FC<{ instanceId: string }> = ({ instanceId }) => {
  const { items, isLoading, toggleItem, deleteItem, openFolder, formatSize } = useResourceManager(instanceId, 'shader');
  const setActiveTab = useLauncherStore((state) => state.setActiveTab);
  const setInstanceDownloadTarget = useLauncherStore((state) => state.setInstanceDownloadTarget);

  return (
    <SettingsPageLayout title="光影管理" subtitle="Shader Packs">
      <div className="relative flex h-full w-full flex-col">
        <FocusItem focusKey="shader-guard-top" onFocus={() => setFocus('btn-open-shader-folder')}>
          {({ ref }) => <div ref={ref as any} className="pointer-events-none absolute left-0 top-0 h-[1px] w-full opacity-0" tabIndex={-1} />}
        </FocusItem>
        <FocusItem focusKey="shader-guard-left" onFocus={() => setFocus('btn-open-shader-folder')}>
          {({ ref }) => <div ref={ref as any} className="pointer-events-none absolute left-0 top-0 h-full w-[1px] opacity-0" tabIndex={-1} />}
        </FocusItem>
        <FocusItem focusKey="shader-guard-right" onFocus={() => setFocus('btn-open-shader-folder')}>
          {({ ref }) => <div ref={ref as any} className="pointer-events-none absolute right-0 top-0 h-full w-[1px] opacity-0" tabIndex={-1} />}
        </FocusItem>
        <FocusItem focusKey="shader-guard-bottom" onFocus={() => setFocus('btn-open-shader-folder')}>
          {({ ref }) => <div ref={ref as any} className="pointer-events-none absolute bottom-0 left-0 h-[1px] w-full opacity-0" tabIndex={-1} />}
        </FocusItem>

        <div className="mb-6 flex items-center justify-between border-2 border-[#2A2A2C] bg-[#18181B] p-4">
          <div>
            <h3 className="flex items-center font-minecraft text-white">
              <ImageIcon size={18} className="mr-2 text-ore-green" />
              本地光影包
            </h3>
            <p className="mt-1 text-sm text-ore-text-muted">使用前请确保实例已安装 OptiFine、Iris 或 Oculus。</p>
          </div>

          <div className="flex items-center gap-3">
            <OreButton
              focusKey="btn-download-shader"
              variant="primary"
              size="sm"
              onClick={() => {
                setInstanceDownloadTarget('shader');
                setActiveTab('instance-mod-download');
              }}
            >
              <DownloadCloud size={16} className="mr-2" />
              下载光影
            </OreButton>

            <OreButton focusKey="btn-open-shader-folder" variant="secondary" size="sm" onClick={openFolder}>
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
          <FocusBoundary id="shader-list" className="grid grid-cols-1 gap-2 overflow-y-auto px-2 pb-4 xl:grid-cols-2 custom-scrollbar">
            {items.map((item, i) => (
              <OreList
                key={i}
                focusKey={`shader-item-${i}`}
                isInactive={!item.isEnabled}
                title={item.fileName.replace('.zip', '').replace('.disabled', '')}
                subtitle={`文件: ${item.fileName} | 大小: ${formatSize(item.fileSize)}`}
                leading={<ImageIcon size={32} className="text-ore-text-muted/50 drop-shadow-md" />}
                trailing={(
                  <div className="flex items-center space-x-2">
                    <OreButton
                      focusKey={`shader-btn-toggle-${i}`}
                      variant={item.isEnabled ? 'secondary' : 'ghost'}
                      size="auto"
                      className="!h-[36px] !min-w-[40px] !px-2.5"
                      onClick={() => toggleItem(item.fileName, item.isEnabled)}
                      title={item.isEnabled ? '点击禁用' : '点击启用'}
                    >
                      <Power size={16} className={item.isEnabled ? 'text-ore-green' : 'text-gray-400'} />
                    </OreButton>

                    <OreButton
                      focusKey={`shader-btn-delete-${i}`}
                      variant="danger"
                      size="auto"
                      className="!h-[36px] !min-w-[40px] !px-2.5"
                      onClick={() => deleteItem(item.fileName)}
                      title="删除光影包"
                    >
                      <Trash2 size={16} />
                    </OreButton>
                  </div>
                )}
              />
            ))}
          </FocusBoundary>
        )}
      </div>
    </SettingsPageLayout>
  );
};
