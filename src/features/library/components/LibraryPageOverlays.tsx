import { DownloadDetailModal } from '@/features/download';
import type { Collection } from '@/types/library';

import type { useLibraryBackup } from '../hooks/useLibraryBackup';
import type { useLibraryCollectionManagement } from '../hooks/useLibraryCollectionManagement';
import type { useLibraryContextMenu } from '../hooks/useLibraryContextMenu';
import type { useLibraryModSetTracking } from '../hooks/useLibraryModSetTracking';
import type { useLibraryRelations } from '../hooks/useLibraryRelations';
import type { useLibraryResourceDetail } from '../hooks/useLibraryResourceDetail';
import type { useLibraryResourceModals } from '../hooks/useLibraryResourceModals';
import { LibraryContextMenu } from './LibraryContextMenu';
import { AddLibraryResourceModal } from './modals/AddLibraryResourceModal';
import { DeleteModSetModal } from './modals/DeleteModSetModal';
import { EditLibraryResourceModal } from './modals/EditLibraryResourceModal';
import { FavoriteDeleteModal } from './modals/FavoriteDeleteModal';
import { LibraryCloudSyncModal } from './modals/LibraryCloudSyncModal';
import { LibraryImportPreviewModal } from './modals/LibraryImportPreviewModal';
import { LibraryInstanceSelectModal } from './modals/LibraryInstanceSelectModal';
import { LibraryTagModal } from './modals/LibraryTagModal';
import { ManageLinkageModal } from './modals/ManageLinkageModal';

interface LibraryPageOverlaysProps {
  selectedCollection: Collection | undefined;
  initializeLibrary: () => Promise<void>;
  tracking: ReturnType<typeof useLibraryModSetTracking>;
  backup: ReturnType<typeof useLibraryBackup>;
  collectionManagement: ReturnType<typeof useLibraryCollectionManagement>;
  contextMenuController: ReturnType<typeof useLibraryContextMenu>;
  relations: ReturnType<typeof useLibraryRelations>;
  resourceDetail: ReturnType<typeof useLibraryResourceDetail>;
  resourceModals: ReturnType<typeof useLibraryResourceModals>;
}

export const LibraryPageOverlays: React.FC<LibraryPageOverlaysProps> = ({
  selectedCollection,
  initializeLibrary,
  tracking,
  backup,
  collectionManagement,
  contextMenuController,
  relations,
  resourceDetail,
  resourceModals,
}) => {
  const { selectedModSetResources } = tracking;
  const {
    isBusy: isLibraryBackupBusy,
    isCloudModalOpen: isLibraryCloudModalOpen,
    isSyncingWebDav: isLibraryWebDavSyncing,
    syncHistory: librarySyncHistory,
    importDraft: libraryImportDraft,
    closeImportPreview,
    closeCloudModal,
    exportLibrary,
    openImportLibrary,
    syncWebDavFavorites,
    toggleImportTagMerge,
    confirmImportLibrary,
  } = backup;
  const {
    isDeleteModSetOpen,
    isDeletingModSet,
    removeFavoritesWithModSet,
    deleteModSetSelectedItemIds,
    closeDeleteModSetModal,
    deleteModSet,
    toggleRemoveFavoritesWithModSet,
    toggleDeleteModSetItem,
    selectAllDeleteModSetItems,
    invertDeleteModSetItems,
    favoriteDeleteTarget,
    isDeletingFavoriteItem,
    closeFavoriteDelete,
    deleteFavoriteItem,
  } = collectionManagement;
  const { contextMenu, setContextMenu, contextMenuActions } = contextMenuController;
  const {
    pendingRelationKeys,
    relationError,
    tagCollections,
    tagTargetItem,
    tagTargetTagIds,
    tagTargetHasPendingRelation,
    closeTagModal,
    toggleItemTag,
  } = relations;
  const {
    detailProject,
    detailSource,
    detailTab,
    directInstallInstanceIds,
    searchMcVersion,
    searchLoader,
    closeResourceDetail,
    openResourceDetailWithInstances,
    handleLibraryDetailDownload,
  } = resourceDetail;
  const {
    isInstanceSelectOpen,
    pendingResource,
    closeInstanceSelect,
    isAddResourceOpen,
    closeAddResource,
    selectedResource,
    isManageLinkageOpen,
    closeManageLinkage,
    isEditResourceOpen,
    closeEditResource,
  } = resourceModals;

  return (
    <>
      {contextMenu && contextMenuActions.length > 0 && (
        <LibraryContextMenu
          anchorRect={contextMenu.anchorRect}
          triggerPoint={contextMenu.triggerPoint}
          actions={contextMenuActions}
          onClose={() => setContextMenu(null)}
        />
      )}

      <LibraryCloudSyncModal
        isOpen={isLibraryCloudModalOpen}
        isBusy={isLibraryBackupBusy}
        isSyncingWebDav={isLibraryWebDavSyncing}
        records={librarySyncHistory}
        onClose={closeCloudModal}
        onExportLibrary={() => {
          closeCloudModal();
          void exportLibrary();
        }}
        onImportLibrary={() => {
          closeCloudModal();
          void openImportLibrary();
        }}
        onSyncWebDav={() => {
          void syncWebDavFavorites();
        }}
      />

      <LibraryImportPreviewModal
        draft={libraryImportDraft}
        isBusy={isLibraryBackupBusy}
        errorMessage={relationError}
        onClose={closeImportPreview}
        onToggleMergeTags={() => {
          void toggleImportTagMerge();
        }}
        onConfirm={() => {
          void confirmImportLibrary();
        }}
      />

      <LibraryTagModal
        item={tagTargetItem}
        tags={tagCollections}
        activeTagIds={tagTargetTagIds}
        pendingRelationKeys={pendingRelationKeys}
        relationError={relationError}
        hasPendingRelation={tagTargetHasPendingRelation}
        onClose={closeTagModal}
        onToggleTag={(tagId) => {
          void toggleItemTag(tagId);
        }}
      />

      <DownloadDetailModal
        project={detailProject}
        instanceConfig={null}
        onClose={closeResourceDetail}
        onDownload={handleLibraryDetailDownload}
        installedVersionIds={[]}
        activeTab={detailTab}
        source={detailSource}
        directInstallInstanceIds={directInstallInstanceIds}
        searchMcVersion={searchMcVersion}
        searchLoader={searchLoader}
      />

      <LibraryInstanceSelectModal
        isOpen={isInstanceSelectOpen}
        onClose={closeInstanceSelect}
        resource={pendingResource}
        onConfirm={(instanceIds) => {
          if (pendingResource) {
            openResourceDetailWithInstances(pendingResource, instanceIds);
          }
        }}
      />

      <FavoriteDeleteModal
        target={favoriteDeleteTarget}
        isDeleting={isDeletingFavoriteItem}
        onClose={closeFavoriteDelete}
        onConfirm={() => {
          void deleteFavoriteItem();
        }}
      />

      <AddLibraryResourceModal
        isOpen={isAddResourceOpen}
        onClose={closeAddResource}
        onSuccess={() => void initializeLibrary()}
      />

      <ManageLinkageModal
        isOpen={isManageLinkageOpen}
        onClose={closeManageLinkage}
        resource={selectedResource}
      />

      <EditLibraryResourceModal
        isOpen={isEditResourceOpen}
        onClose={closeEditResource}
        resource={selectedResource}
        onSuccess={() => void initializeLibrary()}
      />

      <DeleteModSetModal
        isOpen={isDeleteModSetOpen}
        collectionName={selectedCollection?.name || ''}
        isDeleting={isDeletingModSet}
        removeFavoritesWithModSet={removeFavoritesWithModSet}
        selectedItemIds={deleteModSetSelectedItemIds}
        resources={selectedModSetResources}
        onClose={closeDeleteModSetModal}
        onConfirm={() => {
          void deleteModSet();
        }}
        onToggleRemoveFavorites={toggleRemoveFavoritesWithModSet}
        onToggleItem={toggleDeleteModSetItem}
        onSelectAll={selectAllDeleteModSetItems}
        onInvert={invertDeleteModSetItems}
      />
    </>
  );
};
