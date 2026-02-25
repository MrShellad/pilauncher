// /src/hooks/pages/Instances/useCustomInstance.ts
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
  // ✅ 将硬编码改为默认空字符串，后续通过 useEffect 动态加载
  const [savePath, setSavePath] = useState(''); 
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

  // ✅ 新增：组件挂载时，获取用户配置的全局基础目录
  useEffect(() => {
    const fetchBasePath = async () => {
      try {
        const basePath = await invoke<string | null>('get_base_directory');
        if (basePath) {
          // 自动判断系统的路径分隔符（Windows 是 \，macOS/Linux 是 /）
          const separator = basePath.includes('\\') ? '\\' : '/';
          setSavePath(`${basePath}${separator}instances`);
        }
      } catch (error) {
        console.error("获取基础目录失败:", error);
      }
    };
    fetchBasePath();
  }, []);

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
        if (versionType === 'rc') return v.id.includes('-rc');
        if (versionType === 'pre') return v.id.includes('-pre');
        if (versionType === 'release') return v.type === 'release';
        if (versionType === 'snapshot') {
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
    if (step === 2 && loaderType !== 'Vanilla' && gameVersion) {
      const fetchLoaders = async () => {
        try {
          setIsLoadingLoaders(true);
          setLoaderVersions([]); 
          
          const data = await invoke<string[]>('get_loader_versions', { 
            loaderType: loaderType, 
            gameVersion: gameVersion 
          });
          
          setLoaderVersions(data);
          
          if (data.length > 0) {
            setLoaderVersion(data[0]);
          } else {
            setLoaderVersion(null); 
          }
        } catch (error) {
          console.error("获取引导器版本失败:", error);
        } finally {
          setIsLoadingLoaders(false);
        }
      };
      
      fetchLoaders();
    }
  }, [step, loaderType, gameVersion]); 

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
      cover_image: coverImage, // ✅ 补全被遗漏的封面图路径
    };
    await invoke('create_instance', { payload });
  };

  return {
    step, direction, instanceName, setInstanceName, folderName, setFolderName,
    save_path: savePath, setSavePath, coverImage, setCoverImage, gameVersion, setGameVersion,
    versionType, setVersionType, loaderType, setLoaderType, loaderVersion, setLoaderVersion,
    filteredVersionGroups, loaderVersions, isLoadingVersions, isLoadingLoaders,
    handleNextStep, handlePrevStep, handleCreate, handleRefreshVersions, handleOpenWiki,
  };
};