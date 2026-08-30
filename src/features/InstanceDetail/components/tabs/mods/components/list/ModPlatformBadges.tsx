import React from 'react';
import { HardDrive } from 'lucide-react';
import { ModrinthIcon, CurseforgeIcon } from '../../../../../../Download/components/Icons';
import { getModPlatformReference, type ModMeta } from '../../../../../logic/modService';

export interface ModPlatformBadgesProps {
  mod: ModMeta;
  className?: string;
}

export const ModPlatformBadges: React.FC<ModPlatformBadgesProps> = ({ mod, className = '' }) => {
  const modrinth = getModPlatformReference(mod, 'modrinth');
  const curseforge = getModPlatformReference(mod, 'curseforge');
  const hasModrinth = !!modrinth?.projectId;
  const hasCurseForge = !!curseforge?.projectId;

  if (hasModrinth) {
    return (
      <div className={`flex h-[18px] w-full items-center justify-center border-t-[2px] border-[#1E1E1F] bg-[#1BD96A] text-[#06140B] ${className}`}>
        <ModrinthIcon className="h-3.5 w-3.5" />
      </div>
    );
  }

  if (hasCurseForge) {
    return (
      <div className={`flex h-[18px] w-full items-center justify-center border-t-[2px] border-[#1E1E1F] bg-[#F16436] text-white ${className}`}>
        <CurseforgeIcon className="h-3.5 w-3.5" />
      </div>
    );
  }

  return (
    <div className={`flex h-[18px] w-full items-center justify-center border-t-[2px] border-[#1E1E1F] bg-[#14171E] text-[#687082] ${className}`}>
      <HardDrive size={11} strokeWidth={2.5} />
    </div>
  );
};

export default ModPlatformBadges;
