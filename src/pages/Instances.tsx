import React, { useEffect, useState } from 'react';
import { getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';
import {
  FolderPlus,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  RefreshCw,
} from 'lucide-react';

import { InstanceListView } from '../features/Instances/components/InstanceListView';
import { ThirdPartyImportModal } from '../features/Instances/components/ThirdPartyImport/ThirdPartyImportModal';
import { ThirdPartyImportPanel } from '../features/Instances/components/ThirdPartyImport/ThirdPartyImportPanel';
import type { SortType } from '../hooks/pages/Instances/useInstances';
import { useInstances } from '../hooks/pages/Instances/useInstances';
import { useThirdPartyImport } from '../hooks/pages/Instances/useThirdPartyImport';
import { DirectoryBrowserModal } from '../ui/components/DirectoryBrowserModal';
import { FocusBoundary } from '../ui/focus/FocusBoundary';
import { FocusItem } from '../ui/focus/FocusItem';
import { focusManager } from '../ui/focus/FocusManager';
import { OreInput } from '../ui/primitives/OreInput';
import { OreDropdown } from '../ui/primitives/OreDropdown';
import { OreModal } from '../ui/primitives/OreModal';
import { OreTag } from '../ui/primitives/OreTag';
import { OreButton } from '../ui/primitives/OreButton';
import { Filter, Tags, Search } from 'lucide-react';
import { InstanceCardView } from '../features/Instances/components/InstanceCardView';

const Instances: React.FC = () => {
  const {
    instances,
    filteredInstances,
    availableTags,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    selectedTags,
    setSelectedTags,
    loadInstances,
    handleCreate,
    handleEdit,
    handleCardClick,
  } = useInstances();

  const {
    isPanelOpen,
    setIsPanelOpen,
    importSources,
    isDetectingSources,
    importState,
    isImporting,
    closeImportModal,
    confirmDownloadMissing,
    refreshImportSources,
    inspectThirdPartySource,
    handleImportSource,
  } = useThirdPartyImport({ onImportSuccess: loadInstances });

  const [isDirModalOpen, setIsDirModalOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    return (localStorage.getItem('ore-instance-view-mode') as 'list' | 'grid') || 'grid';
  });

  const hasAutoFocused = React.useRef(false);

  useEffect(() => {
    localStorage.setItem('ore-instance-view-mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (hasAutoFocused.current) return;

    const timer = setTimeout(() => {
      if (filteredInstances.length > 0) {
        hasAutoFocused.current = true;
        const firstInstanceFocusKey =
          viewMode === 'list'
            ? `list-play-${filteredInstances[0].id}`
            : `card-play-${filteredInstances[0].id}`;
        focusManager.focus(firstInstanceFocusKey);
      } else if (instances.length === 0) {
        hasAutoFocused.current = true;
        focusManager.focus('action-new');
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [filteredInstances, instances, viewMode]);


  return (
    <FocusBoundary
      id="instances-page"
      isActive={!isDirModalOpen}
      className="flex h-full w-full flex-col overflow-hidden px-6 pb-6 pt-3 sm:px-8 sm:pb-8 sm:pt-4"
    >
      <div className="mb-4 flex w-full flex-wrap items-center justify-between gap-4 lg:mb-5">
        {/* 左侧组：视图切换、搜索、排序、标签 */}
        <div className="flex flex-row items-center gap-3 flex-wrap">
          <FocusItem focusKey="view-toggle" onEnter={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
            {({ ref, focused }) => (
              <button
                ref={ref}
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className={`flex items-center justify-center h-[40px] w-[40px] rounded-sm bg-[#1E1E1F] border-2 border-ore-gray-border transition-colors focus:outline-none hover:bg-white/10 ${focused ? 'outline outline-[3px] outline-offset-[2px] outline-white z-10' : ''
                  }`}
                title={viewMode === 'grid' ? '切换为列表视图' : '切换为网格视图'}
                tabIndex={-1}
              >
                {viewMode === 'grid' ? <List size={18} className="text-white" /> : <LayoutGrid size={18} className="text-white" />}
              </button>
            )}
          </FocusItem>

          <div className="w-[180px] lg:w-[220px]">
            <OreInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索实例..."
              prefixNode={<Search size={16} />}
              focusKey="instances-search"
              height="40px"
              className="!text-sm"
            />
          </div>

          <div className="w-[140px] flex-shrink-0">
            <OreDropdown
              options={[
                { label: "最近游玩", value: "lastPlayed" },
                { label: "创建时间", value: "createdAt" }
              ]}
              value={sortBy}
              onChange={(v) => setSortBy(v as SortType)}
              focusKey="instances-sort"
              className="!h-[40px]"
              prefixNode={<Filter size={14} />}
            />
          </div>

          <FocusItem focusKey="instances-tags" onEnter={() => setIsTagModalOpen(true)}>
            {({ ref, focused }) => (
              <div ref={ref} className={`flex-shrink-0 transition-all ${focused ? 'outline outline-2 outline-white rounded-sm z-10' : ''}`}>
                <OreButton
                  variant="secondary"
                  size="auto"
                  className="!h-[40px] px-4 relative !min-w-0"
                  onClick={() => setIsTagModalOpen(true)}
                  tabIndex={-1}
                >
                  <Tags size={14} className="mr-1.5 flex-shrink-0" />
                  <span className="font-minecraft text-sm">标签</span>
                  {selectedTags.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-ore-green text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">
                      {selectedTags.length}
                    </span>
                  )}
                </OreButton>
              </div>
            )}
          </FocusItem>
        </div>

        {/* 右侧组：操作按钮 */}
        <div className="flex flex-row items-center gap-3 flex-wrap p-2 -m-2">
          <FocusItem focusKey="action-new" onEnter={handleCreate}>
            {({ ref, focused }) => (
              <div
                ref={ref}
                className={`flex-shrink-0 rounded-sm transition-shadow duration-150 ${focused
                    ? 'outline outline-2 outline-offset-[4px] outline-white'
                    : 'outline outline-2 outline-offset-[4px] outline-transparent'
                  }`}
              >
                <OreButton
                  variant="primary"
                  size="auto"
                  className="!h-[40px] !min-w-0 !px-0"
                  onClick={handleCreate}
                  tabIndex={-1}
                >
                  <span className="flex h-full min-w-[clamp(9.2rem,14.2vw,15.4rem)] items-center justify-center whitespace-nowrap px-3">
                    <Plus className="mr-[clamp(0.35rem,0.6vw,0.6rem)] h-[clamp(0.9rem,1.1vw,1.25rem)] w-[clamp(0.9rem,1.1vw,1.25rem)] flex-shrink-0" />
                    <span className="font-minecraft text-[clamp(0.9rem,0.84rem+0.4vw,1.15rem)] tracking-wider">
                      新建实例
                    </span>
                  </span>
                </OreButton>
              </div>
            )}
          </FocusItem>

          <FocusItem focusKey="action-folder" onEnter={() => setIsDirModalOpen(true)}>
            {({ ref, focused }) => (
              <div
                ref={ref}
                className={`flex-shrink-0 rounded-sm transition-shadow duration-150 ${focused
                    ? 'outline outline-2 outline-offset-[4px] outline-white'
                    : 'outline outline-2 outline-offset-[4px] outline-transparent'
                  }`}
              >
                <OreButton
                  variant="secondary"
                  size="auto"
                  className="!h-[40px] !min-w-0 !px-0"
                  onClick={() => setIsDirModalOpen(true)}
                  tabIndex={-1}
                >
                  <span className="flex h-full min-w-[clamp(10.8rem,18vw,18rem)] items-center justify-center whitespace-nowrap px-3">
                    <FolderPlus className="mr-[clamp(0.35rem,0.6vw,0.6rem)] h-[clamp(0.9rem,1.1vw,1.25rem)] w-[clamp(0.9rem,1.1vw,1.25rem)] flex-shrink-0" />
                    <span className="font-minecraft text-[clamp(0.9rem,0.84rem+0.4vw,1.15rem)] tracking-wider">
                      选择启动器库
                    </span>
                  </span>
                </OreButton>
              </div>
            )}
          </FocusItem>

          <FocusItem focusKey="action-detect" onEnter={() => void refreshImportSources()}>
            {({ ref, focused }) => (
              <div
                ref={ref}
                className={`flex-shrink-0 rounded-sm transition-shadow duration-150 ${focused
                    ? 'outline outline-2 outline-offset-[4px] outline-white'
                    : 'outline outline-2 outline-offset-[4px] outline-transparent'
                  }`}
              >
                <OreButton
                  variant="secondary"
                  size="auto"
                  className="!h-[40px] !min-w-0 !px-0"
                  onClick={() => void refreshImportSources()}
                  disabled={isDetectingSources || isImporting}
                  tabIndex={-1}
                >
                  <span className="flex h-full min-w-[clamp(9.8rem,16vw,16.2rem)] items-center justify-center whitespace-nowrap px-3">
                    {isDetectingSources ? (
                      <Loader2 className="mr-[clamp(0.35rem,0.6vw,0.6rem)] h-[clamp(0.9rem,1.1vw,1.25rem)] w-[clamp(0.9rem,1.1vw,1.25rem)] animate-spin flex-shrink-0" />
                    ) : (
                      <RefreshCw className="mr-[clamp(0.35rem,0.6vw,0.6rem)] h-[clamp(0.9rem,1.1vw,1.25rem)] w-[clamp(0.9rem,1.1vw,1.25rem)] flex-shrink-0" />
                    )}
                    <span className="font-minecraft text-[clamp(0.9rem,0.84rem+0.4vw,1.15rem)] tracking-wider">
                      自动探测
                    </span>
                  </span>
                </OreButton>
              </div>
            )}
          </FocusItem>
        </div>
      </div>

      <ThirdPartyImportPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        importSources={importSources}
        isDetectingSources={isDetectingSources}
        isImporting={isImporting}
        handleImportSource={handleImportSource}
      />

      <div
        className={`
          min-h-0 flex-1 overflow-y-auto pb-10 pr-0 scrollbar-none
          ${viewMode === 'grid'
            ? 'flex flex-wrap content-start justify-center gap-4 sm:gap-5 lg:gap-6'
            : 'grid grid-cols-1 content-start gap-3 auto-rows-max'
          }
        `}
      >
        {filteredInstances.map((instance) =>
          viewMode === 'list' ? (
            <InstanceListView
              key={instance.id}
              instance={instance}
              onClick={() => handleCardClick(instance.id)}
              onEdit={() => handleEdit(instance.id)}
            />
          ) : (
            <InstanceCardView
              key={instance.id}
              instance={instance}
              onClick={() => handleCardClick(instance.id)}
              onEdit={() => handleEdit(instance.id)}
            />
          )
        )}
      </div>

      {isDirModalOpen && (
        <DirectoryBrowserModal
          isOpen={isDirModalOpen}
          onClose={() => setIsDirModalOpen(false)}
          onSelect={(path) => {
            setIsDirModalOpen(false);
            setTimeout(() => {
              void inspectThirdPartySource(path);
            }, 150);
          }}
        />
      )}

      <ThirdPartyImportModal
        importState={importState}
        isImporting={isImporting}
        closeImportModal={closeImportModal}
        confirmDownloadMissing={confirmDownloadMissing}
      />

      {isTagModalOpen && (
        <OreModal
          isOpen={isTagModalOpen}
          onClose={() => setIsTagModalOpen(false)}
          title="标签筛选"
          showCloseButton
          width="min(500px, 90vw)"
        >
          <div className="flex flex-col gap-4 p-2 text-white">
            <p className="text-sm text-ore-text-muted font-minecraft">选择下方的标签来筛选显示的实例列表。</p>
            {availableTags.length === 0 ? (
              <div className="py-8 text-center text-ore-text-muted border-2 border-dashed border-white/10 rounded">
                目前没有任何可用的标签
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <FocusItem
                      key={tag}
                      focusKey={`tag-filter-${tag}`}
                      onEnter={() => {
                        setSelectedTags(prev =>
                          prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                        );
                      }}
                    >
                      {({ ref, focused }) => (
                        <div ref={ref as any}>
                          <OreTag
                            label={tag}
                            color={isSelected ? 'green' : 'gray'}
                            onClick={() => {
                              setSelectedTags(prev =>
                                prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                              );
                            }}
                            className={`cursor-pointer transition-transform hover:scale-105 ${focused ? 'outline outline-2 outline-white scale-105 shadow-lg' : ''}`}
                          />
                        </div>
                      )}
                    </FocusItem>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-3 border-t-2 border-white/10 pt-4">
              {selectedTags.length > 0 && (
                <FocusItem focusKey="tag-clear" onEnter={() => setSelectedTags([])}>
                  {({ ref, focused }) => (
                    <div ref={ref}>
                      <OreButton variant="secondary" onClick={() => setSelectedTags([])} className={focused ? 'ring-2 ring-white' : ''}>
                        清空
                      </OreButton>
                    </div>
                  )}
                </FocusItem>
              )}
              <FocusItem focusKey="tag-done" onEnter={() => setIsTagModalOpen(false)}>
                {({ ref, focused }) => (
                  <div ref={ref}>
                    <OreButton variant="primary" onClick={() => setIsTagModalOpen(false)} className={focused ? 'ring-2 ring-white' : ''}>
                      完成
                    </OreButton>
                  </div>
                )}
              </FocusItem>
            </div>
          </div>
        </OreModal>
      )}
    </FocusBoundary>
  );
};

export default Instances;
