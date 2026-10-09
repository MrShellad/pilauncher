import type { CollectionItem, MetaPayload, SnapshotPayload, StarredItem, StatePayload } from '../../../types/library';
import type { LibraryFilterId, LibrarySortId } from '../data/libraryPageData';
import i18n from '../../../ui/i18';

export interface LibraryResourceViewModel {
  item: StarredItem;
  id: string;
  type: string;
  source: string;
  title: string;
  author?: string;
  description?: string;
  iconUrl?: string;
  loaders: string[];
  categories: string[];
  version?: string;
  installedVersion?: string;
  lastKnownVersion?: string;
  hasUpdate: boolean;
  note?: string;
  pinned: boolean;
  archived: boolean;
  updatedAt: number;
  updatedLabel: string;
  searchText: string;
}

export interface LibraryStats {
  total: number;
  modpacks: number;
  mods: number;
  servers: number;
  updates: number;
}

const parseJSON = <T,>(value: string | undefined, fallback: T): T => {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) return i18n.t('libraryPage.item.unknownDate');
  return date.toLocaleDateString();
};

export const toLibraryResource = (item: StarredItem): LibraryResourceViewModel => {
  const snapshot = parseJSON<Partial<SnapshotPayload>>(item.snapshot, {});
  const state = parseJSON<Partial<StatePayload>>(item.state, {});
  const meta = parseJSON<Partial<MetaPayload>>(item.meta, {});
  const title = snapshot.title || item.title || 'Unknown Item';
  const author = snapshot.author || item.author;
  const loaders = snapshot.loaders ?? [];
  const categories = snapshot.categories ?? [];

  return {
    item,
    id: item.id,
    type: item.type,
    source: item.source,
    title,
    author,
    description: snapshot.description,
    iconUrl: snapshot.iconUrl,
    loaders,
    categories,
    version: snapshot.version,
    installedVersion: state.installedVersion,
    lastKnownVersion: state.lastKnownVersion,
    hasUpdate: Boolean(state.hasUpdate),
    note: meta.note,
    pinned: Boolean(meta.pinned),
    archived: Boolean(meta.archived),
    updatedAt: item.updatedAt,
    updatedLabel: formatDate(item.updatedAt),
    searchText: [
      title,
      author,
      item.source,
      item.type,
      snapshot.description,
      snapshot.version,
      state.installedVersion,
      ...loaders,
      ...categories,
      ...(meta.tags ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  };
};

export const resolveCollectionItems = (
  collectionId: string,
  items: StarredItem[],
  collectionItems: CollectionItem[],
) => {
  const itemMap = new Map(items.map((item) => [item.id, item]));
  return collectionItems
    .filter((relation) => relation.collectionId === collectionId)
    .sort((a, b) => a.position - b.position)
    .map((relation) => itemMap.get(relation.itemId))
    .filter((item): item is StarredItem => Boolean(item));
};

export const getScopedItems = (
  groupId: string,
  items: StarredItem[],
  collectionItems: CollectionItem[],
) => {
  if (groupId === 'all') return items;
  if (groupId === 'starred') return items;
  return resolveCollectionItems(groupId, items, collectionItems);
};

export const createLibraryStats = (items: LibraryResourceViewModel[]): LibraryStats => ({
  total: items.length,
  modpacks: items.filter((item) => item.type === 'modpack').length,
  mods: items.filter((item) => item.type === 'mod').length,
  servers: items.filter((item) => item.type === 'server').length,
  updates: items.filter((item) => item.hasUpdate).length,
});

export const filterLibraryResources = (
  resources: LibraryResourceViewModel[],
  query: string,
  filter: LibraryFilterId,
) => {
  const normalizedQuery = query.trim().toLowerCase();

  return resources.filter((resource) => {
    if (filter === 'updated' && !resource.hasUpdate) return false;
    if (filter === 'external') {
      const isExternal =
        resource.source === 'custom' ||
        resource.source === 'external' ||
        (resource.type !== 'mod' && resource.type !== 'modpack');
      if (!isExternal) return false;
    }
    if (filter !== 'all' && filter !== 'updated' && filter !== 'external' && resource.type !== filter) return false;
    if (!normalizedQuery) return true;
    return resource.searchText.includes(normalizedQuery);
  });
};

export const sortLibraryResources = (
  resources: LibraryResourceViewModel[],
  sortBy: LibrarySortId,
) => {
  const sorted = [...resources];

  if (sortBy === 'manual') {
    return sorted;
  }

  if (sortBy === 'name') {
    return sorted.sort((a, b) => a.title.localeCompare(b.title));
  }

  if (sortBy === 'source') {
    return sorted.sort((a, b) => {
      const sourceCompare = a.source.localeCompare(b.source);
      return sourceCompare === 0 ? a.title.localeCompare(b.title) : sourceCompare;
    });
  }

  return sorted.sort((a, b) => b.updatedAt - a.updatedAt);
};
