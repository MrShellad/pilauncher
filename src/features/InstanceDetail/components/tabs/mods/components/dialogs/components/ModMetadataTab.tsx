import React, { useState } from 'react';
import { Check, ExternalLink, Globe, Link2, RefreshCw, Save, Tag } from 'lucide-react';
import { OreButton } from '../../../../../../../../ui/primitives/OreButton';
import { OreOverlayScrollArea } from '../../../../../../../../ui/primitives/OreOverlayScrollArea';
import { OreSegmentedControl } from '../../../../../../../../ui/primitives/OreSegmentedControl';
import { ModrinthIcon, CurseforgeIcon } from '../../../../../../../Download/components/Icons';
import {
  getModPlatformReference,
  type ModMeta,
  type ModMetadataSettings,
  type ModPlatformPreference
} from '../../../../../../logic/modService';
import { openExternalLink } from '../../../../../../../../utils/openExternalLink';
import { normalizePreference } from '../utils/modDetailUtils';

interface ModMetadataTabProps {
  mod: ModMeta;
  displayMod: ModMeta | null;
  onSaveMetadataSettings: (mod: ModMeta, settings: ModMetadataSettings) => Promise<ModMeta>;
  onReidentifyMod: (mod: ModMeta) => Promise<ModMeta>;
  onSettingsUpdated: (updatedMod: ModMeta) => void;
}

export const ModMetadataTab: React.FC<ModMetadataTabProps> = ({
  mod,
  displayMod,
  onSaveMetadataSettings,
  onReidentifyMod,
  onSettingsUpdated
}) => {
  const targetMod = displayMod || mod;

  const currentPlatformPref = normalizePreference(targetMod.manifestEntry?.metadataSettings?.metadataPlatform);
  const [platformDraft, setPlatformDraft] = useState<ModPlatformPreference>(currentPlatformPref);
  const [isSaving, setIsSaving] = useState(false);
  const [isReidentifying, setIsReidentifying] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const modrinthRef = getModPlatformReference(targetMod, 'modrinth');
  const curseforgeRef = getModPlatformReference(targetMod, 'curseforge');

  const handleSave = async () => {
    const previousSettings = targetMod.manifestEntry?.metadataSettings;
    const settings: ModMetadataSettings = {
      ...(previousSettings || {}),
      metadataPlatform: platformDraft,
      updatePlatform: 'auto',
      metadataLocked: platformDraft === 'auto' ? false : true,
      updateLocked: false
    };

    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const updated = await onSaveMetadataSettings(targetMod, settings);
      onSettingsUpdated(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('保存 MOD 元数据设置失败:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReidentify = async () => {
    setIsReidentifying(true);
    try {
      const updated = await onReidentifyMod(targetMod);
      onSettingsUpdated(updated);
    } catch (error) {
      console.error('重新识别 MOD 失败:', error);
    } finally {
      setIsReidentifying(false);
    }
  };

  const platformOptions = [
    { id: 'auto', label: '自动探测 (Auto)' },
    { id: 'modrinth', label: '优先 Modrinth' },
    { id: 'curseforge', label: '优先 CurseForge' }
  ];

  return (
    <OreOverlayScrollArea
      className="h-full w-full bg-[var(--ore-modal-bg)]"
      viewportClassName="p-4 sm:p-5 flex flex-col gap-4 font-minecraft shadow-[inset_0_10px_20px_-10px_rgba(0,0,0,0.55)]"
      contentSafePaddingRight={6}
    >
      {/* 1. 首选元数据提供源设置 */}
      <div
        className="flex flex-col border-[2px] border-[#1E1E1F] bg-[#222324] p-4"
        style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.4)' }}
      >
        <div className="flex items-center gap-2 border-b-[2px] border-[#1E1E1F] pb-2 text-xs font-bold uppercase tracking-wider text-white ore-text-shadow">
          <Globe size={14} className="text-[#6CC349]" />
          <span>首选云端数据平台</span>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <span className="text-xs text-[#D0D1D4]">
            选择向该模组提供图标、简介、依赖图谱及版本更新检测的首选平台源：
          </span>
          <div className="mt-1">
            <OreSegmentedControl
              tabs={platformOptions}
              activeTab={platformDraft}
              onChange={(val) => setPlatformDraft(val as ModPlatformPreference)}
              className="w-full sm:w-auto"
              style={{
                '--seg-height': '2.25rem',
                '--seg-min-width': '0px',
                '--seg-px': '1rem',
                '--seg-font-size': '0.8125rem'
              } as any}
            />
          </div>
        </div>
      </div>

      {/* 2. 平台绑定与云端映射状态 */}
      <div
        className="flex flex-col border-[2px] border-[#1E1E1F] bg-[#222324] p-4"
        style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.4)' }}
      >
        <div className="flex items-center gap-2 border-b-[2px] border-[#1E1E1F] pb-2 text-xs font-bold uppercase tracking-wider text-white ore-text-shadow">
          <Link2 size={14} className="text-[#8CB3FF]" />
          <span>云端平台映射与标识符</span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Modrinth 平台卡片 */}
          <div className="flex flex-col justify-between border-[2px] border-[#1E1E1F] bg-[#48494A] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-2px_0_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center border-[2px] border-[#1E1E1F] bg-[#1D4D13] text-[#6CC349]">
                  <ModrinthIcon className="h-3.5 w-3.5 text-[#1BD96A]" />
                </div>
                <span className="text-xs font-bold text-white ore-text-shadow">Modrinth</span>
              </div>
              <span
                className={`border-[2px] border-[#1E1E1F] px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                  modrinthRef?.projectId ? 'bg-[#1D4D13] text-[#6CC349]' : 'bg-[#313233] text-[#B1B2B5]'
                }`}
              >
                {modrinthRef?.projectId ? '已关联' : '未关联'}
              </span>
            </div>

            <div className="mt-3 flex flex-col gap-1 text-xs">
              <div className="flex items-center justify-between text-[#D0D1D4]">
                <span>项目 ID:</span>
                <span className="font-mono font-bold text-white select-text">
                  {modrinthRef?.projectId || '-'}
                </span>
              </div>
              {modrinthRef?.projectId && (
                <button
                  type="button"
                  onClick={() => openExternalLink(`https://modrinth.com/mod/${modrinthRef.projectId}`)}
                  className="mt-2 flex items-center justify-center gap-1.5 border-[2px] border-[#1E1E1F] bg-[#313233] py-1 text-xs font-bold text-[#8CB3FF] hover:bg-[#58595B] hover:text-white transition-none shadow-[inset_0_-2px_0_#1E1E1F]"
                >
                  <ExternalLink size={12} />
                  <span>在 Modrinth 中查看</span>
                </button>
              )}
            </div>
          </div>

          {/* CurseForge 平台卡片 */}
          <div className="flex flex-col justify-between border-[2px] border-[#1E1E1F] bg-[#48494A] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-2px_0_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center border-[2px] border-[#1E1E1F] bg-[#5E1E1E] text-white">
                  <CurseforgeIcon className="h-3.5 w-3.5 text-[#F16436]" />
                </div>
                <span className="text-xs font-bold text-white ore-text-shadow">CurseForge</span>
              </div>
              <span
                className={`border-[2px] border-[#1E1E1F] px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                  curseforgeRef?.projectId ? 'bg-[#1D4D13] text-[#6CC349]' : 'bg-[#313233] text-[#B1B2B5]'
                }`}
              >
                {curseforgeRef?.projectId ? '已关联' : '未关联'}
              </span>
            </div>

            <div className="mt-3 flex flex-col gap-1 text-xs">
              <div className="flex items-center justify-between text-[#D0D1D4]">
                <span>项目 ID:</span>
                <span className="font-mono font-bold text-white select-text">
                  {curseforgeRef?.projectId || '-'}
                </span>
              </div>
              {curseforgeRef?.projectId && (
                <button
                  type="button"
                  onClick={() => openExternalLink(`https://www.curseforge.com/minecraft/mc-mods/${curseforgeRef.projectId}`)}
                  className="mt-2 flex items-center justify-center gap-1.5 border-[2px] border-[#1E1E1F] bg-[#313233] py-1 text-xs font-bold text-[#FFB84D] hover:bg-[#58595B] hover:text-white transition-none shadow-[inset_0_-2px_0_#1E1E1F]"
                >
                  <ExternalLink size={12} />
                  <span>在 CurseForge 中查看</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. 模组本地标识与别名 */}
      {targetMod.aliases && targetMod.aliases.length > 0 && (
        <div
          className="flex flex-col border-[2px] border-[#1E1E1F] bg-[#222324] p-4"
          style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.4)' }}
        >
          <div className="flex items-center gap-2 border-b-[2px] border-[#1E1E1F] pb-2 text-xs font-bold uppercase tracking-wider text-white ore-text-shadow">
            <Tag size={14} className="text-[#FFB84D]" />
            <span>已知别名与别名集 (Aliases)</span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {targetMod.aliases.map((alias) => (
              <span
                key={alias}
                className="border-[2px] border-[#1E1E1F] bg-[#48494A] px-2.5 py-1 font-mono text-xs font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-2px_0_rgba(0,0,0,0.3)]"
              >
                {alias}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 4. 底栏操作按钮 */}
      <div
        className="flex items-center justify-between border-[2px] border-[#1E1E1F] bg-[#222324] p-3.5"
        style={{ boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.4)' }}
      >
        <OreButton
          focusKey="metadata-reidentify-btn"
          variant="secondary"
          size="sm"
          onClick={handleReidentify}
          disabled={isReidentifying || isSaving}
        >
          <RefreshCw size={14} className={`mr-1.5 ${isReidentifying ? 'animate-spin' : ''}`} />
          {isReidentifying ? '正在重新识别...' : '重新识别该模组'}
        </OreButton>

        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="flex items-center gap-1 text-xs font-bold text-[#6CC349]">
              <Check size={14} strokeWidth={3} />
              <span>设置已保存</span>
            </span>
          )}
          <OreButton
            focusKey="metadata-save-btn"
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={isReidentifying || isSaving}
          >
            <Save size={14} className="mr-1.5" />
            {isSaving ? '保存中...' : '保存元数据设置'}
          </OreButton>
        </div>
      </div>
    </OreOverlayScrollArea>
  );
};

export default ModMetadataTab;