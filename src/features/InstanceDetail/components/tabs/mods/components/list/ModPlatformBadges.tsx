import React from 'react';
import { ModrinthIcon, CurseforgeIcon } from '../../../../../../Download/components/Icons';
import type { ModMeta } from '../../../../../logic/modService';

interface ModPlatformBadgesProps {
  mod: ModMeta;
  className?: string;
}

export const ModPlatformBadges: React.FC<ModPlatformBadgesProps> = ({ mod, className = '' }) => {
  const matched = mod.manifestEntry?.matchedPlatforms;
  const sourcePlatform = mod.manifestEntry?.source?.platform;
  
  const hasModrinth = !!(
    matched?.modrinth?.projectId || 
    sourcePlatform === 'modrinth'
  );
  const hasCurseForge = !!(
    matched?.curseforge?.projectId || 
    sourcePlatform === 'curseforge'
  );

  if (!hasModrinth && !hasCurseForge) {
    return null;
  }

  return (
    <div className={`absolute top-0 right-0 z-10 flex items-center border-b-[2px] border-l-[2px] border-[#1E1E1F] bg-[#14171E] ${className}`}>
      {hasModrinth && (
        <div
          className="flex h-3.5 w-3.5 items-center justify-center bg-[#1BD96A] text-[#06140B] shadow-[inset_0_-1px_0_#148A45]"
          title={matched?.modrinth?.projectId ? `Modrinth (ID: ${matched.modrinth.projectId})` : 'Modrinth'}
        >
          <ModrinthIcon className="h-2 w-2" />
        </div>
      )}
      {hasCurseForge && (
        <div
          className="flex h-3.5 w-3.5 items-center justify-center bg-[#F16436] text-white shadow-[inset_0_-1px_0_#A83812]"
          title={matched?.curseforge?.projectId ? `CurseForge (ID: ${matched.curseforge.projectId})` : 'CurseForge'}
        >
          <CurseforgeIcon className="h-2 w-2" />
        </div>
      )}
    </div>
  );
};
