import type { DropdownOption } from '../../../ui/primitives/OreDropdown';
import type {
  ModrinthProject as OreProjectSummary,
  OreProjectDependency,
  OreProjectDetail,
  OreProjectVersion
} from '../../InstanceDetail/logic/modrinthApi';
import {
  readPersistentCache,
  readSessionCache,
  writePersistentCache,
  writeSessionCache
} from './sessionCache';

const CURSEFORGE_API_BASE = 'https://api.curseforge.com/v1';
const CURSEFORGE_API_KEY = import.meta.env.VITE_CURSEFORGE_API_KEY?.trim() || '';
const MINECRAFT_GAME_ID = 432;
type DownloadTabType = 'mod' | 'resourcepack' | 'shader' | 'modpack';

const PROJECT_TYPE_CLASS_ID: Record<DownloadTabType, number> = {
  mod: 6,
  resourcepack: 12,
  shader: 6552,
  modpack: 4471
};

const LOADER_TYPE_MAP: Record<string, number> = {
  forge: 1,
  fabric: 4,
  quilt: 5,
  neoforge: 6
};

const KNOWN_LOADERS = Object.keys(LOADER_TYPE_MAP);
const VERSION_PATTERN = /^(\d+\.\d+(?:\.\d+)?)|(\d{2}w\d{2}[a-z])$/i;

interface CurseForgeEnvelope<T> {
  data: T;
}

interface CurseForgeAuthor {
  name: string;
}

interface CurseForgeCategory {
  id: number;
  name: string;
  slug: string;
  classId: number;
  parentCategoryId: number;
  isClass?: boolean;
}

interface CurseForgeLogo {
  url?: string;
  thumbnailUrl?: string;
}

interface CurseForgeScreenshot {
  url?: string;
  thumbnailUrl?: string;
}

interface CurseForgeSortableGameVersion {
  gameVersionName?: string;
}

interface CurseForgeLatestFileIndex {
  gameVersion: string;
  modLoader: number;
}

interface CurseForgeDependency {
  modId?: number;
  relationType?: number;
}

interface CurseForgeFile {
  id: number;
  displayName: string;
  fileName: string;
  fileDate: string;
  downloadUrl: string | null;
  gameVersions: string[];
  sortableGameVersions?: CurseForgeSortableGameVersion[];
  dependencies?: CurseForgeDependency[];
}

interface CurseForgeMod {
  id: number;
  name: string;
  slug: string;
  summary: string;
  authors?: CurseForgeAuthor[];
  logo?: CurseForgeLogo | null;
  downloadCount?: number;
  dateModified?: string;
  categories?: CurseForgeCategory[];
  latestFilesIndexes?: CurseForgeLatestFileIndex[];
  latestFiles?: CurseForgeFile[];
  classId?: number;
  thumbsUpCount?: number;
  screenshots?: CurseForgeScreenshot[];
}

interface SearchParams {
  query: string;
  version?: string;
  loader?: string;
  category?: string;
  sort?: 'relevance' | 'downloads' | 'updated' | 'newest';
  projectType?: DownloadTabType;
  limit?: number;
  offset?: number;
}

const hasApiKey = () => CURSEFORGE_API_KEY.length > 0;

export const hasCurseForgeApiKey = () => hasApiKey();

const toLoaderName = (modLoader: number): string | null => {
  const entry = Object.entries(LOADER_TYPE_MAP).find(([, value]) => value === modLoader);
  return entry?.[0] || null;
};

const dedupe = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const normalizeGameVersions = (values: string[]) =>
  dedupe(
    values.filter((value) => {
      const lower = value.toLowerCase();
      return VERSION_PATTERN.test(value) || lower.includes('snapshot') || lower.includes('experimental');
    })
  );

const normalizeLoaderNames = (values: string[]) =>
  dedupe(
    values
      .map((value) => value.toLowerCase())
      .filter((value) => KNOWN_LOADERS.includes(value))
  );

const getFileLoaders = (file: CurseForgeFile) => {
  const combined = [
    ...(file.gameVersions || []),
    ...((file.sortableGameVersions || []).map((item) => item.gameVersionName || ''))
  ];
  return normalizeLoaderNames(combined);
};

const getFileGameVersions = (file: CurseForgeFile) => {
  const combined = [
    ...(file.gameVersions || []),
    ...((file.sortableGameVersions || []).map((item) => item.gameVersionName || ''))
  ];
  return normalizeGameVersions(combined);
};

const mapDependencyType = (relationType?: number): OreProjectDependency['dependency_type'] => {
  switch (relationType) {
    case 3:
      return 'required';
    case 2:
      return 'optional';
    case 5:
      return 'incompatible';
    case 1:
    case 4:
    case 6:
      return 'embedded';
    default:
      return 'optional';
  }
};

const mapSortField = (sort: SearchParams['sort']) => {
  switch (sort) {
    case 'downloads':
      return 6;
    case 'updated':
      return 3;
    case 'newest':
      return 11;
    case 'relevance':
    default:
      return 1;
  }
};

const prettifyLabel = (value: string) =>
  value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const getCurseForgeCategoryTranslationKey = (slug: string) =>
  `download.categories.${slug.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;

export const getCurseForgeCategoryFallbackLabel = (slug: string, name: string) => {
  if (name) return name;
  return prettifyLabel(slug);
};

const hydrateCurseForgeCategoryOption = (
  category: Partial<CurseForgeCategoryOption> & Pick<DropdownOption, 'label' | 'value'>
): CurseForgeCategoryOption => {
  const label = String(category.label || '').trim();
  const slug = String(category.slug || label).trim();

  return {
    ...category,
    label: label || getCurseForgeCategoryFallbackLabel(slug, ''),
    value: String(category.value || ''),
    slug,
    translationKey: category.translationKey || getCurseForgeCategoryTranslationKey(slug || label),
    defaultLabel: category.defaultLabel || getCurseForgeCategoryFallbackLabel(slug, label)
  };
};

const filterProjectCategories = (categories: CurseForgeCategory[] = [], classId?: number) =>
  categories.filter((category) => {
    if (typeof classId === 'number') {
      return shouldIncludeCategory(category, classId);
    }

    if (category.isClass) return false;
    const slug = (category.slug || '').toLowerCase();
    return !KNOWN_LOADERS.includes(slug);
  });

const mapProjectSummary = (mod: CurseForgeMod): OreProjectSummary => {
  const visibleCategories = filterProjectCategories(mod.categories || [], mod.classId);

  return {
    id: String(mod.id),
    project_id: String(mod.id),
    slug: mod.slug,
    title: mod.name,
    description: mod.summary || '',
    icon_url: mod.logo?.thumbnailUrl || mod.logo?.url || '',
    author: mod.authors?.[0]?.name || 'Unknown',
    downloads: Math.trunc(mod.downloadCount || 0),
    date_modified: mod.dateModified || '',
    client_side: '',
    server_side: '',
    follows: mod.thumbsUpCount || 0,
    categories: visibleCategories.map((category) => category.slug || category.name),
    display_categories: visibleCategories.map((category) => category.name),
    gallery_urls: (mod.screenshots || []).map((item) => item.thumbnailUrl || item.url || '').filter(Boolean),
    source: 'curseforge'
  };
};

const mapProjectDetail = (mod: CurseForgeMod): OreProjectDetail => {
  const latestIndexes = mod.latestFilesIndexes || [];
  const gameVersions = normalizeGameVersions(latestIndexes.map((item) => item.gameVersion));
  const loaders = normalizeLoaderNames(
    latestIndexes
      .map((item) => toLoaderName(item.modLoader) || '')
      .filter(Boolean)
  );

  return {
    id: String(mod.id),
    title: mod.name,
    author: mod.authors?.[0]?.name || 'Unknown',
    description: mod.summary || '',
    icon_url: mod.logo?.url || mod.logo?.thumbnailUrl || null,
    client_side: '',
    server_side: '',
    downloads: Math.trunc(mod.downloadCount || 0),
    followers: mod.thumbsUpCount || 0,
    updated_at: mod.dateModified || '',
    loaders,
    game_versions: gameVersions,
    gallery_urls: (mod.screenshots || []).map((item) => item.url || item.thumbnailUrl || '').filter(Boolean)
  };
};

const mapProjectVersion = (file: CurseForgeFile): OreProjectVersion | null => {
  if (!file.downloadUrl) return null;

  return {
    id: String(file.id),
    name: file.displayName || file.fileName,
    version_number: file.fileName,
    date_published: file.fileDate,
    loaders: getFileLoaders(file),
    game_versions: getFileGameVersions(file),
    file_name: file.fileName,
    download_url: file.downloadUrl,
    dependencies: (file.dependencies || [])
      .filter((dependency) => dependency.modId)
      .map((dependency) => ({
        version_id: null,
        project_id: dependency.modId ? String(dependency.modId) : null,
        file_name: null,
        dependency_type: mapDependencyType(dependency.relationType)
      }))
  };
};

const curseForgeFetch = async <T>(path: string, params?: Record<string, string | number | undefined>) => {
  if (!hasApiKey()) {
    throw new Error('CurseForge API key is missing. Set VITE_CURSEFORGE_API_KEY before using CurseForge.');
  }

  const url = new URL(`${CURSEFORGE_API_BASE}${path}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'x-api-key': CURSEFORGE_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`CurseForge request failed: ${response.status}`);
  }

  const payload = (await response.json()) as CurseForgeEnvelope<T>;
  return payload.data;
};

export const searchCurseForge = async (
  params: SearchParams
): Promise<{ hits: OreProjectSummary[]; total_hits: number }> => {
  const projectType = params.projectType || 'mod';
  const classId = PROJECT_TYPE_CLASS_ID[projectType];
  const isModTab = projectType === 'mod';
  const pageSize = params.limit || 20;
  const data = await curseForgeFetch<CurseForgeMod[]>('/mods/search', {
    gameId: MINECRAFT_GAME_ID,
    classId,
    searchFilter: params.query || undefined,
    sortField: mapSortField(params.sort),
    sortOrder: 'desc',
    index: params.offset || 0,
    pageSize,
    gameVersion: params.version || undefined,
    modLoaderType: isModTab ? LOADER_TYPE_MAP[params.loader || ''] : undefined,
    categoryId: params.category || undefined
  });

  return {
    hits: data.map(mapProjectSummary),
    total_hits: (params.offset || 0) + data.length + (data.length === pageSize ? 1 : 0)
  };
};

export const getCurseForgeProjectDetails = async (projectId: string): Promise<OreProjectDetail> => {
  const data = await curseForgeFetch<CurseForgeMod>(`/mods/${projectId}`);
  return mapProjectDetail(data);
};

export const fetchCurseForgeVersions = async (
  projectId: string,
  gameVersion?: string,
  loader?: string
): Promise<OreProjectVersion[]> => {
  const data = await curseForgeFetch<CurseForgeFile[]>(`/mods/${projectId}/files`, {
    gameVersion: gameVersion || undefined,
    modLoaderType: LOADER_TYPE_MAP[loader || ''],
    pageSize: 50
  });

  return data
    .map(mapProjectVersion)
    .filter((item): item is OreProjectVersion => !!item)
    .sort((a, b) => new Date(b.date_published).getTime() - new Date(a.date_published).getTime());
};

const mapVersionLabel = (item: Record<string, unknown>) => {
  const raw = String(item.versionString || item.name || item.slug || '');
  return raw.trim();
};

export const getCachedCurseForgeMinecraftVersions = async (): Promise<DropdownOption[]> => {
  const cacheKey = 'curseforge_minecraft_versions';
  const cached = await readSessionCache<DropdownOption[]>(cacheKey);
  if (cached?.length) return cached;

  const data = await curseForgeFetch<Record<string, unknown>[]>('/minecraft/version');
  const versions = normalizeGameVersions(data.map(mapVersionLabel))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }))
    .map((version) => ({ label: version, value: version }));

  await writeSessionCache(cacheKey, versions);
  return versions;
};

const shouldIncludeCategory = (category: CurseForgeCategory, classId: number) => {
  if (category.isClass) return false;
  if (category.classId !== classId) return false;
  const slug = (category.slug || '').toLowerCase();
  if (KNOWN_LOADERS.includes(slug)) return false;
  return true;
};

export interface CurseForgeCategoryOption extends DropdownOption {
  slug: string;
  translationKey?: string;
  defaultLabel?: string;
}

export const getCachedCurseForgeCategories = async (
  projectType: DownloadTabType
): Promise<CurseForgeCategoryOption[]> => {
  const classId = PROJECT_TYPE_CLASS_ID[projectType];
  const cacheKey = `curseforge_categories_${projectType}`;
  const cached = await readPersistentCache<CurseForgeCategoryOption[]>(cacheKey);
  if (cached?.length) return cached.map(hydrateCurseForgeCategoryOption);

  const data = await curseForgeFetch<CurseForgeCategory[]>('/categories', {
    gameId: MINECRAFT_GAME_ID,
    classId
  });

  const categories = data
    .filter((category) => shouldIncludeCategory(category, classId))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((category) => hydrateCurseForgeCategoryOption({
      label: category.name,
      value: String(category.id),
      slug: category.slug || category.name
    }));

  await writePersistentCache(cacheKey, categories);
  return categories;
};
