// src/features/InstanceDetail/components/tabs/mods/components/dialogs/components/ModMetadataSettingsModal.tsx
import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useTranslation } from 'react-i18next';

import { OreModal } from '../../../../../../../../ui/primitives/OreModal';
import { OreButton } from '../../../../../../../../ui/primitives/OreButton';
import { FocusBoundary } from '../../../../../../../../ui/focus/FocusBoundary';
import { OreToggleButton } from '../../../../../../../../ui/primitives/OreToggleButton';
import {
  type ModMeta,
  type ModMetadataSettings,
  type ModPlatformPreference
} from '../../../../../../logic/modService';
import { PLATFORM_TABS, normalizePreference } from '../utils/modDetailUtils';

interface ModMetadataSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  displayMod: ModMeta | null;
  onSaveMetadataSettings: (mod: ModMeta, settings: ModMetadataSettings) => Promise<ModMeta>;
  onReidentifyMod: (mod: ModMeta) => Promise<ModMeta>;
  onSettingsUpdated: (updatedMod: ModMeta) => void;
}

export const ModMetadataSettingsModal: React.FC<ModMetadataSettingsModalProps> = ({
  isOpen,
  onClose,
  displayMod,
  onSaveMetadataSettings,
  onReidentifyMod,
  onSettingsUpdated
}) => {
  const { t } = useTranslation();
  const [metadataPlatformDraft, setMetadataPlatformDraft] = useState<ModPlatformPreference>('auto');
  const [isSaving, setIsSaving] = useState(false);
  const [isReidentifying, setIsReidentifying] = useState(false);

  // Initialize drafts when modal is opened
  useEffect(() => {
    if (isOpen && displayMod) {
      const settings = displayMod.manifestEntry?.metadataSettings;
      setMetadataPlatformDraft(normalizePreference(settings?.metadataPlatform));
      setTimeout(() => setFocus('metadata-platform-0'), 100);
    }
  }, [isOpen, displayMod]);

  if (!displayMod) return null;

  const handleSave = async () => {
    const previousSettings = displayMod.manifestEntry?.metadataSettings;
    const settings: ModMetadataSettings = {
      ...(previousSettings || {}),
      metadataPlatform: metadataPlatformDraft,
      updatePlatform: 'auto',
      metadataLocked: metadataPlatformDraft === 'auto' ? false : !!previousSettings?.metadataLocked,
      updateLocked: false
    };

    setIsSaving(true);
    try {
      const updated = await onSaveMetadataSettings(displayMod, settings);
      onSettingsUpdated(updated);
    } catch (error) {
      console.error('保存 MOD 元数据设置失败:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReidentify = async () => {
    setIsReidentifying(true);
    try {
      const updated = await onReidentifyMod(displayMod);
      onSettingsUpdated(updated);
    } catch (error) {
      console.error('重新识别 MOD 失败:', error);
    } finally {
      setIsReidentifying(false);
    }
  };

  const toggleOptions = PLATFORM_TABS.map((tab) => ({
    label: tab.id === 'auto' ? t('instanceDetail.mods.metadataSettings.auto', { defaultValue: '自动' }) : tab.label,
    value: tab.id
  }));

  const actions = (
    <>
      <OreButton
        focusKey="metadata-reidentify"
        variant="secondary"
        size="auto"
        onClick={handleReidentify}
        disabled={isReidentifying || isSaving}
      >
        <RefreshCw size={14} className={`mr-1.5 ${isReidentifying ? 'animate-spin' : ''}`} />
        {t('instanceDetail.mods.metadataSettings.reidentify', { defaultValue: '重新识别' })}
      </OreButton>
      <OreButton
        focusKey="metadata-save"
        variant="primary"
        size="auto"
        onClick={handleSave}
        disabled={isReidentifying || isSaving}
      >
        {isSaving ? t('instanceDetail.mods.metadataSettings.saving', { defaultValue: '保存中...' }) : t('instanceDetail.mods.metadataSettings.save', { defaultValue: '保存' })}
      </OreButton>
      <OreButton
        focusKey="metadata-cancel"
        variant="secondary"
        size="auto"
        onClick={onClose}
        disabled={isReidentifying || isSaving}
      >
        {t('instanceDetail.mods.metadataSettings.cancel', { defaultValue: '取消' })}
      </OreButton>
    </>
  );

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('instanceDetail.mods.metadataSettings.title', { defaultValue: 'MOD 元数据' })}
      className="w-[95vw] max-w-xl"
      actionsClassName="!justify-center"
      defaultFocusKey="metadata-platform-0"
      actions={actions}
    >
      <FocusBoundary
        id="mod-metadata-settings-boundary"
        trapFocus
        onEscape={onClose}
        className="space-y-4 bg-transparent font-minecraft"
      >
        {/* Linked project summary info */}
        <div className="rounded-sm border-[2px] border-[var(--ore-border-color)] bg-[var(--ore-color-background-surface-panel)] p-3 flex flex-col gap-1.5 text-xs">
          <div className="flex items-center justify-between text-white">
            <span className="font-bold truncate">{displayMod.name || displayMod.fileName}</span>
            <span className="text-[10px] text-gray-400 font-mono">{displayMod.fileName}</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
            {displayMod.manifestEntry?.matchedPlatforms?.modrinth?.projectId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-[#1E1E1F] bg-[#113824] text-[#1BD96A] rounded-sm">
                Modrinth: {displayMod.manifestEntry.matchedPlatforms.modrinth.projectId}
              </span>
            )}
            {displayMod.manifestEntry?.matchedPlatforms?.curseforge?.projectId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-[#1E1E1F] bg-[#3B1F14] text-[#F16436] rounded-sm">
                CurseForge: {displayMod.manifestEntry.matchedPlatforms.curseforge.projectId}
              </span>
            )}
            {!displayMod.manifestEntry?.matchedPlatforms?.modrinth?.projectId && !displayMod.manifestEntry?.matchedPlatforms?.curseforge?.projectId && (
              <span className="text-gray-400">
                {t('instanceDetail.mods.metadataSettings.notLinked', { defaultValue: '尚未链接至云端平台，点击“重新识别”可自动从 Modrinth / CurseForge 获取元数据与依赖' })}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-sm border-[2px] border-[var(--ore-border-color)] bg-[var(--ore-color-background-surface-panel)] p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm text-white font-bold">{t('instanceDetail.mods.metadataSettings.platform', { defaultValue: '元数据平台偏好' })}</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">{t('instanceDetail.mods.metadataSettings.platformDesc', { defaultValue: '选择模组名称、图标、简介与依赖解析优先使用的云端平台' })}</p>
            </div>
            {displayMod.manifestEntry?.metadataSettings?.metadataLocked && (
              <span className="rounded-sm border-[2px] border-[var(--ore-border-color)] bg-[#7AA2FF]/10 px-2 py-1 text-xs text-[#AFC4FF] shrink-0">
                {t('instanceDetail.mods.metadataSettings.locked', { defaultValue: '已锁定' })}
              </span>
            )}
          </div>
          <div className="pt-2">
            <OreToggleButton
              options={toggleOptions}
              value={metadataPlatformDraft}
              onChange={(id) => setMetadataPlatformDraft(id as ModPlatformPreference)}
              focusKeyPrefix="metadata-platform"
              size="sm"
            />
          </div>
        </div>

        <div className="rounded-sm border border-ore-green/30 bg-ore-green/10 px-3 py-2 text-[11px] text-ore-green leading-relaxed">
          {t('instanceDetail.mods.metadataSettings.autoUpdateSource', { defaultValue: '更新检查始终使用自动模式：同时查询所有已识别平台，并选择最新的兼容版本。' })}
        </div>
      </FocusBoundary>
    </OreModal>
  );
};
