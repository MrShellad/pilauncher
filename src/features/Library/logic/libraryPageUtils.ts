import type { DownloadSource, TabType as DownloadTabType } from '../../Download/hooks/useResourceDownload';
import type { ModrinthProject } from '../../InstanceDetail/logic/modrinthApi';
import type { DropdownOption } from '../../../ui/primitives/OreDropdown';
import type { CollectionItem } from '../../../types/library';
import type { LibraryResourceViewModel } from './libraryItems';

export const LOADER_OPTIONS: DropdownOption[] = [
  { label: 'Fabric', value: 'fabric' },
  { label: 'Forge', value: 'forge' },
  { label: 'NeoForge', value: 'neoforge' },
  { label: 'Quilt', value: 'quilt' },
];

export const LIBRARY_RESOURCE_FOCUS_PREFIX = 'library-resource-';
export const LIBRARY_COLLECTION_FOCUS_PREFIX = 'library-collection-';

export const createCollectionItemId = (collectionId: string, itemId: string) => `${collectionId}:${itemId}`;

export const nowSeconds = () => Math.floor(Date.now() / 1000);

export const getRelationPendingKey = (collectionId: string, itemId: string) => `${collectionId}::${itemId}`;

export const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const getCollectionItemTrackerKeys = (relation: CollectionItem) => {
  const keys = new Set<string>();
  const itemId = relation.itemId.trim().toLowerCase();
  if (itemId) keys.add(itemId);

  try {
    const extra = relation.extra ? JSON.parse(relation.extra) : null;
    const source = typeof extra?.source === 'string' ? extra.source.trim().toLowerCase() : '';
    const projectId = typeof extra?.projectId === 'string' ? extra.projectId.trim().toLowerCase() : '';
    if (projectId) keys.add(projectId);
    if (source && projectId) keys.add(`${source}:${projectId}`);
  } catch {
    // Ignore stale relation metadata; the item id remains the canonical key.
  }

  return [...keys];
};

export const toDownloadTabType = (type: string): DownloadTabType => {
  if (type === 'modpack') return 'modpack';
  if (type === 'resourcepack') return 'resourcepack';
  if (type === 'shader') return 'shader';
  return 'mod';
};

export const toDetailProject = (resource: LibraryResourceViewModel): ModrinthProject | null => {
  const source = resource.source.toLowerCase();
  if (source !== 'modrinth' && source !== 'curseforge') return null;

  const projectId = resource.item.projectId || resource.id.split(':').slice(1).join(':') || resource.id;
  if (!projectId) return null;

  return {
    id: projectId,
    project_id: projectId,
    slug: projectId,
    title: resource.title,
    description: resource.description || '',
    icon_url: resource.iconUrl || '',
    author: resource.author || '',
    downloads: 0,
    date_modified: new Date(resource.updatedAt * 1000).toISOString(),
    client_side: 'unknown',
    server_side: 'unknown',
    follows: 0,
    loaders: resource.loaders,
    categories: resource.categories,
    display_categories: resource.categories,
    source: source as DownloadSource,
  };
};

export const getRemoveContextLabel = (collectionType?: string) => {
  if (collectionType === 'group') return 'libraryPage.context.removeFromTag';
  if (collectionType === 'mod_set') return 'libraryPage.context.removeFromModSet';
  if (collectionType === 'modpack') return 'libraryPage.context.removeFromModpack';
  return 'libraryPage.context.removeFromCollection';
};

export const getLibraryDownloadSubFolder = (tab: DownloadTabType) => {
  if (tab === 'resourcepack') return 'resourcepacks';
  if (tab === 'shader') return 'shaderpacks';
  if (tab === 'modpack') return 'modpacks';
  return 'mods';
};
