// src/features/InstanceDetail/components/tabs/mods/components/dialogs/components/ModHeader.tsx
import React from 'react';
import { motion } from 'motion/react';
import { Blocks, Clock3, Download, ExternalLink, Heart, Loader2, Monitor, Server } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FocusItem } from '../../../../../../../../ui/focus/FocusItem';

import { useModIcon } from '../../../../../../logic/modIconService';
import { getModPreferredPlatform, type ModMeta } from '../../../../../../logic/modService';
import { PLATFORM_LABELS } from '../utils/modDetailUtils';
import { formatDate, formatNumber } from '../../../../../../../../utils/formatters';
import { openExternalLink } from '../../../../../../../../utils/openExternalLink';
import { CurseforgeIcon, ModrinthIcon } from '../../../../../../../Download/components/Icons';

interface ModHeaderProps {
  mod: ModMeta;
  displayMod: ModMeta | null;
}

const renderEnvChip = (
  env: string | undefined,
  type: 'client' | 'server',
  t: ReturnType<typeof useTranslation>['t']
) => {
  if (!env || env === 'unsupported') return null;

  const Icon = type === 'client' ? Monitor : Server;
  const isRequired = env === 'required';
  const label = type === 'client'
    ? t('download.env.client', { defaultValue: 'Client' })
    : t('download.env.server', { defaultValue: 'Server' });

  return (
    <span
      className={`
        inline-flex items-center gap-1 border-[2px] border-[var(--ore-downloadDetail-divider)] px-1.5 py-0.5
        text-[9px] font-minecraft uppercase tracking-[0.14em]
        ${isRequired
          ? 'bg-[#6CC349] text-black shadow-[inset_0_-2px_0_#3C8527]'
          : 'bg-[var(--ore-downloadDetail-rowBg)] text-[var(--ore-downloadDetail-rowText)] shadow-[var(--ore-downloadDetail-chipShadow)]'}
      `}
    >
      <Icon size={10} />
      {label}
      {isRequired
        ? t('download.env.required', { defaultValue: 'Required' })
        : t('download.env.optional', { defaultValue: 'Optional' })}
    </span>
  );
};

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

  const handleOpenWeb = () => {
    if (!displayMod?.networkInfo) return;
    const url = displayMod.networkInfo.source === 'curseforge'
      ? `https://www.curseforge.com/projects/${displayMod.networkInfo.id}`
      : `https://modrinth.com/project/${displayMod.networkInfo.slug || displayMod.networkInfo.id}`;
    openExternalLink(url);
  };

  const author = displayMod?.networkInfo?.author || t('download.meta.unknownAuthor', { defaultValue: 'Unknown' });
  const networkInfo = displayMod?.networkInfo;

  return (
    <div
      className="flex flex-shrink-0 gap-3 border-b-[2px] border-[var(--ore-downloadDetail-divider)] bg-[var(--ore-downloadDetail-surface)] px-4 py-2.5"
      style={{ boxShadow: 'var(--ore-downloadDetail-headerShadow)' }}
    >
      <motion.div
        layoutId={`mod-icon-container-${mod.fileName}`}
        className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border-[2px] border-[var(--ore-downloadDetail-divider)] bg-[var(--ore-downloadDetail-base)] relative"
        style={{ boxShadow: 'var(--ore-downloadDetail-sectionShadow)' }}
      >
        {mod.isFetchingNetwork && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <Loader2 className="animate-spin text-ore-green" size={16} />
          </div>
        )}
        {detailIconUrl ? (
          <motion.img
            layoutId={`mod-icon-image-${mod.fileName}`}
            src={detailIconUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <motion.div
            layoutId={`mod-icon-placeholder-${mod.fileName}`}
            className="flex h-full w-full items-center justify-center"
          >
            <Blocks size={28} className="text-white/75" />
          </motion.div>
        )}
      </motion.div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h2 className="min-w-0 truncate font-minecraft text-lg text-white xl:text-xl flex items-center gap-2">
            <span className="truncate">{displayMod?.name || displayMod?.networkInfo?.title || displayMod?.fileName}</span>
            {!displayMod?.isEnabled && (
              <span className="flex-shrink-0 text-[10px] bg-[var(--ore-color-background-danger-subtle)] text-[var(--ore-color-text-danger-default)] px-1.5 py-0.5 border-[2px] border-[var(--ore-border-color)] tracking-wider font-minecraft uppercase">
                {t('instanceDetail.mods.header.disabled', { defaultValue: '已禁用' })}
              </span>
            )}
          </h2>
          {networkInfo && (
            <span className="font-minecraft text-[10px] uppercase tracking-[0.14em] text-[var(--ore-downloadDetail-labelText)]">
              {t('download.meta.byAuthor', { defaultValue: 'by {{author}}', author })}
            </span>
          )}
          <div className="ml-1 flex flex-wrap items-center gap-1.5">
            {renderEnvChip(networkInfo?.client_side, 'client', t)}
            {renderEnvChip(networkInfo?.server_side, 'server', t)}
          </div>
        </div>

        {networkInfo ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-minecraft uppercase tracking-[0.12em] text-[var(--ore-downloadDetail-hintText)]">
            <span className="inline-flex items-center gap-1 text-[#6CC349]">
              <Download size={12} />
              {formatNumber(networkInfo.downloads)}
            </span>
            <span className="inline-flex items-center gap-1 text-[#F46D6D]">
              <Heart size={12} />
              {formatNumber(networkInfo.follows || 0)}
            </span>
            <span className="inline-flex items-center gap-1 text-[#8CB3FF]">
              <Clock3 size={12} />
              {formatDate(networkInfo.date_modified)}
            </span>
            <span className="text-[var(--ore-downloadDetail-hintText)] opacity-60">
              • {sizeText} • {displayMod.fileName}
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-minecraft uppercase tracking-[0.12em] text-[var(--ore-downloadDetail-hintText)]">
            <span className="text-[var(--ore-downloadDetail-hintText)]">
              {sizeText}
            </span>
            <span>•</span>
            <span className="truncate max-w-[12rem] sm:max-w-xs text-gray-400" title={displayMod?.fileName}>
              {displayMod?.fileName}
            </span>
            <span>•</span>
            <span className="text-gray-400">{statusText}</span>
          </div>
        )}
      </div>

      {networkInfo && (
        <div className="flex shrink-0 flex-col items-end justify-center ml-2">
          <FocusItem focusKey="mod-modal-header-open-web">
            {({ ref, focused }: { ref: any; focused: boolean }) => (
              <button
                ref={ref}
                onClick={handleOpenWeb}
                className={`flex h-8 items-center gap-1.5 border-[2px] bg-[var(--ore-downloadDetail-base)] px-2.5 shadow-[inset_0_-2px_0_rgba(0,0,0,0.2)] transition-colors hover:bg-[var(--ore-downloadDetail-rowBg)] active:translate-y-[1px] active:shadow-none ${
                  focused ? 'border-white shadow-[0_0_1rem_rgba(255,255,255,0.2)]' : 'border-[var(--ore-downloadDetail-divider)]'
                }`}
                title={t('download.openInBrowser', { defaultValue: 'Open in Browser' })}
              >
                {networkInfo.source === 'curseforge' ? (
                  <>
                    <CurseforgeIcon className="text-[14px] text-[#F16436]" />
                    <span className="font-minecraft text-[10px] uppercase tracking-[0.1em] text-white">CurseForge</span>
                  </>
                ) : (
                  <>
                    <ModrinthIcon className="text-[14px] text-[#1BD96A]" />
                    <span className="font-minecraft text-[10px] uppercase tracking-[0.1em] text-white">Modrinth</span>
                  </>
                )}
                <ExternalLink size={12} className="ml-0.5 text-[var(--ore-downloadDetail-hintText)]" />
              </button>
            )}
          </FocusItem>
        </div>
      )}
    </div>
  );
};
