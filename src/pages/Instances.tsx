import React, { useEffect, useMemo, useState } from 'react';
import { getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';
import {
  FolderPlus,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  RefreshCw,
} from 'lucide-react';

import { InstanceCardView } from '../features/Instances/components/InstanceCardView';
import { InstanceListView } from '../features/Instances/components/InstanceListView';
import { ThirdPartyImportModal } from '../features/Instances/components/ThirdPartyImport/ThirdPartyImportModal';
import { ThirdPartyImportPanel } from '../features/Instances/components/ThirdPartyImport/ThirdPartyImportPanel';
import { useInstances } from '../hooks/pages/Instances/useInstances';
import { useThirdPartyImport } from '../hooks/pages/Instances/useThirdPartyImport';
import { DirectoryBrowserModal } from '../ui/components/DirectoryBrowserModal';
import { FocusBoundary } from '../ui/focus/FocusBoundary';
import { FocusItem } from '../ui/focus/FocusItem';
import { focusManager } from '../ui/focus/FocusManager';
import { OreModal } from '../ui/primitives/OreModal';
import { OreButton } from '../ui/primitives/OreButton';

const Instances: React.FC = () => {
  const {
    instances,
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
    if (instances.length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      const currentFocusKey = getCurrentFocusKey();
      const isActionAreaFocus =
        currentFocusKey === 'SN:ROOT' ||
        currentFocusKey === 'action-new' ||
        currentFocusKey === 'action-folder' ||
        currentFocusKey === 'action-detect' ||
        currentFocusKey === 'view-grid' ||
        currentFocusKey === 'view-list';

      if (!isActionAreaFocus) {
        return;
      }

      const firstInstanceFocusKey =
        viewMode === 'list'
          ? `list-play-${instances[0].id}`
          : `card-play-${instances[0].id}`;

      focusManager.focus(firstInstanceFocusKey);
    }, 120);

    return () => clearTimeout(timer);
  }, [instances, viewMode]);


  return (
    <FocusBoundary
      id="instances-page"
      isActive={!isDirModalOpen}
      className="flex h-full w-full flex-col overflow-hidden px-6 pb-6 pt-3 sm:px-8 sm:pb-8 sm:pt-4"
    >
      <div className="mb-4 flex w-full flex-shrink-0 flex-row items-center justify-between gap-4 lg:mb-5">
        <div className="flex flex-shrink-0 items-center border-2 border-ore-gray-border bg-[#1E1E1F] p-0.5">
          <FocusItem focusKey="view-list" onEnter={() => setViewMode('list')}>
            {({ ref, focused }) => (
              <button
                ref={ref}
                onClick={() => setViewMode('list')}
                className={`p-1.5 transition-colors focus:outline-none ${
                  viewMode === 'list'
                    ? 'bg-white/20 text-white shadow-inner'
                    : 'text-ore-text-muted hover:bg-white/10 hover:text-white'
                } ${focused ? 'relative z-10 outline outline-[3px] outline-offset-[-2px] outline-white' : ''}`}
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
                className={`p-1.5 transition-colors focus:outline-none ${
                  viewMode === 'grid'
                    ? 'bg-white/20 text-white shadow-inner'
                    : 'text-ore-text-muted hover:bg-white/10 hover:text-white'
                } ${focused ? 'relative z-10 outline outline-[3px] outline-offset-[-2px] outline-white' : ''}`}
                title="网格视图"
                tabIndex={-1}
              >
                <LayoutGrid size={20} />
              </button>
            )}
          </FocusItem>
        </div>

        <div className="mr-[-0.5rem] flex flex-1 flex-row items-center justify-end gap-3 overflow-x-auto p-[0.375rem] pt-[0.125rem] scrollbar-none">
          <FocusItem focusKey="action-new" onEnter={handleCreate}>
            {({ ref, focused }) => (
              <div
                ref={ref}
                className={`flex-shrink-0 rounded-sm transition-shadow duration-150 ${
                  focused
                    ? 'outline outline-2 outline-offset-[4px] outline-white'
                    : 'outline outline-2 outline-offset-[4px] outline-transparent'
                }`}
              >
                <OreButton
                  variant="primary"
                  size="auto"
                  className="!h-auto !min-w-0 !px-0"
                  onClick={handleCreate}
                  tabIndex={-1}
                >
                  <span className="flex h-[clamp(2.35rem,3.1vh,3.6rem)] min-w-[clamp(9.2rem,14.2vw,15.4rem)] items-center justify-center whitespace-nowrap px-[clamp(0.65rem,1vw,1.2rem)]">
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
                className={`flex-shrink-0 rounded-sm transition-shadow duration-150 ${
                  focused
                    ? 'outline outline-2 outline-offset-[4px] outline-white'
                    : 'outline outline-2 outline-offset-[4px] outline-transparent'
                }`}
              >
                <OreButton
                  variant="secondary"
                  size="auto"
                  className="!h-auto !min-w-0 !px-0"
                  onClick={() => setIsDirModalOpen(true)}
                  tabIndex={-1}
                >
                  <span className="flex h-[clamp(2.35rem,3.1vh,3.6rem)] min-w-[clamp(10.8rem,18vw,18rem)] items-center justify-center whitespace-nowrap px-[clamp(0.65rem,1vw,1.2rem)]">
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
                className={`flex-shrink-0 rounded-sm transition-shadow duration-150 ${
                  focused
                    ? 'outline outline-2 outline-offset-[4px] outline-white'
                    : 'outline outline-2 outline-offset-[4px] outline-transparent'
                }`}
              >
                <OreButton
                  variant="secondary"
                  size="auto"
                  className="!h-auto !min-w-0 !px-0"
                  onClick={() => void refreshImportSources()}
                  disabled={isDetectingSources || isImporting}
                  tabIndex={-1}
                >
                  <span className="flex h-[clamp(2.35rem,3.1vh,3.6rem)] min-w-[clamp(9.8rem,16vw,16.2rem)] items-center justify-center whitespace-nowrap px-[clamp(0.65rem,1vw,1.2rem)]">
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
          flex-1 overflow-y-auto pb-10 pr-0 scrollbar-none
          ${
            viewMode === 'grid'
              ? 'flex flex-wrap content-start justify-center gap-4 sm:gap-5 lg:gap-6'
              : 'flex flex-col space-y-3'
          }
        `}
      >
        {instances.map((instance) =>
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
    </FocusBoundary>
  );
};

export default Instances;
