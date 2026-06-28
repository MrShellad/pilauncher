// /src/features/InstanceDetail/components/tabs/mods/components/dialogs/ModDetailModal.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, Power, Settings2, Star, Trash2 } from 'lucide-react';
import {
  getCurrentFocusKey,
  doesFocusableExist,
  setFocus
} from '@noriginmedia/norigin-spatial-navigation';
import { useTranslation } from 'react-i18next';
import { OreModal } from '../../../../../../../ui/primitives/OreModal';
import { OreButton } from '../../../../../../../ui/primitives/OreButton';
import { FocusBoundary } from '../../../../../../../ui/focus/FocusBoundary';
import {
  getModPreferredPlatform,
  type ModMeta,
  type ModMetadataSettings,
  type ModPlatformId,
  type ModVersionInstallAction
} from '../../../../../logic/modService';
import { type OreProjectVersion, getProjectDetails } from '../../../../../logic/modrinthApi';
import { getCurseForgeProjectDetails } from '../../../../../../Download/logic/curseforgeApi';

import { useModMetadata } from './hooks/useModMetadata';
import { useModVersions } from './hooks/useModVersions';
import { ModHeader } from './components/ModHeader';
import { ModVersionHistory } from './components/ModVersionHistory';
import { ModMetadataSettingsModal } from './components/ModMetadataSettingsModal';
import { ModDeleteConfirmModal } from './components/ModDeleteConfirmModal';

interface ModDetailModalProps {
  mod: ModMeta | null;
  instanceConfig: any;
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
        title={displayMod?.name || displayMod?.networkInfo?.title || displayMod?.fileName}
        className="w-[95vw] max-w-4xl h-[85vh] sm:h-[75vh]"
        contentClassName="flex flex-col min-h-0 p-0"
        actionsClassName="!justify-center"
        actions={modalActions}
      >
        <FocusBoundary
          id="mod-detail-boundary"
          trapFocus
          onEscape={handleClose}
          className="flex flex-col min-h-0 h-full p-4 sm:p-6 gap-4 sm:gap-5"
        >
          {/* Header Info Block */}
          <ModHeader mod={mod} displayMod={displayMod} />

          {/* Dependencies Section */}
          <div className="flex flex-col gap-2 border-t border-white/5 pt-4 shrink-0 font-minecraft">
            <h3 className="font-minecraft text-white text-sm sm:text-base tracking-wide">
              {t('instanceDetail.mods.detail.dependencies', { defaultValue: '前置依赖' })}
            </h3>
            {isLoadingDeps ? (
              <div className="flex items-center gap-2 text-xs text-ore-text-muted">
                <Loader2 size={12} className="animate-spin text-ore-green" />
                <span>正在分析前置依赖...</span>
              </div>
            ) : dependencies.length > 0 ? (
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-1">
                {dependencies.map((dep) => (
                  <span
                    key={dep.id}
                    className={`flex items-center gap-1.5 border-[2px] px-2 py-0.5 rounded-[2px] text-xs font-minecraft tracking-wide transition-colors ${
                      dep.isInstalled
                        ? 'border-ore-green/40 bg-ore-green/10 text-ore-green'
                        : dep.type === 'optional'
                        ? 'border-gray-500/30 bg-gray-500/5 text-gray-400'
                        : 'border-amber-500/40 bg-amber-500/10 text-amber-500'
                    }`}
                    title={dep.type === 'optional' ? '可选依赖' : '必需依赖'}
                  >
                    {dep.isInstalled ? (
                      <Check size={11} strokeWidth={3} className="shrink-0" />
                    ) : dep.type === 'optional' ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
                    )}
                    <span>{dep.name}</span>
                    <span className="text-[10px] opacity-60 uppercase">
                      ({dep.isInstalled ? '已安装' : dep.type === 'optional' ? '可选' : '未安装'})
                    </span>
                  </span>
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
    </>
  );
};
