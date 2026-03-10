import { useEffect, useMemo, useState } from 'react';

import { getProjectDetails, fetchModrinthVersions, type ModrinthProject, type OreProjectDetail, type OreProjectVersion } from '../../InstanceDetail/logic/modrinthApi';
import type { ToggleOption } from '../../../ui/primitives/OreToggleButton';

import fabricIcon from '../../../assets/icons/tags/loaders/fabric.svg';
import forgeIcon from '../../../assets/icons/tags/loaders/forge.svg';
import neoforgeIcon from '../../../assets/icons/tags/loaders/neoforge.svg';
import quiltIcon from '../../../assets/icons/tags/loaders/quilt.svg';
import liteloaderIcon from '../../../assets/icons/tags/loaders/liteloader.svg';

const loaderIconMap: Record<string, string> = {
  fabric: fabricIcon,
  forge: forgeIcon,
  neoforge: neoforgeIcon,
  quilt: quiltIcon,
  liteloader: liteloaderIcon
};

interface DownloadInstanceConfig {
  game_version?: string;
  gameVersion?: string;
  loader_type?: string;
  loaderType?: string;
}

const getProjectId = (project: ModrinthProject | null) => {
  const extendedProject = project as (ModrinthProject & { project_id?: string }) | null;
  return extendedProject?.id || extendedProject?.project_id || '';
};

export const useDownloadDetail = (
  project: ModrinthProject | null,
  instanceConfig: DownloadInstanceConfig | null,
  searchMcVersion?: string,
  searchLoader?: string
) => {
  const [details, setDetails] = useState<OreProjectDetail | null>(null);
  const [versions, setVersions] = useState<OreProjectVersion[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [activeLoader, setActiveLoader] = useState('');
  const [activeVersion, setActiveVersion] = useState('');

  useEffect(() => {
    if (!project) return;

    const projectId = getProjectId(project);
    if (!projectId) return;

    const preferredVersion = searchMcVersion || instanceConfig?.game_version || instanceConfig?.gameVersion || '';
    const preferredLoader = (searchLoader || instanceConfig?.loader_type || instanceConfig?.loaderType || '').toLowerCase();

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveVersion(preferredVersion);
    setActiveLoader(preferredLoader === 'vanilla' ? '' : preferredLoader);
    setIsLoadingDetails(true);

    getProjectDetails(projectId)
      .then(setDetails)
      .catch(console.error)
      .finally(() => setIsLoadingDetails(false));
  }, [project, instanceConfig, searchMcVersion, searchLoader]);

  useEffect(() => {
    if (!details) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activeLoader && !details.loaders.includes(activeLoader)) setActiveLoader('');
    if (activeVersion && !details.game_versions.includes(activeVersion)) setActiveVersion('');
  }, [details, activeLoader, activeVersion]);

  useEffect(() => {
    if (!project) return;

    const projectId = getProjectId(project);
    if (!projectId) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoadingVersions(true);
    fetchModrinthVersions(projectId, activeVersion, activeLoader)
      .then((data) => setVersions(data || []))
      .catch(console.error)
      .finally(() => setIsLoadingVersions(false));
  }, [project, activeVersion, activeLoader]);

  const loaderOptions = useMemo<ToggleOption[]>(() => {
    const options: ToggleOption[] = [{ label: '全部 Loader', value: '' }];
    if (!details) return options;

    const uniqueLoaders = Array.from(new Set((details.loaders || []).filter(Boolean)));
    uniqueLoaders.forEach((loader) => {
      const normalized = loader.toLowerCase();
      const icon = loaderIconMap[normalized];
      const name = normalized === 'neoforge' ? 'NeoForge' : normalized.charAt(0).toUpperCase() + normalized.slice(1);

      options.push({
        label: (
          <div className="flex items-center justify-center">
            {icon && <img src={icon} className="mr-2 h-4 w-4 object-contain" alt={normalized} />}
            {name}
          </div>
        ),
        value: normalized
      });
    });

    return options;
  }, [details]);

  const availableVersions = useMemo(() => {
    if (!details) return [];

    const versionSet = new Set<string>(details.game_versions || []);

    return Array.from(versionSet).sort((a, b) => {
      const pa = a.split('.').map(Number);
      const pb = b.split('.').map(Number);

      for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
        const na = pa[i] || 0;
        const nb = pb[i] || 0;
        if (na !== nb) return nb - na;
      }

      return 0;
    });
  }, [details]);

  return {
    details,
    versions,
    isLoadingDetails,
    isLoadingVersions,
    activeLoader,
    setActiveLoader,
    activeVersion,
    setActiveVersion,
    loaderOptions,
    availableVersions
  };
};
