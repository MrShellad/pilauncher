export type McVersionType = 'release' | 'snapshot' | 'rc' | 'pre' | 'special';

export type LoaderType = 'Vanilla' | 'Fabric' | 'Forge' | 'NeoForge' | 'Quilt';

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

export const VERSION_TYPES: readonly McVersionType[] = ['release', 'snapshot', 'rc', 'pre', 'special'];

export const LOADER_TYPES: readonly LoaderType[] = ['Vanilla', 'NeoForge', 'Forge', 'Fabric', 'Quilt'];

export const sortLoaderVersionsDesc = (versions: string[]) =>
  [...versions].sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }));

export const filterVersionGroups = (
  versionGroups: VersionGroup[],
  versionType: McVersionType,
): VersionGroup[] =>
  versionGroups
    .map((group) => ({
      ...group,
      versions: group.versions.filter((version) => {
        if (versionType === 'rc') return version.id.includes('-rc');
        if (versionType === 'pre') return version.id.includes('-pre');
        if (versionType === 'release') return version.type === 'release';
        if (versionType === 'snapshot') {
          return version.type === 'snapshot' && !version.id.includes('-rc') && !version.id.includes('-pre');
        }
        return version.type === 'special' || (version.type !== 'release' && version.type !== 'snapshot');
      }),
    }))
    .filter((group) => group.versions.length > 0);

export const normalizeLoaderType = (loaderType?: string | null): LoaderType => {
  switch ((loaderType || '').trim().toLowerCase()) {
    case 'fabric':
      return 'Fabric';
    case 'forge':
      return 'Forge';
    case 'neoforge':
    case 'neo_forge':
    case 'neo-forge':
      return 'NeoForge';
    case 'quilt':
      return 'Quilt';
    default:
      return 'Vanilla';
  }
};

export const normalizeLoaderVersion = (loaderType: LoaderType, loaderVersion?: string | null) =>
  loaderType === 'Vanilla' ? 'Vanilla' : (loaderVersion || '').trim();

export const loaderTypeToPayload = (loaderType: LoaderType) =>
  loaderType === 'NeoForge' ? 'NeoForge' : loaderType;
