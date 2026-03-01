// /src/features/InstanceDetail/logic/modrinthApi.ts
export interface ModrinthProject {
  id: string;
  title: string;
  description: string;
  icon_url: string;
}

export const fetchModrinthInfo = async (query: string): Promise<ModrinthProject | null> => {
  try {
    const res = await fetch(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&limit=1`);
    const data = await res.json();
    if (data.hits && data.hits.length > 0) {
      return data.hits[0];
    }
    return null;
  } catch (error) {
    console.error("Modrinth API 请求失败", error);
    return null;
  }
};

// ✅ 新增：根据项目 ID、游戏版本、加载器类型，获取具体的版本列表
export const fetchModrinthVersions = async (projectId: string, gameVersion: string, loader: string): Promise<any[]> => {
  try {
    const params = new URLSearchParams();
    if (loader && loader.toLowerCase() !== 'vanilla') {
      let l = loader.toLowerCase();
      if (l === 'neoforge') l = 'neoforge'; // 适配 NeoForge 命名
      params.append('loaders', JSON.stringify([l]));
    }
    if (gameVersion) {
      params.append('game_versions', JSON.stringify([gameVersion]));
    }
    const res = await fetch(`https://api.modrinth.com/v2/project/${projectId}/version?${params.toString()}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error("Modrinth Versions API 请求失败", error);
    return [];
  }
};