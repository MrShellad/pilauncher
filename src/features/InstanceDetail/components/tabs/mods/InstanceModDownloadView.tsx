import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

import { DownloadDetailModal } from '../../../../Download/components/DownloadDetailModal';
import {
  resolveInstanceGameVersion,
  resolveInstanceLoaderType,
  useResourceDownload,
  type DownloadSource
} from '../../../../Download/hooks/useResourceDownload';
import { fetchCurseForgeVersions, getCurseForgeProjectDetails } from '../../../../Download/logic/curseforgeApi';
import {
  fetchModrinthVersions,
  getProjectDetails,
  type ModrinthProject,
  type OreProjectDependency,
  type OreProjectVersion
} from '../../../logic/modrinthApi';
import { useDownloadStore } from '../../../../../store/useDownloadStore';
import { FocusBoundary } from '../../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../../ui/focus/FocusItem';
import { useInputAction } from '../../../../../ui/focus/InputDriver';
import { OreModal } from '../../../../../ui/primitives/OreModal';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { InstanceFilterBar } from './InstanceFilterBar';
import { ResourceGrid } from './ResourceGrid';

const GamepadBtn = ({ text, color }: { text: string; color: string }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="inline-block flex-shrink-0"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" fill={color} className="drop-shadow-[0_0_4px_rgba(250,204,21,0.45)]" />
    <text
      x="12"
      y="16.5"
      fontSize="13"
      fontWeight="900"
      fontFamily="system-ui, sans-serif"
      fill="#1E1E1F"
      textAnchor="middle"
    >
      {text}
    </text>
  </svg>
);

interface MissingDependencyInfo {
  id: string;
  name: string;
}

const prettifyLoader = (loader: string) => {
  if (!loader) return 'Vanilla';
  if (loader === 'neoforge') return 'NeoForge';
  return loader.charAt(0).toUpperCase() + loader.slice(1);
};

const MissingDependenciesModal: React.FC<{
  isOpen: boolean;
  version: OreProjectVersion | null;
  missingDeps: MissingDependencyInfo[];
  autoInstallDeps: boolean;
  isChecking: boolean;
  onToggleAutoInstall: () => void;
  onClose: () => void;
  onConfirm: () => void;
}> = ({
  isOpen,
  version,
  missingDeps,
  autoInstallDeps,
  isChecking,
  onToggleAutoInstall,
  onClose,
  onConfirm
}) => {
  if (!isOpen || !version) return null;

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title="检查前置依赖"
      className="w-full max-w-lg border-[2px] border-[#313233] bg-[#18181B]"
      contentClassName="flex flex-col overflow-hidden p-0"
    >
      <div className="border-b border-white/5 bg-black/40 p-5 text-sm text-gray-300">
        <div className="mb-1 font-minecraft text-lg text-white">准备部署到当前实例</div>
        <span className="truncate text-ore-green">{version.file_name}</span>
      </div>

      <div className="flex flex-col gap-4 bg-[#111112] p-5">
        {isChecking ? (
          <div className="flex items-center text-xs font-minecraft text-ore-green">
            <Loader2 size={14} className="mr-2 animate-spin" />
            正在分析当前实例缺少的必需前置...
          </div>
        ) : (
          <>
            <div className="rounded-sm border border-yellow-500/30 bg-yellow-500/10 p-4">
              <div className="mb-2 flex items-start text-yellow-400">
                <AlertTriangle size={16} className="mr-2 mt-0.5 flex-shrink-0" />
                <div className="text-xs font-minecraft leading-relaxed">
                  当前实例缺少 <span className="font-bold">{missingDeps.length}</span> 个必需前置：
                </div>
              </div>
              <div className="pl-6 text-sm text-yellow-300">
                {missingDeps.map((dep) => dep.name).join('、')}
              </div>
            </div>

            <FocusItem focusKey="instance-deps-auto-install" onEnter={onToggleAutoInstall}>
              {({ ref, focused }) => (
                <button
                  ref={ref as React.RefObject<HTMLButtonElement>}
                  type="button"
                  onClick={onToggleAutoInstall}
                  className={`flex w-fit items-center gap-2 rounded-sm p-1.5 text-left outline-none transition-all ${
                    focused ? 'bg-white/10 ring-1 ring-white' : 'hover:bg-white/5'
                  }`}
                >
                  <div className={`flex h-4 w-4 items-center justify-center rounded-sm border ${
                    autoInstallDeps ? 'border-ore-green bg-ore-green text-black' : 'border-gray-500 bg-transparent'
                  }`}>
                    {autoInstallDeps && <CheckCircle2 size={10} />}
                  </div>
                  <span className="text-xs font-minecraft uppercase tracking-wider text-gray-300">
                    自动下载并补全前置模组
                  </span>
                </button>
              )}
            </FocusItem>
          </>
        )}
      </div>

      <div className="flex justify-end gap-4 border-t border-white/10 bg-black/60 p-4">
        <OreButton focusKey="instance-deps-cancel" variant="secondary" onClick={onClose}>
          取消
        </OreButton>
        <OreButton
          focusKey="instance-deps-confirm"
          variant="primary"
          disabled={isChecking}
          onClick={onConfirm}
          className="font-bold tracking-widest text-black"
        >
          确认并下载
        </OreButton>
      </div>
    </OreModal>
  );
};

export const InstanceModDownloadView: React.FC<{
  instanceId: string;
  onBack: () => void;
  showFilterBackButton?: boolean;
  resourceTab?: 'mod' | 'resourcepack' | 'shader';
}> = ({
  instanceId,
  onBack,
  showFilterBackButton = true,
  resourceTab = 'mod'
}) => {
  const {
    activeTab,
    setActiveTab,
    query,
    setQuery,
    category,
    setCategory,
    sort,
    setSort,
    source,
    setSource,
    results,
    hasMore,
    isLoading,
    isLoadingMore,
    isEnvLoaded,
    installedMods,
    instanceConfig,
    resolvedMcVersion,
    resolvedLoaderType,
    handleSearchClick,
    handleResetClick,
    loadMore
  } = useResourceDownload(instanceId, { lockInstanceEnvironment: true });

  const [selectedProject, setSelectedProject] = useState<ModrinthProject | null>(null);
  const [syncStep, setSyncStep] = useState(0);
  const [pendingDependencyVersion, setPendingDependencyVersion] = useState<OreProjectVersion | null>(null);
  const [pendingDependencyEntries, setPendingDependencyEntries] = useState<OreProjectDependency[]>([]);
  const [missingDeps, setMissingDeps] = useState<MissingDependencyInfo[]>([]);
  const [autoInstallDeps, setAutoInstallDeps] = useState(true);
  const [isCheckingDeps, setIsCheckingDeps] = useState(false);
  const [resultsScrollTop, setResultsScrollTop] = useState(0);

  const isHintVisible = resultsScrollTop > 48;
  const targetMc = resolvedMcVersion || resolveInstanceGameVersion(instanceConfig);
  const targetLoader = resourceTab === 'mod'
    ? (resolvedLoaderType || resolveInstanceLoaderType(instanceConfig))
    : '';
  const loaderLabel = prettifyLoader(targetLoader);
  const installedModIds = useMemo(
    () => installedMods.map((item) => item.modId || '').filter(Boolean),
    [installedMods]
  );
  const yHintText = useMemo(() => '回到顶部', []);
  const subFolder = resourceTab === 'shader'
    ? 'shaderpacks'
    : resourceTab === 'resourcepack'
      ? 'resourcepacks'
      : 'mods';

  useEffect(() => {
    setSyncStep(0);
  }, [instanceId, resourceTab, targetMc, targetLoader]);

  useEffect(() => {
    if (!isEnvLoaded || !instanceConfig) return;

    if (syncStep === 0) {
      if (activeTab !== resourceTab) setActiveTab(resourceTab);
      setSyncStep(1);
      return;
    }

    if (syncStep === 1) {
      if (targetMc && activeTab === resourceTab) {
        handleSearchClick();
        setSyncStep(2);
      }
      return;
    }

    if (syncStep === 2) {
      const timer = setTimeout(() => setSyncStep(3), 150);
      return () => clearTimeout(timer);
    }
  }, [
    activeTab,
    handleSearchClick,
    instanceConfig,
    isEnvLoaded,
    resourceTab,
    setActiveTab,
    syncStep,
    targetMc
  ]);

  useEffect(() => {
    if (syncStep !== 3) return;
    const timer = setTimeout(() => setFocus('inst-filter-search'), 100);
    return () => clearTimeout(timer);
  }, [syncStep]);

  useInputAction('ACTION_Y', () => {
    const scrollHost = document.getElementById('instance-mod-download-results');
    if (scrollHost) {
      scrollHost.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setTimeout(() => setFocus('inst-filter-search'), 120);
  });

  const closeDependencyModal = useCallback(() => {
    setPendingDependencyVersion(null);
    setPendingDependencyEntries([]);
    setMissingDeps([]);
    setAutoInstallDeps(true);
    setIsCheckingDeps(false);
  }, []);

  const enqueueDownload = useCallback(async (version: OreProjectVersion, targetInstanceId: string) => {
    useDownloadStore.getState().addOrUpdateTask({
      id: version.file_name,
      taskType: 'resource',
      title: version.file_name,
      stage: 'DOWNLOADING_MOD',
      current: 0,
      total: 100,
      message: '正在建立连接...',
      retryAction: 'download_resource',
      retryPayload: {
        url: version.download_url,
        fileName: version.file_name,
        instanceId: targetInstanceId,
        subFolder
      }
    });

    try {
      await invoke('download_resource', {
        url: version.download_url,
        fileName: version.file_name,
        instanceId: targetInstanceId,
        subFolder
      });
    } catch (error) {
      console.error('下载异常:', error);
      useDownloadStore.getState().addOrUpdateTask({
        id: version.file_name,
        message: `下载失败: ${error}`
      });
    }
  }, [subFolder]);

  const resolveMissingDependencyInfo = useCallback(async (
    dependencies: OreProjectDependency[],
    activeSource: DownloadSource
  ): Promise<MissingDependencyInfo[]> => {
    return Promise.all(
      dependencies.map(async (dependency) => {
        const dependencyId = dependency.project_id!;

        try {
          if (activeSource === 'curseforge') {
            const detail = await getCurseForgeProjectDetails(dependencyId);
            return { id: dependencyId, name: detail.title };
          }

          const detail = await getProjectDetails(dependencyId);
          return { id: dependencyId, name: detail.title };
        } catch {
          return { id: dependencyId, name: `未知前置 (${dependencyId})` };
        }
      })
    );
  }, []);

  const downloadWithDependencies = useCallback(async (
    version: OreProjectVersion,
    targetInstanceId: string,
    dependenciesToInstall: OreProjectDependency[] = []
  ) => {
    if (dependenciesToInstall.length > 0) {
      const fetchVersions = source === 'curseforge' ? fetchCurseForgeVersions : fetchModrinthVersions;

      for (const dependency of dependenciesToInstall) {
        if (!dependency.project_id) continue;

        try {
          const dependencyVersions = await fetchVersions(
            dependency.project_id,
            targetMc || undefined,
            resourceTab === 'mod' ? targetLoader || undefined : undefined
          );

          if (dependencyVersions.length > 0) {
            await enqueueDownload(dependencyVersions[0], targetInstanceId);
          }
        } catch (error) {
          console.error(`前置 ${dependency.project_id} 自动下载失败:`, error);
        }
      }
    }

    await enqueueDownload(version, targetInstanceId);
  }, [enqueueDownload, resourceTab, source, targetLoader, targetMc]);

  const handleStartDownload = useCallback(async (
    version: OreProjectVersion,
    targetInstanceId: string,
    autoInstallRequiredDeps?: boolean
  ) => {
    if (resourceTab !== 'mod' || targetInstanceId !== instanceId) {
      await downloadWithDependencies(version, targetInstanceId);
      return;
    }

    if (typeof autoInstallRequiredDeps === 'boolean') {
      await downloadWithDependencies(
        version,
        targetInstanceId,
        autoInstallRequiredDeps ? pendingDependencyEntries : []
      );
      closeDependencyModal();
      return;
    }

    const requiredDependencies = (version.dependencies || []).filter(
      (dependency) => dependency.dependency_type === 'required' && dependency.project_id
    );

    if (requiredDependencies.length === 0) {
      await downloadWithDependencies(version, targetInstanceId);
      return;
    }

    const missingDependencyEntries = requiredDependencies.filter(
      (dependency) => !installedModIds.includes(dependency.project_id || '')
    );

    if (missingDependencyEntries.length === 0) {
      await downloadWithDependencies(version, targetInstanceId);
      return;
    }

    setPendingDependencyVersion(version);
    setPendingDependencyEntries(missingDependencyEntries);
    setMissingDeps([]);
    setAutoInstallDeps(true);
    setIsCheckingDeps(true);

    try {
      const resolvedMissingDeps = await resolveMissingDependencyInfo(missingDependencyEntries, source);
      setMissingDeps(resolvedMissingDeps);
    } catch (error) {
      console.error('分析前置依赖失败:', error);
      closeDependencyModal();
      await downloadWithDependencies(version, targetInstanceId);
      return;
    } finally {
      setIsCheckingDeps(false);
    }
  }, [
    closeDependencyModal,
    downloadWithDependencies,
    instanceId,
    installedModIds,
    pendingDependencyEntries,
    resolveMissingDependencyInfo,
    resourceTab,
    source
  ]);

  const handleConfirmDependencyDownload = useCallback(async () => {
    if (!pendingDependencyVersion) return;
    await handleStartDownload(pendingDependencyVersion, instanceId, autoInstallDeps);
  }, [autoInstallDeps, handleStartDownload, instanceId, pendingDependencyVersion]);

  if (!isEnvLoaded || syncStep < 3) {
    return (
      <div className="flex h-full w-full animate-pulse flex-col items-center justify-center bg-[#141415] font-minecraft text-ore-green">
        <Loader2 size={40} className="mb-5 animate-spin" />
        <div className="mb-2 text-xl tracking-widest text-white">正在初始化下载环境</div>
        <div className="text-sm text-gray-500">
          自动匹配 {targetMc} {resourceTab === 'mod' ? loaderLabel : ''} 专属资源...
        </div>
      </div>
    );
  }

  return (
    <FocusBoundary id="instance-mod-download-view" className="flex h-full w-full animate-fade-in flex-col outline-none">
      <InstanceFilterBar
        onBack={onBack}
        showBackButton={showFilterBackButton}
        resourceTab={resourceTab}
        lockedMcVersion={targetMc}
        lockedLoaderType={targetLoader}
        query={query}
        setQuery={setQuery}
        source={source}
        setSource={(value) => setSource(value as DownloadSource)}
        category={category}
        setCategory={setCategory}
        sort={sort}
        setSort={setSort}
        onSearch={handleSearchClick}
        onReset={handleResetClick}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm border-2 border-[#1E1E1F] bg-black/20 shadow-inner">
        {isHintVisible && (
          <div className="pointer-events-none absolute right-4 top-4 z-50 flex items-center gap-2 rounded-sm border border-white/10 bg-black/60 px-3 py-2 text-xs font-minecraft tracking-wider text-gray-200 shadow-lg backdrop-blur">
            <GamepadBtn text="Y" color="#FACC15" />
            <span className="mt-[1px]">{yHintText}</span>
          </div>
        )}

        <ResourceGrid
          results={results}
          installedMods={installedMods}
          isLoading={isLoading && results.length === 0}
          isLoadingMore={isLoadingMore}
          hasMore={hasMore}
          resourceTab={resourceTab}
          lockedMcVersion={targetMc}
          lockedLoaderType={targetLoader}
          onLoadMore={loadMore}
          onSelectProject={setSelectedProject}
          scrollContainerId="instance-mod-download-results"
          onScrollTopChange={setResultsScrollTop}
        />
      </div>

      <DownloadDetailModal
        project={selectedProject}
        instanceConfig={instanceConfig}
        onClose={() => {
          setSelectedProject(null);
          setTimeout(() => setFocus('download-grid-item-0'), 50);
        }}
        onDownload={handleStartDownload}
        installedVersionIds={installedModIds}
        searchMcVersion={targetMc}
        searchLoader={resourceTab === 'mod' ? targetLoader : ''}
        activeTab={resourceTab}
        source={source}
        directInstallInstanceId={instanceId}
      />

      <MissingDependenciesModal
        isOpen={!!pendingDependencyVersion}
        version={pendingDependencyVersion}
        missingDeps={missingDeps}
        autoInstallDeps={autoInstallDeps}
        isChecking={isCheckingDeps}
        onToggleAutoInstall={() => setAutoInstallDeps((prev) => !prev)}
        onClose={closeDependencyModal}
        onConfirm={handleConfirmDependencyDownload}
      />
    </FocusBoundary>
  );
};
