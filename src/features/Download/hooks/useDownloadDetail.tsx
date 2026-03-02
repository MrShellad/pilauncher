// /src/features/Download/hooks/useDownloadDetail.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { getProjectDetails, fetchModrinthVersions, type OreProjectDetail, type OreProjectVersion, type ModrinthProject } from '../../InstanceDetail/logic/modrinthApi';

import fabricIcon from '../../../assets/icons/tags/loaders/fabric.svg';
import forgeIcon from '../../../assets/icons/tags/loaders/forge.svg';
import neoforgeIcon from '../../../assets/icons/tags/loaders/neoforge.svg';
import quiltIcon from '../../../assets/icons/tags/loaders/quilt.svg';
import liteloaderIcon from '../../../assets/icons/tags/loaders/liteloader.svg';

const loaderIconMap: Record<string, string> = {
  fabric: fabricIcon, forge: forgeIcon, neoforge: neoforgeIcon, quilt: quiltIcon, liteloader: liteloaderIcon
};

export const useDownloadDetail = (
  project: ModrinthProject | null, 
  instanceConfig: any,
  searchMcVersion?: string, 
  searchLoader?: string     
) => {
  const [details, setDetails] = useState<OreProjectDetail | null>(null);
  const [versions, setVersions] = useState<OreProjectVersion[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);

  const [activeLoader, setActiveLoader] = useState<string>('');
  const [activeVersion, setActiveVersion] = useState<string>('');

  // 1. 初始化读取：提取真实的 ID，防止发送 undefined 导致 Rust 崩溃
  useEffect(() => {
    if (project) {
      // ✅ 终极双保险防御：同时兼容 id 和 project_id
      const projectId = project.id || (project as any).project_id;
      if (!projectId) return; 

      const preferredVer = searchMcVersion || instanceConfig?.game_version || instanceConfig?.gameVersion || '';
      const preferredLoader = (searchLoader || instanceConfig?.loader_type || instanceConfig?.loaderType || '').toLowerCase();
      
      setActiveVersion(preferredVer);
      setActiveLoader(preferredLoader === 'vanilla' ? '' : preferredLoader);

      setIsLoadingDetails(true);
      getProjectDetails(projectId)
        .then(setDetails)
        .catch(console.error)
        .finally(() => setIsLoadingDetails(false));
    }
  }, [project, instanceConfig, searchMcVersion, searchLoader]);

  // 2. 核心纠偏拦截
  useEffect(() => {
    if (details) {
      if (activeLoader && !details.loaders.includes(activeLoader)) setActiveLoader('');
      if (activeVersion && !details.game_versions.includes(activeVersion)) setActiveVersion('');
    }
  }, [details, activeLoader, activeVersion]);

  // 3. 拉取版本列表
  useEffect(() => {
    if (project) {
      const projectId = project.id || (project as any).project_id;
      if (!projectId) return;

      setIsLoadingVersions(true);
      fetchModrinthVersions(projectId, activeVersion, activeLoader)
        .then(data => {
          setVersions(data || []);
          setTimeout(() => setFocus('download-modal-versions-list'), 100);
        })
        .catch(console.error)
        .finally(() => setIsLoadingVersions(false));
    }
  }, [project, activeVersion, activeLoader]);

  // 4. 动态计算 Loader
  const loaderOptions = useMemo(() => {
    const options: any[] = [{ label: '所有 Loader', value: '' }];
    if (!details) return options; 

    const uniqueLoaders = Array.from(new Set((details.loaders || []).filter(Boolean)));

    uniqueLoaders.forEach((loader: string) => {
      const l = loader.toLowerCase();
      const icon = loaderIconMap[l];
      const Name = l === 'neoforge' ? 'NeoForge' : l.charAt(0).toUpperCase() + l.slice(1);

      options.push({
        label: (
          <div className="flex items-center justify-center">
            {icon && <img src={icon} className="w-4 h-4 mr-2 object-contain" alt={l} />}
            {Name}
          </div>
        ),
        value: l
      });
    });
    return options;
  }, [details]);

  // 5. 动态计算版本
  const availableVersions = useMemo(() => {
    if (!details) return [];
    
    const set = new Set<string>(details.game_versions || []);
    
    return Array.from(set).sort((a, b) => {
      const pa = a.split('.').map(Number);
      const pb = b.split('.').map(Number);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
         const na = pa[i] || 0;
         const nb = pb[i] || 0;
         if (na !== nb) return nb - na;
      }
      return 0;
    });
  }, [details]);

  return {
    details, versions, isLoadingDetails, isLoadingVersions,
    activeLoader, setActiveLoader, activeVersion, setActiveVersion,
    loaderOptions, availableVersions
  };
};