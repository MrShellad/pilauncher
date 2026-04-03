// /src/pages/Instances.tsx
import React, { useState, useEffect } from 'react';
import { useInstances } from '../hooks/pages/Instances/useInstances';
import { OreButton } from '../ui/primitives/OreButton';
import { Plus, FolderPlus, List, LayoutGrid, Loader2, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { OreModal } from '../ui/primitives/OreModal';
import { getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';

import { InstanceListView } from '../features/Instances/components/InstanceListView';
import { InstanceCardView } from '../features/Instances/components/InstanceCardView';

// 引入空间焦点引擎
import { FocusBoundary } from '../ui/focus/FocusBoundary';
import { FocusItem } from '../ui/focus/FocusItem';
import { focusManager } from '../ui/focus/FocusManager';

import { DirectoryBrowserModal } from '../ui/components/DirectoryBrowserModal';

const Instances: React.FC = () => {
  const {
    instances,
    importState,
    closeImportModal,
    confirmDownloadMissing,
    handleCreate,
    handleAddThirdPartyFolder,
    handleEdit,
    handleCardClick
  } = useInstances();

  const [isDirModalOpen, setIsDirModalOpen] = useState(false);

  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    return (localStorage.getItem('ore-instance-view-mode') as 'list' | 'grid') || 'grid';
  });

  useEffect(() => {
    localStorage.setItem('ore-instance-view-mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      focusManager.focus('action-new');
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (instances.length === 0) return;
    const timer = setTimeout(() => {
      const currentFocusKey = getCurrentFocusKey();
      const isActionAreaFocus =
        currentFocusKey === 'SN:ROOT' ||
        currentFocusKey === 'action-new' ||
        currentFocusKey === 'action-folder' ||
        currentFocusKey === 'view-grid' ||
        currentFocusKey === 'view-list';

      if (!isActionAreaFocus) return;

      const firstInstanceFocusKey = viewMode === 'list'
        ? `list-play-${instances[0].id}`
        : `card-play-${instances[0].id}`;
      focusManager.focus(firstInstanceFocusKey);
    }, 120);
    return () => clearTimeout(timer);
  }, [instances, viewMode]);

  return (
    <FocusBoundary id="instances-page" isActive={!isDirModalOpen} className="flex h-full w-full flex-col overflow-hidden px-6 pb-6 pt-3 sm:px-8 sm:pb-8 sm:pt-4">

      {/* 1. 顶部操作区 */}
      {/* ✅ 修复点 1：强制 flex-row 不换行，items-center 保证左右两组按钮绝对水平垂直居中对齐 */}
      <div className="mb-4 flex w-full flex-shrink-0 flex-row items-center justify-between gap-4 lg:mb-5">

        {/* 左侧：视图切换器 (加上 flex-shrink-0 确保在极小宽度下也不会被挤压变形) */}
        <div className="flex items-center bg-[#1E1E1F] border-2 border-ore-gray-border p-0.5 flex-shrink-0">
          <FocusItem focusKey="view-list" onEnter={() => setViewMode('list')}>
            {({ ref, focused }) => (
              <button
                ref={ref}
                onClick={() => setViewMode('list')}
                className={`p-1.5 transition-colors focus:outline-none ${viewMode === 'list' ? 'bg-white/20 text-white shadow-inner' : 'text-ore-text-muted hover:text-white hover:bg-white/10'} ${focused ? 'outline outline-[3px] outline-offset-[-2px] outline-white z-10 relative' : ''}`}
                title="列表视图"
                tabIndex={-1}
              >
                <List size={20} />
              </button>
            )}
          </FocusItem>

          <FocusItem focusKey="view-grid" onEnter={() => setViewMode('grid')}>
            {({ ref, focused }) => (
              <button
                ref={ref}
                onClick={() => setViewMode('grid')}
                className={`p-1.5 transition-colors focus:outline-none ${viewMode === 'grid' ? 'bg-white/20 text-white shadow-inner' : 'text-ore-text-muted hover:text-white hover:bg-white/10'} ${focused ? 'outline outline-[3px] outline-offset-[-2px] outline-white z-10 relative' : ''}`}
                title="网格视图"
                tabIndex={-1}
              >
                <LayoutGrid size={20} />
              </button>
            )}
          </FocusItem>
        </div>

        {/* 右侧：操作按钮 */}
        {/* ✅ 修复点 2：
            - 去掉 flex-wrap，换回 overflow-x-auto 防止换行，超窄屏幕下可平滑横向滚动。
            - 增加 p-2 给 outline 焦点光环留出绝对充足的绘制空间，绝不被截断。
            - 增加 -mr-2 (负 Margin) 抵消 p-2 带来的布局偏移，确保右侧依然能完美贴合屏幕边缘！
            - justify-end 确保按钮永远靠右对齐。
        */}
        <div className="mr-[-0.5rem] flex flex-1 flex-row items-center justify-end gap-3 overflow-x-auto p-[0.375rem] pt-[0.125rem] scrollbar-none">

          {/* 给每个包裹层加上 flex-shrink-0 防止在拥挤时被压缩 */}
          <FocusItem focusKey="action-new" onEnter={handleCreate}>
            {({ ref, focused }) => (
              <div ref={ref} className={`rounded-sm transition-shadow duration-150 flex-shrink-0 ${focused ? 'outline outline-2 outline-offset-[4px] outline-white' : 'outline outline-2 outline-offset-[4px] outline-transparent'}`}>
                <OreButton variant="primary" size="auto" className="!h-auto !min-w-0 !px-0" onClick={handleCreate} tabIndex={-1}>
                  <span className="flex h-[clamp(2.35rem,3.1vh,3.6rem)] min-w-[clamp(9.2rem,14.2vw,15.4rem)] items-center justify-center whitespace-nowrap px-[clamp(0.65rem,1vw,1.2rem)]">
                    <Plus className="mr-[clamp(0.35rem,0.6vw,0.6rem)] h-[clamp(0.9rem,1.1vw,1.25rem)] w-[clamp(0.9rem,1.1vw,1.25rem)] flex-shrink-0" />
                    <span className="font-minecraft text-[clamp(0.9rem,0.84rem+0.4vw,1.15rem)] tracking-wider">新建实例</span>
                  </span>
                </OreButton>
              </div>
            )}
          </FocusItem>

          <FocusItem focusKey="action-folder" onEnter={() => setIsDirModalOpen(true)}>
            {({ ref, focused }) => (
              <div ref={ref} className={`rounded-sm transition-shadow duration-150 flex-shrink-0 ${focused ? 'outline outline-2 outline-offset-[4px] outline-white' : 'outline outline-2 outline-offset-[4px] outline-transparent'}`}>
                <OreButton variant="secondary" size="auto" className="!h-auto !min-w-0 !px-0" onClick={() => setIsDirModalOpen(true)} tabIndex={-1}>
                  <span className="flex h-[clamp(2.35rem,3.1vh,3.6rem)] min-w-[clamp(10.3rem,16.8vw,17.4rem)] items-center justify-center whitespace-nowrap px-[clamp(0.65rem,1vw,1.2rem)]">
                    <FolderPlus className="mr-[clamp(0.35rem,0.6vw,0.6rem)] h-[clamp(0.9rem,1.1vw,1.25rem)] w-[clamp(0.9rem,1.1vw,1.25rem)] flex-shrink-0" />
                    <span className="font-minecraft text-[clamp(0.9rem,0.84rem+0.4vw,1.15rem)] tracking-wider">扫描实例目录</span>
                  </span>
                </OreButton>
              </div>
            )}
          </FocusItem>

        </div>
      </div>

      {/* 2. 实例列表区 */}
      <div className={`
        flex-1 overflow-y-auto pr-0 pb-10
        scrollbar-none
        ${viewMode === 'grid'
          ? 'flex flex-wrap gap-4 sm:gap-5 lg:gap-6 content-start justify-center'
          : 'flex flex-col space-y-3'
        }
      `}>
        {instances.map((instance) => (
          viewMode === 'list' ? (
            <InstanceListView key={instance.id} instance={instance} onClick={() => handleCardClick(instance.id)} onEdit={() => handleEdit(instance.id)} />
          ) : (
            <InstanceCardView key={instance.id} instance={instance} onClick={() => handleCardClick(instance.id)} onEdit={() => handleEdit(instance.id)} />
          )
        ))}
      </div>

      {isDirModalOpen && (
        <DirectoryBrowserModal
          isOpen={isDirModalOpen}
          onClose={() => setIsDirModalOpen(false)}
          onSelect={(path) => {
            setIsDirModalOpen(false);
            handleAddThirdPartyFolder(path);
          }}
        />
      )}

      {/* Import Status Modal */}
      {importState.isOpen && (
        <OreModal
          isOpen={importState.isOpen}
          onClose={importState.status === 'scanning' ? () => {} : closeImportModal}
          title={
            importState.status === 'scanning' ? '正在处理...' :
            importState.status === 'success' ? '导入成功' :
            importState.status === 'partial_missing' ? '导入完成（需补全）' :
            importState.status === 'empty' ? '未找到实例' : '导入失败'
          }
          className="!w-[500px]"
          actions={
            <div className="flex justify-end gap-3 w-full">
              {importState.status !== 'scanning' && (
                <OreButton variant="ghost" size="sm" onClick={closeImportModal} focusKey="import-close">
                  关闭
                </OreButton>
              )}
              {importState.status === 'partial_missing' && (
                <OreButton variant="primary" size="sm" onClick={confirmDownloadMissing} focusKey="import-download">
                  前往下载管理补全
                </OreButton>
              )}
            </div>
          }
        >
          <div className="flex flex-col items-center justify-center p-6 text-center space-y-4">
            {importState.status === 'scanning' && (
              <>
                <Loader2 size={48} className="animate-spin text-ore-green" />
                <p className="text-white font-minecraft tracking-wider">正在扫描并注册实例，请稍候...</p>
              </>
            )}
            {importState.status === 'success' && (
              <>
                <CheckCircle2 size={48} className="text-ore-green" />
                <p className="text-white font-minecraft tracking-wider">成功导入 {importState.added} 个实例，本地运行环境完整！</p>
              </>
            )}
            {importState.status === 'partial_missing' && (
              <>
                <AlertTriangle size={48} className="text-[#FFE866]" />
                <p className="text-white font-minecraft text-lg tracking-wider">
                  成功导入 {importState.added} 个实例。
                </p>
                <div className="bg-[#141415] border border-[#2A2A2C] p-4 text-left w-full mt-2">
                  <span className="text-ore-text-muted text-sm font-minecraft leading-relaxed">发现有 <strong className="text-white">{importState.missing.length}</strong> 个实例缺少部分本地运行环境（如指定的 MC 版本、Loader 或特定的 JVM）。<br/><br/>为了正常启动这些实例，建议立即前往下载管理补全缺失依赖。</span>
                </div>
              </>
            )}
            {importState.status === 'empty' && (
              <>
                <FolderPlus size={48} className="text-ore-text-muted opacity-50" />
                <p className="text-white font-minecraft tracking-wider">该目录下未扫描到任何兼容的实例格式。</p>
                <p className="text-sm text-ore-text-muted pt-2 border-t border-[#2A2A2C] w-full">请直接选择那些包含 <code>instance.json</code> 或 <code>{`{版本名}.json`}</code>（如 HMCL/PCL 结构）的实例根目录，或者它们的上级目录。</p>
              </>
            )}
            {importState.status === 'error' && (
              <>
                <AlertCircle size={48} className="text-red-500" />
                <p className="text-red-400 font-minecraft tracking-wider">扫描出错：</p>
                <code className="text-xs bg-[#141415] p-2 text-red-300 w-full text-left overflow-hidden text-ellipsis whitespace-nowrap">{importState.errorMsg}</code>
              </>
            )}
          </div>
        </OreModal>
      )}

    </FocusBoundary>
  );
};

export default Instances;
