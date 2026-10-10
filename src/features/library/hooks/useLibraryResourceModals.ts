import { useState } from 'react';

import type { LibraryResourceViewModel } from '../logic/libraryItems';

export const useLibraryResourceModals = () => {
  const [isInstanceSelectOpen, setIsInstanceSelectOpen] = useState(false);
  const [pendingResource, setPendingResource] = useState<LibraryResourceViewModel | null>(null);
  const [isAddResourceOpen, setIsAddResourceOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<LibraryResourceViewModel | null>(null);
  const [isManageLinkageOpen, setIsManageLinkageOpen] = useState(false);
  const [isEditResourceOpen, setIsEditResourceOpen] = useState(false);

  const openInstanceSelect = (resource: LibraryResourceViewModel) => {
    setPendingResource(resource);
    setIsInstanceSelectOpen(true);
  };

  const closeInstanceSelect = () => {
    setIsInstanceSelectOpen(false);
    setPendingResource(null);
  };

  const openManageLinkage = (resource: LibraryResourceViewModel) => {
    setSelectedResource(resource);
    setIsManageLinkageOpen(true);
  };

  const closeManageLinkage = () => {
    setIsManageLinkageOpen(false);
    setSelectedResource(null);
  };

  const openEditResource = (resource: LibraryResourceViewModel) => {
    setSelectedResource(resource);
    setIsEditResourceOpen(true);
  };

  const closeEditResource = () => {
    setIsEditResourceOpen(false);
    setSelectedResource(null);
  };

  return {
    isInstanceSelectOpen,
    pendingResource,
    openInstanceSelect,
    closeInstanceSelect,
    isAddResourceOpen,
    openAddResource: () => setIsAddResourceOpen(true),
    closeAddResource: () => setIsAddResourceOpen(false),
    selectedResource,
    isManageLinkageOpen,
    openManageLinkage,
    closeManageLinkage,
    isEditResourceOpen,
    openEditResource,
    closeEditResource,
  };
};
