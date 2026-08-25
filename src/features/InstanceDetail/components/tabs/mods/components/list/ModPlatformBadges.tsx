import React from 'react';
import { ModrinthIcon, CurseforgeIcon } from '../../../../../../Download/components/Icons';
import { getModPlatformReference, type ModMeta } from '../../../../../logic/modService';

interface ModPlatformBadgesProps {
  mod: ModMeta;
  className?: string;
}

export const ModPlatformBadges: React.FC<ModPlatformBadgesProps> = ({ mod, className = '' }) => {
  const modrinth = getModPlatformReference(mod, 'modrinth');
  const curseforge = getModPlatformReference(mod, 'curseforge');
  const hasModrinth = !!modrinth?.projectId;
  const hasCurseForge = !!curseforge?.projectId;

  if (!hasModrinth && !hasCurseForge) {
    return null;
  }

  return (
    <div className={`absolute top-0 right-0 z-10 flex items-center border-b-[2px] border-l-[2px] border-[#1E1E1F] bg-[#14171E] ${className}`}>
      {hasModrinth && (
        <div
          className="flex h-3.5 w-3.5 items-center justify-center bg-[#1BD96A] text-[#06140B] shadow-[inset_0_-1px_0_#148A45]"
          title={`Modrinth (ID: ${modrinth?.projectId})`}
        >
          <ModrinthIcon className="h-2 w-2" />
        </div>
      )}
      {hasCurseForge && (
        <div
          className="flex h-3.5 w-3.5 items-center justify-center bg-[#F16436] text-white shadow-[inset_0_-1px_0_#A83812]"
          title={`CurseForge (ID: ${curseforge?.projectId})`}
        >
          <CurseforgeIcon className="h-2 w-2" />
        </div>
      )}
    </div>
  );
};
