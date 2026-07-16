// src/features/InstanceDetail/components/tabs/mods/components/dialogs/ModDetailModal.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Power, Settings2, Star, Trash2 } from 'lucide-react';
import {
  getCurrentFocusKey,
  doesFocusableExist,
  setFocus
} from '@noriginmedia/norigin-spatial-navigation';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { useDownloadStore } from '../../../../../../../store/useDownloadStore';
import { DownloadDetailModal } from '../../../../../../Download/components/DownloadDetailModal';
import { OreModal } from '../../../../../../../ui/primitives/OreModal';
import { OreButton } from '../../../../../../../ui/primitives/OreButton';
import { FocusBoundary } from '../../../../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../../../../ui/focus/FocusItem';
import {
  getModPreferredPlatform,
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
import { ModDeleteConfirmModal } from './components/ModDeleteConfirmModal';

interface ModDetailModalProps {
  mod: ModMeta | null;
  instanceConfig: any;
  instanceId?: string;
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
        instanceId: singleId,
        subFolder: 'mods'
      }
    });

    try {
      await invoke('download_resource', {
        url: version.download_url,
        fileName: version.file_name,
        instanceId: singleId,
        subFolder: 'mods'
      });
    } catch (err) {
      console.error('Failed to download dependency:', err);
    }
  }, []);

  const lastFocusBeforeModalRef = useRef<string | null>(null);
  const lastFocusBeforeDeleteRef = useRef<string | null>(null);

  // Hook for loading metadata
  const {
    displayMod,
    setDisplayMod,
    initialMetadataPlatform
  } = useModMetadata(mod, onMetadataResolved, instanceConfig);

  // Hook for loading platform version lists
  const {
    modVersions,
    isLoadingVersions
  } = useModVersions(displayMod, activePlatform, instanceConfig);

  const [dependencies, setDependencies] = useState<DependencyItem[]>([]);
  const [isLoadingDeps, setIsLoadingDeps] = useState(false);

  // RESOLVE DEPENDENCIES
  useEffect(() => {
    if (!displayMod) return;

    let disposed = false;
    setIsLoadingDeps(true);

    const resolveDependencies = async () => {
      const itemsMap = new Map<string, DependencyItem>();

      // 1. Resolve local dependencies (from jar parsing)
      const localDeps = displayMod.dependencies || [];
      for (const depId of localDeps) {
        const isInstalled = (allMods || []).some(
          (m) => m.modId?.toLowerCase() === depId.toLowerCase() || m.fileName.toLowerCase().includes(depId.toLowerCase())
        );
        const installedMod = (allMods || []).find(
          (m) => m.modId?.toLowerCase() === depId.toLowerCase()
        );
        const name = installedMod ? (installedMod.name || installedMod.networkInfo?.title || depId) : depId;
        
        itemsMap.set(depId.toLowerCase(), {
          id: depId,
          name,
          type: 'required',
          isInstalled
        });
      }

      // 2. Resolve network dependencies from the version (if available)
      if (modVersions && modVersions.length > 0) {
        const activeVersion = modVersions.find(
          (v) =>
            v.version_number === displayMod.version ||
            v.id === displayMod.manifestEntry?.source?.fileId
        ) || modVersions[0];

        if (activeVersion && activeVersion.dependencies) {
          const netDeps: any[] = activeVersion.dependencies;
          
          await Promise.all(
            netDeps.map(async (dep) => {
              if (!dep.project_id) return;
              const depProjectId = String(dep.project_id);
              
              // Check if installed in instance
              const isInstalled = (allMods || []).some(
                (m) =>
                  m.manifestEntry?.source?.projectId === depProjectId ||
                  m.modId?.toLowerCase() === depProjectId.toLowerCase()
              );

              // If already resolved by local dep, just update its type / installed status
              const existing = itemsMap.get(depProjectId.toLowerCase());
              if (existing) {
                existing.type = dep.dependency_type || existing.type;
                existing.isInstalled = existing.isInstalled || isInstalled;
                return;
              }

              // Find mod name locally if installed
              const installedMod = (allMods || []).find(
                (m) =>
                  m.manifestEntry?.source?.projectId === depProjectId ||
                  m.modId?.toLowerCase() === depProjectId.toLowerCase()
              );

              if (installedMod) {
                itemsMap.set(depProjectId.toLowerCase(), {
                  id: depProjectId,
                  name: installedMod.name || installedMod.networkInfo?.title || installedMod.fileName,
                  type: dep.dependency_type || 'required',
                  isInstalled: true
                });
                return;
              }

              // Fetch name from API
              try {
                let name = `未知前置 (${depProjectId})`;
                if (activePlatform === 'curseforge') {
                  const detail = await getCurseForgeProjectDetails(depProjectId);
                  name = detail.title;
                } else {
                  const detail = await getProjectDetails(depProjectId);
                  name = detail.title;
                }
                if (!disposed) {
                  itemsMap.set(depProjectId.toLowerCase(), {
                    id: depProjectId,
                    name,
                    type: dep.dependency_type || 'required',
                    isInstalled: false
                  });
                }
              } catch (err) {
                console.error('Failed to fetch dependency project details:', err);
                if (!disposed) {
                  itemsMap.set(depProjectId.toLowerCase(), {
                    id: depProjectId,
                    name: `未知前置 (${depProjectId})`,
                    type: dep.dependency_type || 'required',
                    isInstalled: false
                  });
                }
              }
            })
          );
        }
      }

      if (!disposed) {
        // Filter out self-dependencies if any
        const finalDeps = Array.from(itemsMap.values()).filter(
          (item) => item.id.toLowerCase() !== displayMod.modId?.toLowerCase()
        );
        setDependencies(finalDeps);
        setIsLoadingDeps(false);
      }
    };

    resolveDependencies();

    return () => {
      disposed = true;
    };
  }, [displayMod, modVersions, allMods, activePlatform]);

  // Sync activePlatform with mod's preferred platform upon opening
  useEffect(() => {
    if (mod) {
      setActivePlatform(initialMetadataPlatform);
    }
  }, [mod, initialMetadataPlatform]);

  // Initial focus management when opening the modal
  useEffect(() => {
    if (mod) {
      const currentFocus = getCurrentFocusKey();
      if (currentFocus && currentFocus !== 'SN:ROOT') {
        lastFocusBeforeModalRef.current = currentFocus;
      }
      setTimeout(() => {
        if (doesFocusableExist('btn-mod-toggle')) {
          setFocus('btn-mod-toggle');
        }
      }, 150);
    } else {
      setShowDeleteConfirm(false);
    }
  }, [mod]);

  // Save the focused key before showing deletion confirmation modal
  useEffect(() => {
    if (showDeleteConfirm) {
      const currentFocus = getCurrentFocusKey();
      if (currentFocus && currentFocus !== 'SN:ROOT') {
        lastFocusBeforeDeleteRef.current = currentFocus;
      }
    }
  }, [showDeleteConfirm]);

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

  const handleCloseDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    setTimeout(() => {
      const lastFocus = lastFocusBeforeDeleteRef.current;
      if (lastFocus && doesFocusableExist(lastFocus)) {
        setFocus(lastFocus);
      } else {
        setFocus('btn-mod-delete');
      }
    }, 50);
  };

  const handleExecuteDelete = () => {
    if (!mod) return;
    onDelete(mod.fileName);
    setShowDeleteConfirm(false);
    handleClose();
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
        onClick={() => setShowDeleteConfirm(true)}
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
        isOpen={!!mod && !showDeleteConfirm}
        onClose={handleClose}
        hideTitleBar
        defaultFocusKey="btn-mod-toggle"
        className="ore-download-detail-modal border-[0.1875rem] border-[#1E1E1F]"
        contentClassName="ore-download-detail-modal__content flex flex-1 min-h-0 flex-col overflow-hidden bg-[#313233] p-0"
        actionsClassName="!justify-center bg-[#2B2C2D] border-t-[3px] border-[#1E1E1F]"
        actions={modalActions}
      >
        <FocusBoundary
          id="mod-detail-boundary"
          trapFocus
          onEscape={handleClose}
          className="flex flex-col min-h-0 h-full bg-[#313233]"
        >
          {/* Header Info Block */}
          <ModHeader mod={mod} displayMod={displayMod} />

          {/* Dependencies Section & Version History */}
          <div className="flex flex-col flex-1 min-h-0 p-4 sm:p-6 gap-4">
            <div className="flex flex-col gap-2 border-b border-white/5 pb-4 shrink-0 font-minecraft">
              <h3 className="font-minecraft text-white text-sm sm:text-base tracking-wide">
                {t('instanceDetail.mods.detail.dependencies', { defaultValue: '前置依赖' })}
              </h3>
              {isLoadingDeps ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 px-2 py-1.5">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-[34px] border-[2px] border-[var(--ore-downloadDetail-divider)] bg-white/[0.03] rounded-[2px] animate-pulse flex items-center px-3"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-white/10 mr-1.5 shrink-0" />
                      <div className="h-3 bg-white/10 rounded w-20" />
                    </div>
                  ))}
                </div>
              ) : dependencies.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-36 overflow-y-auto px-2 py-1.5 custom-scrollbar">
                  {dependencies.map((dep, idx) => (
                    <FocusItem key={dep.id} focusKey={`mod-dependency-${idx}`} onEnter={() => handleDependencyClick(dep)}>
                      {({ ref, focused }) => (
                        <button
                          ref={ref}
                          onClick={() => handleDependencyClick(dep)}
                          disabled={isFetchingDependencyProject}
                          className={`
                            flex items-center justify-between gap-2 border-[2px] px-3 py-1.5 rounded-[2px] text-xs font-minecraft tracking-wide text-left cursor-pointer transition-all w-full select-none outline-none
                            ${dep.isInstalled
                              ? 'border-ore-green/40 bg-ore-green/5 text-ore-green hover:bg-ore-green/10'
                              : dep.type === 'optional'
                              ? 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                              : 'border-amber-500/40 bg-amber-500/5 text-amber-500 hover:bg-amber-500/10'
                            }
                            ${focused ? 'border-white z-10 scale-[1.02] shadow-[0_0_8px_rgba(255,255,255,0.15)] bg-white/10 text-white' : ''}
                          `}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            {dep.isInstalled ? (
                              <Check size={12} strokeWidth={3} className="shrink-0 text-ore-green" />
                            ) : dep.type === 'optional' ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
                            )}
                            <span className="truncate font-medium">{dep.name}</span>
                          </div>
                          <span className="text-[9px] opacity-60 uppercase shrink-0 font-mono">
                            {dep.isInstalled ? '已安装' : dep.type === 'optional' ? '可选' : '未安装'}
                          </span>
                        </button>
                      )}
                    </FocusItem>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-ore-text-muted">
                  无前置依赖
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
          </div>
        </FocusBoundary>
      </OreModal>

      <ModMetadataSettingsModal
        isOpen={showMetadataSettings}
        onClose={closeMetadataSettings}
        displayMod={displayMod}
        onSaveMetadataSettings={onSaveMetadataSettings}
        onReidentifyMod={onReidentifyMod}
        onSettingsUpdated={handleSettingsUpdated}
      />

      <ModDeleteConfirmModal
        isOpen={showDeleteConfirm}
        onClose={handleCloseDeleteConfirm}
        fileName={displayMod?.fileName}
        onConfirm={handleExecuteDelete}
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
