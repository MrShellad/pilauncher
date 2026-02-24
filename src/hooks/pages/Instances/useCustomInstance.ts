import { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
export type McVersionType = 'release' | 'snapshot' | 'rc' | 'pre' | 'special';
export interface McVersion {
  id: string;
  type: string;
  release_time: string;
  wiki_url: string;
}

export interface VersionGroup {
  group_name: string;
  versions: McVersion[];
}

export const useCustomInstance = () => {
  const [step, setStep] = useState<number>(1);
  const [direction, setDirection] = useState(1);

  // --- 表单状态 ---
  const [instanceName, setInstanceName] = useState('');
  const [folderName, setFolderName] = useState('');
  const [savePath, setSavePath] = useState('C:/OreLauncher/instances');
  const [coverImage, setCoverImage] = useState<string | null>(null);

  // --- 游戏参数 ---
  const [gameVersion, setGameVersion] = useState<string | null>(null);
  const [versionType, setVersionType] = useState<McVersionType>('release');
  const [loaderType, setLoaderType] = useState<'Vanilla' | 'Fabric' | 'Forge' | 'NeoForge'>('Vanilla');
  const [loaderVersion, setLoaderVersion] = useState<string | null>('Vanilla');

  // --- 版本与加载状态 ---
  const [versionGroups, setVersionGroups] = useState<VersionGroup[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [loaderVersions, setLoaderVersions] = useState<string[]>([]);
  const [isLoadingLoaders, setIsLoadingLoaders] = useState(false);

  // 1. 获取 MC 版本列表 (带缓存/强制刷新逻辑)
  const fetchVersions = async (force: boolean = false) => {
    try {
      setIsLoadingVersions(true);
      const data = await invoke<VersionGroup[]>('get_minecraft_versions', { force });
      setVersionGroups(data);
    } catch (error) {
      console.error("获取版本列表失败:", error);
    } finally {
      setIsLoadingVersions(false);
    }
  };

  useEffect(() => {
    fetchVersions(false);
  }, []);

  const handleRefreshVersions = () => fetchVersions(true);

  // 根据类型过滤版本
  const filteredVersionGroups = useMemo(() => {
    return versionGroups.map(g => ({
      ...g,
      versions: g.versions.filter(v => {
        // 根据 ID 特征和后端分类逻辑进行匹配
        if (versionType === 'rc') return v.id.includes('-rc');
        if (versionType === 'pre') return v.id.includes('-pre');
        if (versionType === 'release') return v.type === 'release';
        if (versionType === 'snapshot') {
          // 排除掉 rc 和 pre 的普通快照
          return v.type === 'snapshot' && !v.id.includes('-rc') && !v.id.includes('-pre');
        }
        return v.type === 'special' || (v.type !== 'release' && v.type !== 'snapshot');
      })
    })).filter(g => g.versions.length > 0);
  }, [versionGroups, versionType]);
  // 4. Wiki 跳转处理
  const handleOpenWiki = (url: string) => {
    if (url) window.open(url, '_blank');
  };
  // 2. 获取 Loader 版本逻辑
useEffect(() => {
    // 只有在第二步，并且不是纯净原版，且已经选择了游戏版本时才发起请求
    if (step === 2 && loaderType !== 'Vanilla' && gameVersion) {
      const fetchLoaders = async () => {
        try {
          setIsLoadingLoaders(true);
          setLoaderVersions([]); // 清空旧列表，防止误导
          
          // 调用 Rust 的 Loader 抓取指令
          const data = await invoke<string[]>('get_loader_versions', { 
            loaderType: loaderType, 
            gameVersion: gameVersion 
          });
          
          setLoaderVersions(data);
          
          // 如果有版本返回，默认选中最新的（数组第一个）
          if (data.length > 0) {
            setLoaderVersion(data[0]);
          } else {
            setLoaderVersion(null); // 该游戏版本没有此 Loader
          }
        } catch (error) {
          console.error("获取引导器版本失败:", error);
        } finally {
          setIsLoadingLoaders(false);
        }
      };
      
      fetchLoaders();
    }
  }, [step, loaderType, gameVersion]); // 依赖项包含 gameVersion，确保游戏版本改变时更新 Loader



  
  // 3. 自动生成文件夹名称逻辑
  useEffect(() => {
    if (gameVersion) {
      const now = new Date();
      const ts = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
      const lType = loaderType;
      const lVer = loaderType === 'Vanilla' ? '' : `_${loaderVersion}`;
      setFolderName(`${gameVersion}_${lType}${lVer}_${ts}`);
    }
  }, [gameVersion, loaderType, loaderVersion]);

  const handleNextStep = () => { setDirection(1); setStep(s => s + 1); };
  const handlePrevStep = () => { setDirection(-1); setStep(s => s - 1); };

  const handleCreate = async () => {
    const payload = {
      name: instanceName || folderName,
      folder_name: folderName,
      game_version: gameVersion,
      loader_type: loaderType,
      loader_version: loaderVersion,
      save_path: savePath,
    };
    await invoke('create_instance', { payload });
  };

  return {
    step, direction, instanceName, setInstanceName, folderName, setFolderName,
    save_path: savePath, setSavePath, coverImage, setCoverImage, gameVersion, setGameVersion,
    versionType, setVersionType, loaderType, setLoaderType, loaderVersion, setLoaderVersion,
    filteredVersionGroups, loaderVersions, isLoadingVersions, isLoadingLoaders,
    handleNextStep, handlePrevStep, handleCreate, handleRefreshVersions,handleOpenWiki,
  };
};