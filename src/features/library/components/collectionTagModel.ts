import type { Collection } from '../../../types/library';
import {
  normalizeOreIconId,
  ORE_DEFAULT_ICON_ID,
} from '../../../ui/primitives/OreIconPicker';

export const DEFAULT_TAG_COLOR = '#90A6D6';

const TAG_ICON_PREFIX = 'tagIcon:';

export const normalizeTagColor = (value?: string) =>
  value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : DEFAULT_TAG_COLOR;

export const getTagIconId = (description?: string) => {
  if (!description?.startsWith(TAG_ICON_PREFIX)) return ORE_DEFAULT_ICON_ID;
  return normalizeOreIconId(description.slice(TAG_ICON_PREFIX.length));
};

export const createTagDescription = (iconId: string) =>
  `${TAG_ICON_PREFIX}${normalizeOreIconId(iconId)}`;

export const getReadableTextColor = (hex: string) => {
  const normalized = normalizeTagColor(hex).slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 > 150
    ? 'var(--ore-color-text-onLight-soft)'
    : 'var(--ore-color-text-emphasis-default)';
};

const createGroupId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

export const getCurrentUnixTimestamp = () => Math.floor(Date.now() / 1000);

interface CreateTagCollectionOptions {
  name: string;
  color: string;
  iconId: string;
  sortOrder: number;
}

export const createTagCollection = ({
  name,
  color,
  iconId,
  sortOrder,
}: CreateTagCollectionOptions): Collection => {
  const now = getCurrentUnixTimestamp();
  return {
    id: createGroupId(),
    name,
    type: 'group',
    sortOrder,
    createdAt: now,
    updatedAt: now,
    description: createTagDescription(iconId),
    coverImage: normalizeTagColor(color),
  };
};
