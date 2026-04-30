import {
  filterVersionGroups,
  normalizeLoaderType,
  normalizeLoaderVersion,
  sortLoaderVersionsDesc,
  type LoaderType,
  type McVersionType,
  type VersionGroup,
} from '../../../../../Instances/logic/environmentSelection';
import type { InstanceEnvironmentUpdate } from '../schemas/basicPanelSchemas';

interface CurrentEnvironmentInput {
  currentGameVersion?: string;
  currentLoaderType?: string;
  currentLoaderVersion?: string;
}

interface CurrentEnvironmentState {
  currentGameVersionValue: string;
  normalizedCurrentLoader: LoaderType;
  normalizedCurrentLoaderVersion: string;
}

interface LoaderVersionSelectionInput {
  previousLoaderVersion: string | null;
  sortedLoaderVersions: string[];
  loaderType: LoaderType;
  normalizedCurrentLoader: LoaderType;
  normalizedCurrentLoaderVersion: string;
}

interface EnvironmentChangeInput {
  gameVersion: string;
  loaderType: LoaderType;
  targetLoaderVersion: string;
  currentGameVersionValue: string;
  normalizedCurrentLoader: LoaderType;
  normalizedCurrentLoaderVersion: string;
}

interface CanApplyEnvironmentInput {
  gameVersion: string;
  loaderType: LoaderType;
  targetLoaderVersion: string;
  isLoadingVersions: boolean;
  isLoadingLoaders: boolean;
  hasEnvironmentChanged: boolean;
}

export const getCurrentEnvironmentState = ({
  currentGameVersion,
  currentLoaderType,
  currentLoaderVersion,
}: CurrentEnvironmentInput): CurrentEnvironmentState => {
  const normalizedCurrentLoader = normalizeLoaderType(currentLoaderType);

  return {
    currentGameVersionValue: currentGameVersion || '',
    normalizedCurrentLoader,
    normalizedCurrentLoaderVersion: normalizeLoaderVersion(
      normalizedCurrentLoader,
      currentLoaderVersion,
    ),
  };
};

export const getFilteredEnvironmentVersionGroups = (
  versionGroups: VersionGroup[],
  versionType: McVersionType,
) => filterVersionGroups(versionGroups, versionType);

export const getSortedEnvironmentLoaderVersions = (versions: string[]) =>
  sortLoaderVersionsDesc(versions);

export const getSelectedLoaderVersion = ({
  previousLoaderVersion,
  sortedLoaderVersions,
  loaderType,
  normalizedCurrentLoader,
  normalizedCurrentLoaderVersion,
}: LoaderVersionSelectionInput): string | null => {
  if (previousLoaderVersion && sortedLoaderVersions.includes(previousLoaderVersion)) {
    return previousLoaderVersion;
  }

  if (
    normalizedCurrentLoader === loaderType &&
    sortedLoaderVersions.includes(normalizedCurrentLoaderVersion)
  ) {
    return normalizedCurrentLoaderVersion;
  }

  return sortedLoaderVersions[0] || null;
};

export const getTargetLoaderVersion = (
  loaderType: LoaderType,
  loaderVersion?: string | null,
) => normalizeLoaderVersion(loaderType, loaderVersion);

export const hasEnvironmentChanged = ({
  gameVersion,
  loaderType,
  targetLoaderVersion,
  currentGameVersionValue,
  normalizedCurrentLoader,
  normalizedCurrentLoaderVersion,
}: EnvironmentChangeInput) =>
  gameVersion !== currentGameVersionValue ||
  loaderType !== normalizedCurrentLoader ||
  targetLoaderVersion !== normalizedCurrentLoaderVersion;

export const canApplyEnvironment = ({
  gameVersion,
  loaderType,
  targetLoaderVersion,
  isLoadingVersions,
  isLoadingLoaders,
  hasEnvironmentChanged: changed,
}: CanApplyEnvironmentInput) =>
  !!gameVersion &&
  !isLoadingVersions &&
  !isLoadingLoaders &&
  (loaderType === 'Vanilla' || !!targetLoaderVersion) &&
  changed;

export const getCurrentLoaderLabel = (
  normalizedCurrentLoader: LoaderType,
  normalizedCurrentLoaderVersion: string,
) =>
  normalizedCurrentLoader === 'Vanilla'
    ? 'Vanilla'
    : `${normalizedCurrentLoader} ${normalizedCurrentLoaderVersion || '-'}`;

export const createEnvironmentUpdate = (
  gameVersion: string,
  loaderType: LoaderType,
  loaderVersion: string,
): InstanceEnvironmentUpdate => ({
  gameVersion,
  loaderType,
  loaderVersion,
});

export const getNextCircularValue = <T extends string>(
  values: readonly T[],
  currentValue: T,
  direction: -1 | 1,
) => {
  const currentIndex = values.findIndex((value) => value === currentValue);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  return values[(safeIndex + direction + values.length) % values.length];
};

export const getFirstVersionFocusKey = (versionGroups: VersionGroup[]) => {
  const firstVersion = versionGroups[0]?.versions[0];
  return firstVersion ? `basic-env-version-${firstVersion.id}` : null;
};

export const getFirstLoaderFocusKey = (
  loaderType: LoaderType,
  loaderVersions: string[],
) => {
  if (loaderType === 'Vanilla') return 'basic-env-loader-vanilla-card';
  const firstVersion = loaderVersions[0];
  return firstVersion ? `basic-env-loader-${firstVersion}` : null;
};
