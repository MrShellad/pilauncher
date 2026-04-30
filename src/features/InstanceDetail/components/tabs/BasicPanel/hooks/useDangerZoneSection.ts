import { useCallback, useState } from 'react';

interface UseDangerZoneSectionOptions {
  onDelete: (skipConfirm?: boolean) => Promise<void>;
  setIsGlobalSaving: (val: boolean) => void;
}

export const useDangerZoneSection = ({
  onDelete,
  setIsGlobalSaving,
}: UseDangerZoneSectionOptions) => {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const openDeleteModal = useCallback(() => setIsDeleteModalOpen(true), []);
  const closeDeleteModal = useCallback(() => setIsDeleteModalOpen(false), []);

  const confirmDelete = useCallback(async () => {
    setIsGlobalSaving(true);
    setIsDeleteModalOpen(false);
    await onDelete(true);
    // 删除后页面会关闭或跳转，不需要把全局保存状态重置为 false。
  }, [onDelete, setIsGlobalSaving]);

  return {
    isDeleteModalOpen,
    openDeleteModal,
    closeDeleteModal,
    confirmDelete,
  };
};
