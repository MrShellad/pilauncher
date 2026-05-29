// src/features/InstanceDetail/components/tabs/mods/components/dialogs/components/ModHeader.tsx
import React from 'react';
import { Blocks, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useModIcon } from '../../../../../../logic/modIconService';
import { getModPreferredPlatform, type ModMeta } from '../../../../../../logic/modService';
import { PLATFORM_LABELS } from '../utils/modDetailUtils';

interface ModHeaderProps {
  mod: ModMeta;
  displayMod: ModMeta | null;
}

export const ModHeader: React.FC<ModHeaderProps> = ({ mod, displayMod }) => {
  const { t } = useTranslation();
  const activeIconMod = displayMod || mod;
  const iconSnapshot = useModIcon(activeIconMod, 'high');

  const preferredMetadataPlatform = displayMod ? getModPreferredPlatform(displayMod, 'metadata') : undefined;
  const sourceLabel = preferredMetadataPlatform
    ? PLATFORM_LABELS[preferredMetadataPlatform]
    : displayMod?.networkInfo?.source === 'curseforge'
      ? 'CurseForge'
      : displayMod?.networkInfo?.source === 'modrinth' || displayMod?.manifestEntry?.source.platform === 'modrinth'
      ? 'Modrinth'
      : displayMod?.manifestEntry?.source.platform || t('instanceDetail.mods.header.sourceLocal', { defaultValue: '本地' });

  const detailIconUrl = iconSnapshot.src || displayMod?.networkIconUrl || displayMod?.networkInfo?.icon_url || '';

  const sizeText = displayMod?.fileSize ? (displayMod.fileSize / 1024 / 1024).toFixed(2) + ' MB' : t('instanceDetail.mods.header.unknown', { defaultValue: '未知' });
  
  const statusText = mod.isFetchingNetwork 
    ? t('instanceDetail.mods.header.matching', { defaultValue: '匹配中...' }) 
    : (displayMod?.networkInfo 
      ? t('instanceDetail.mods.header.linked', { defaultValue: '已链接至 {{source}}', source: sourceLabel }) 
      : t('instanceDetail.mods.header.unmatched', { defaultValue: '未找到匹配项目' }));

  return (
    <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 shrink-0 font-minecraft">
      <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto sm:mx-0 flex-shrink-0 bg-[var(--ore-color-background-surface-deep)] border-[2px] border-[var(--ore-border-color)] flex items-center justify-center p-1 rounded-sm relative shadow-sm">
        {mod.isFetchingNetwork && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="animate-spin text-ore-green" />
          </div>
        )}

        {detailIconUrl ? (
          <img src={detailIconUrl} alt="icon" className="w-full h-full object-cover rounded-sm" />
        ) : (
          <Blocks size={36} className="text-gray-600" />
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center text-center sm:text-left">
        <h2 className="text-lg sm:text-xl font-minecraft text-white drop-shadow-sm flex flex-col sm:flex-row items-center sm:justify-start gap-2 sm:gap-3 truncate mb-1.5">
          <span className="truncate">{displayMod?.name || displayMod?.networkInfo?.title || displayMod?.fileName}</span>
          {!displayMod?.isEnabled && (
            <span className="flex-shrink-0 text-xs bg-[var(--ore-color-background-danger-subtle)] text-[var(--ore-color-text-danger-default)] px-1.5 py-0.5 rounded-[2px] border-[2px] border-[var(--ore-border-color)] tracking-wider">
              {t('instanceDetail.mods.header.disabled', { defaultValue: '已禁用' })}
            </span>
          )}
        </h2>
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 sm:gap-x-5 gap-y-1.5 text-xs sm:text-sm text-gray-400">
          <span className="truncate max-w-[12rem] sm:max-w-xs">{t('instanceDetail.mods.header.fileLabel', { defaultValue: '文件: {{fileName}}', fileName: displayMod?.fileName })}</span>
          <span>{t('instanceDetail.mods.header.sizeLabel', { defaultValue: '大小: {{size}}', size: sizeText })}</span>
          <span>{t('instanceDetail.mods.header.sourceLabel', { defaultValue: '来源: {{source}}', source: sourceLabel })}</span>
          <span>{t('instanceDetail.mods.header.statusLabel', { defaultValue: '状态: {{status}}', status: statusText })}</span>
        </div>
      </div>
    </div>
  );
};
