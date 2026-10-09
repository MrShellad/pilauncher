import { Boxes, type LucideIcon } from 'lucide-react';
import type { TFunction } from 'i18next';

export type LibraryFilterId = 'all' | 'modpack' | 'mod' | 'server' | 'external' | 'updated';
export type LibrarySortId = 'manual' | 'recent' | 'name' | 'source';
export type LibraryDensity = 'comfortable' | 'compact';

export interface LibraryFilterOption {
  id: LibraryFilterId;
  label: string;
}

export interface LibraryEntryAction {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: 'primary' | 'secondary';
}

export const LIBRARY_FILTER_OPTIONS: LibraryFilterOption[] = [
  { id: 'all', label: 'libraryPage.filters.all' },
  { id: 'modpack', label: 'libraryPage.filters.modpack' },
  { id: 'mod', label: 'libraryPage.filters.mod' },
  { id: 'server', label: 'libraryPage.filters.server' },
  { id: 'updated', label: 'libraryPage.filters.updated' },
];

export const getLibrarySortOptions = (t: TFunction) => [
  { label: t('libraryPage.sort.manual'), value: 'manual' },
  { label: t('libraryPage.sort.recent'), value: 'recent' },
  { label: t('libraryPage.sort.name'), value: 'name' },
  { label: t('libraryPage.sort.source'), value: 'source' },
];

export const LIBRARY_EMPTY_ACTIONS: LibraryEntryAction[] = [
  {
    id: 'download',
    label: 'libraryPage.empty.actionDownload',
    description: 'libraryPage.empty.actionDownloadDesc',
    icon: Boxes,
    tone: 'primary',
  },
];
