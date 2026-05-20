import { create } from 'zustand';

import type { ModrinthProject } from '../../../../logic/modrinthApi';

interface InstanceDownloadSelectionState {
  selectedProjects: Record<string, ModrinthProject>;
  selectedProjectIds: Set<string>;
  selectedCount: number;
  isSelectionMode: boolean;
  getProjectKey: (project: ModrinthProject) => string;
  toggleProject: (project: ModrinthProject) => void;
  clearSelection: () => void;
}

const getProjectKey = (project: ModrinthProject) =>
  project.id || project.project_id || project.slug || project.title;

const createDerivedState = (selectedProjects: Record<string, ModrinthProject>) => {
  const ids = Object.keys(selectedProjects);
  return {
    selectedProjects,
    selectedProjectIds: new Set(ids),
    selectedCount: ids.length,
    isSelectionMode: ids.length > 0,
  };
};

export const useInstanceDownloadSelectionStore = create<InstanceDownloadSelectionState>((set) => ({
  selectedProjects: {},
  selectedProjectIds: new Set(),
  selectedCount: 0,
  isSelectionMode: false,
  getProjectKey,
  toggleProject: (project) => {
    const key = getProjectKey(project);
    if (!key) return;

    set((state) => {
      const next = { ...state.selectedProjects };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = project;
      }
      return createDerivedState(next);
    });
  },
  clearSelection: () => set(createDerivedState({})),
}));
