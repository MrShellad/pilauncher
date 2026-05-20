import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';

import { DownloadDetailModal } from '../../../../../../Download/components/DownloadDetailModal';
import {
  ContextualActionBar,
  getContextualActionBarFocusKey
} from '../../../../../../Download/components/ContextualActionBar';
import { FavoritePlaceholderModal } from '../../../../../../Download/components/FavoritePlaceholderModal';
import {
  resolveInstanceGameVersion,
  resolveInstanceLoaderType,
  useResourceDownload,
  type DownloadSource
} from '../../../../../../Download/hooks/useResourceDownload';
import { fetchCurseForgeVersions, getCurseForgeProjectDetails } from '../../../../../../Download/logic/curseforgeApi';
import {
  fetchModrinthVersions,
  getProjectDetails,
  type ModrinthProject,
  type OreProjectDependency,
  type OreProjectVersion
} from '../../../../../logic/modrinthApi';
import { getInstalledProjectIds, getInstalledVersionIds, modService } from '../../../../../logic/modService';
import { useDownloadStore } from '../../../../../../../store/useDownloadStore';
import { FocusBoundary } from '../../../../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../../../../ui/focus/FocusItem';
import { useInputAction } from '../../../../../../../ui/focus/InputDriver';
import { OreModal } from '../../../../../../../ui/primitives/OreModal';
import { OreButton } from '../../../../../../../ui/primitives/OreButton';
import { OreOverlayScrollArea } from '../../../../../../../ui/primitives/OreOverlayScrollArea';
import { InstanceFilterBar } from './InstanceFilterBar';
import { ResourceGrid } from './ResourceGrid';
import { useInstanceDownloadSelectionStore } from '../../hooks/useInstanceDownloadSelectionStore';

const INSTANCE_DOWNLOAD_ACTION_BAR_FOCUS_PREFIX = 'instance-download-actions';
const INSTANCE_DOWNLOAD_GRID_FOCUS_PREFIX = 'download-grid-item-';

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
      defaultFocusKey={isChecking ? 'instance-deps-cancel' : 'instance-deps-confirm'}
      className="w-full max-w-[34rem]"
      contentClassName="flex flex-col gap-4 overflow-hidden bg-[var(--ore-modal-bg)] p-5"
      actionsClassName="px-5 py-4"
      actions={(
        <>
          <OreButton focusKey="instance-deps-cancel" variant="secondary" size="auto" onClick={onClose}>
            取消
          </OreButton>
          <OreButton
            focusKey="instance-deps-confirm"
            variant="primary"
            size="auto"
            disabled={isChecking}
            onClick={onConfirm}
            className="font-bold tracking-widest text-black"
          >
            确认下载
          </OreButton>
        </>
      )}
    >
      <div className="border-[0.125rem] border-[var(--ore-border-color)] bg-[var(--ore-modal-header-bg)] px-4 py-3 shadow-[inset_0_-0.25rem_0_rgba(0,0,0,0.28),inset_0.125rem_0.125rem_0_rgba(255,255,255,0.08)]">
        <div className="mb-2 font-minecraft text-[0.75rem] uppercase leading-none tracking-[0.16em] text-[var(--ore-text-muted)]">
          准备部署到当前实例
        </div>
        <div className="truncate font-minecraft text-[1rem] leading-[1.25] text-[var(--ore-btn-primary-bg)] ore-text-shadow">
          {version.file_name}
        </div>
      </div>

      {isChecking ? (
        <div className="flex min-h-[8rem] items-center justify-center border-[0.125rem] border-[var(--ore-border-color)] bg-[#111112] px-4 py-5 shadow-[inset_0_0.1875rem_0_rgba(255,255,255,0.04),inset_0_-0.25rem_0_rgba(0,0,0,0.35)]">
          <div className="flex items-center gap-3 font-minecraft text-[0.8125rem] leading-none tracking-[0.08em] text-[var(--ore-btn-primary-bg)]">
            <Loader2 size={18} className="animate-spin" />
            <span className="translate-y-px">正在分析当前实例缺少的必需前置...</span>
          </div>
        </div>
      ) : (
        <>
          <div className="border-[0.125rem] border-[#8A6A22] bg-[#221B10] shadow-[inset_0_-0.25rem_0_rgba(0,0,0,0.32),inset_0.125rem_0.125rem_0_rgba(255,229,138,0.12)]">
            <div className="flex items-center gap-3 border-b-[0.125rem] border-[#8A6A22]/70 bg-[#3A2B12] px-4 py-3 text-[#F5C542]">
              <AlertTriangle size={18} className="shrink-0" strokeWidth={2.5} />
              <div className="font-minecraft text-[0.875rem] leading-none tracking-[0.08em]">
                当前实例缺少 <span className="text-white">{missingDeps.length}</span> 个必需前置
              </div>
            </div>
            <OreOverlayScrollArea
              className="max-h-28"
              viewportClassName="max-h-28"
              contentClassName="py-3 pl-4"
              safeInsetTop={8}
              safeInsetBottom={8}
              safeInsetRight={5}
              contentSafePaddingRight={24}
            >
              <div className="flex flex-wrap gap-2">
                {missingDeps.map((dep) => (
                  <span
                    key={dep.id}
                    className="max-w-full truncate border-[0.125rem] border-[#B88A24] bg-[#0B0905] px-2 py-1 font-minecraft text-[0.75rem] leading-none tracking-[0.06em] text-[#FFF2B8] shadow-[inset_0_-0.125rem_0_rgba(0,0,0,0.55)]"
                  >
                    {dep.name}
                  </span>
                ))}
              </div>
            </OreOverlayScrollArea>
          </div>

          <FocusItem focusKey="instance-deps-auto-install" onEnter={onToggleAutoInstall}>
            {({ ref, focused }) => (
              <button
                ref={ref as React.RefObject<HTMLButtonElement>}
                type="button"
                onClick={onToggleAutoInstall}
                aria-pressed={autoInstallDeps}
                className={`group flex w-full items-center gap-3 border-[0.125rem] px-4 py-3 text-left outline-none transition-none ${
                  focused
                    ? 'border-[var(--ore-focus-ringFallback)] bg-[#3A3B3D] drop-shadow-[0_0_0.5rem_var(--ore-focus-glow)]'
                    : 'border-[var(--ore-border-color)] bg-[var(--ore-modal-header-bg)] hover:bg-[#343538]'
                }`}
                style={{
                  boxShadow: focused
                    ? 'inset 0 -0.25rem var(--ore-btn-secondary-shadow), inset 0.125rem 0.125rem var(--ore-btn-secondary-highlight)'
                    : 'inset 0 -0.25rem rgba(0,0,0,0.28), inset 0.125rem 0.125rem rgba(255,255,255,0.08)'
                }}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center border-[0.125rem] transition-none ${
                    autoInstallDeps
                      ? 'border-[#1E1E1F] bg-[var(--ore-btn-primary-bg)] text-black shadow-[inset_0_-0.1875rem_0_var(--ore-btn-primary-shadow),inset_0.125rem_0.125rem_0_var(--ore-btn-primary-hl1)]'
                      : 'border-[var(--ore-border-color)] bg-[#111112] text-transparent shadow-[inset_0_0.1875rem_0_rgba(0,0,0,0.4)]'
                  }`}
                  aria-hidden="true"
                >
                  <Check size={15} strokeWidth={3.5} className="translate-y-[-0.0625rem]" />
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span
                    className={`font-minecraft text-[0.875rem] uppercase leading-none tracking-[0.12em] ${
                      focused ? 'text-white ore-text-shadow' : 'text-[#F4F4F5] group-hover:text-white'
                    }`}
                  >
                    自动下载并补全前置
                  </span>
                  <span className="text-[0.75rem] leading-[1.35] text-[#C8CBD0] group-hover:text-[#E4E6EA]">
                    关闭后只下载当前选择的文件，缺失前置可能导致模组无法加载。
                  </span>
                </span>
              </button>
            )}
          </FocusItem>
        </>
      )}
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
    categoryOptions,
    results,
    hasMore,
    isLoading,
    isLoadingMore,
    isEnvLoaded,
    installedMods,
    refreshInstalledMods,
    instanceConfig,
    resolvedMcVersion,
    resolvedLoaderType,
    mcVersionOptions,
    handleSearchClick,
    handleResetClick,
    loadMore
  } = useResourceDownload(instanceId, { lockInstanceEnvironment: true });

  const [selectedProject, setSelectedProject] = useState<ModrinthProject | null>(null);
  const [syncStep, setSyncStep] = useState(0);
  const [pendingDependencyVersion, setPendingDependencyVersion] = useState<OreProjectVersion | null>(null);
  const [pendingDependencyEntries, setPendingDependencyEntries] = useState<OreProjectDependency[]>([]);
  const [pendingDependencyProjectId, setPendingDependencyProjectId] = useState('');
  const [missingDeps, setMissingDeps] = useState<MissingDependencyInfo[]>([]);
  const [autoInstallDeps, setAutoInstallDeps] = useState(true);
  const [isCheckingDeps, setIsCheckingDeps] = useState(false);
  const [resultsScrollTop, setResultsScrollTop] = useState(0);
  const [isFavoriteModalOpen, setIsFavoriteModalOpen] = useState(false);
  const selectedProjectIds = useInstanceDownloadSelectionStore((state) => state.selectedProjectIds);
  const selectedProjectsById = useInstanceDownloadSelectionStore((state) => state.selectedProjects);
  const selectedCount = useInstanceDownloadSelectionStore((state) => state.selectedCount);
  const isSelectionMode = useInstanceDownloadSelectionStore((state) => state.isSelectionMode);
  const getProjectKey = useInstanceDownloadSelectionStore((state) => state.getProjectKey);
  const toggleProjectSelection = useInstanceDownloadSelectionStore((state) => state.toggleProject);
  const clearDownloadSelection = useInstanceDownloadSelectionStore((state) => state.clearSelection);
  const pendingDepIdsRef = React.useRef<Set<string>>(new Set());
  const lastListFocusBeforeActionBarRef = React.useRef<string>('download-grid-item-0');

  const isHintVisible = resultsScrollTop > 48;
  const targetMc = resolvedMcVersion || resolveInstanceGameVersion(instanceConfig);
  const targetLoader = resourceTab === 'mod'
    ? (resolvedLoaderType || resolveInstanceLoaderType(instanceConfig))
    : '';
  const loaderLabel = prettifyLoader(targetLoader);
  const installedModIds = useMemo(() => getInstalledProjectIds(installedMods), [installedMods]);
  const installedVersionIds = useMemo(() => getInstalledVersionIds(installedMods), [installedMods]);
  const yHintText = useMemo(() => '回到顶部', []);
  const subFolder = resourceTab === 'shader'
    ? 'shaderpacks'
    : resourceTab === 'resourcepack'
      ? 'resourcepacks'
      : 'mods';
  const selectedProjects = useMemo(
    () => Object.values(selectedProjectsById),
    [selectedProjectsById]
  );
  const showBulkDownload = Boolean(
    selectedCount > 0 &&
    targetMc &&
    (resourceTab !== 'mod' || targetLoader)
  );

  const clearSelection = useCallback(() => {
    clearDownloadSelection();
    setIsFavoriteModalOpen(false);
  }, [clearDownloadSelection]);

  const handleToggleProjectSelection = useCallback((project: ModrinthProject) => {
    toggleProjectSelection(project);
  }, [toggleProjectSelection]);

  const getFocusedResultProject = useCallback(() => {
    const currentFocus = getCurrentFocusKey();
    if (!currentFocus?.startsWith(INSTANCE_DOWNLOAD_GRID_FOCUS_PREFIX)) return null;

    const index = Number(currentFocus.slice(INSTANCE_DOWNLOAD_GRID_FOCUS_PREFIX.length));
    if (!Number.isInteger(index) || index < 0) return null;
    return results[index] ?? null;
  }, [results]);

  useEffect(() => {
    setSyncStep(0);
  }, [instanceId, resourceTab, targetMc, targetLoader]);

  useEffect(() => {
    void refreshInstalledMods();
  }, [refreshInstalledMods]);

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

  useInputAction('ACTION_X', () => {
    if (selectedProject || isFavoriteModalOpen || pendingDependencyVersion) return;

    const project = getFocusedResultProject();
    if (!project) return;

    const currentFocus = getCurrentFocusKey();
    if (currentFocus) lastListFocusBeforeActionBarRef.current = currentFocus;
    handleToggleProjectSelection(project);
  });

  useInputAction('MENU', () => {
    if (!isSelectionMode || selectedProject || isFavoriteModalOpen || pendingDependencyVersion) return;

    const currentFocus = getCurrentFocusKey();
    const isActionBarFocused = Boolean(currentFocus?.startsWith(INSTANCE_DOWNLOAD_ACTION_BAR_FOCUS_PREFIX));

    if (isActionBarFocused) {
      const target = lastListFocusBeforeActionBarRef.current;
      if (target && doesFocusableExist(target)) {
        setFocus(target);
      } else if (doesFocusableExist('download-grid-item-0')) {
        setFocus('download-grid-item-0');
      }
      return;
    }

    if (currentFocus?.startsWith(INSTANCE_DOWNLOAD_GRID_FOCUS_PREFIX)) {
      lastListFocusBeforeActionBarRef.current = currentFocus;
    }

    const actionFocusKey = getContextualActionBarFocusKey(INSTANCE_DOWNLOAD_ACTION_BAR_FOCUS_PREFIX, showBulkDownload);
    if (doesFocusableExist(actionFocusKey)) {
      setFocus(actionFocusKey);
    }
  });

  const closeDependencyModal = useCallback(() => {
    setPendingDependencyVersion(null);
    setPendingDependencyEntries([]);
    setPendingDependencyProjectId('');
    setMissingDeps([]);
    setAutoInstallDeps(true);
    setIsCheckingDeps(false);
  }, []);

  const enqueueDownload = useCallback(async (version: OreProjectVersion, targetInstanceId: string, explicitProjectId?: string) => {
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

      if (resourceTab === 'mod') {
        const projectId = explicitProjectId || selectedProject?.id || '';
        if (projectId) {
          await modService.updateModManifest(
            targetInstanceId,
            version.file_name,
            'launcherDownload',
            source === 'curseforge' ? 'curseforge' : 'modrinth',
            projectId,
            version.id
          );
        }

        if (targetInstanceId === instanceId) {
          await refreshInstalledMods();
        }
      }
    } catch (error) {
      console.error('下载异常:', error);
      useDownloadStore.getState().addOrUpdateTask({
        id: version.file_name,
        message: `下载失败: ${error}`
      });
    }
  }, [instanceId, refreshInstalledMods, resourceTab, selectedProject, source, subFolder]);

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
    dependenciesToInstall: OreProjectDependency[] = [],
    primaryProjectId?: string
  ) => {
    if (dependenciesToInstall.length > 0) {
      const fetchVersions = source === 'curseforge' ? fetchCurseForgeVersions : fetchModrinthVersions;

      for (const dependency of dependenciesToInstall) {
        if (!dependency.project_id) continue;
        pendingDepIdsRef.current.add(dependency.project_id);

        try {
          const dependencyVersions = await fetchVersions(
            dependency.project_id,
            targetMc || undefined,
            resourceTab === 'mod' ? targetLoader || undefined : undefined
          );

          if (dependencyVersions.length > 0) {
            await enqueueDownload(dependencyVersions[0], targetInstanceId, dependency.project_id);
          }
        } catch (error) {
          console.error(`前置 ${dependency.project_id} 自动下载失败:`, error);
        }
      }
      for (const dependency of dependenciesToInstall) {
        if (dependency.project_id) {
          pendingDepIdsRef.current.delete(dependency.project_id);
        }
      }
    }

    await enqueueDownload(version, targetInstanceId, primaryProjectId);
  }, [enqueueDownload, resourceTab, source, targetLoader, targetMc]);

  const handleStartDownload = useCallback(async (
    version: OreProjectVersion,
    targetInstanceId: string,
    autoInstallRequiredDeps?: boolean,
    primaryProjectId = ''
  ) => {
    if (resourceTab !== 'mod' || targetInstanceId !== instanceId) {
      await downloadWithDependencies(version, targetInstanceId, [], primaryProjectId);
      return;
    }

    if (typeof autoInstallRequiredDeps === 'boolean') {
      const dependenciesToInstall = autoInstallRequiredDeps ? pendingDependencyEntries : [];
      closeDependencyModal();

      await downloadWithDependencies(
        version,
        targetInstanceId,
        dependenciesToInstall,
        primaryProjectId
      );
      return;
    }

    const requiredDependencies = (version.dependencies || []).filter(
      (dependency) => dependency.dependency_type === 'required' && dependency.project_id
    );

    if (requiredDependencies.length === 0) {
      await downloadWithDependencies(version, targetInstanceId, [], primaryProjectId);
      return;
    }

    const missingDependencyEntries = requiredDependencies.filter(
      (dependency) => 
        !installedModIds.includes(dependency.project_id || '') &&
        dependency.project_id &&
        !pendingDepIdsRef.current.has(dependency.project_id)
    );

    if (missingDependencyEntries.length === 0) {
      await downloadWithDependencies(version, targetInstanceId, [], primaryProjectId);
      return;
    }

    setPendingDependencyVersion(version);
    setPendingDependencyEntries(missingDependencyEntries);
    setPendingDependencyProjectId(primaryProjectId);
    setMissingDeps([]);
    setAutoInstallDeps(true);
    setIsCheckingDeps(true);

    try {
      const resolvedMissingDeps = await resolveMissingDependencyInfo(missingDependencyEntries, source);
      setMissingDeps(resolvedMissingDeps);
    } catch (error) {
      console.error('分析前置依赖失败:', error);
      closeDependencyModal();
      await downloadWithDependencies(version, targetInstanceId, [], primaryProjectId);
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
    await handleStartDownload(pendingDependencyVersion, instanceId, autoInstallDeps, pendingDependencyProjectId);
  }, [autoInstallDeps, handleStartDownload, instanceId, pendingDependencyProjectId, pendingDependencyVersion]);

  const handleDetailDownload = useCallback((
    version: OreProjectVersion,
    targetInstanceId: string,
    autoInstallRequiredDeps?: boolean
  ) => {
    return handleStartDownload(version, targetInstanceId, autoInstallRequiredDeps, selectedProject?.id || '');
  }, [handleStartDownload, selectedProject]);

  const fetchLatestProjectVersion = useCallback(async (project: ModrinthProject) => {
    const projectId = project.id || project.project_id || '';
    if (!projectId) return null;

    const fetchVersions = source === 'curseforge' ? fetchCurseForgeVersions : fetchModrinthVersions;
    const versions = await fetchVersions(
      projectId,
      targetMc || undefined,
      resourceTab === 'mod' ? targetLoader || undefined : undefined
    );

    return versions[0] ? { version: versions[0], projectId } : null;
  }, [resourceTab, source, targetLoader, targetMc]);

  const handleBatchDownload = useCallback(async () => {
    const targets = [...selectedProjects];
    const resolvedVersions = await Promise.allSettled(
      targets.map((project) => fetchLatestProjectVersion(project))
    );

    const downloadable = resolvedVersions
      .map((result) => result.status === 'fulfilled' ? result.value : null)
      .filter((result): result is { version: OreProjectVersion; projectId: string } => Boolean(result));

    await Promise.allSettled(
      downloadable.map(({ version, projectId }) =>
        handleStartDownload(version, instanceId, false, projectId)
      )
    );

    clearSelection();
  }, [clearSelection, fetchLatestProjectVersion, handleStartDownload, instanceId, selectedProjects]);

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
        categoryOptions={categoryOptions}
        sort={sort}
        setSort={setSort}
        onSearch={handleSearchClick}
        onReset={handleResetClick}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm border-2 border-[#1E1E1F] bg-black/20 shadow-inner">
        {isHintVisible && (
          <div className="pointer-events-none absolute right-4 top-4 z-50 flex items-center gap-2 rounded-sm border border-white/10 bg-black/85 px-3 py-2 text-xs font-minecraft tracking-wider text-gray-200 shadow-lg">
            <GamepadBtn text="Y" color="#FACC15" />
            <span className="mt-[0.0625rem]">{yHintText}</span>
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
          selectedProjectIds={selectedProjectIds}
          isSelectionMode={isSelectionMode}
          onToggleProjectSelection={handleToggleProjectSelection}
          getProjectKey={getProjectKey}
          scrollContainerId="instance-mod-download-results"
          onScrollTopChange={setResultsScrollTop}
        />

        <ContextualActionBar
          selectedCount={selectedCount}
          showBulkDownload={showBulkDownload}
          onBulkDownload={() => { void handleBatchDownload(); }}
          onAddFavorite={() => setIsFavoriteModalOpen(true)}
          onClear={clearSelection}
          focusKeyPrefix={INSTANCE_DOWNLOAD_ACTION_BAR_FOCUS_PREFIX}
        />
      </div>

      <DownloadDetailModal
        project={selectedProject}
        instanceConfig={instanceConfig}
        onClose={() => {
          setSelectedProject(null);
          setTimeout(() => setFocus('download-grid-item-0'), 50);
        }}
        onDownload={handleDetailDownload}
        installedVersionIds={installedVersionIds}
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

      <FavoritePlaceholderModal
        isOpen={isFavoriteModalOpen}
        projects={selectedProjects}
        onClose={() => setIsFavoriteModalOpen(false)}
        defaultGameVersion={targetMc}
        defaultLoader={targetLoader}
        mcVersionOptions={mcVersionOptions}
        onCreated={clearSelection}
      />
    </FocusBoundary>
  );
};
