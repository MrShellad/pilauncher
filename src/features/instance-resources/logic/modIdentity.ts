import type { ModrinthProject } from '../../resource-catalog';
import type {
  InstalledDependencyMatch,
  InstanceVersionConfig,
  ModDependencyIdentity,
  ModMeta,
  ModMetadataPurpose,
  ModMetadataSettings,
  ModPlatformId,
  ModPlatformMatch,
} from './modTypes';

export const resolveInstanceGameVersion = (config?: InstanceVersionConfig | null): string => {
  return config?.game_version || config?.gameVersion || config?.mcVersion || '';
};

export const resolveInstanceLoader = (config?: InstanceVersionConfig | null): string => {
  const rawLoader = config?.loader;
  const loader = typeof rawLoader === 'string'
    ? rawLoader
    : rawLoader?.type || config?.loaderType || config?.loader_type || '';

  return loader && loader.toLowerCase() !== 'vanilla' ? loader.toLowerCase() : '';
};

const normalizeInstalledKey = (value?: string | null) => String(value || '').trim();

const GENERIC_MOD_STOPWORDS = new Set([
  'api', 'core', 'lib', 'library', 'mod', 'mods', 'client', 'server', 'addon',
  'addons', 'tool', 'tools', 'utils', 'util', 'utility', 'config', 'configuration',
  'gui', 'ui', 'hud', 'fps', 'fix', 'fixes', 'plus', 'extra', 'extras',
  'fabric', 'forge', 'neoforge', 'quilt', 'liteloader', 'vanilla',
  'optifine', 'patch', 'port', 'edition', 'reforged', 'fork', 'v1', 'v2', 'v3'
]);

const normalizeModIdentity = (value?: string | null): string => {
  let normalized = normalizeInstalledKey(value).toLowerCase();
  normalized = normalized.replace(/\.disabled$/i, '').replace(/\.(jar|zip)$/i, '');
  normalized = normalized.replace(/[-_+](?:fabric|forge|neoforge|quilt)(?=[-_+]|$).*$/i, '');
  normalized = normalized.replace(/[-_+]v?\d+(?:[._+-]\w+)*.*$/i, '');
  return normalized.replace(/[^a-z0-9]/g, '');
};

const getModIdentityVariants = (value?: string | null): string[] => {
  const normalized = normalizeModIdentity(value);
  if (!normalized || normalized.length <= 3 || GENERIC_MOD_STOPWORDS.has(normalized)) return [];

  const variants = new Set([normalized]);
  if (normalized.endsWith('v2') && normalized.length > 5) {
    const base = normalized.slice(0, -2);
    if (!GENERIC_MOD_STOPWORDS.has(base) && base.length > 3) variants.add(base);
  } else if (normalized.endsWith('2') && normalized.length > 4) {
    const base = normalized.slice(0, -1);
    if (!GENERIC_MOD_STOPWORDS.has(base) && base.length > 3) variants.add(base);
  }
  return [...variants];
};

export const getModPlatformReference = (
  mod: ModMeta,
  platform: ModPlatformId
): ModPlatformMatch | undefined => {
  const source = mod.manifestEntry?.source;
  const matched = mod.manifestEntry?.matchedPlatforms?.[platform];
  const sourcePlatform = source?.platform?.trim().toLowerCase();

  if (sourcePlatform === platform && (source?.projectId || source?.fileId)) {
    return {
      projectId: source.projectId || matched?.projectId,
      fileId: source.fileId || matched?.fileId
    };
  }

  return matched;
};

export const getModIdentityKey = (mod: ModMeta): string => {
  const source = mod.manifestEntry?.source;
  const references = [
    source,
    { platform: 'modrinth', ...mod.manifestEntry?.matchedPlatforms?.modrinth },
    { platform: 'curseforge', ...mod.manifestEntry?.matchedPlatforms?.curseforge }
  ];

  for (const reference of references) {
    if (reference?.platform && reference.projectId) {
      return `project:${reference.platform}:${reference.projectId}`;
    }
  }

  if (mod.modId) {
    return `mod:${mod.modId}`;
  }

  if (mod.cacheKey && !mod.cacheKey.startsWith('file_')) {
    return `cache:${mod.cacheKey}`;
  }

  return `file:${mod.fileName.replace(/\.disabled$/i, '').toLowerCase()}`;
};

export const isCompleteModPlatformReference = (
  mod: ModMeta,
  platform: ModPlatformId
) => {
  const reference = getModPlatformReference(mod, platform);
  return !!reference?.projectId && !!reference.fileId;
};

export const getModPreferredPlatform = (
  mod: ModMeta,
  purpose: ModMetadataPurpose,
  requireCompleteReference = false
): ModPlatformId | undefined => {
  const settings = mod.manifestEntry?.metadataSettings;
  const preference = purpose === 'metadata'
    ? settings?.metadataPlatform
    : settings?.updatePlatform;
  const locked = purpose === 'metadata'
    ? !!settings?.metadataLocked
    : !!settings?.updateLocked;

  const hasReference = (platform: ModPlatformId) => (
    requireCompleteReference ? isCompleteModPlatformReference(mod, platform) : true
  );

  if (preference === 'modrinth' || preference === 'curseforge') {
    if (hasReference(preference)) return preference;
    if (locked) return undefined;
  }

  const sourcePlatform = mod.manifestEntry?.source?.platform;
  if (
    (sourcePlatform === 'modrinth' || sourcePlatform === 'curseforge')
    && hasReference(sourcePlatform)
  ) {
    return sourcePlatform;
  }

  if (hasReference('modrinth') && getModPlatformReference(mod, 'modrinth')?.projectId) {
    return 'modrinth';
  }

  if (hasReference('curseforge') && getModPlatformReference(mod, 'curseforge')?.projectId) {
    return 'curseforge';
  }

  return undefined;
};

export const getModPreferredPlatformReference = (
  mod: ModMeta,
  purpose: ModMetadataPurpose
): { platform: ModPlatformId; reference: ModPlatformMatch } | null => {
  const platform = getModPreferredPlatform(mod, purpose, true);
  if (!platform) return null;

  const reference = getModPlatformReference(mod, platform);
  if (!reference?.projectId || !reference.fileId) return null;

  return { platform, reference };
};

export const buildAutomaticUpdateMetadataSettings = (
  previous?: ModMetadataSettings
): ModMetadataSettings => ({
  ...(previous || {}),
  updatePlatform: 'auto',
  updateLocked: false
});

export const getInstalledProjectIds = (mods: ModMeta[]): string[] => {
  const ids = new Set<string>();

  for (const mod of mods) {
    const directId = normalizeInstalledKey(mod.modId);
    const manifestProjectId = normalizeInstalledKey(mod.manifestEntry?.source?.projectId);
    const modrinthProjectId = normalizeInstalledKey(getModPlatformReference(mod, 'modrinth')?.projectId);
    const curseforgeProjectId = normalizeInstalledKey(getModPlatformReference(mod, 'curseforge')?.projectId);

    if (directId) ids.add(directId);
    if (manifestProjectId) ids.add(manifestProjectId);
    if (modrinthProjectId) ids.add(modrinthProjectId);
    if (curseforgeProjectId) ids.add(curseforgeProjectId);
  }

  return [...ids];
};

export const getInstalledVersionIds = (mods: ModMeta[]): string[] => {
  const ids = new Set<string>();

  for (const mod of mods) {
    const manifestFileId = normalizeInstalledKey(mod.manifestEntry?.source?.fileId);
    const modrinthFileId = normalizeInstalledKey(getModPlatformReference(mod, 'modrinth')?.fileId);
    const curseforgeFileId = normalizeInstalledKey(getModPlatformReference(mod, 'curseforge')?.fileId);
    const fileName = normalizeInstalledKey(mod.fileName);
    const baseFileName = normalizeInstalledKey(mod.fileName?.replace(/\.disabled$/i, ''));

    if (manifestFileId) ids.add(manifestFileId);
    if (modrinthFileId) ids.add(modrinthFileId);
    if (curseforgeFileId) ids.add(curseforgeFileId);
    if (fileName) ids.add(fileName);
    if (baseFileName) ids.add(baseFileName);
  }

  return [...ids];
};

export class InstalledModIndex {
  public projectIds: Set<string> = new Set();
  public fileNames: string[] = [];
  private enabledProjectIdsByPlatform = new Map<string, Set<string>>();
  private disabledProjectIdsByPlatform = new Map<string, Set<string>>();
  private enabledAliases = new Set<string>();
  private disabledAliases = new Set<string>();

  constructor(mods: ModMeta[]) {
    for (const mod of mods) {
      const aliasTarget = mod.isEnabled ? this.enabledAliases : this.disabledAliases;
      const projectTarget = mod.isEnabled
        ? this.enabledProjectIdsByPlatform
        : this.disabledProjectIdsByPlatform;
      const registerAlias = (value?: string | null) => {
        getModIdentityVariants(value).forEach((identity) => aliasTarget.add(identity));
      };
      const registerProject = (platform: string, projectId?: string | null) => {
        const normalizedProjectId = normalizeInstalledKey(projectId).toLowerCase();
        if (!normalizedProjectId) return;
        const platformKey = platform.trim().toLowerCase();
        if (!projectTarget.has(platformKey)) projectTarget.set(platformKey, new Set());
        projectTarget.get(platformKey)!.add(normalizedProjectId);
        this.projectIds.add(normalizedProjectId);
      };

      registerAlias(mod.modId);
      registerAlias(mod.name);
      registerAlias(mod.fileName);
      registerAlias(mod.cacheKey?.replace(/^(?:local|file|modrinth|curseforge)_/i, ''));
      mod.aliases?.forEach(registerAlias);
      mod.manifestEntry?.aliases?.forEach(registerAlias);

      const source = mod.manifestEntry?.source;
      if (source?.platform) registerProject(source.platform, source.projectId);
      registerProject('modrinth', getModPlatformReference(mod, 'modrinth')?.projectId);
      registerProject('curseforge', getModPlatformReference(mod, 'curseforge')?.projectId);

      if (mod.modId) this.projectIds.add(normalizeInstalledKey(mod.modId).toLowerCase());
      this.fileNames.push(normalizeInstalledKey(mod.fileName).toLowerCase());
    }
  }

  public matchDependency(
    dependency: ModDependencyIdentity,
    platform: ModPlatformId
  ): InstalledDependencyMatch {
    const projectId = normalizeInstalledKey(dependency.projectId).toLowerCase();
    const platformKey = platform.toLowerCase();

    if (projectId && this.enabledProjectIdsByPlatform.get(platformKey)?.has(projectId)) {
      return { status: 'installed', matchedBy: 'projectId' };
    }
    if (projectId && this.disabledProjectIdsByPlatform.get(platformKey)?.has(projectId)) {
      return { status: 'disabled', matchedBy: 'projectId' };
    }

    const aliases = new Set<string>();
    [dependency.slug, dependency.name, dependency.projectId].forEach((value) => {
      getModIdentityVariants(value).forEach((identity) => aliases.add(identity));
    });

    for (const alias of aliases) {
      if (this.enabledAliases.has(alias)) {
        return { status: 'installed', matchedBy: 'alias' };
      }
    }
    for (const alias of aliases) {
      if (this.disabledAliases.has(alias)) {
        return { status: 'disabled', matchedBy: 'alias' };
      }
    }

    return { status: 'missing' };
  }

  public isInstalled(project: ModrinthProject): boolean {
    const projectId = normalizeInstalledKey(project.id).toLowerCase();
    const legacyProjectId = normalizeInstalledKey(project.project_id).toLowerCase();

    if (projectId && this.projectIds.has(projectId)) return true;
    if (legacyProjectId && this.projectIds.has(legacyProjectId)) return true;

    const slug = normalizeInstalledKey(project.slug).toLowerCase();
    if (slug && this.projectIds.has(slug)) return true;

    const projectAliases = new Set<string>();
    if (project.slug) {
      getModIdentityVariants(project.slug).forEach((identity) => projectAliases.add(identity));
    }

    if (projectAliases.size === 0 && project.title) {
      getModIdentityVariants(project.title).forEach((identity) => projectAliases.add(identity));
    }

    return [...projectAliases].some((alias) => (
      this.enabledAliases.has(alias) || this.disabledAliases.has(alias)
    ));
  }
}

export const isProjectInstalled = (
  project: ModrinthProject,
  installedMods: ModMeta[] | InstalledModIndex
): boolean => {
  if (installedMods instanceof InstalledModIndex) {
    return installedMods.isInstalled(project);
  }
  return new InstalledModIndex(installedMods).isInstalled(project);
};
