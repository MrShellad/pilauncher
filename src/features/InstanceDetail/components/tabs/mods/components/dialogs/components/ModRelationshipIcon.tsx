import React, { useEffect, useMemo, useState } from 'react';
import { Blocks, Loader2 } from 'lucide-react';

import { getCurseForgeProjectDetails } from '../../../../../../../Download/logic/curseforgeApi';
import { getProjectDetails } from '../../../../../../logic/modrinthApi';
import { useResourceIcon, type IconTargetItem } from '../../../../../../logic/modIconService';
import type { ModMeta } from '../../../../../../logic/modService';

type DependencyPlatform = 'modrinth' | 'curseforge';

const dependencyProjectIconRequests = new Map<string, Promise<string | null>>();

const fetchDependencyProjectIcon = (platform: DependencyPlatform, projectId: string) => {
  const cacheKey = `${platform}:${projectId}`;
  const existing = dependencyProjectIconRequests.get(cacheKey);
  if (existing) return existing;

  const request = (platform === 'curseforge'
    ? getCurseForgeProjectDetails(projectId)
    : getProjectDetails(projectId)
  )
    .then((project) => project.icon_url || null)
    .catch((error) => {
      console.warn(`Failed to fetch ${platform} dependency icon for ${projectId}:`, error);
      return null;
    });

  dependencyProjectIconRequests.set(cacheKey, request);
  return request;
};

interface ModRelationshipIconProps {
  id: string;
  name: string;
  platform?: DependencyPlatform;
  installedMod?: ModMeta;
  instanceId?: string;
  className?: string;
}

export const ModRelationshipIcon: React.FC<ModRelationshipIconProps> = ({
  id,
  name,
  platform,
  installedMod,
  instanceId,
  className = '',
}) => {
  const [networkIconUrl, setNetworkIconUrl] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    setNetworkIconUrl(null);

    if (installedMod || !platform || !id) return;

    void fetchDependencyProjectIcon(platform, id).then((iconUrl) => {
      if (!disposed) setNetworkIconUrl(iconUrl);
    });

    return () => {
      disposed = true;
    };
  }, [id, installedMod, platform]);

  const iconItem = useMemo<IconTargetItem>(() => {
    if (installedMod) return installedMod;

    return {
      fileName: `dependency-${platform || 'unknown'}-${id}`,
      cacheKey: `dependency-${platform || 'unknown'}-${id}`,
      networkIconUrl,
    };
  }, [id, installedMod, networkIconUrl, platform]);
  const iconSnapshot = useResourceIcon(
    iconItem,
    'medium',
    installedMod ? { instanceId, resType: 'mod' } : undefined,
  );

  return (
    <div
      className={`relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden border-[2px] border-[#1E1E1F] bg-[#313233] ${className}`}
      title={name}
    >
      {iconSnapshot.src ? (
        <img src={iconSnapshot.src} alt="" className="h-full w-full object-cover pixelated" />
      ) : (
        <Blocks size={18} className="text-[#B1B2B5]" />
      )}
      {iconSnapshot.status === 'loading' && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/45">
          <Loader2 size={14} className="animate-spin text-white" />
        </span>
      )}
    </div>
  );
};
