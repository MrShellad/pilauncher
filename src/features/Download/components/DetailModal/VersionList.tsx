import React from 'react';
import { CheckCircle2, Clock3, Download, Loader2 } from 'lucide-react';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';

import type { OreProjectVersion } from '../../../InstanceDetail/logic/modrinthApi';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { formatDate } from '../../../../utils/formatters';

interface VersionListProps {
  versions: OreProjectVersion[];
  isLoadingVersions: boolean;
  activeVersion: string;
  activeLoader: string;
  displayVersions: OreProjectVersion[];
  installedVersionIds: string[];
  onDownload: (version: OreProjectVersion) => void;
  visibleCount: number;
  observerTarget: React.RefObject<HTMLDivElement | null>;
}

export const VersionList: React.FC<VersionListProps> = ({
  versions,
  isLoadingVersions,
  activeVersion,
  activeLoader,
  displayVersions,
  installedVersionIds,
  onDownload,
  visibleCount,
  observerTarget
}) => {
  const handleVersionArrow = (idx: number) => (direction: string) => {
    if (direction === 'up' && idx === 0) return false;

    if ((direction === 'left' || direction === 'right') && doesFocusableExist('download-modal-mc-dropdown-0')) {
      setFocus('download-modal-mc-dropdown-0');
      return false;
    }

    return true;
  };

  return (
    <FocusBoundary id="download-modal-versions-list" className="flex min-h-full flex-col gap-2.5 p-3">
      {isLoadingVersions ? (
        <div className="flex flex-col items-center justify-center py-16 text-ore-green">
          <Loader2 className="mb-4 animate-spin" size={32} />
          <span className="font-minecraft text-sm text-[var(--ore-downloadDetail-labelText)]">正在与数据源通信...</span>
        </div>
      ) : versions.length === 0 ? (
        <div
          className="border-[2px] border-[var(--ore-downloadDetail-divider)] bg-[var(--ore-downloadDetail-surface)] px-6 py-10 text-center font-minecraft text-sm text-[var(--ore-downloadDetail-labelText)]"
          style={{ boxShadow: 'var(--ore-downloadDetail-sectionShadow)' }}
        >
          没有找到匹配 <span className="text-white">{activeVersion || '全部版本'}</span> +{' '}
          <span className="text-white">{activeLoader || '全部 Loader'}</span> 的可用文件。
        </div>
      ) : (
        <>
          {displayVersions.map((version, idx) => {
            const isInstalled = installedVersionIds.includes(version.id) || installedVersionIds.includes(version.version_number);

            return (
              <div
                key={version.id}
                className={`
                  group relative flex items-center justify-between gap-3 overflow-hidden border-[2px]
                  border-[var(--ore-downloadDetail-divider)] px-4 py-2.5 transition-none
                  ${isInstalled ? 'bg-[var(--ore-downloadDetail-installedBg)]' : 'bg-[var(--ore-downloadDetail-rowBg)]'}
                  focus-within:z-20 focus-within:outline focus-within:outline-2 focus-within:outline-offset-[3px] focus-within:outline-white
                `}
                style={{
                  boxShadow: isInstalled
                    ? 'var(--ore-downloadDetail-installedShadow)'
                    : 'var(--ore-downloadDetail-rowShadow)'
                }}
              >
                <div
                  className={`absolute inset-y-0 left-0 w-2 ${
                    isInstalled ? 'bg-[var(--ore-downloadDetail-installedAccent)]' : 'bg-[var(--ore-downloadDetail-idleAccent)]'
                  }`}
                />

                <div className="flex min-w-0 flex-1 flex-col pl-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-minecraft text-[15px] leading-5 text-black">{version.name}</span>
                    <span className="border-[2px] border-[var(--ore-downloadDetail-divider)] bg-[var(--ore-downloadDetail-base)] px-2 py-0.5 font-mono text-[10px] text-white">
                      {version.version_number}
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-minecraft uppercase tracking-[0.08em] text-[#313233]">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 size={11} />
                      {formatDate(version.date_published)}
                    </span>
                    <span className="text-[var(--ore-downloadDetail-loaderMeta)]">
                      {version.loaders.join(', ') || 'Universal'}
                    </span>
                    <span className="text-[var(--ore-downloadDetail-versionMeta)]">{version.game_versions.join(', ')}</span>
                  </div>
                </div>

                <div className="ml-2 flex-shrink-0">
                  {isInstalled ? (
                    <OreButton
                      focusKey={`download-modal-version-action-${idx}`}
                      onArrowPress={handleVersionArrow(idx)}
                      variant="secondary"
                      size="sm"
                      className="!h-8 min-w-[148px] text-[11px]"
                      onClick={() => {}}
                    >
                      <CheckCircle2 size={14} className="mr-1.5" />
                      已在实例中
                    </OreButton>
                  ) : (
                    <OreButton
                      focusKey={`download-modal-version-action-${idx}`}
                      onArrowPress={handleVersionArrow(idx)}
                      variant="primary"
                      size="sm"
                      className="!h-8 min-w-[148px] text-[11px] font-bold tracking-wide text-black"
                      onClick={() => onDownload(version)}
                    >
                      <Download size={14} className="mr-1.5" />
                      下载此版本
                    </OreButton>
                  )}
                </div>
              </div>
            );
          })}

          {visibleCount < versions.length && (
            <div ref={observerTarget} className="flex items-center justify-center py-5">
              <Loader2 className="animate-spin text-ore-green opacity-60" size={24} />
            </div>
          )}
        </>
      )}
    </FocusBoundary>
  );
};
