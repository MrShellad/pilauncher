// /src/features/Download/components/DetailModal/VersionList.tsx
import React from 'react';
import { Loader2, Clock, CheckCircle2, Download } from 'lucide-react';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { formatDate } from '../../../../utils/formatters';
import type { OreProjectVersion } from '../../../InstanceDetail/logic/modrinthApi';

interface VersionListProps {
  versions: OreProjectVersion[];
  isLoadingVersions: boolean;
  activeVersion: string;
  activeLoader: string;
  displayVersions: OreProjectVersion[];
  installedVersionIds: string[];
  // ✅ 核心修改：改为传递整个版本对象
  onDownload: (version: OreProjectVersion) => void; 
  visibleCount: number;
  // ✅ 修复类型报错：允许其内部类型为 null，以完美匹配 useRef<HTMLDivElement>(null)
  observerTarget: React.RefObject<HTMLDivElement | null>;
}

export const VersionList: React.FC<VersionListProps> = ({
  versions, isLoadingVersions, activeVersion, activeLoader,
  displayVersions, installedVersionIds, onDownload, visibleCount, observerTarget
}) => {
  return (
    <FocusBoundary id="download-modal-versions-list" className="p-4 space-y-2 flex flex-col min-h-full">
      {isLoadingVersions ? (
        <div className="flex flex-col justify-center items-center py-16 text-ore-green">
          <Loader2 className="animate-spin mb-4" size={32} />
          <span className="font-minecraft text-sm text-gray-400">正在与数据源通信...</span>
        </div>
      ) : versions.length === 0 ? (
        <div className="text-center py-16 text-gray-500 font-minecraft">
          没有找到匹配 <span className="text-white">{activeVersion}</span> + <span className="text-white">{activeLoader}</span> 的可用文件。
        </div>
      ) : (
        <>
          {displayVersions.map((v: OreProjectVersion) => {
            const isInstalled = installedVersionIds.includes(v.id) || installedVersionIds.includes(v.version_number);

            return (
              <div
                key={v.id}
                className={`
                  group flex items-center justify-between p-3 border transition-all outline-none relative overflow-hidden rounded-sm z-10
                  ${isInstalled ? 'border-ore-green/30 bg-ore-green/5' : 'border-white/5 bg-black/40 hover:border-white/20 hover:bg-black/60'}
                  focus-within:border-white focus-within:scale-[1.01] focus-within:brightness-110 focus-within:shadow-lg focus-within:z-20
                `}
              >
                <div className="flex flex-col min-w-0 flex-1 pr-4">
                  <div className="flex items-center mb-1">
                    <span className={`font-minecraft font-bold truncate text-sm ${isInstalled ? 'text-ore-green' : 'text-white'}`}>{v.name}</span>
                    <span className="ml-3 text-[10px] text-gray-500 font-mono bg-white/5 px-1.5 py-0.5 rounded">{v.version_number}</span>
                  </div>
                  
                  <div className="text-[11px] text-gray-400 flex flex-wrap gap-2 items-center">
                    <span className="text-blue-300 flex items-center"><Clock size={10} className="mr-1" /> {formatDate(v.date_published)}</span>
                    <span className="opacity-50">|</span>
                    <span className="text-orange-300">{v.loaders.map((l:string) => l.charAt(0).toUpperCase() + l.slice(1)).join(', ')}</span>
                    <span className="opacity-50">|</span>
                    <span className="text-green-300 truncate max-w-[250px]">{v.game_versions.join(', ')}</span>
                  </div>
                </div>

                <div className="flex-shrink-0 ml-4">
                  {isInstalled ? (
                    <OreButton variant="secondary" size="sm" className="!h-8 !text-ore-green border-ore-green/30 bg-ore-green/10" onClick={() => {}}>
                      <CheckCircle2 size={14} className="mr-1.5"/> 已在实例中
                    </OreButton>
                  ) : (
                    <OreButton 
                      variant="primary" 
                      size="sm" 
                      className="!h-8 text-xs text-black font-bold tracking-wide" 
                      // ✅ 核心修改：点击时传出整个 v 对象
                      onClick={() => onDownload(v)}
                    >
                      <Download size={14} className="mr-1.5" /> 下载此版本
                    </OreButton>
                  )}
                </div>
              </div>
            );
          })}

          {visibleCount < versions.length && (
            <div ref={observerTarget} className="flex justify-center items-center py-6">
              <Loader2 className="animate-spin text-ore-green opacity-50" size={24} />
            </div>
          )}
        </>
      )}
    </FocusBoundary>
  );
};