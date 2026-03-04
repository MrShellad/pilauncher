// /src/features/Download/components/DetailModal/ProjectHeader.tsx
import React from 'react';
import { Download, Blocks, Heart, Clock, Monitor, Server } from 'lucide-react';
import type { ModrinthProject, OreProjectDetail } from '../../../InstanceDetail/logic/modrinthApi';
import { formatNumber, formatDate } from '../../../../utils/formatters';

interface ProjectHeaderProps {
  project: ModrinthProject;
  details: OreProjectDetail | null;
}

export const ProjectHeader: React.FC<ProjectHeaderProps> = ({ project, details }) => {
  const renderEnvTag = (env: string, type: 'client' | 'server') => {
    if (env === 'unsupported' || !env) return null;
    const isRequired = env === 'required';
    const Icon = type === 'client' ? Monitor : Server;
    const label = type === 'client' ? '客户端' : '服务端';
    return (
      <span className={`flex items-center text-[10px] px-1.5 py-0.5 rounded-sm border ${isRequired ? 'bg-ore-green/10 text-ore-green border-ore-green/20' : 'bg-gray-700/30 text-gray-400 border-white/5'}`}>
        <Icon size={10} className="mr-1" /> {label} {isRequired ? '(必装)' : '(可选)'}
      </span>
    );
  };

  return (
    // ✅ 需求2：背景色提升至 bg-[#1E1E1F]，并加强边框，使之与内容区产生清晰的视差
    <div className="flex p-4 lg:p-5 border-b-2 border-white/10 bg-[#1E1E1F] flex-shrink-0 relative overflow-hidden items-center shadow-lg z-10">
      <div className="w-16 h-16 lg:w-20 lg:h-20 bg-black/50 border border-white/10 flex items-center justify-center p-1.5 rounded-lg shadow-inner z-10 flex-shrink-0">
        {project.icon_url ? <img src={project.icon_url} className="w-full h-full object-cover rounded-md" alt="icon" /> : <Blocks size={32} className="text-white/20" />}
      </div>
      
      <div className="ml-5 flex-1 z-10 flex flex-col justify-center min-w-0">
        <div className="flex items-baseline min-w-0 mb-1.5">
          <h2 className="text-2xl lg:text-3xl font-minecraft text-white drop-shadow-md truncate mr-3">{project.title}</h2>
          {/* ✅ 需求1：完美修复作者字段读取问题 */}
          <p className="text-xs text-gray-400 truncate flex-shrink-0">
            by <span className="text-gray-200 font-bold">{project.author || (project as any).team || details?.author || 'Unknown'}</span>
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-1">
          <div className="flex gap-2">
            {renderEnvTag(details?.client_side || project.client_side, 'client')}
            {renderEnvTag(details?.server_side || project.server_side, 'server')}
          </div>

          <div className="flex items-center space-x-4 text-xs text-gray-400 font-minecraft">
            <span className="flex items-center text-ore-green"><Download size={14} className="mr-1.5"/> {formatNumber(details?.downloads || project.downloads)}</span>
            <span className="flex items-center text-red-400"><Heart size={14} className="mr-1.5"/> {formatNumber(details?.followers || project.follows || 0)}</span>
            <span className="flex items-center text-blue-400"><Clock size={14} className="mr-1.5"/> {formatDate(details?.updated_at || project.date_modified)} 更新</span>
          </div>
        </div>
      </div>
    </div>
  );
};