import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  fetchCurseForgeVersions,
  getCurseForgeProjectDetails
} from '../logic/curseforgeApi';
import {
  fetchModrinthVersions,
  getProjectDetails,
  type ModrinthProject,
  type OreProjectDetail,
  type OreProjectVersion
} from '../../InstanceDetail/logic/modrinthApi';
import type { ToggleOption } from '../../../ui/primitives/OreToggleButton';
import type { DownloadInstanceConfig, DownloadSource } from './useResourceDownload';

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

const getProjectId = (project: ModrinthProject | null) => {
  const extendedProject = project as (ModrinthProject & { project_id?: string }) | null;
  return extendedProject?.id || extendedProject?.project_id || '';
};

export const useDownloadDetail = (
  project: ModrinthProject | null,
  instanceConfig: DownloadInstanceConfig | null,
  source: DownloadSource,
  searchMcVersion?: string,
  searchLoader?: string
) => {
  const { t } = useTranslation();
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

    setActiveVersion(preferredVersion);
    setActiveLoader(preferredLoader === 'vanilla' ? '' : preferredLoader);
    setIsLoadingDetails(true);

    const request = source === 'curseforge'
      ? getCurseForgeProjectDetails(projectId)
      : getProjectDetails(projectId);

    request
      .then(setDetails)
      .catch(console.error)
      .finally(() => setIsLoadingDetails(false));
  }, [instanceConfig, project, searchLoader, searchMcVersion, source]);

  useEffect(() => {
    if (!details) return;

    if (activeLoader && !details.loaders.includes(activeLoader)) setActiveLoader('');
    if (activeVersion && !details.game_versions.includes(activeVersion)) setActiveVersion('');
  }, [activeLoader, activeVersion, details]);

  useEffect(() => {
    if (!project) return;

    const projectId = getProjectId(project);
    if (!projectId) return;

    setIsLoadingVersions(true);

    const request = source === 'curseforge'
      ? fetchCurseForgeVersions(projectId, activeVersion, activeLoader)
      : fetchModrinthVersions(projectId, activeVersion, activeLoader);

    request
      .then((data) => setVersions(data || []))
      .catch(console.error)
      .finally(() => setIsLoadingVersions(false));
  }, [activeLoader, activeVersion, project, source]);

  const loaderOptions = useMemo<ToggleOption[]>(() => {
    const options: ToggleOption[] = [
      { label: t('download.filters.loaderAll', { defaultValue: 'All Loaders' }), value: '' }
    ];

    if (!details) return options;

    const uniqueLoaders = Array.from(new Set((details.loaders || []).filter(Boolean)));
    uniqueLoaders.forEach((loader) => {
      const normalized = loader.toLowerCase();
      const icon = loaderIconMap[normalized];
      const label = t(`download.tags.loader.${normalized}`, {
        defaultValue: normalized === 'neoforge'
          ? 'NeoForge'
          : normalized.charAt(0).toUpperCase() + normalized.slice(1)
      });

      options.push({
        label: (
          <div className="flex items-center justify-center">
            {icon && <img src={icon} className="mr-2 h-4 w-4 object-contain" alt={normalized} />}
            {label}
          </div>
        ),
        value: normalized
      });
    });

    return options;
  }, [details, t]);

  const availableVersions = useMemo(() => {
    if (!details) return [];

    const versionSet = new Set<string>(details.game_versions || []);
    versions.forEach((version) => version.game_versions.forEach((item) => versionSet.add(item)));

    return Array.from(versionSet).sort((a, b) => {
      const pa = a.split('.').map(Number);
      const pb = b.split('.').map(Number);

      for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
        const na = pa[i] || 0;
        const nb = pb[i] || 0;
        if (na !== nb) return nb - na;
      }

      return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [details, versions]);

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
