// /src/features/InstanceDetail/logic/modrinthApi.ts
import { invoke } from '@tauri-apps/api/core';

// ==========================================
// 1. 搜索列表原始模型
// ==========================================
export interface ModrinthProject {
  id: string; 
  slug: string;
  title: string;
  description: string;
  icon_url: string;
  author: string;
  downloads: number;
  date_modified: string;
  client_side: string;
  server_side: string;
  follows?: number;
  loaders?: string[];
  categories?: string[];
  display_categories?: string[];
  source?: 'modrinth' | 'curseforge';
  project_id?: string;
  gallery_urls?: string[];
}

const toModrinthProject = (detail: OreProjectDetail): ModrinthProject => ({
  id: detail.id,
  project_id: detail.id,
  slug: detail.id,
  title: detail.title,
  description: detail.description,
  icon_url: detail.icon_url || '',
  author: detail.author,
  downloads: detail.downloads,
  date_modified: detail.updated_at,
  client_side: detail.client_side,
  server_side: detail.server_side,
  follows: detail.followers,
  loaders: detail.loaders,
  categories: detail.loaders,
  display_categories: detail.loaders,
  source: 'modrinth',
  gallery_urls: detail.gallery_urls
});

export interface SearchParams {
  query: string;
  version?: string;
  loader?: string;
  category?: string;
  sort?: 'relevance' | 'downloads' | 'updated' | 'newest';
  projectType?: 'mod' | 'resourcepack' | 'shader' | 'modpack';
  limit?: number;
  offset?: number;
}

export const searchModrinth = async (params: SearchParams): Promise<{ hits: ModrinthProject[], total_hits: number }> => {
  const url = new URL('https://api.modrinth.com/v2/search');
  url.searchParams.append('query', params.query);
  url.searchParams.append('limit', (params.limit || 20).toString());
  url.searchParams.append('offset', (params.offset || 0).toString());

  const sortMap = { relevance: 'relevance', downloads: 'downloads', updated: 'updated', newest: 'newest' };
  url.searchParams.append('index', sortMap[params.sort || 'relevance']);

  const facets: string[][] = [];
  facets.push([`project_type:${params.projectType || 'mod'}`]);
  if (params.version) facets.push([`versions:${params.version}`]);
  if (params.loader && params.loader !== 'Vanilla') facets.push([`categories:${params.loader.toLowerCase()}`]);
  if (params.category) facets.push([`categories:${params.category}`]);

  url.searchParams.append('facets', JSON.stringify(facets));

  const data = await invoke<{ hits: any[], total_hits: number }>('proxy_fetch', {
    url: url.toString(),
    method: 'GET',
    headers: { Accept: 'application/json' }
  });

  data.hits = data.hits.map((hit: any) => ({
    ...hit,
    id: hit.project_id || hit.id 
  }));

  return data;
};

// ==========================================
// 2. 严格对齐 Rust domain 的自有内部模型
// ==========================================
export interface OreProjectDetail {
  id: string;
  title: string;
  author: string;
  description: string;
  icon_url: string | null;
  client_side: string;
  server_side: string;
  downloads: number;
  followers: number;
  updated_at: string;
  loaders: string[];
  game_versions: string[];
  gallery_urls: string[]; 
}

// ✅ 新增：定义依赖项数据结构
export interface OreProjectDependency {
  version_id: string | null;
  project_id: string | null;
  file_name: string | null;
  dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded';
}

export interface OreProjectVersion {
  id: string;
  project_id?: string;
  name: string;
  version_number: string;
  date_published: string;
  loaders: string[];
  game_versions: string[];
  file_name: string;      
  download_url: string;   
  dependencies?: OreProjectDependency[]; // ✅ 注入依赖字段
}

interface ModrinthRawVersionFile {
  url: string;
  filename: string;
  primary: boolean;
}

interface ModrinthRawVersion {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
  date_published: string;
  loaders: string[];
  game_versions: string[];
  files: ModrinthRawVersionFile[];
  dependencies?: OreProjectDependency[];
}

// ==========================================
// 3. 调用 Rust 后端
// ==========================================

export const getProjectDetails = async (projectId: string): Promise<OreProjectDetail> => {
  return await invoke<OreProjectDetail>('get_ore_project_detail', { projectId });
};

export const fetchModrinthProjectById = async (projectId: string): Promise<ModrinthProject> => {
  const detail = await getProjectDetails(projectId);
  return toModrinthProject(detail);
};

export const fetchModrinthVersions = async (projectId: string, gameVersion?: string, loader?: string): Promise<OreProjectVersion[]> => {
  return await invoke<OreProjectVersion[]>('get_ore_project_versions', { 
    projectId, 
    gameVersion: gameVersion || null, 
    loader: loader || null 
  });
};

const mapModrinthRawVersion = (version: ModrinthRawVersion): OreProjectVersion | null => {
  const primaryFile = version.files.find((file) => file.primary) || version.files[0];
  if (!primaryFile) return null;

  return {
    id: version.id,
    project_id: version.project_id,
    name: version.name,
    version_number: version.version_number,
    date_published: version.date_published,
    loaders: version.loaders,
    game_versions: version.game_versions,
    file_name: primaryFile.filename,
    download_url: primaryFile.url,
    dependencies: version.dependencies
  };
};

export const matchModrinthVersionsByHashes = async (
  hashes: string[],
  algorithm: 'sha1' | 'sha512' = 'sha1'
): Promise<Record<string, OreProjectVersion>> => {
  if (hashes.length === 0) return {};

  const payload = await invoke<Record<string, ModrinthRawVersion>>('proxy_fetch', {
    url: 'https://api.modrinth.com/v2/version_files',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ hashes, algorithm })
  });
  const mapped: Record<string, OreProjectVersion> = {};

  Object.entries(payload).forEach(([hash, version]) => {
    const cleanVersion = mapModrinthRawVersion(version);
    if (cleanVersion) {
      mapped[hash] = cleanVersion;
    }
  });

  return mapped;
};

export const fetchModrinthInfo = async (query: string): Promise<ModrinthProject | null> => {
  try {
    const data = await searchModrinth({ query, limit: 1 });
    return data.hits.length > 0 ? data.hits[0] : null;
  } catch { return null; }
};
