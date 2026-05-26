// /src/features/InstanceDetail/components/tabs/mods/components/dialogs/GlobalModMetadataModal.tsx
import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

import { OreModal } from '../../../../../../../ui/primitives/OreModal';
import { OreButton } from '../../../../../../../ui/primitives/OreButton';
import { FocusBoundary } from '../../../../../../../ui/focus/FocusBoundary';
import { OreToggleButton } from '../../../../../../../ui/primitives/OreToggleButton';
import { OreProgressBar } from '../../../../../../../ui/primitives/OreProgressBar';
import type { ModMetadataSettings, ModPlatformPreference } from '../../../../../logic/modService';

interface GlobalModMetadataModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings?: ModMetadataSettings;
  onSaveMetadataSettings: (settings: ModMetadataSettings) => Promise<void>;
  onReidentifyAllMods: (onProgress?: (current: number, total: number) => void) => Promise<void>;
}

export const GlobalModMetadataModal: React.FC<GlobalModMetadataModalProps> = ({
  isOpen,
  onClose,
  currentSettings,
  onSaveMetadataSettings,
  onReidentifyAllMods
}) => {
  const [metadataPlatformDraft, setMetadataPlatformDraft] = useState<ModPlatformPreference>('auto');
  const [updatePlatformDraft, setUpdatePlatformDraft] = useState<ModPlatformPreference>('auto');
  const [isSaving, setIsSaving] = useState(false);
  const [isReidentifying, setIsReidentifying] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  // Load current settings when opened
  useEffect(() => {
    if (isOpen) {
      setMetadataPlatformDraft(currentSettings?.metadataPlatform ?? 'auto');
      setUpdatePlatformDraft(currentSettings?.updatePlatform ?? 'auto');
      setIsSaving(false);
      setIsReidentifying(false);
      setProgress(null);
    }
  }, [isOpen, currentSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveMetadataSettings({
        metadataPlatform: metadataPlatformDraft,
        updatePlatform: updatePlatformDraft,
        metadataLocked: metadataPlatformDraft !== 'auto',
        updateLocked: updatePlatformDraft !== 'auto'
      });
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReidentifyAll = async () => {
    setIsReidentifying(true);
    setProgress({ current: 0, total: 1 });
    try {
      await onReidentifyAllMods((current, total) => {
        setProgress({ current, total });
      });
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsReidentifying(false);
      setProgress(null);
    }
  };

  const platformOptions = [
    { label: '自动', value: 'auto', description: '根据模组文件哈希自动匹配' },
    { label: 'Modrinth', value: 'modrinth', description: '仅从 Modrinth 平台获取' },
    { label: 'CurseForge', value: 'curseforge', description: '仅从 CurseForge 平台获取' }
  ];

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title="全局模组元数据设置"
      className="w-[95vw] max-w-xl"
      defaultFocusKey="global-metadata-platform-0"
      actions={
        <>
          <OreButton
            focusKey="global-metadata-save"
            variant="primary"
            onClick={handleSave}
            disabled={isReidentifying || isSaving}
          >
            {isSaving ? '保存中...' : '保存修改'}
          </OreButton>
          <OreButton
            focusKey="global-metadata-cancel"
            variant="secondary"
            onClick={onClose}
            disabled={isReidentifying || isSaving}
          >
            取消
          </OreButton>
        </>
      }
    >
      <FocusBoundary id="global-mod-metadata-boundary" trapFocus onEscape={onClose} className="space-y-5 bg-[#141415]">
        <div className="rounded-sm border border-[#2A2A2C] bg-[#1A1A1C] p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-minecraft font-bold text-white">全局元数据平台</h3>
          </div>
          <OreToggleButton
            options={platformOptions}
            value={metadataPlatformDraft}
            onChange={(val) => setMetadataPlatformDraft(val as ModPlatformPreference)}
            focusKeyPrefix="global-metadata-platform"
          />
        </div>

        <div className="rounded-sm border border-[#2A2A2C] bg-[#1A1A1C] p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-minecraft font-bold text-white">全局更新来源</h3>
          </div>
          <OreToggleButton
            options={platformOptions}
            value={updatePlatformDraft}
            onChange={(val) => setUpdatePlatformDraft(val as ModPlatformPreference)}
            focusKeyPrefix="global-update-platform"
          />
        </div>

        <div className="rounded-sm border border-ore-green/30 bg-ore-green/10 p-3 text-xs text-ore-green font-minecraft">
          提示：此设置将应用于当前实例中的所有模组。如果您选择特定平台，将锁定它们的元数据或更新来源。
        </div>

        {/* 危险操作 / 维护区域 */}
        <div className="rounded-sm border border-red-900/50 bg-red-950/20 p-4 space-y-3">
          <div>
            <h4 className="text-xs font-minecraft font-bold text-red-300">高级维护操作</h4>
            <p className="text-[11px] text-gray-300 mt-1 font-minecraft leading-relaxed">
              如果模组匹配信息出现偏差或无法获取更新，可清空并重新从云端检索匹配所有模组的数据。
            </p>
          </div>
          
          {isReidentifying ? (
            <OreProgressBar
              percent={progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}
              label={
                <span className="flex items-center gap-1.5 font-minecraft text-[11px] text-gray-300 normal-case tracking-normal">
                  <RefreshCw size={11} className="animate-spin text-ore-green" />
                  正在重新匹配模组云端数据... ({progress ? `${progress.current}/${progress.total}` : '0/0'})
                </span>
              }
              className="pt-1 !px-0"
            />
          ) : (
            <OreButton
              focusKey="global-metadata-reidentify"
              variant="danger"
              className="w-full justify-center"
              onClick={handleReidentifyAll}
              disabled={isSaving}
            >
              <RefreshCw size={14} className="mr-1.5" />
              重新识别所有模组数据
            </OreButton>
          )}
        </div>
      </FocusBoundary>
    </OreModal>
  );
};
