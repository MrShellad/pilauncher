import type { DropdownOption } from '../../../ui/primitives/OreDropdown';
import type { CollectionItem, StarredItem } from '../../../types/library';
import type { ModrinthProject, TabType } from '@/features/resource-catalog';

export type FavoriteResourceType = Extract<TabType, 'mod' | 'resourcepack' | 'shader'>;

export interface FavoritePlaceholderCopy {
  title: string;
  tagTitle: string;
  tagPlaceholder: string;
  includeCollectionLabel: string;
  collectionLabel: string;
  collectionPlaceholder: string;
  matchedText: string;
  unmatchedText: string;
  selectedTitle: string;
  info: string;
  saveText: string;
}

export const LOADER_OPTIONS: DropdownOption[] = [
  { label: 'Fabric', value: 'fabric' },
  { label: 'Forge', value: 'forge' },
  { label: 'NeoForge', value: 'neoforge' },
  { label: 'Quilt', value: 'quilt' },
];

const nowSeconds = () => Math.floor(Date.now() / 1000);

export const createFavoriteId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

export const normalizeFavoriteProjectId = (project: ModrinthProject) =>
  project.id || project.project_id || project.slug || project.title;

export const toFavoriteStarredItem = (
  project: ModrinthProject,
  resourceType: FavoriteResourceType,
): StarredItem => {
  const timestamp = nowSeconds();
  const source = project.source || 'modrinth';
  const projectId = normalizeFavoriteProjectId(project);

  return {
    id: `${source}:${projectId}`,
    type: resourceType,
    source,
    projectId,
    title: project.title,
    author: project.author,
    snapshot: JSON.stringify({
      title: project.title,
      iconUrl: project.icon_url,
      author: project.author,
      description: project.description,
      loaders: project.loaders || project.categories || [],
      categories: project.display_categories || project.categories || [],
      updatedAt: project.date_modified,
    }),
    state: JSON.stringify({
      hasUpdate: false,
      lastCheckedAt: timestamp,
    }),
    meta: JSON.stringify({
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const buildFavoriteCollectionRelation = (
  collectionId: string,
  item: StarredItem,
  position: number,
  timestamp: number,
): CollectionItem => ({
  id: `${collectionId}:${item.id}`,
  collectionId,
  itemId: item.id,
  position,
  extra: JSON.stringify({ source: item.source, projectId: item.projectId }),
  createdAt: timestamp,
});

export const getFavoritePlaceholderCopy = (
  resourceType: FavoriteResourceType,
): FavoritePlaceholderCopy => {
  if (resourceType === 'mod') {
    return {
      title: '加入收藏',
      tagTitle: '入库标签',
      tagPlaceholder: '选择标签',
      includeCollectionLabel: '同时加入模组集',
      collectionLabel: '模组集',
      collectionPlaceholder: '输入名称，或从已有模组集中选择',
      matchedText: '已匹配现有模组集，保存时会加入其中。',
      unmatchedText: '没有同名模组集时，保存会自动创建。',
      selectedTitle: '已选择 Mod',
      info: '默认只保存到收藏并关联标签；开启模组集后，才会额外生成可追踪的模组集合。',
      saveText: '保存入库',
    };
  }

  if (resourceType === 'shader') {
    return {
      title: '收藏光影',
      tagTitle: '光影标签',
      tagPlaceholder: '选择标签',
      includeCollectionLabel: '',
      collectionLabel: '',
      collectionPlaceholder: '',
      matchedText: '',
      unmatchedText: '',
      selectedTitle: '已选择光影',
      info: '光影会保存到收藏，并可按标签整理。',
      saveText: '保存光影',
    };
  }

  return {
    title: '收藏资源包',
    tagTitle: '资源包标签',
    tagPlaceholder: '选择标签',
    includeCollectionLabel: '',
    collectionLabel: '',
    collectionPlaceholder: '',
    matchedText: '',
    unmatchedText: '',
    selectedTitle: '已选择资源包',
    info: '资源包会保存到收藏，并可按标签整理。',
    saveText: '保存资源包',
  };
};
