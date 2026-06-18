import React, { useEffect, useMemo, useState } from 'react';
import { Info, Radar, Save, Search, Tag } from 'lucide-react';
import { useIconCacheStore } from '../logic/iconCache';

import { useLibraryStore } from '../../../stores/useLibraryStore';
import type { Collection, CollectionItem, StarredItem } from '../../../types/library';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreDropdown, type DropdownOption } from '../../../ui/primitives/OreDropdown';
import { CreatableCombobox } from '../../../ui/primitives/CreatableCombobox';
import { OreModal } from '../../../ui/primitives/OreModal';
import { OreOverlayScrollArea } from '../../../ui/primitives/OreOverlayScrollArea';
import { OreSwitch } from '../../../ui/primitives/OreSwitch';
import { useModSetTrackerStore, toModSetTrackerProject } from '../../Library/stores/useModSetTrackerStore';
import type { ModrinthProject } from '../../InstanceDetail/logic/modrinthApi';
import type { TabType } from '../hooks/useResourceDownload';

interface FavoritePlaceholderModalProps {
  isOpen: boolean;
  projects: ModrinthProject[];
  onClose: () => void;
  resourceType?: Extract<TabType, 'mod' | 'resourcepack' | 'shader'>;
  defaultGameVersion?: string;
  defaultLoader?: string;
  mcVersionOptions?: DropdownOption[];
  onCreated?: () => void;
}

const LOADER_OPTIONS: DropdownOption[] = [
  { label: 'Fabric', value: 'fabric' },
  { label: 'Forge', value: 'forge' },
  { label: 'NeoForge', value: 'neoforge' },
  { label: 'Quilt', value: 'quilt' },
];

const nowSeconds = () => Math.floor(Date.now() / 1000);

const createId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const normalizeProjectId = (project: ModrinthProject) =>
  project.id || project.project_id || project.slug || project.title;

const toStarredItem = (
  project: ModrinthProject,
  resourceType: Extract<TabType, 'mod' | 'resourcepack' | 'shader'>,
): StarredItem => {
  const timestamp = nowSeconds();
  const source = project.source || 'modrinth';
  const projectId = normalizeProjectId(project);

  return {
    id: `${source}:${projectId}`,
    type: resourceType,
    source,
    projectId,
    title: project.title,
    author: project.author,
    snapshot: JSON.stringify({
      title: project.title,
      iconUrl: project.icon_url,
      author: project.author,
      description: project.description,
      loaders: project.loaders || project.categories || [],
      categories: project.display_categories || project.categories || [],
      updatedAt: project.date_modified,
    }),
    state: JSON.stringify({
      hasUpdate: false,
      lastCheckedAt: timestamp,
    }),
    meta: JSON.stringify({
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const buildCollectionRelation = (
  collectionId: string,
  item: StarredItem,
  position: number,
  timestamp: number,
): CollectionItem => ({
  id: `${collectionId}:${item.id}`,
  collectionId,
  itemId: item.id,
  position,
  extra: JSON.stringify({ source: item.source, projectId: item.projectId }),
  createdAt: timestamp,
});

export const FavoritePlaceholderModal: React.FC<FavoritePlaceholderModalProps> = ({
  isOpen,
  projects,
  onClose,
  resourceType = 'mod',
  defaultGameVersion = '',
  defaultLoader = '',
  mcVersionOptions = [],
  onCreated,
}) => {
  const {
    collections,
    initialized,
    initializeLibrary,
    addStarredItem,
    createCollection,
    addItemsToCollection,
  } = useLibraryStore();
  const loadTrackers = useModSetTrackerStore((state) => state.loadTrackers);
  const createTracker = useModSetTrackerStore((state) => state.createTracker);
  const checkTracker = useModSetTrackerStore((state) => state.checkTracker);
  const trackers = useModSetTrackerStore((state) => state.trackers);

  const tagCollections = useMemo(
    () => collections
      .filter((collection) => collection.type === 'group')
      .sort((a, b) => a.sortOrder - b.sortOrder),
    [collections],
  );
  const modSetCollections = useMemo(
    () => collections
      .filter((collection) => collection.type === 'mod_set')
      .sort((a, b) => a.sortOrder - b.sortOrder),
    [collections],
  );
  const trackingVersionOptions = useMemo(() => {
    const normalized = mcVersionOptions
      .filter((option) => option.value && option.value !== 'all')
      .map((option) => ({ label: option.label, value: option.value }));

    if (defaultGameVersion && !normalized.some((option) => option.value === defaultGameVersion)) {
      normalized.unshift({ label: defaultGameVersion, value: defaultGameVersion });
    }

    return normalized;
  }, [defaultGameVersion, mcVersionOptions]);

  const [selectedTagId, setSelectedTagId] = useState('');
  const [includeCollection, setIncludeCollection] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [trackingEnabled, setTrackingEnabled] = useState(Boolean(defaultGameVersion && defaultLoader));
  const [targetGameVersion, setTargetGameVersion] = useState(defaultGameVersion);
  const [targetLoader, setTargetLoader] = useState(defaultLoader);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const isModFavorite = resourceType === 'mod';
  const copy = isModFavorite
    ? {
        title: '加入收藏',
        tagTitle: '入库标签',
        tagPlaceholder: '选择标签',
        includeCollectionLabel: '同时加入模组集',
        collectionLabel: '模组集',
        collectionPlaceholder: '输入名称，或从已有模组集中选择',
        autoCreateLabel: '未命名模组集',
        matchedText: '已匹配现有模组集，保存时会加入其中。',
        unmatchedText: '没有同名模组集时，保存会自动创建。',
        selectedTitle: '已选择 Mod',
        info: '默认只保存到收藏并关联标签；开启模组集后，才会额外生成可追踪的模组集合。',
        saveText: '保存入库',
      }
    : resourceType === 'shader'
    ? {
        title: '收藏光影',
        tagTitle: '光影标签',
        tagPlaceholder: '选择标签',
        selectedTitle: '已选择光影',
        info: '光影会保存到收藏，并可按标签整理。',
        saveText: '保存光影',
      }
    : {
        title: '收藏资源包',
        tagTitle: '资源包标签',
        tagPlaceholder: '选择标签',
        selectedTitle: '已选择资源包',
        info: '资源包会保存到收藏，并可按标签整理。',
        saveText: '保存资源包',
      };

  useEffect(() => {
    if (isOpen) {
      if (!initialized) {
        void initializeLibrary();
      }
      void loadTrackers();
    }
  }, [initializeLibrary, initialized, isOpen, loadTrackers]);

  useEffect(() => {
    if (!isOpen) return;
    const fallbackName = projects.length === 1
      ? `${projects[0].title} 相关模组`
      : `模组集 ${new Date().toLocaleDateString()}`;

    setSelectedTagId(tagCollections[0]?.id || '');
    setIncludeCollection(false);
    setCollectionName(fallbackName);
    setTrackingEnabled(isModFavorite && Boolean(defaultGameVersion && defaultLoader));
    setTargetGameVersion(defaultGameVersion);
    setTargetLoader(defaultLoader);
    setNotice('');
  }, [defaultGameVersion, defaultLoader, isModFavorite, isOpen, modSetCollections, projects, tagCollections]);

  const normalizedCollectionName = collectionName.trim();
  const matchedCollection = useMemo(
    () => modSetCollections.find(
      (collection) => collection.name.trim().toLowerCase() === normalizedCollectionName.toLowerCase(),
    ),
    [modSetCollections, normalizedCollectionName],
  );

  useEffect(() => {
    if (!isOpen) return;
    if (matchedCollection) {
      const existingTracker = trackers.find((t) => t.collectionId === matchedCollection.id);
      if (existingTracker) {
        setTargetGameVersion(existingTracker.gameVersion);
        setTargetLoader(existingTracker.loader);
        setTrackingEnabled(true);
      } else {
        setTargetGameVersion(defaultGameVersion);
        setTargetLoader(defaultLoader);
        setTrackingEnabled(false);
      }
    } else {
      setTargetGameVersion(defaultGameVersion);
      setTargetLoader(defaultLoader);
      setTrackingEnabled(Boolean(defaultGameVersion && defaultLoader));
    }
  }, [isOpen, matchedCollection?.id, trackers, defaultGameVersion, defaultLoader]);

  const modSetOptions = useMemo(
    () => modSetCollections.map((collection) => ({
      label: collection.name,
      value: collection.id,
    })),
    [modSetCollections],
  );

  const needsCollectionTarget = isModFavorite && includeCollection && normalizedCollectionName.length === 0;
  const needsTrackingTarget = isModFavorite &&
    includeCollection &&
    trackingEnabled &&
    (targetGameVersion.trim().length === 0 || targetLoader.trim().length === 0);
  const canSave = projects.length > 0 && !needsCollectionTarget && !needsTrackingTarget;

  const handleSave = async () => {
    if (!canSave || isSaving) return;

    setIsSaving(true);
    setNotice('');

    try {
      const timestamp = nowSeconds();
      const starredItems = projects.map((project) => toStarredItem(project, resourceType));
      const collectionRelations: CollectionItem[] = [];

      for (const item of starredItems) {
        await addStarredItem(item);
      }

      if (selectedTagId) {
        for (let index = 0; index < starredItems.length; index += 1) {
          collectionRelations.push(buildCollectionRelation(
            selectedTagId,
            starredItems[index],
            timestamp + index,
            timestamp,
          ));
        }
      }

      let collection: Collection | undefined;
      if (isModFavorite && includeCollection) {
        collection = matchedCollection;
        if (!collection) {
          collection = {
            id: createId('modset'),
            name: normalizedCollectionName,
            description: '',
            type: 'mod_set',
            sortOrder: 0,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          await createCollection(collection);
        }

        if (!collection) return;

        for (let index = 0; index < starredItems.length; index += 1) {
          collectionRelations.push(buildCollectionRelation(
            collection.id,
            starredItems[index],
            timestamp + index,
            timestamp,
          ));
        }

        if (trackingEnabled) {
          await loadTrackers();
          const trackerProjects = projects
            .map(toModSetTrackerProject)
            .filter((item): item is NonNullable<typeof item> => Boolean(item));
          if (trackerProjects.length > 0) {
            const tracker = createTracker({
              collectionId: collection.id,
              collectionName: collection.name,
              gameVersion: targetGameVersion.trim(),
              loader: targetLoader.trim().toLowerCase(),
              projects: trackerProjects,
            });
            void checkTracker(tracker.id);
          }
        }
      }

      await addItemsToCollection(collectionRelations);

      onCreated?.();
      onClose();
    } catch (error) {
      console.error('[FavoriteModal] save failed', error);
      setNotice(`保存失败：${String(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={copy.title}
      defaultFocusKey="favorite-save"
      className="h-[min(46rem,calc(100vh-2rem))] w-[72rem] max-w-[calc(100vw-2rem)] border-[0.1875rem] border-[#1E1E1F] bg-[var(--ore-modal-bg)]"
      contentClassName="min-h-0 overflow-visible p-0"
      actions={(
        <>
          {isModFavorite && includeCollection && trackingEnabled && (
            <div className="mr-auto hidden items-center text-xs text-[#6CC349] lg:flex">
              <Radar size={14} className="mr-1" />
              首次检查会在保存后自动开始
            </div>
          )}
          <OreButton focusKey="favorite-cancel" variant="secondary" onClick={onClose}>
            取消
          </OreButton>
          <OreButton
            focusKey="favorite-save"
            variant="primary"
            disabled={!canSave || isSaving}
            onClick={() => { void handleSave(); }}
          >
            <Save size={15} className="mr-2" />
            {isSaving ? '保存中...' : isModFavorite && includeCollection && trackingEnabled ? '保存并追踪' : copy.saveText}
          </OreButton>
        </>
      )}
    >
      <div className="flex h-full min-h-0 flex-col overflow-visible">

      <div className="grid min-h-0 flex-1 gap-0 overflow-visible bg-[#313233] lg:grid-cols-[minmax(0,1fr)_24rem]">
        <OreOverlayScrollArea
          className="min-h-0"
          viewportClassName="overflow-x-visible"
          contentClassName="grid content-start gap-4 p-5 pb-6"
          safeInsetTop={14}
          safeInsetBottom={14}
          safeInsetRight={10}
          contentSafePaddingRight={24}
        >
          <div className="border-2 border-[#1E1E1F] bg-[#1E1E1F] p-3">
            <div className="mb-2 flex items-center gap-2 font-minecraft text-sm text-white">
              <Tag size={15} className="text-[#6CC349]" />
              {copy.tagTitle}
            </div>
            <OreDropdown
              focusKey="favorite-tag"
              options={[
                { label: '不打标签', value: '' },
                ...tagCollections.map((collection) => ({ label: collection.name, value: collection.id })),
              ]}
              value={selectedTagId}
              onChange={setSelectedTagId}
              placeholder={copy.tagPlaceholder}
              searchable={tagCollections.length > 8}
              portal
              panelWidth="trigger"
              lazy
            />
          </div>

          {isModFavorite && (
            <div className={[
              'grid gap-3 border-2 border-[#1E1E1F] bg-[#1E1E1F] p-3',
              includeCollection ? 'md:grid-cols-2' : '',
            ].join(' ')}>
              <div className="flex min-h-10 items-center">
                <OreSwitch
                  focusKey="favorite-include-collection"
                  checked={includeCollection}
                  onChange={setIncludeCollection}
                  label={copy.includeCollectionLabel}
                />
              </div>
              {includeCollection && (
                <div className="flex min-h-10 items-center md:justify-end">
                  <OreSwitch
                    focusKey="modset-enable-tracking"
                    checked={trackingEnabled}
                    onChange={setTrackingEnabled}
                    label="开启版本追踪"
                  />
                </div>
              )}
            </div>
          )}

          {isModFavorite && includeCollection && (
            <div className="grid gap-4 border-2 border-[#1E1E1F] bg-[#242526] p-3">
              <div className="relative">
                <CreatableCombobox
                  focusKey="modset-combobox"
                  label={copy.collectionLabel}
                  value={collectionName}
                  options={modSetOptions}
                  onChange={(option) => {
                    setCollectionName(option.label);
                  }}
                  onCreate={(inputValue) => {
                    setCollectionName(inputValue);
                  }}
                  placeholder={copy.collectionPlaceholder}
                  prefixNode={<Search size={15} />}
                />

                <div className="mt-2 text-xs text-[#B1B2B5]">
                  {matchedCollection ? copy.matchedText : copy.unmatchedText}
                </div>
              </div>

              {trackingEnabled && (
                <div className="border-2 border-[#1E1E1F] bg-[#1E1E1F] p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="mb-1 font-minecraft text-sm text-white">目标 Minecraft 版本</div>
                      <OreDropdown
                        focusKey="modset-target-version"
                        options={trackingVersionOptions}
                        value={targetGameVersion}
                        onChange={setTargetGameVersion}
                        placeholder="选择版本"
                        searchable
                        portal
                        panelWidth="trigger"
                        lazy
                        lazyBatchSize={36}
                      />
                    </div>
                    <div>
                      <div className="mb-1 font-minecraft text-sm text-white">目标 Loader</div>
                      <OreDropdown
                        focusKey="modset-target-loader"
                        options={LOADER_OPTIONS}
                        value={targetLoader}
                        onChange={setTargetLoader}
                        placeholder="选择 Loader"
                        portal
                        panelWidth="trigger"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-start gap-2 border-2 border-[#1E1E1F] bg-[#1E1E1F] p-3 text-sm leading-6 text-[#D0D1D4]">
            <Info size={16} className="mt-1 shrink-0 text-[#6CC349]" />
            <span>{copy.info}</span>
          </div>

          {notice && (
            <div className="border-2 border-[#7A2323] bg-[#3A1414] p-3 text-sm text-[#F46D6D]">
              {notice}
            </div>
          )}
        </OreOverlayScrollArea>

        <aside className="flex min-h-[18rem] flex-col border-t-2 border-[#1E1E1F] bg-[#242526] p-4 lg:min-h-0 lg:border-l-2 lg:border-t-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="font-minecraft text-sm text-white">{copy.selectedTitle}</div>
            <div className="border-2 border-[#1E1E1F] bg-[#6CC349] px-2 py-1 font-minecraft text-xs text-[#111214]">
              {projects.length}
            </div>
          </div>

          <OreOverlayScrollArea
            className="min-h-0 flex-1"
            contentClassName="space-y-2"
            safeInsetTop={4}
            safeInsetBottom={4}
            safeInsetRight={2}
            contentSafePaddingRight={20}
          >
            {projects.map((project) => (
              <FavoriteProjectItem
                key={`${project.source || 'modrinth'}:${normalizeProjectId(project)}`}
                project={project}
              />
            ))}
          </OreOverlayScrollArea>
        </aside>
      </div>
      </div>
    </OreModal>
  );
};

const FavoriteProjectItem: React.FC<{ project: ModrinthProject }> = ({ project }) => {
  const cachedIconUrl = useIconCacheStore((state) => project.icon_url ? state.cachedUrls[project.icon_url] || '' : '');
  const loadIcon = useIconCacheStore((state) => state.loadIcon);

  useEffect(() => {
    if (project.icon_url) {
      void loadIcon(project.icon_url);
    }
  }, [project.icon_url, loadIcon]);

  return (
    <div
      className="flex items-center gap-3 border-2 border-[#1E1E1F] bg-[#D0D1D4] p-2 text-[#111214] shadow-[inset_0_-0.1875rem_0_#58585A,inset_0.125rem_0.125rem_0_rgba(255,255,255,0.68)]"
    >
      <div className="h-10 w-10 shrink-0 overflow-hidden border-2 border-[#1E1E1F] bg-[#48494A]">
        {project.icon_url ? (
          <img src={cachedIconUrl || project.icon_url} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0">
        <div className="truncate font-minecraft text-sm">{project.title}</div>
        <div className="truncate text-xs text-[#48494A]">{project.author || project.source || 'Unknown'}</div>
      </div>
    </div>
  );
};
