// /src/features/Download/components/DownloadDetailModal.tsx
import React, { useState, useEffect } from 'react';
import { OreModal } from '../../../ui/primitives/OreModal';
import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Download, Loader2, Blocks, CheckCircle2, AlertCircle } from 'lucide-react';
import { getProjectDetails, fetchModrinthVersions, type ModrinthProject } from '../../InstanceDetail/logic/modrinthApi';

interface DownloadDetailModalProps {
  project: ModrinthProject | null;
  instanceConfig: any; 
  onClose: () => void;
  onDownload: (versionId: string, fileUrl: string, fileName: string) => void;
  installedVersionIds: string[]; 
}

export const DownloadDetailModal: React.FC<DownloadDetailModalProps> = ({ 
  project, instanceConfig, onClose, onDownload, installedVersionIds 
}) => {
  const [details, setDetails] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (project && instanceConfig) {
      setIsLoading(true);
      setDetails(null);
      setVersions([]);
      
      Promise.all([
        getProjectDetails(project.id).catch(() => null), // 防止详情崩溃连累版本列表
        fetchModrinthVersions(project.id) 
      ]).then(([detailData, versionData]) => {
        setDetails(detailData);
        setVersions(versionData || []);
        setTimeout(() => setFocus('download-modal-versions'), 100);
      }).catch(console.error).finally(() => setIsLoading(false));
    }
  }, [project, instanceConfig]);

  if (!project) return null;

  // 安全取值
  const gameVer = instanceConfig?.game_version || instanceConfig?.gameVersion || '';
  const currentLoader = (instanceConfig?.loader_type || instanceConfig?.loaderType || '').toLowerCase();

  return (
    <OreModal isOpen={!!project} onClose={onClose} hideTitleBar={true} className="w-full max-w-4xl h-[85vh]">
      <FocusBoundary id="download-detail-boundary" className="flex flex-col h-full bg-[#111112]">
        
        {/* 顶部头图与信息 */}
        <div className="flex p-8 border-b border-white/10 bg-black/40 flex-shrink-0 relative overflow-hidden">
          <div className="w-28 h-28 bg-black/50 border border-white/10 flex items-center justify-center p-2 rounded-lg shadow-xl z-10">
            {project.icon_url ? <img src={project.icon_url} className="w-full h-full object-contain" /> : <Blocks size={48} className="text-gray-600" />}
          </div>
          <div className="ml-6 flex-1 z-10 flex flex-col justify-center">
            <h2 className="text-3xl font-minecraft text-white drop-shadow-md">{project.title}</h2>
            <p className="text-ore-green font-minecraft mt-2">作者: {details?.team || project.author || '未知'} • 下载量: {(project.downloads / 1000).toFixed(1)}K</p>
            <p className="text-gray-400 text-sm mt-3 line-clamp-2 max-w-2xl">{project.description}</p>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* 左侧：详细描述 */}
          <div className="flex-[3] p-8 overflow-y-auto custom-scrollbar border-r border-white/10 bg-black/20">
            <h3 className="text-white font-minecraft text-lg mb-4 border-b border-white/10 pb-2">项目介绍</h3>
            {isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-ore-green" /></div>
            ) : (
              <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                {details?.body || project.description}
              </div>
            )}
          </div>

          {/* 右侧：版本列表 */}
          <FocusBoundary id="download-modal-versions" className="flex-[2] bg-black/40 flex flex-col">
            <div className="p-4 border-b border-white/10 bg-black/50">
              <h3 className="text-white font-minecraft text-sm">可用版本</h3>
              <p className="text-xs text-gray-400 mt-1">匹配环境: {gameVer || '任意'} {currentLoader === 'vanilla' ? '' : `(${currentLoader})`}</p>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
              {isLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-ore-green" /></div>
              ) : versions.map(v => {
                // ✅ 极其安全的数组检查，绝对不会触发 includes undefined 崩溃
                const safeGameVersions = Array.isArray(v.game_versions) ? v.game_versions : [];
                const safeLoaders = Array.isArray(v.loaders) ? v.loaders : [];

                const isCompatibleVersion = !gameVer || safeGameVersions.includes(gameVer);
                const isCompatibleLoader = currentLoader === 'vanilla' || currentLoader === '' || safeLoaders.includes(currentLoader);
                const isCompatible = isCompatibleVersion && isCompatibleLoader;
                
                const isInstalled = installedVersionIds.includes(v.id) || installedVersionIds.includes(v.version_number);

                return (
                  <FocusItem key={v.id} onEnter={() => isCompatible && !isInstalled && onDownload(v.id, v.files[0].url, v.files[0].filename)}>
                    {({ref, focused}) => (
                      <div ref={ref as any} onClick={() => isCompatible && !isInstalled && onDownload(v.id, v.files[0].url, v.files[0].filename)}
                        className={`
                          p-3 border transition-all outline-none flex flex-col relative overflow-hidden rounded-sm
                          ${!isCompatible ? 'border-transparent opacity-40 cursor-not-allowed grayscale' : 'cursor-pointer'}
                          ${isInstalled ? 'border-ore-green/50 bg-ore-green/10' : 'border-white/10 bg-black/40 hover:border-white/30 hover:bg-black/60'}
                          ${focused && isCompatible && !isInstalled ? 'border-white scale-[1.02] z-10 brightness-110 shadow-lg' : ''}
                        `}
                      >
                        <div className="flex justify-between items-start">
                          <span className={`font-minecraft truncate text-sm ${isInstalled ? 'text-ore-green' : 'text-white'}`}>{v.name}</span>
                          {isInstalled && <CheckCircle2 size={16} className="text-ore-green flex-shrink-0" />}
                        </div>
                        
                        <div className="text-xs text-gray-500 mt-1 space-x-2 flex items-center">
                          <span className="bg-black/50 px-1.5 py-0.5 rounded text-gray-300 border border-white/5">{safeLoaders[0] || 'Unknown'}</span>
                          <span>{safeGameVersions[0] || 'Any'}</span>
                        </div>

                        <div className="mt-3 flex justify-end">
                          {!isCompatible ? (
                            <span className="text-xs flex items-center text-red-400"><AlertCircle size={12} className="mr-1"/> 不适配</span>
                          ) : isInstalled ? (
                            <span className="text-xs flex items-center text-ore-green"><CheckCircle2 size={12} className="mr-1"/> 已安装</span>
                          ) : (
                            <button className={`text-xs flex items-center px-2 py-1 rounded-sm transition-colors ${focused ? 'bg-white text-black' : 'bg-white/10 text-white'}`}>
                              <Download size={12} className="mr-1" /> 下载
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </FocusItem>
                );
              })}
            </div>
          </FocusBoundary>
          
        </div>
      </FocusBoundary>
    </OreModal>
  );
};