import { useState, type MouseEvent } from 'react';
import { getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';
import { Columns3, Eye, Pencil, Tags, Trash2, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { Collection } from '@/types/library';

import type {
  LibraryContextMenuAction,
  LibraryContextMenuAnchor,
  LibraryContextMenuPoint,
} from '../components/LibraryContextMenu';
import type { LibraryResourceViewModel } from '../logic/libraryItems';
import {
  LIBRARY_COLLECTION_FOCUS_PREFIX,
  LIBRARY_RESOURCE_FOCUS_PREFIX,
  getRelationPendingKey,
  getRemoveContextLabel,
  toDetailProject,
} from '../logic/libraryPageUtils';
import { useLibraryStore } from '../stores/useLibraryStore';

interface ContextMenuState {
  type: 'resource' | 'collection';
  item?: LibraryResourceViewModel;
  collection?: Collection;
  anchorRect: LibraryContextMenuAnchor;
  triggerPoint: LibraryContextMenuPoint;
}

interface UseLibraryContextMenuOptions {
  visibleResources: LibraryResourceViewModel[];
  visibleCollections: Collection[];
  selectedCollection: Collection | null | undefined;
  selectedGroupId: string;
  pendingRelationKeys: Set<string>;
  setSelectedGroupId: (groupId: string) => void;
  removeItemFromCollectionWithTracking: (collection: Collection, item: LibraryResourceViewModel) => Promise<void>;
  openTagModal: (item: LibraryResourceViewModel) => void;
  openResourceDetail: (item: LibraryResourceViewModel) => void;
  openCollectionMetadataEdit: (collection: Collection) => void;
  openFavoriteDelete: (item: LibraryResourceViewModel) => void;
  openDeleteModSetModal: () => void;
  openInstanceSelect: (item: LibraryResourceViewModel) => void;
  openManageLinkage: (item: LibraryResourceViewModel) => void;
  openEditResource: (item: LibraryResourceViewModel) => void;
}

const getControllerAnchorForFocusKey = (focusKey: string) => {
  const element = document.querySelector<HTMLElement>(
    `[data-library-resource-focus-key="${focusKey}"], [data-library-collection-focus-key="${focusKey}"]`,
  );
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    anchorRect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
    triggerPoint: {
      x: rect.right - Math.min(28, rect.width / 4),
      y: rect.top + Math.min(28, rect.height / 3),
    },
  };
};

export const useLibraryContextMenu = ({
  visibleResources,
  visibleCollections,
  selectedCollection,
  selectedGroupId,
  pendingRelationKeys,
  setSelectedGroupId,
  removeItemFromCollectionWithTracking,
  openTagModal,
  openResourceDetail,
  openCollectionMetadataEdit,
  openFavoriteDelete,
  openDeleteModSetModal,
  openInstanceSelect,
  openManageLinkage,
  openEditResource,
}: UseLibraryContextMenuOptions) => {
  const { t } = useTranslation();
  const collectionItems = useLibraryStore((state) => state.collectionItems);
  const removeCollection = useLibraryStore((state) => state.removeCollection);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const handleItemContextMenu = (event: MouseEvent<HTMLElement>, item: LibraryResourceViewModel) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setContextMenu({
      type: 'resource',
      item,
      anchorRect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      triggerPoint: { x: event.clientX, y: event.clientY },
    });
  };

  const handleCollectionContextMenu = (event: MouseEvent<HTMLElement>, collection: Collection) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setContextMenu({
      type: 'collection',
      collection,
      anchorRect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      triggerPoint: { x: event.clientX, y: event.clientY },
    });
  };

  const handleOpenItem = (item: LibraryResourceViewModel) => {
    if (item.type !== 'shader' && item.type !== 'resourcepack') {
      openResourceDetail(item);
      return;
    }
    if (item.installedVersion) {
      openManageLinkage(item);
    } else {
      openInstanceSelect(item);
    }
  };

  const handleOpenFocusedResourceContextMenu = () => {
    const currentFocus = getCurrentFocusKey();
    if (!currentFocus) return;

    if (currentFocus.startsWith(LIBRARY_RESOURCE_FOCUS_PREFIX)) {
      const index = Number(currentFocus.slice(LIBRARY_RESOURCE_FOCUS_PREFIX.length));
      const item = Number.isInteger(index) && index >= 0 ? visibleResources[index] : null;
      const anchor = getControllerAnchorForFocusKey(currentFocus);
      if (item && anchor) setContextMenu({ type: 'resource', item, ...anchor });
      return;
    }

    if (currentFocus.startsWith(LIBRARY_COLLECTION_FOCUS_PREFIX)) {
      const index = Number(currentFocus.slice(LIBRARY_COLLECTION_FOCUS_PREFIX.length));
      const collection = visibleCollections[index];
      const anchor = getControllerAnchorForFocusKey(currentFocus);
      if (collection && anchor) setContextMenu({ type: 'collection', collection, ...anchor });
    }
  };

  const actions: LibraryContextMenuAction[] = [];
  if (contextMenu?.type === 'resource' && contextMenu.item) {
    const item = contextMenu.item;
    if (toDetailProject(item)) {
      actions.push({
        id: 'detail',
        label: t('libraryPage.context.detail', { type: t(`libraryPage.types.${item.type}`, { defaultValue: 'Mod' }) }),
        icon: Eye,
        group: 'primary',
        onSelect: () => { openResourceDetail(item); setContextMenu(null); },
      });
    }
    if (item.type === 'shader' || item.type === 'resourcepack') {
      actions.push({
        id: 'link-instances', label: '导入/应用到实例', icon: Columns3, group: 'primary',
        onSelect: () => { openManageLinkage(item); setContextMenu(null); },
      });
      actions.push({
        id: 'upgrade-resource', label: '编辑与覆盖升级', icon: Pencil, group: 'primary',
        onSelect: () => { openEditResource(item); setContextMenu(null); },
      });
    }
    actions.push({
      id: 'tags', label: t('libraryPage.context.tags'), icon: Tags, group: 'secondary',
      onSelect: () => { openTagModal(item); setContextMenu(null); },
    });

    const canRemove = Boolean(selectedCollection && collectionItems.some(
      (relation) => relation.collectionId === selectedCollection.id && relation.itemId === item.id,
    ));
    const pendingKey = selectedCollection ? getRelationPendingKey(selectedCollection.id, item.id) : '';
    if (canRemove && !pendingRelationKeys.has(pendingKey) && selectedCollection) {
      actions.push({
        id: 'remove', label: t(getRemoveContextLabel(selectedCollection.type)), icon: XCircle, group: 'danger',
        onSelect: () => {
          setContextMenu(null);
          void removeItemFromCollectionWithTracking(selectedCollection, item);
        },
      });
    }
    actions.push({
      id: 'delete-favorite', label: t('libraryPage.context.deleteFavorite'), icon: Trash2, group: 'danger',
      onSelect: () => { openFavoriteDelete(item); setContextMenu(null); },
    });
  } else if (contextMenu?.type === 'collection' && contextMenu.collection) {
    const collection = contextMenu.collection;
    if (collection.type === 'mod_set' || collection.type === 'modpack') {
      actions.push({
        id: 'edit-collection',
        label: t('libraryPage.metadata.title', {
          type: collection.type === 'modpack' ? t('libraryPage.views.modpack') : t('libraryPage.views.modSet'),
        }),
        icon: Pencil,
        group: 'primary',
        onSelect: () => { openCollectionMetadataEdit(collection); setContextMenu(null); },
      });
    }
    if (collection.type === 'mod_set') {
      actions.push({
        id: 'delete-modset', label: t('libraryPage.toolbar.deleteModSet'), icon: Trash2, group: 'danger',
        onSelect: () => {
          openDeleteModSetModal();
          setContextMenu(null);
        },
      });
    } else if (collection.type === 'group') {
      actions.push({
        id: 'delete-tag', label: t('libraryPage.sidebar.deleteTag'), icon: Trash2, group: 'danger',
        onSelect: () => {
          void removeCollection(collection.id);
          if (selectedGroupId === collection.id) setSelectedGroupId('all');
          setContextMenu(null);
        },
      });
    }
  }

  return {
    contextMenu,
    setContextMenu,
    contextMenuActions: actions,
    handleItemContextMenu,
    handleCollectionContextMenu,
    handleOpenItem,
    handleOpenFocusedResourceContextMenu,
  };
};
