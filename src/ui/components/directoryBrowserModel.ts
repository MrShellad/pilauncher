import fileCategoriesConfig from '../../assets/config/file_categories.json';
import type { DirNode } from '../hooks/useDirectoryBrowser';

interface FileCategoryConfig {
  id: string;
  label: string;
  icon: string;
  extensions: string[];
}

export interface DirectoryBreadcrumb {
  label: string;
  path: string;
}

export type DirectorySortMode = 'folders-first' | 'files-first';

const fileCategories = fileCategoriesConfig.categories as FileCategoryConfig[];

const normalizeExtension = (extension: string) => extension.replace(/^\./, '').toLowerCase();

export const getCategoryForExtension = (extension?: string | null) => {
  if (!extension) return null;
  const normalized = normalizeExtension(extension);
  return fileCategories.find((category) =>
    category.extensions.some((item) => normalizeExtension(item) === normalized),
  ) || null;
};

export const getExtensionsForCategories = (categoryIds?: string[]) => {
  if (!categoryIds?.length) return [];
  const selectedIds = new Set(categoryIds);
  return fileCategories
    .filter((category) => selectedIds.has(category.id))
    .flatMap((category) => category.extensions);
};

export const getDirectoryNodeFocusKey = (path: string) => `dir-item-${path.replace(/[^a-zA-Z0-9]/g, '-')}`;

export const buildDirectoryBreadcrumbs = (path: string): DirectoryBreadcrumb[] => {
  if (!path) return [{ label: 'This PC', path: '' }];
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  const rootMatch = normalized.match(/^[A-Za-z]:/);
  const crumbs: DirectoryBreadcrumb[] = [];

  if (rootMatch) {
    const root = `${rootMatch[0]}\\`;
    crumbs.push({ label: rootMatch[0], path: root });
    let acc = root;
    parts.slice(1).forEach((part) => {
      acc = `${acc}${part}\\`;
      crumbs.push({ label: part, path: acc });
    });
    return crumbs;
  }

  crumbs.push({ label: '/', path: '/' });
  let acc = '/';
  parts.forEach((part) => {
    acc = `${acc.replace(/\/$/, '')}/${part}`;
    crumbs.push({ label: part, path: acc });
  });
  return crumbs;
};

const abbreviateBreadcrumbLabel = (label: string) => {
  if (label.length <= 4) return label;
  return `${label.slice(0, 2)}...`;
};

export const buildDisplayBreadcrumbs = (crumbs: DirectoryBreadcrumb[], fullPath: string) => {
  const shouldCompact = crumbs.length > 4 || fullPath.length > 48;
  if (!shouldCompact) return crumbs;

  const firstLayerIndex = crumbs.length > 1 ? 1 : 0;
  const currentIndex = crumbs.length - 1;

  return crumbs.map((crumb, index) => {
    const shouldKeepFull = index === 0 || index === firstLayerIndex || index === currentIndex;
    return shouldKeepFull ? crumb : { ...crumb, label: abbreviateBreadcrumbLabel(crumb.label) };
  });
};

export const sortDirectoryNodes = (nodes: DirNode[], sortMode: DirectorySortMode) => {
  return [...nodes].sort((a, b) => {
    const aRank = a.is_file ? (sortMode === 'files-first' ? 0 : 1) : sortMode === 'files-first' ? 1 : 0;
    const bRank = b.is_file ? (sortMode === 'files-first' ? 0 : 1) : sortMode === 'files-first' ? 1 : 0;
    return aRank - bRank || a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
};
