import React from 'react';
import { Blocks, Clock3, Download, Heart, Monitor, Server } from 'lucide-react';

import type { ModrinthProject, OreProjectDetail } from '../../../InstanceDetail/logic/modrinthApi';
import { formatDate, formatNumber } from '../../../../utils/formatters';

interface ProjectHeaderProps {
  project: ModrinthProject;
  details: OreProjectDetail | null;
}

const renderEnvChip = (env: string | undefined, type: 'client' | 'server') => {
  if (!env || env === 'unsupported') return null;

  const Icon = type === 'client' ? Monitor : Server;
  const isRequired = env === 'required';
  const label = type === 'client' ? '客户端' : '服务端';

  return (
    <span
      className={`
        inline-flex items-center gap-1 border-[2px] border-[var(--ore-downloadDetail-divider)] px-1.5 py-0.5
        text-[9px] font-minecraft uppercase tracking-[0.14em]
        ${isRequired
          ? 'bg-[#6CC349] text-black shadow-[inset_0_-2px_0_#3C8527]'
          : 'bg-[var(--ore-downloadDetail-rowBg)] text-black shadow-[inset_0_-2px_0_#8C8D90]'}
      `}
    >
      <Icon size={10} />
      {label}
      {isRequired ? ' 必需' : ' 可选'}
    </span>
  );
};

export const ProjectHeader: React.FC<ProjectHeaderProps> = ({ project, details }) => {
  const author = project.author || details?.author || 'Unknown';

  return (
    <div
      className="flex flex-shrink-0 gap-3 border-b-[2px] border-[var(--ore-downloadDetail-divider)] bg-[var(--ore-downloadDetail-surface)] px-4 py-2.5"
      style={{ boxShadow: 'var(--ore-downloadDetail-headerShadow)' }}
    >
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border-[2px] border-[var(--ore-downloadDetail-divider)] bg-[var(--ore-downloadDetail-base)]"
        style={{ boxShadow: 'var(--ore-downloadDetail-sectionShadow)' }}
      >
        {project.icon_url ? (
          <img src={project.icon_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <Blocks size={28} className="text-white/75" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h2 className="min-w-0 truncate font-minecraft text-lg text-white xl:text-xl">{project.title}</h2>
          <span className="font-minecraft text-[10px] uppercase tracking-[0.14em] text-[var(--ore-downloadDetail-labelText)]">
            by {author}
          </span>
          <div className="ml-1 flex flex-wrap items-center gap-1.5">
            {renderEnvChip(details?.client_side || project.client_side, 'client')}
            {renderEnvChip(details?.server_side || project.server_side, 'server')}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-minecraft uppercase tracking-[0.12em] text-[var(--ore-downloadDetail-hintText)]">
          <span className="inline-flex items-center gap-1 text-[#6CC349]">
            <Download size={12} />
            {formatNumber(details?.downloads || project.downloads)}
          </span>
          <span className="inline-flex items-center gap-1 text-[#F46D6D]">
            <Heart size={12} />
            {formatNumber(details?.followers || project.follows || 0)}
          </span>
          <span className="inline-flex items-center gap-1 text-[#8CB3FF]">
            <Clock3 size={12} />
            {formatDate(details?.updated_at || project.date_modified)}
          </span>
        </div>
      </div>
    </div>
  );
};
