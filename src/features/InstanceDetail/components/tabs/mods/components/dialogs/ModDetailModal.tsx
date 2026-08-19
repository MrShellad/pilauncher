import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Power, Settings2, Star, Trash2 } from 'lucide-react';
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
import { OreOverlayScrollArea } from '../../../../../../../ui/primitives/OreOverlayScrollArea';
import { FocusItem } from '../../../../../../../ui/focus/FocusItem';
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
import { ModVersionHistory } from './components/ModVersionHistory';
import { ModMetadataSettingsModal } from './components/ModMetadataSettingsModal';

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

interface DependencyItem {
  id: string;
  name: string;
  type: string;
  isInstalled: boolean;
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
  const [activePlatform, setActivePlatform] = useState<ModPlatformId>('modrinth');
  const [showMetadataSettings, setShowMetadataSettings] = useState(false);
  const [selectedDependencyProject, setSelectedDependencyProject] = useState<ModrinthProject | null>(null);
  const [isFetchingDependencyProject, setIsFetchingDependencyProject] = useState(false);
  const [isDependentsExpanded, setIsDependentsExpanded] = useState(false);

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
    /* Legacy task initialization is owned by runResourceDownloadTask.
      message: '正在建立连接...',
    */
    try {
      await runResourceDownloadTask({
        url: version.download_url,
        fileName: version.file_name,
        instanceId: singleId,
        subFolder: 'mods',
        title: version.file_name,
        message: '姝ｅ湪寤虹珛杩炴帴...'
      });
    } catch (err) {
      console.error('Failed to download dependency:', err);
    }
  }, []);

  const lastFocusBeforeModalRef = useRef<string | null>(null);

  // Hook for loading metadata
  const {
    displayMod,
    setDisplayMod,
    initialMetadataPlatform
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

  // RESOLVE DEPENDENCIES: 100% synchronous derived memory state, eliminating state oscillation & skeleton flickering
  const dependencies = React.useMemo<DependencyItem[]>(() => {
    if (!displayMod) return [];

    const itemsMap = new Map<string, DependencyItem>();

    // 1. Authoritative primary source: SQLite dependency graph from backend
    const declaredDeps = dependencyHealth?.declaredDependencies?.[displayMod.fileName] || [];
    for (const dep of declaredDeps) {
      itemsMap.set(dep.targetIdentifier.toLowerCase(), {
        id: dep.targetIdentifier,
        name: dep.targetNameHint || dep.targetIdentifier,
        type: dep.relationType || 'required',
        isInstalled: !!dep.isInstalledInInstance
      });
    }

    // 2. Supplementary local dependencies from jar parsing if not already in graph
    const localDeps = displayMod.dependencies || [];
    for (const depId of localDeps) {
      const cleanId = depId.toLowerCase();
      if (itemsMap.has(cleanId)) continue;

      const installedMod = (allMods || []).find((m) => {
        const modIdLower = m.modId?.toLowerCase();
        const fileNameClean = m.fileName.toLowerCase().replace(/\.jar|\.disabled/g, '');
        const hasAlias = m.aliases?.some((a) => a.toLowerCase() === cleanId);
        return modIdLower === cleanId || fileNameClean.includes(cleanId) || hasAlias;
      });
      const name = installedMod ? (installedMod.name || installedMod.networkInfo?.title || depId) : depId;

      itemsMap.set(cleanId, {
        id: depId,
        name,
        type: 'required',
        isInstalled: !!installedMod
      });
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

          const installedMod = (allMods || []).find((m) => {
            const mrId = m.manifestEntry?.matchedPlatforms?.modrinth?.projectId;
            const cfId = m.manifestEntry?.matchedPlatforms?.curseforge?.projectId;
            const srcId = m.manifestEntry?.source?.projectId;
            const modIdLower = m.modId?.toLowerCase();
            const fileNameClean = m.fileName.toLowerCase().replace(/\.jar|\.disabled/g, '');
            const hasAlias = m.aliases?.some((a) => a.toLowerCase() === cleanId);
            return (
              srcId === depProjectId ||
              mrId === depProjectId ||
              cfId === depProjectId ||
              modIdLower === cleanId ||
              fileNameClean.includes(cleanId) ||
              hasAlias
            );
          });

          itemsMap.set(cleanId, {
            id: depProjectId,
            name: installedMod ? (installedMod.name || installedMod.networkInfo?.title || installedMod.fileName) : (dep.file_name || `前置 (${depProjectId})`),
            type: dep.dependency_type || 'required',
            isInstalled: !!installedMod
          });
        }
      }
    }

    const selfModId = displayMod.modId?.toLowerCase();
    return Array.from(itemsMap.values()).filter(
      (item) => item?.id && item.id.toLowerCase() !== selfModId
    );
  }, [displayMod, modVersions, allMods, dependencyHealth]);

  // Sync activePlatform with mod's preferred platform upon opening
  useEffect(() => {
    if (mod) {
      setActivePlatform(initialMetadataPlatform);
    }
  }, [mod, initialMetadataPlatform]);

  // Initial focus management when opening the modal
  useEffect(() => {
    if (mod) {
      setIsDependentsExpanded(false);
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
  }, [mod]);

  // Open metadata settings if requested on load
  useEffect(() => {
    if (!openMetadataSettingsOnOpen || !displayMod) {
      return;
    }
    setShowMetadataSettings(true);
    onMetadataSettingsOpenHandled?.();
  }, [displayMod, onMetadataSettingsOpenHandled, openMetadataSettingsOnOpen]);

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      const lastFocus = lastFocusBeforeModalRef.current;
      if (lastFocus && doesFocusableExist(lastFocus)) {
        setFocus(lastFocus);
      }
    }, 50);
  };

  const openMetadataSettings = useCallback(() => {
    setShowMetadataSettings(true);
  }, []);

  const closeMetadataSettings = () => {
    setShowMetadataSettings(false);
    setTimeout(() => setFocus('btn-mod-metadata-settings'), 50);
  };

  const handleSettingsUpdated = (updatedMod: ModMeta) => {
    setDisplayMod(updatedMod);
    setActivePlatform(getModPreferredPlatform(updatedMod, 'metadata') || activePlatform);
    setShowMetadataSettings(false);
    setTimeout(() => setFocus('btn-mod-metadata-settings'), 50);
  };

  if (!mod) return null;

  const modalActions = (
    <>
      <OreButton
        focusKey="btn-mod-toggle"
        variant={displayMod?.isEnabled ? 'secondary' : 'primary'}
        size="auto"
        onClick={() => onToggle(mod.fileName, !!displayMod?.isEnabled)}
      >
        <Power size={14} className="mr-1.5" /> {displayMod?.isEnabled ? t('instanceDetail.mods.detail.disable', { defaultValue: '禁用' }) : t('instanceDetail.mods.detail.enable', { defaultValue: '启用' })}
      </OreButton>
      <OreButton
        focusKey="btn-mod-delete"
        variant="danger"
        size="auto"
        onClick={() => onDelete(mod.fileName)}
      >
        <Trash2 size={14} className="mr-1.5" /> {t('instanceDetail.mods.detail.delete', { defaultValue: '删除' })}
      </OreButton>
      <OreButton
        focusKey="btn-mod-favorite"
        variant="secondary"
        size="auto"
        onClick={() => onAddFavorite?.(mod)}
      >
        <Star size={14} className="mr-1.5" /> {t('instanceDetail.mods.detail.favorite', { defaultValue: '收藏' })}
      </OreButton>
      <OreButton
        focusKey="btn-mod-metadata-settings"
        variant="secondary"
        size="auto"
        onClick={openMetadataSettings}
      >
        <Settings2 size={14} className="mr-1.5" /> {t('instanceDetail.mods.detail.metadata', { defaultValue: '元数据' })}
      </OreButton>
      <OreButton
        focusKey="btn-mod-cancel"
        variant="secondary"
        size="auto"
        onClick={handleClose}
      >
        {t('instanceDetail.mods.detail.cancel', { defaultValue: '取消' })}
      </OreButton>
    </>
  );

  return (
    <>
      <OreModal
        isOpen={!!mod}
        onClose={handleClose}
        hideTitleBar
        defaultFocusKey="btn-mod-toggle"
        className="ore-download-detail-modal border-[0.1875rem] border-[#1E1E1F]"
        contentClassName="ore-download-detail-modal__content flex flex-1 min-h-0 flex-col overflow-hidden bg-[#313233] p-0"
        actionsClassName="!justify-center bg-[var(--ore-downloadDetail-surface)] border-t-[2px] border-[var(--ore-downloadDetail-divider)] px-4 py-2.5 gap-2"
        actions={modalActions}
      >
        {/* Header Info Block */}
        <ModHeader mod={mod} displayMod={displayMod} instanceId={instanceId} />

          {/* Body Content with OreOverlayScrollArea (Unified with DownloadDetailModal) */}
          <OreOverlayScrollArea
            className="relative z-10 flex-1 w-full bg-[var(--ore-downloadDetail-surface)] min-h-0"
            viewportClassName="shadow-[inset_0_0.625rem_1.25rem_-0.625rem_rgba(0,0,0,0.55)] p-4 sm:p-5 flex flex-col gap-3.5"
            contentSafePaddingRight={6}
          >
            {/* Dependents Section (if any installed mods depend on this mod) */}
            {instanceDependents.length > 0 && (
              <div className="flex flex-col border-[2px] border-[var(--ore-downloadDetail-divider)] bg-[var(--ore-downloadDetail-base)] rounded-sm shrink-0 font-minecraft transition-all">
                <button
                  type="button"
                  onClick={() => setIsDependentsExpanded(!isDependentsExpanded)}
                  className="flex items-center justify-between w-full p-2.5 sm:p-3 text-left hover:bg-white/[0.03] transition-colors cursor-pointer outline-none select-none"
                >
                  <div className="flex items-center gap-1.5 text-xs font-minecraft text-[#91CAFF] font-bold">
                    <span>🧩 {t('instanceDetail.mods.detail.dependents', { defaultValue: '作为以下 {{count}} 个已安装模组的前置', count: instanceDependents.length })}</span>
                    <span className="text-[10px] bg-[#112A45] border border-[#183B63] text-[#91CAFF] px-1.5 py-0.2 rounded font-mono font-normal">
                      {instanceDependents.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-[#91CAFF]/80 font-normal">
                    <span>{isDependentsExpanded ? t('common.collapse', { defaultValue: '折叠' }) : t('common.expand', { defaultValue: '展开' })}</span>
                    {isDependentsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                </button>

                {isDependentsExpanded && (
                  <div className="px-3 pb-3 pt-0 border-t border-[var(--ore-downloadDetail-divider)]/50">
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar pt-2">
                      {instanceDependents.map((depFileName) => {
                        const dependentMod = (allMods || []).find((m) => m.fileName === depFileName);
                        const name = dependentMod?.name || dependentMod?.networkInfo?.title || depFileName;
                        return (
                          <span
                            key={depFileName}
                            className="inline-flex items-center gap-1 px-2 py-0.5 border-[2px] border-[#183B63] bg-[#112A45] text-[#91CAFF] text-[11px] font-minecraft rounded-sm tracking-wide shadow-sm"
                            title={depFileName}
                          >
                            {name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Dependencies Section */}
            <div className="flex flex-col gap-2 border-[2px] border-[var(--ore-downloadDetail-divider)] bg-[var(--ore-downloadDetail-base)] p-3 rounded-sm shrink-0 font-minecraft">
              <div className="flex items-center justify-between">
                <h3 className="font-minecraft text-white text-xs sm:text-sm tracking-wide font-bold flex items-center gap-1.5">
                  <span>🔗 {t('instanceDetail.mods.detail.dependencies', { defaultValue: '前置依赖关系' })}</span>
                  {dependencies.length > 0 && (
                    <span className="text-[10px] bg-white/10 text-gray-300 px-1.5 py-0.2 rounded font-mono">
                      {dependencies.length}
                    </span>
                  )}
                </h3>
                {dependencies.length > 0 && (
                  <span className="text-[10px] text-[var(--ore-downloadDetail-hintText)] opacity-80">
                    {t('instanceDetail.mods.detail.depClickHint', { defaultValue: '点击依赖项可快速下载或查看' })}
                  </span>
                )}
              </div>

              {dependencies.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-36 overflow-y-auto px-0.5 py-1 custom-scrollbar">
                  {dependencies.map((dep, idx) => (
                    <FocusItem key={dep.id} focusKey={`mod-dependency-${idx}`} onEnter={() => handleDependencyClick(dep)}>
                      {({ ref, focused }) => (
                        <button
                          ref={ref}
                          onClick={() => handleDependencyClick(dep)}
                          disabled={isFetchingDependencyProject}
                          className={`
                            flex items-center justify-between gap-2 border-[2px] px-2.5 py-1.5 rounded-sm text-xs font-minecraft tracking-wide text-left cursor-pointer transition-all w-full select-none outline-none
                            ${dep.isInstalled
                              ? 'border-[#3C8527] bg-[#1E3A1A] text-[#6CC349] hover:bg-[#254A20]'
                              : dep.type === 'optional'
                              ? 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                              : 'border-[#B26B00] bg-[#3B2500] text-[#FFB84D] hover:bg-[#4D3100] shadow-[0_0_8px_rgba(255,184,77,0.15)]'
                            }
                            ${focused ? 'border-white z-10 scale-[1.02] shadow-[0_0_12px_rgba(255,255,255,0.25)] brightness-110' : ''}
                          `}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            {dep.isInstalled ? (
                              <Check size={13} strokeWidth={3} className="shrink-0 text-[#6CC349]" />
                            ) : dep.type === 'optional' ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-[#FFB84D] shrink-0" />
                            )}
                            <span className="truncate font-medium">{dep.name}</span>
                          </div>
                          <span className={`text-[10px] px-1 py-0.2 rounded font-mono uppercase shrink-0 ${
                            dep.isInstalled ? 'bg-black/30 text-[#6CC349]' : dep.type === 'optional' ? 'bg-black/20 text-gray-400' : 'bg-black/40 text-[#FFB84D] font-bold'
                          }`}>
                            {dep.isInstalled ? '已安装' : dep.type === 'optional' ? '可选' : '未安装'}
                          </span>
                        </button>
                      )}
                    </FocusItem>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[var(--ore-downloadDetail-hintText)] py-1">
                  {t('instanceDetail.mods.detail.noDependencies', { defaultValue: '无前置依赖' })}
                </div>
              )}
            </div>

            {/* Version History */}
            <ModVersionHistory
              mod={mod}
              displayMod={displayMod}
              activePlatform={activePlatform}
              setActivePlatform={setActivePlatform}
              isLoadingVersions={isLoadingVersions}
              modVersions={modVersions}
              onInstallVersion={onInstallVersion}
            />
          </OreOverlayScrollArea>
      </OreModal>

      <ModMetadataSettingsModal
        isOpen={showMetadataSettings}
        onClose={closeMetadataSettings}
        displayMod={displayMod}
        onSaveMetadataSettings={onSaveMetadataSettings}
        onReidentifyMod={onReidentifyMod}
        onSettingsUpdated={handleSettingsUpdated}
      />

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
