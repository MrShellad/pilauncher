// /src/features/InstanceDetail/logic/modrinthApi.ts

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
}

export interface SearchParams {
  query: string;
  version?: string;
  loader?: string;
  category?: string;
  sort?: 'relevance' | 'downloads' | 'updated' | 'newest';
  projectType?: 'mod' | 'resourcepack' | 'shader';
  limit?: number;
  offset?: number;
}

// 1. 高级搜索接口
export const searchModrinth = async (params: SearchParams): Promise<{ hits: ModrinthProject[], total_hits: number }> => {
  const url = new URL('https://api.modrinth.com/v2/search');
  url.searchParams.append('query', params.query);
  url.searchParams.append('limit', (params.limit || 20).toString());
  url.searchParams.append('offset', (params.offset || 0).toString());

  // 排序映射
  const sortMap = { relevance: 'relevance', downloads: 'downloads', updated: 'updated', newest: 'newest' };
  url.searchParams.append('index', sortMap[params.sort || 'relevance']);

  // 构建核心过滤条件 (Facets)
  const facets: string[][] = [];
  facets.push([`project_type:${params.projectType || 'mod'}`]);
  if (params.version) facets.push([`versions:${params.version}`]);
  if (params.loader && params.loader !== 'Vanilla') facets.push([`categories:${params.loader.toLowerCase()}`]);
  if (params.category) facets.push([`categories:${params.category}`]);

  url.searchParams.append('facets', JSON.stringify(facets));

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Modrinth 搜索失败');
  return await res.json();
};

// 2. 获取单个项目的详细 Markdown 描述
export const getProjectDetails = async (projectId: string) => {
  const res = await fetch(`https://api.modrinth.com/v2/project/${projectId}`);
  if (!res.ok) throw new Error('获取详情失败');
  return await res.json();
};

// 3. 获取版本列表 (已有的接口，稍作完善)
export const fetchModrinthVersions = async (projectId: string, gameVersion?: string, loader?: string): Promise<any[]> => {
  const params = new URLSearchParams();
  if (loader && loader.toLowerCase() !== 'vanilla') params.append('loaders', JSON.stringify([loader.toLowerCase()]));
  if (gameVersion) params.append('game_versions', JSON.stringify([gameVersion]));
  
  const res = await fetch(`https://api.modrinth.com/v2/project/${projectId}/version?${params.toString()}`);
  if (!res.ok) return [];
  return await res.json();
};

// 兼容旧版的快捷查询
export const fetchModrinthInfo = async (query: string): Promise<ModrinthProject | null> => {
  try {
    const data = await searchModrinth({ query, limit: 1 });
    return data.hits.length > 0 ? data.hits[0] : null;
  } catch { return null; }
};