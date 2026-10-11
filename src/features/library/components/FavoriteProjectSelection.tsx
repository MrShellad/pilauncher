import React, { useEffect } from 'react';

import { useIconCacheStore } from '@/features/download';
import type { ModrinthProject } from '@/features/resource-catalog';
import { OreOverlayScrollArea } from '../../../ui/primitives/OreOverlayScrollArea';
import { normalizeFavoriteProjectId } from './favoritePlaceholderModel';

interface FavoriteProjectSelectionProps {
  projects: ModrinthProject[];
  title: string;
}

export const FavoriteProjectSelection: React.FC<FavoriteProjectSelectionProps> = ({ projects, title }) => (
  <aside className="flex min-h-[18rem] flex-col border-t-2 border-[#1E1E1F] bg-[#242526] p-4 lg:min-h-0 lg:border-l-2 lg:border-t-0">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="font-minecraft text-sm text-white">{title}</div>
      <div className="border-2 border-[#1E1E1F] bg-[#6CC349] px-2 py-1 font-minecraft text-xs text-[#111214]">
        {projects.length}
      </div>
    </div>

    <OreOverlayScrollArea
      className="min-h-0 flex-1"
      contentClassName="space-y-2"
      safeInsetTop={4}
      safeInsetBottom={4}
      safeInsetRight={2}
      contentSafePaddingRight={20}
    >
      {projects.map((project) => (
        <FavoriteProjectItem
          key={`${project.source || 'modrinth'}:${normalizeFavoriteProjectId(project)}`}
          project={project}
        />
      ))}
    </OreOverlayScrollArea>
  </aside>
);

const FavoriteProjectItem: React.FC<{ project: ModrinthProject }> = ({ project }) => {
  const cachedIconUrl = useIconCacheStore((state) => project.icon_url ? state.cachedUrls[project.icon_url] || '' : '');
  const loadIcon = useIconCacheStore((state) => state.loadIcon);

  useEffect(() => {
    if (project.icon_url) {
      void loadIcon(project.icon_url);
    }
  }, [project.icon_url, loadIcon]);

  return (
    <div className="flex items-center gap-3 border-2 border-[#1E1E1F] bg-[#D0D1D4] p-2 text-[#111214] shadow-[inset_0_-0.1875rem_0_#58585A,inset_0.125rem_0.125rem_0_rgba(255,255,255,0.68)]">
      <div className="h-10 w-10 shrink-0 overflow-hidden border-2 border-[#1E1E1F] bg-[#48494A]">
        {project.icon_url ? (
          <img src={cachedIconUrl || project.icon_url} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0">
        <div className="truncate font-minecraft text-sm">{project.title}</div>
        <div className="truncate text-xs text-[#48494A]">{project.author || project.source || 'Unknown'}</div>
      </div>
    </div>
  );
};
