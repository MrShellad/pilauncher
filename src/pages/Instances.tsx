import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FolderPlus,
  LayoutGrid,
  List,
  Loader2,
  Plus,
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
import { OreOverlayScrollArea } from '../ui/primitives/OreOverlayScrollArea';
import { LayoutGroup } from 'framer-motion';

const Instances: React.FC = () => {
  const { t } = useTranslation();
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
  } = useThirdPartyImport({ onImportSuccess: () => loadInstances(true) });

  const [isDirModalOpen, setIsDirModalOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isImportOptionModalOpen, setIsImportOptionModalOpen] = useState(false);
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
        <div className="flex flex-row items-center gap-3 flex-wrap sm:flex-nowrap">
          <FocusItem focusKey="view-toggle" onEnter={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
            {({ ref, focused }) => (
              <button
                ref={ref}
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className={`flex items-center justify-center h-[40px] w-[40px] rounded-sm bg-[#1E1E1F] border-2 border-ore-gray-border transition-colors focus:outline-none hover:bg-white/10 ${focused ? 'outline outline-[3px] outline-offset-[2px] outline-white z-10' : ''
                  }`}
                title={viewMode === 'grid' ? t('instancesPage.viewToggleList', '切换为列表视图') : t('instancesPage.viewToggleGrid', '切换为网格视图')}
                tabIndex={-1}
              >
                {viewMode === 'grid' ? <List size={18} className="text-white" /> : <LayoutGrid size={18} className="text-white" />}
              </button>
            )}
          </FocusItem>

          <div className="flex-1 min-w-[140px] max-w-[220px]">
            <OreInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('instancesPage.searchPlaceholder', '搜索实例...')}
              prefixNode={<Search size={16} />}
              focusKey="instances-search"
              height="40px"
              className="!text-sm"
            />
          </div>

          <div className="w-[180px] flex-shrink-0">
            <OreDropdown
              options={[
                { label: t('instancesPage.sortOptions.lastPlayed', '最近游玩'), value: "lastPlayed" },
                { label: t('instancesPage.sortOptions.createdAt', '创建时间'), value: "createdAt" }
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
                  className="!h-[40px] px-4 relative !min-w-0 !m-0"
                  onClick={() => setIsTagModalOpen(true)}
                  tabIndex={-1}
                >
                  <Tags size={14} className="mr-1.5 flex-shrink-0" />
                  <span className="font-minecraft text-sm">{t('instancesPage.tagsBtn', '标签')}</span>
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
        <div className="flex flex-row items-center gap-3 flex-wrap sm:flex-nowrap p-2 -m-2">
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
                  className="!h-[40px] !min-w-0 !px-0 !m-0"
                  onClick={handleCreate}
                  tabIndex={-1}
                >
                  <span className="flex h-full min-w-[clamp(9.2rem,14.2vw,15.4rem)] items-center justify-center whitespace-nowrap px-3">
                    <Plus className="mr-[clamp(0.35rem,0.6vw,0.6rem)] h-[clamp(0.9rem,1.1vw,1.25rem)] w-[clamp(0.9rem,1.1vw,1.25rem)] flex-shrink-0" />
                    <span className="font-minecraft text-[clamp(0.9rem,0.84rem+0.4vw,1.15rem)] tracking-wider">
                      {t('instancesPage.actionNew', '新建实例')}
                    </span>
                  </span>
                </OreButton>
              </div>
            )}
          </FocusItem>

          <FocusItem focusKey="action-import-external" onEnter={() => setIsImportOptionModalOpen(true)}>
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
                  className="!h-[40px] !min-w-0 !px-0 !m-0"
                  onClick={() => setIsImportOptionModalOpen(true)}
                  disabled={isDetectingSources || isImporting}
                  tabIndex={-1}
                >
                  <span className="flex h-full min-w-[clamp(10.8rem,18vw,18rem)] items-center justify-center whitespace-nowrap px-3">
                    {isDetectingSources ? (
                      <Loader2 className="mr-[clamp(0.35rem,0.6vw,0.6rem)] h-[clamp(0.9rem,1.1vw,1.25rem)] w-[clamp(0.9rem,1.1vw,1.25rem)] animate-spin flex-shrink-0" />
                    ) : (
                      <FolderPlus className="mr-[clamp(0.35rem,0.6vw,0.6rem)] h-[clamp(0.9rem,1.1vw,1.25rem)] w-[clamp(0.9rem,1.1vw,1.25rem)] flex-shrink-0" />
                    )}
                    <span className="font-minecraft text-[clamp(0.9rem,0.84rem+0.4vw,1.15rem)] tracking-wider">
                      {t('instancesPage.actionImportExternal', '导入外部实例')}
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

      <OreOverlayScrollArea
        className="min-h-0 flex-1"
        viewportClassName="pb-10 pr-0"
        contentClassName={`
          ${viewMode === 'grid'
            ? 'flex flex-wrap content-start justify-center gap-4 sm:gap-5 lg:gap-6'
            : 'grid grid-cols-1 content-start gap-3 auto-rows-max'
          }
        `}
      >
        <LayoutGroup id="instances-layout-group">
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
        </LayoutGroup>
      </OreOverlayScrollArea>

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

      {isImportOptionModalOpen && (
        <OreModal
          isOpen={isImportOptionModalOpen}
          onClose={() => setIsImportOptionModalOpen(false)}
          title={t('instancesPage.importModal.title', '导入第三方实例')}
          className="w-[min(600px,95vw)]"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 text-white">
            <FocusItem
              focusKey="import-option-manual"
              onEnter={() => {
                setIsImportOptionModalOpen(false);
                setIsDirModalOpen(true);
              }}
            >
              {({ ref, focused }) => (
                <div
                  ref={ref as any}
                  onClick={() => {
                    setIsImportOptionModalOpen(false);
                    setIsDirModalOpen(true);
                  }}
                  className={`
                    flex flex-col items-center justify-center p-6 text-center cursor-pointer select-none
                    border-2 border-ore-gray-border bg-[#2B2C2E] transition-all duration-150 rounded-sm
                    hover:bg-[#3C3D3F] hover:scale-[1.02]
                    ${focused ? 'outline outline-2 outline-white scale-[1.02] shadow-[0_0_15px_rgba(255,255,255,0.15)] z-10' : ''}
                  `}
                >
                  <FolderPlus size={36} className="text-[#6CC349] mb-3" />
                  <h3 className="font-minecraft font-bold text-lg mb-2 text-white ore-text-shadow">
                    {t('instancesPage.importModal.manualTitle', '手动选择目录')}
                  </h3>
                  <p className="font-minecraft text-xs text-gray-400 leading-relaxed min-h-[40px]">
                    {t('instancesPage.importModal.manualDesc', '选择本地已有启动器（如 PCL2、HMCL）的实例路径进行关联')}
                  </p>
                </div>
              )}
            </FocusItem>

            <FocusItem
              focusKey="import-option-detect"
              onEnter={() => {
                setIsImportOptionModalOpen(false);
                void refreshImportSources();
              }}
            >
              {({ ref, focused }) => (
                <div
                  ref={ref as any}
                  onClick={() => {
                    setIsImportOptionModalOpen(false);
                    void refreshImportSources();
                  }}
                  className={`
                    flex flex-col items-center justify-center p-6 text-center cursor-pointer select-none
                    border-2 border-ore-gray-border bg-[#2B2C2E] transition-all duration-150 rounded-sm
                    hover:bg-[#3C3D3F] hover:scale-[1.02]
                    ${focused ? 'outline outline-2 outline-white scale-[1.02] shadow-[0_0_15px_rgba(255,255,255,0.15)] z-10' : ''}
                  `}
                >
                  <Search size={36} className="text-[#6CC349] mb-3" />
                  <h3 className="font-minecraft font-bold text-lg mb-2 text-white ore-text-shadow">
                    {t('instancesPage.importModal.detectTitle', '自动探测实例')}
                  </h3>
                  <p className="font-minecraft text-xs text-gray-400 leading-relaxed min-h-[40px]">
                    {t('instancesPage.importModal.detectDesc', '智能扫描系统常见路径下的第三方实例并一键导入')}
                  </p>
                </div>
              )}
            </FocusItem>
          </div>
        </OreModal>
      )}

      {isTagModalOpen && (
        <OreModal
          isOpen={isTagModalOpen}
          onClose={() => setIsTagModalOpen(false)}
          title={t('instancesPage.tagFilterModal.title', '标签筛选')}
          className="w-[min(500px,90vw)]"
        >
          <div className="flex flex-col gap-4 p-2 text-white">
            <p className="text-sm text-ore-text-muted font-minecraft">{t('instancesPage.tagFilterModal.description', '选择下方的标签来筛选显示的实例列表。')}</p>
            {availableTags.length === 0 ? (
              <div className="py-8 text-center text-ore-text-muted border-2 border-dashed border-white/10 rounded">
                {t('instancesPage.tagFilterModal.empty', '目前没有任何可用的标签')}
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
                            variant={isSelected ? 'primary' : 'neutral'}
                            onClick={() => {
                              setSelectedTags(prev =>
                                prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                              );
                            }}
                            className={`cursor-pointer transition-transform hover:scale-105 ${focused ? 'outline outline-2 outline-white scale-105 shadow-lg' : ''}`}
                          >
                            {tag}
                          </OreTag>
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
                      <OreButton variant="secondary" onClick={() => setSelectedTags([])} className={`${focused ? 'ring-2 ring-white' : ''} !m-0`}>
                      {t('instancesPage.tagFilterModal.clear', '清空')}
                    </OreButton>
                  </div>
                )}
              </FocusItem>
            )}
            <FocusItem focusKey="tag-done" onEnter={() => setIsTagModalOpen(false)}>
              {({ ref, focused }) => (
                <div ref={ref}>
                  <OreButton variant="primary" onClick={() => setIsTagModalOpen(false)} className={`${focused ? 'ring-2 ring-white' : ''} !m-0`}>
                    {t('instancesPage.tagFilterModal.done', '完成')}
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
