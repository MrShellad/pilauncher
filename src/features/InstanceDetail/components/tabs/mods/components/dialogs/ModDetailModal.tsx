import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Power, Star, Trash2 } from 'lucide-react';
import {
  getCurrentFocusKey,
  doesFocusableExist,
  setFocus
} from '@noriginmedia/norigin-spatial-navigation';
import { useTranslation } from 'react-i18next';
import { DownloadDetailModal } from '../../../../../../Download/components/DownloadDetailModal';
import { runResourceDownloadTask } from '../../../../../../Download/logic/resourceDownloadTask';
import { OreModal } from '../../../../../../../ui/primitives/OreModal';
import { OreButton } from '../../../../../../../ui/primitives/OreButton';
import { OreSegmentedControl } from '../../../../../../../ui/primitives/OreSegmentedControl';
import {
  getModPreferredPlatform,
  type InstanceDependencyHealth,
  type ModMeta,
  type ModMetadataSettings,
  type ModPlatformId,
  type ModVersionInstallAction
} from '../../../../../logic/modService';
import { type OreProjectVersion, getProjectDetails, type ModrinthProject } from '../../../../../logic/modrinthApi';
import { getCurseForgeProjectDetails } from '../../../../../../Download/logic/curseforgeApi';
import { toNetworkInfo } from './utils/modDetailUtils';

import { useModMetadata } from './hooks/useModMetadata';
import { useModVersions } from './hooks/useModVersions';
import { ModHeader } from './components/ModHeader';
import { ModOverviewTab, type DependencyItem } from './components/ModOverviewTab';
import { ModVersionHistory } from './components/ModVersionHistory';
import { ModMetadataTab } from './components/ModMetadataTab';

type ModDetailTab = 'overview' | 'versions' | 'metadata';

interface ModDetailModalProps {
  mod: ModMeta | null;
  instanceConfig: any;
  instanceId?: string;
  dependencyHealth?: InstanceDependencyHealth | null;
  onClose: () => void;
  onToggle: (fileName: string, currentEnabled: boolean) => void;
  onDelete: (fileName: string) => void;
  onInstallVersion: (mod: ModMeta, version: OreProjectVersion, action: ModVersionInstallAction) => void;
  onSaveMetadataSettings: (mod: ModMeta, settings: ModMetadataSettings) => Promise<ModMeta>;
  onReidentifyMod: (mod: ModMeta) => Promise<ModMeta>;
  onMetadataResolved?: (mod: ModMeta) => void;
  onAddFavorite?: (mod: ModMeta) => void;
  allMods?: ModMeta[];
  openMetadataSettingsOnOpen?: boolean;
  onMetadataSettingsOpenHandled?: () => void;
}

export const ModDetailModal: React.FC<ModDetailModalProps> = ({
  mod,
  instanceConfig,
  instanceId,
  dependencyHealth,
  onClose,
  onToggle,
  onDelete,
  onInstallVersion,
  onSaveMetadataSettings,
  onReidentifyMod,
  onMetadataResolved,
  onAddFavorite,
  openMetadataSettingsOnOpen = false,
  onMetadataSettingsOpenHandled,
  allMods = []
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ModDetailTab>('overview');
  const [activePlatform, setActivePlatform] = useState<ModPlatformId>('modrinth');
  const [selectedDependencyProject, setSelectedDependencyProject] = useState<ModrinthProject | null>(null);
  const [isFetchingDependencyProject, setIsFetchingDependencyProject] = useState(false);

  const installedVersionIds = React.useMemo(() => {
    const ids: string[] = [];
    (allMods || []).forEach(m => {
      if (m.manifestEntry?.source?.fileId) ids.push(String(m.manifestEntry.source.fileId));
      if (m.manifestEntry?.source?.projectId) ids.push(String(m.manifestEntry.source.projectId));
      if (m.modId) ids.push(m.modId);
      if (m.fileName) ids.push(m.fileName);
    });
    return ids;
  }, [allMods]);

  const handleDependencyClick = async (dep: DependencyItem) => {
    if (isFetchingDependencyProject) return;
    setIsFetchingDependencyProject(true);
    try {
      let projectDetail: ModrinthProject | null = null;
      const platform = activePlatform;
      if (platform === 'curseforge') {
        try {
          const detail = await getCurseForgeProjectDetails(dep.id);
          projectDetail = toNetworkInfo(detail, 'curseforge');
        } catch (err) {
          console.warn('CurseForge dependency fetch failed, trying Modrinth:', err);
          const detail = await getProjectDetails(dep.id);
          projectDetail = toNetworkInfo(detail, 'modrinth');
        }
      } else {
        try {
          const detail = await getProjectDetails(dep.id);
          projectDetail = toNetworkInfo(detail, 'modrinth');
        } catch (err) {
          console.warn('Modrinth dependency fetch failed, trying CurseForge:', err);
          const detail = await getCurseForgeProjectDetails(dep.id);
          projectDetail = toNetworkInfo(detail, 'curseforge');
        }
      }

      if (projectDetail) {
        setSelectedDependencyProject(projectDetail);
      }
    } catch (err) {
      console.error('Failed to resolve dependency project details:', err);
    } finally {
      setIsFetchingDependencyProject(false);
    }
  };

  const handleDownload = useCallback(async (
    version: OreProjectVersion,
    targetInstanceIdOrName: string | string[],
    _autoInstallRequiredDeps?: boolean
  ) => {
    const singleId = (Array.isArray(targetInstanceIdOrName) ? targetInstanceIdOrName[0] : targetInstanceIdOrName) || instanceId || '';
    try {
      await runResourceDownloadTask({
        url: version.download_url,
        fileName: version.file_name,
        instanceId: singleId,
        subFolder: 'mods',
        title: version.file_name,
        message: '正在建立连接...'
      });
    } catch (err) {
      console.error('Failed to download dependency:', err);
    }
  }, [instanceId]);

  const lastFocusBeforeModalRef = useRef<string | null>(null);
  const openedModFileNameRef = useRef<string | null>(null);

  // Hook for loading metadata
  const {
    displayMod,
    setDisplayMod,
    initialMetadataPlatform,
    suppressAutoResolution
  } = useModMetadata(mod, onMetadataResolved, instanceConfig, instanceId);

  // Hook for loading platform version lists
  const {
    modVersions,
    isLoadingVersions
  } = useModVersions(displayMod, activePlatform, instanceConfig);

  // Computed instance dependents (mods in this instance that depend on displayMod)
  const instanceDependents = React.useMemo(() => {
    if (!displayMod || !dependencyHealth?.instanceDependents) return [];
    return dependencyHealth.instanceDependents[displayMod.fileName] || [];
  }, [displayMod, dependencyHealth]);

  // RESOLVE DEPENDENCIES: 100% synchronous derived memory state
  const dependencies = React.useMemo<DependencyItem[]>(() => {
    if (!displayMod) return [];

    const itemsMap = new Map<string, DependencyItem>();
    const dependencyPlatform = getModPreferredPlatform(displayMod, 'metadata');
    const findInstalledMod = (dependencyId: string) => {
      const cleanId = dependencyId.toLowerCase();
      return (allMods || []).find((candidate) => {
        const sourceProjectId = candidate.manifestEntry?.source?.projectId?.toLowerCase();
        const modrinthProjectId = candidate.manifestEntry?.matchedPlatforms?.modrinth?.projectId?.toLowerCase();
        const curseforgeProjectId = candidate.manifestEntry?.matchedPlatforms?.curseforge?.projectId?.toLowerCase();
        const modId = candidate.modId?.toLowerCase();
        const fileName = candidate.fileName.toLowerCase().replace(/\.jar|\.disabled/g, '');
        const hasAlias = candidate.aliases?.some((alias) => alias.toLowerCase() === cleanId);
        return sourceProjectId === cleanId
          || modrinthProjectId === cleanId
          || curseforgeProjectId === cleanId
          || modId === cleanId
          || fileName.includes(cleanId)
          || hasAlias;
      });
    };

    // 1. Authoritative primary source: SQLite dependency graph from backend
    const allDeclaredDeps = dependencyHealth?.declaredDependencies?.[displayMod.fileName] || [];
    const hasCloudDeclaredDeps = allDeclaredDeps.some(
      (dep) => dep.sourceProvider === 'modrinth' || dep.sourceProvider === 'curseforge'
    );
    const declaredDeps = hasCloudDeclaredDeps && dependencyPlatform
      ? allDeclaredDeps.filter(
        (dep) => dep.sourceProvider !== 'modrinth' && dep.sourceProvider !== 'curseforge'
          || dep.sourceProvider === dependencyPlatform
      )
      : allDeclaredDeps;
    for (const dep of declaredDeps) {
      const installedMod = findInstalledMod(dep.targetIdentifier);
      itemsMap.set(dep.targetIdentifier.toLowerCase(), {
        id: dep.targetIdentifier,
        name: installedMod?.name || installedMod?.networkInfo?.title || dep.targetNameHint || dep.targetIdentifier,
        type: dep.relationType || 'required',
        isInstalled: !!dep.isInstalledInInstance,
        platform: dep.targetType === 'modrinth' || dep.targetType === 'curseforge'
          ? dep.targetType
          : undefined,
        installedMod
      });
    }

    // 2. Supplementary local dependencies from jar parsing if not already in graph
    const localDeps = displayMod.dependencies || [];
    if (!hasCloudDeclaredDeps) {
      for (const depId of localDeps) {
        const cleanId = depId.toLowerCase();
        if (itemsMap.has(cleanId)) continue;

        const installedMod = findInstalledMod(depId);
        const name = installedMod ? (installedMod.name || installedMod.networkInfo?.title || depId) : depId;

        itemsMap.set(cleanId, {
          id: depId,
          name,
          type: 'required',
          isInstalled: !!installedMod,
          installedMod
        });
      }
    }

    // 3. Fallback: version cloud dependencies only if local graph has no items
    if (itemsMap.size === 0 && modVersions && modVersions.length > 0) {
      const activeVersion = modVersions.find(
        (v) =>
          v.version_number === displayMod.version ||
          v.id === displayMod.manifestEntry?.source?.fileId
      ) || modVersions[0];

      if (activeVersion && activeVersion.dependencies) {
        const netDeps: any[] = activeVersion.dependencies;

        for (const dep of netDeps) {
          if (!dep.project_id) continue;
          const depProjectId = String(dep.project_id);
          const cleanId = depProjectId.toLowerCase();
          if (itemsMap.has(cleanId)) continue;

          const installedMod = findInstalledMod(depProjectId);

          itemsMap.set(cleanId, {
            id: depProjectId,
            name: installedMod ? (installedMod.name || installedMod.networkInfo?.title || installedMod.fileName) : (dep.file_name || `前置 (${depProjectId})`),
            type: dep.dependency_type || 'required',
            isInstalled: !!installedMod,
            platform: activePlatform,
            installedMod
          });
        }
      }
    }

    const selfModId = displayMod.modId?.toLowerCase();
    return Array.from(itemsMap.values()).filter(
      (item) => item?.id && item.id.toLowerCase() !== selfModId
    );
  }, [displayMod, modVersions, allMods, dependencyHealth, activePlatform]);

  // Sync activePlatform with a newly opened mod only. Updating metadata for the
  // currently open file must not reset the user's in-dialog state.
  useEffect(() => {
    if (!mod || openedModFileNameRef.current === mod.fileName) return;
    setActivePlatform(initialMetadataPlatform);
  }, [mod?.fileName, initialMetadataPlatform]);

  // Initial focus management when opening the modal
  useEffect(() => {
    if (!mod) {
      openedModFileNameRef.current = null;
      return;
    }

    const isNewMod = openedModFileNameRef.current !== mod.fileName;
    if (!isNewMod && !openMetadataSettingsOnOpen) return;
    openedModFileNameRef.current = mod.fileName;

    if (openMetadataSettingsOnOpen) {
      setActiveTab('metadata');
      onMetadataSettingsOpenHandled?.();
    } else if (isNewMod) {
      setActiveTab('overview');
    }

    if (isNewMod) {
      const currentFocus = getCurrentFocusKey();
      if (currentFocus && currentFocus !== 'SN:ROOT') {
        lastFocusBeforeModalRef.current = currentFocus;
      }
      setTimeout(() => {
        if (doesFocusableExist('btn-mod-toggle')) {
          setFocus('btn-mod-toggle');
        }
      }, 150);
    }
  }, [mod?.fileName, openMetadataSettingsOnOpen, onMetadataSettingsOpenHandled]);

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      const lastFocus = lastFocusBeforeModalRef.current;
      if (lastFocus && doesFocusableExist(lastFocus)) {
        setFocus(lastFocus);
      }
    }, 50);
  };

  const handleSettingsUpdated = (updatedMod: ModMeta) => {
    setDisplayMod(updatedMod);
    setActivePlatform(getModPreferredPlatform(updatedMod, 'metadata') || activePlatform);
  };

  if (!mod) return null;

  const tabOptions = [
    { id: 'overview', label: t('instanceDetail.mods.tabs.overview', { defaultValue: '概览与依赖' }) },
    { id: 'versions', label: t('instanceDetail.mods.tabs.versions', { defaultValue: '版本管理' }) },
    { id: 'metadata', label: t('instanceDetail.mods.tabs.metadata', { defaultValue: '元数据与识别' }) }
  ];

  const modalActions = (
    <div className="flex w-full items-center justify-between gap-3 font-minecraft">
      {/* 左侧：危险操作 (删除模组) */}
      <div className="flex items-center gap-2">
        <OreButton
          focusKey="btn-mod-delete"
          variant="danger"
          size="md"
          onClick={() => onDelete(mod.fileName)}
        >
          <Trash2 size={16} className="mr-2" />
          <span>删除模组</span>
        </OreButton>
      </div>

      {/* 右侧：状态切换 + 收藏 + 完成关闭 */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {onAddFavorite && (
          <OreButton
            focusKey="btn-mod-favorite"
            variant="secondary"
            size="md"
            onClick={() => onAddFavorite(mod)}
          >
            <Star size={16} className="mr-2" />
            <span>收藏</span>
          </OreButton>
        )}

        <OreButton
          focusKey="btn-mod-toggle"
          variant={displayMod?.isEnabled ? 'secondary' : 'primary'}
          size="md"
          onClick={() => onToggle(mod.fileName, !!displayMod?.isEnabled)}
        >
          <Power size={16} className="mr-2" />
          <span>{displayMod?.isEnabled ? '禁用模组' : '启用模组'}</span>
        </OreButton>

        <OreButton
          focusKey="btn-mod-cancel"
          variant="secondary"
          size="md"
          onClick={handleClose}
        >
          <span>完成</span>
        </OreButton>
      </div>
    </div>
  );

  return (
    <>
      <OreModal
        isOpen={!!mod}
        onClose={handleClose}
        hideTitleBar
        disableScrollArea
        defaultFocusKey="btn-mod-toggle"
        className="w-full max-w-4xl h-[82vh] max-h-[720px] min-h-[520px] border-[3px] border-[#1E1E1F] flex flex-col"
        contentClassName="flex flex-1 min-h-0 h-full flex-col overflow-hidden bg-[var(--ore-modal-bg)] p-0"
        actionsClassName="bg-[var(--ore-modal-footer-bg)] border-t-[3px] border-[#1E1E1F] px-5 py-3.5 shadow-[var(--ore-modal-footer-shadow)]"
        actions={modalActions}
      >
        {/* 1. 模组专属头部英雄栏 (包含图标、标题、作者、平台芯片、浏览器直达与右上角关闭 X) */}
        <ModHeader
          mod={mod}
          displayMod={displayMod}
          instanceId={instanceId}
          onClose={handleClose}
        />

        {/* 2. 居中展示的顶级 OreSegmentedControl 选项卡导航栏 */}
        <div
          className="flex shrink-0 items-center justify-center border-b-[2px] border-[#1E1E1F] bg-[#313233] px-4 py-2"
          style={{ boxShadow: 'inset 0 2px 0 rgba(255, 255, 255, 0.08)' }}
        >
          <OreSegmentedControl
            tabs={tabOptions}
            activeTab={activeTab}
            onChange={(val) => setActiveTab(val as ModDetailTab)}
            style={{
              '--seg-height': '2.25rem',
              '--seg-min-width': '0px',
              '--seg-px': '1.25rem',
              '--seg-font-size': '0.8125rem'
            } as any}
          />
        </div>

        {/* 3. 选项卡主视口容器 (固定撑满剩余高度，切换 tab 绝对不会发生尺寸伸缩变化) */}
        <div className="flex flex-1 min-h-0 h-full flex-col overflow-hidden bg-[var(--ore-modal-bg)]">
          {activeTab === 'overview' && (
            <ModOverviewTab
              mod={mod}
              displayMod={displayMod}
              dependencies={dependencies}
              instanceDependents={instanceDependents}
              allMods={allMods}
              instanceId={instanceId}
              isFetchingDependencyProject={isFetchingDependencyProject}
              onDependencyClick={handleDependencyClick}
            />
          )}

          {activeTab === 'versions' && (
            <ModVersionHistory
              mod={mod}
              displayMod={displayMod}
              activePlatform={activePlatform}
              setActivePlatform={setActivePlatform}
              isLoadingVersions={isLoadingVersions}
              modVersions={modVersions}
              onInstallVersion={onInstallVersion}
            />
          )}

          {activeTab === 'metadata' && (
            <ModMetadataTab
              mod={mod}
              displayMod={displayMod}
              onSaveMetadataSettings={onSaveMetadataSettings}
              onReidentifyMod={onReidentifyMod}
              onReidentifyStart={suppressAutoResolution}
              onSettingsUpdated={handleSettingsUpdated}
            />
          )}
        </div>
      </OreModal>

      {/* 4. 依赖项快捷下载/查看弹窗 */}
      {selectedDependencyProject && (
        <DownloadDetailModal
          project={selectedDependencyProject}
          instanceConfig={instanceConfig}
          onClose={() => setSelectedDependencyProject(null)}
          onDownload={handleDownload}
          installedVersionIds={installedVersionIds}
          searchMcVersion={instanceConfig?.game_version || instanceConfig?.gameVersion}
          searchLoader={instanceConfig?.loader_type || instanceConfig?.loaderType}
          activeTab="mod"
          source={selectedDependencyProject.source as any}
        />
      )}
    </>
  );
};

export default ModDetailModal;
