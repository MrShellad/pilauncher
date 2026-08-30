import React from 'react';
import { Blocks, ExternalLink, Loader2, Monitor, Server, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FocusItem } from '../../../../../../../../ui/focus/FocusItem';
import { OreButton } from '../../../../../../../../ui/primitives/OreButton';
import { useModIcon } from '../../../../../../logic/modIconService';
import { getModPreferredPlatform, type ModMeta } from '../../../../../../logic/modService';
import { openExternalLink } from '../../../../../../../../utils/openExternalLink';
import { CurseforgeIcon, ModrinthIcon } from '../../../../../../../Download/components/Icons';

interface ModHeaderProps {
  mod: ModMeta;
  displayMod: ModMeta | null;
  instanceId?: string;
  onClose?: () => void;
}

const renderEnvChip = (env: string | undefined, type: 'client' | 'server') => {
  if (!env || env === 'unsupported') return null;

  const Icon = type === 'client' ? Monitor : Server;
  const isRequired = env === 'required';
  const label = type === 'client' ? 'Client' : 'Server';

  return (
    <span
      className={`inline-flex items-center gap-1 border-[2px] px-1.5 py-0.5 font-minecraft text-[9px] font-bold uppercase tracking-wider ${
        isRequired
          ? 'border-[#1E1E1F] bg-[#3C8527] text-white shadow-[inset_0_-2px_0_#1D4D13]'
          : 'border-[#1E1E1F] bg-[#313233] text-[#D0D1D4] shadow-[inset_0_-2px_0_#1E1E1F]'
      }`}
    >
      <Icon size={10} />
      <span>{label}</span>
      <span>{isRequired ? '必需' : '可选'}</span>
    </span>
  );
};

export const ModHeader: React.FC<ModHeaderProps> = ({ mod, displayMod, instanceId, onClose }) => {
  const { t } = useTranslation();
  const activeIconMod = displayMod || mod;
  const iconSnapshot = useModIcon(activeIconMod, 'high', instanceId);

  const preferredMetadataPlatform = displayMod ? getModPreferredPlatform(displayMod, 'metadata') : undefined;
  const networkInfo = displayMod?.networkInfo;

  const sourcePlatform = preferredMetadataPlatform
    || (networkInfo?.source === 'curseforge' ? 'curseforge' : networkInfo?.source === 'modrinth' ? 'modrinth' : 'local');

  const detailIconUrl = iconSnapshot.src || '';

  const handleOpenWeb = () => {
    if (!networkInfo) return;
    const url = networkInfo.source === 'curseforge'
      ? `https://www.curseforge.com/projects/${networkInfo.id}`
      : `https://modrinth.com/project/${networkInfo.slug || networkInfo.id}`;
    openExternalLink(url);
  };

  const author = networkInfo?.author || t('download.meta.unknownAuthor', { defaultValue: '未知作者' });
  const displayName = displayMod?.name || networkInfo?.title || displayMod?.fileName || mod.fileName;

  return (
    <div
      className="flex shrink-0 items-center justify-between gap-4 border-b-[2px] border-[#1E1E1F] bg-[#48494A] px-5 py-3 font-minecraft select-none"
      style={{ boxShadow: 'inset 0 2px 0 rgba(255, 255, 255, 0.12)' }}
    >
      {/* 左侧：56px 大图标 + 模组名称与平台/作者 */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {/* 56px 大图标 */}
        <div
          className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border-[2px] border-[#1E1E1F] bg-[#313233]"
          style={{ boxShadow: 'inset 0 -2px 0 rgba(0, 0, 0, 0.4), inset 2px 2px 0 rgba(255, 255, 255, 0.12)' }}
        >
          {mod.isFetchingNetwork && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
              <Loader2 className="animate-spin text-[#6CC349]" size={18} />
            </div>
          )}
          {detailIconUrl ? (
            <img src={detailIconUrl} alt="" className="h-full w-full object-cover pixelated" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#2B2C2D]">
              <Blocks size={26} className="text-[#8C8D90]" />
            </div>
          )}
        </div>

        {/* 标题 + 附属信息 */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate font-minecraft text-base sm:text-lg font-bold text-white ore-text-shadow">
              {displayName}
            </h2>
            {!displayMod?.isEnabled && (
              <span className="shrink-0 border-[2px] border-[#1E1E1F] bg-[#C33636] px-1.5 py-0.5 text-[10px] font-bold uppercase text-white shadow-[inset_0_-2px_0_#AD1D1D]">
                已禁用
              </span>
            )}
            {networkInfo && (
              <span className="text-[11px] text-[#B1B2B5]">
                by <span className="text-white font-bold">{author}</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            {/* 来源平台芯片 */}
            {sourcePlatform === 'modrinth' ? (
              <span className="inline-flex items-center gap-1 border-[2px] border-[#1E1E1F] bg-[#313233] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#1BD96A] shadow-[inset_0_-2px_0_#1E1E1F]">
                <ModrinthIcon className="h-3 w-3 text-[#1BD96A]" />
                <span>Modrinth</span>
              </span>
            ) : sourcePlatform === 'curseforge' ? (
              <span className="inline-flex items-center gap-1 border-[2px] border-[#1E1E1F] bg-[#313233] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#F16436] shadow-[inset_0_-2px_0_#1E1E1F]">
                <CurseforgeIcon className="h-3 w-3 text-[#F16436]" />
                <span>CurseForge</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 border-[2px] border-[#1E1E1F] bg-[#313233] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#D0D1D4] shadow-[inset_0_-2px_0_#1E1E1F]">
                <span>本地文件</span>
              </span>
            )}

            {/* 环境芯片 */}
            {networkInfo && (
              <>
                {renderEnvChip(networkInfo.client_side, 'client')}
                {renderEnvChip(networkInfo.server_side, 'server')}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 右侧：浏览器查看链接 + 关闭 X 按钮 */}
      <div className="flex shrink-0 items-center gap-2">
        {networkInfo && (
          <FocusItem focusKey="mod-header-open-web" onEnter={handleOpenWeb}>
            {({ ref }) => (
              <div ref={ref as any}>
                <OreButton
                  variant="secondary"
                  size="sm"
                  onClick={handleOpenWeb}
                  className="!h-8 text-xs font-bold"
                >
                  <ExternalLink size={13} className="mr-1.5 text-[#3C8527]" />
                  <span>浏览器</span>
                </OreButton>
              </div>
            )}
          </FocusItem>
        )}

        {onClose && (
          <FocusItem focusKey="mod-header-close-btn" onEnter={onClose}>
            {({ ref, focused }) => (
              <button
                ref={ref}
                type="button"
                onClick={onClose}
                aria-label="关闭模态框"
                className={`flex h-8 w-8 items-center justify-center border-[2px] border-[#1E1E1F] bg-[#313233] text-[#D0D1D4] shadow-[inset_0_-2px_0_#1E1E1F] transition-none outline-none cursor-pointer hover:bg-[#58595B] hover:text-white active:translate-y-[1px] ${
                  focused ? 'outline outline-2 outline-white outline-offset-1 z-10' : ''
                }`}
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            )}
          </FocusItem>
        )}
      </div>
    </div>
  );
};

export default ModHeader;