// /src/features/InstanceDetail/logic/modrinthApi.ts
import { invoke } from '@tauri-apps/api/core';

// ==========================================
// 1. 搜索列表原始模型
// ==========================================
export interface ModrinthProject {
  id: string; // 我们在搜索结果映射后保证这个字段存在
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
  categories?: string[];
  display_categories?: string[];
}

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

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Modrinth 搜索失败');
  
  const data = await res.json();

  // ✅ 核心修复：Modrinth 搜索接口返回的是 project_id，我们在这里统一映射为 id
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

export interface OreProjectVersion {
  id: string;
  name: string;
  version_number: string;
  date_published: string;
  loaders: string[];
  game_versions: string[];
  file_name: string;      
  download_url: string;   
}

// ==========================================
// 3. 调用 Rust 后端
// ==========================================

export const getProjectDetails = async (projectId: string): Promise<OreProjectDetail> => {
  return await invoke<OreProjectDetail>('get_ore_project_detail', { projectId });
};

export const fetchModrinthVersions = async (projectId: string, gameVersion?: string, loader?: string): Promise<OreProjectVersion[]> => {
  return await invoke<OreProjectVersion[]>('get_ore_project_versions', { 
    projectId, 
    gameVersion: gameVersion || null, 
    loader: loader || null 
  });
};

export const fetchModrinthInfo = async (query: string): Promise<ModrinthProject | null> => {
  try {
    const data = await searchModrinth({ query, limit: 1 });
    return data.hits.length > 0 ? data.hits[0] : null;
  } catch { return null; }
};