import React from 'react';
import { Loader2 } from 'lucide-react';

import { useResourceIcon, type ModIconPriority } from '../../logic/modIconService';
import type { ResourceItem, ResourceType } from '../../logic/resourceService';

export interface ResourceIconBoxProps {
  item: ResourceItem;
  instanceId: string;
  resType: ResourceType;
  priority?: ModIconPriority;
  className?: string;
  fallbackIconSize?: number;
}

const getPlaceholderInitial = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '#';

  const firstAlphaNumeric = Array.from(trimmed).find((char) => /[\p{L}\p{N}]/u.test(char));
  return (firstAlphaNumeric || trimmed[0] || '#').toUpperCase();
};

const getHashHue = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash % 360;
};

export const ResourceIconBox: React.FC<ResourceIconBoxProps> = ({
  item,
  instanceId,
  resType,
  priority = 'medium',
  className = '',
  fallbackIconSize = 24,
}) => {
  const iconSnapshot = useResourceIcon(item, priority, { instanceId, resType });
  const isIconLoading = iconSnapshot.status === 'loading';
  const iconUrl = iconSnapshot.src;

  const displayName = (item.fileName || '')
    .replace(/\.disabled$/i, '')
    .replace(/\.zip$/i, '')
    .replace(/\.jar$/i, '');

  const hue = getHashHue(item.fileName || 'resource');
  const initial = getPlaceholderInitial(displayName);
  const placeholderStyle = {
    background: `linear-gradient(135deg, hsl(${hue} 64% 34%), hsl(${(hue + 36) % 360} 48% 18%))`,
  };

  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt=""
        loading="lazy"
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center select-none ${
        isIconLoading ? 'animate-pulse' : ''
      } ${className}`}
      style={placeholderStyle}
    >
      <span
        className="font-minecraft font-bold leading-none text-white/90"
        style={{ fontSize: fallbackIconSize }}
      >
        {initial}
      </span>
      {isIconLoading && (
        <span className="absolute bottom-1 right-1 bg-[#111318]/90 p-0.5 rounded-sm">
          <Loader2 size={12} className="animate-spin text-[#AFC4FF]" />
        </span>
      )}
    </div>
  );
};
