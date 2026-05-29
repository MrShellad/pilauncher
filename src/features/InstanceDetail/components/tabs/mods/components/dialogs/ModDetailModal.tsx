// /src/features/InstanceDetail/components/tabs/mods/components/dialogs/ModDetailModal.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Power, Settings2, Star, Trash2 } from 'lucide-react';
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
import { type OreProjectVersion } from '../../../../../logic/modrinthApi';

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
  openMetadataSettingsOnOpen?: boolean;
  onMetadataSettingsOpenHandled?: () => void;
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
  onMetadataSettingsOpenHandled
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
