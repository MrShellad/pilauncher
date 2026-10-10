import type { DownloadSource } from '../../../../download';
import {
  getCurseForgeProjectDetails,
  getProjectDetails,
  type OreProjectDependency,
  type OreProjectDetail
} from '../../../../resource-catalog';
import type { InstalledModIndex } from '../../../../instance-resources';

export interface MissingDependencyInfo {
  id: string;
  name: string;
}

interface ResolveMissingDependenciesOptions {
  dependencies: OreProjectDependency[];
  activeSource: DownloadSource;
  identityIndex: InstalledModIndex;
  cacheProjectDetails: (projectId: string, details: OreProjectDetail) => void;
}

export const resolveMissingDependencies = async ({
  dependencies,
  activeSource,
  identityIndex,
  cacheProjectDetails
}: ResolveMissingDependenciesOptions): Promise<{
  entries: OreProjectDependency[];
  info: MissingDependencyInfo[];
}> => {
  const inspected = await Promise.all(
    dependencies.map(async (dependency) => {
      const dependencyId = dependency.project_id!;
      const exactMatch = identityIndex.matchDependency(
        { projectId: dependencyId },
        activeSource
      );
      if (exactMatch.status !== 'missing') return null;

      try {
        const detail = activeSource === 'curseforge'
          ? await getCurseForgeProjectDetails(dependencyId)
          : await getProjectDetails(dependencyId);
        cacheProjectDetails(dependencyId, detail);
        const localMatch = identityIndex.matchDependency(
          {
            projectId: dependencyId,
            slug: detail.slug,
            name: detail.title
          },
          activeSource
        );
        if (localMatch.status !== 'missing') return null;
        return {
          dependency,
          info: { id: dependencyId, name: detail.title }
        };
      } catch {
        return {
          dependency,
          info: { id: dependencyId, name: `未知前置 (${dependencyId})` }
        };
      }
    })
  );

  const missing = inspected.filter((item): item is NonNullable<typeof item> => item !== null);
  return {
    entries: missing.map((item) => item.dependency),
    info: missing.map((item) => item.info)
  };
};
