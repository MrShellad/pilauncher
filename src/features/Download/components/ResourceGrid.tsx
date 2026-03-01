// /src/features/Download/components/ResourceGrid.tsx
import React, { useEffect, useRef } from 'react';
import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { Loader2, Blocks, Download, Clock, CheckCircle2, Heart, Monitor, Tags } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ModrinthProject } from '../../InstanceDetail/logic/modrinthApi';
import type { ModMeta } from '../../InstanceDetail/logic/modService';

interface ResourceGridProps {
  results: ModrinthProject[];
  installedMods: ModMeta[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onSelectProject: (project: ModrinthProject) => void;
}

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

const formatNumber = (num?: number) => {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

const timeAgo = (dateStr: string | undefined, t: any) => {
  if (!dateStr) return t('download.time.unknown', '未知时间');
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return t('download.time.today', '今天');
  if (days < 30) return t('download.time.daysAgo', '{{count}} 天前', { count: days });
  const months = Math.floor(days / 30);
  if (months < 12) return t('download.time.monthsAgo', '{{count}} 个月前', { count: months });
  return t('download.time.yearsAgo', '{{count}} 年前', { count: Math.floor(months / 12) });
};

export const ResourceGrid: React.FC<ResourceGridProps> = ({ results, installedMods, isLoading, hasMore, onLoadMore, onSelectProject }) => {
  const { t } = useTranslation(); 
  const observerTarget = useRef<HTMLDivElement>(null);

  // 鼠标滚轮依然依靠 IntersectionObserver 触发懒加载
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) onLoadMore(); },
      { threshold: 0.1 }
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [onLoadMore]);

  const checkIsInstalled = (project: ModrinthProject) => {
    return installedMods.some(m => 
      m.modId === project.id || (m.fileName || '').toLowerCase().includes((project.slug || '').toLowerCase())
    );
  };

  const KNOWN_LOADERS = ['fabric', 'forge', 'neoforge', 'quilt', 'liteloader'];

  return (
    <FocusBoundary id="download-results-grid" className="flex-1 overflow-y-auto custom-scrollbar p-6">
      {isLoading ? (
        <div className="flex h-full items-center justify-center"><Loader2 size={48} className="animate-spin text-ore-green" /></div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pb-6">
          {results.map((project, i) => {
            const isInstalled = checkIsInstalled(project);
            const displayCategories: string[] = (project as any).display_categories || [];
            const follows: number = (project as any).follows || 0;
            const loaders = displayCategories.filter(c => KNOWN_LOADERS.includes(c.toLowerCase()));
            const features = displayCategories.filter(c => !KNOWN_LOADERS.includes(c.toLowerCase())).slice(0, 2);

            // ✅ 核心判断：如果当前卡片处于列表最后 4 个之内（涵盖各种列数排列情况的最后一行）
            const isNearBottom = i >= results.length - 4;

            return (
              <FocusItem 
                key={`${project.id}-${i}`} 
                onEnter={() => onSelectProject(project)}
                // ✅ 手柄焦点抵达触发器：光环滑到这里时，如果还有更多数据，无感触发下一页加载！
                onFocus={() => {
                  if (isNearBottom && hasMore) onLoadMore();
                }}
              >
                {({ref, focused}) => (
                   <div ref={ref as any} onClick={() => onSelectProject(project)}
                     className={`
                       flex bg-black/40 backdrop-blur-sm border transition-all outline-none cursor-pointer p-4 rounded-lg
                       ${focused ? 'border-white scale-[1.02] z-10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] bg-black/60 brightness-110' : 'border-white/10 hover:border-white/30 hover:bg-black/50'}
                       ${isInstalled ? 'border-ore-green/30 bg-ore-green/5' : ''}
                     `}
                   >
                     <div className="w-20 h-20 md:w-24 md:h-24 bg-black/50 border border-white/10 flex-shrink-0 rounded-md overflow-hidden shadow-inner">
                       {project.icon_url ? (
                         <img src={project.icon_url} className="w-full h-full object-cover" alt="icon" />
                       ) : (
                         <Blocks className="w-full h-full p-4 text-white/20"/>
                       )}
                     </div>
                     
                     <div className="ml-4 flex flex-col flex-1 min-w-0 justify-between">
                       <div>
                         <div className="flex items-baseline justify-between min-w-0">
                           <div className="flex items-baseline min-w-0 truncate">
                             <h3 className="font-minecraft text-white text-lg truncate drop-shadow-md mr-2">{project.title}</h3>
                             <span className="text-xs text-gray-400 truncate flex-shrink-0">by <span className="text-gray-300">{project.author}</span></span>
                           </div>
                           {isInstalled && <CheckCircle2 size={16} className="text-ore-green flex-shrink-0 ml-2" />}
                         </div>
                         <p className="text-xs text-gray-300 mt-1 line-clamp-2 leading-snug opacity-80">{project.description}</p>
                       </div>

                       <div className="flex flex-wrap gap-1.5 mt-2">
                         {project.client_side !== 'unsupported' && (
                           <span className="flex items-center bg-white/10 border border-white/5 px-2 py-0.5 rounded-full text-[10px] text-gray-300">
                             <Monitor size={10} className="mr-1" /> 
                             {t('download.tags.clientSide', '客户端')}
                           </span>
                         )}
                         
                         {features.map(f => (
                           <span key={f} className="flex items-center bg-white/5 border border-white/5 px-2 py-0.5 rounded-full text-[10px] text-gray-300">
                             <Tags size={10} className="mr-1 opacity-70" /> 
                             {t(`download.tags.${f.toLowerCase()}`, capitalize(f))}
                           </span>
                         ))}
                         
                         {loaders.map(l => (
                           <span key={l} className="flex items-center bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full text-[10px] text-orange-200/80">
                             {t(`download.tags.loader.${l.toLowerCase()}`, capitalize(l))}
                           </span>
                         ))}
                       </div>

                       <div className="flex justify-between items-end mt-3 text-gray-400 text-xs font-minecraft">
                         <div className="flex space-x-4">
                           <span className="flex items-center" title={t('download.stats.downloads', '总下载量')}><Download size={14} className="mr-1"/> {formatNumber(project.downloads)}</span>
                           <span className="flex items-center" title={t('download.stats.followers', '关注人数')}><Heart size={14} className="mr-1"/> {formatNumber(follows)}</span>
                           <span className="flex items-center" title={t('download.stats.updatedAt', '最后更新时间')}><Clock size={14} className="mr-1"/> {timeAgo(project.date_modified, t)}</span>
                         </div>
                         
                         {isInstalled && (
                           <span className="text-ore-green bg-ore-green/10 border border-ore-green/20 px-1.5 py-0.5 rounded-sm flex items-center shadow-inner text-[10px]">
                             {t('download.status.installed', '已安装')}
                           </span>
                         )}
                       </div>

                     </div>
                   </div>
                )}
              </FocusItem>
            );
          })}
          
          {results.length > 0 && hasMore && (
            <div ref={observerTarget} className="col-span-full h-20 flex justify-center items-center mt-4">
              <Loader2 size={24} className="animate-spin text-ore-green opacity-50" />
            </div>
          )}
        </div>
      )}
    </FocusBoundary>
  );
};