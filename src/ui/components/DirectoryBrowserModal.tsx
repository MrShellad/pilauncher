import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Archive,
  Box,
  Check,
  ChevronLeft,
  ChevronRight,
  CornerLeftUp,
  File,
  FileImage,
  FileText,
  Folder,
  Gamepad2,
  HardDrive,
  MousePointer2,
  Plus,
  Settings,
  TerminalSquare,
  X,
} from 'lucide-react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useTranslation } from 'react-i18next';

import fileCategoriesConfig from '../../assets/config/file_categories.json';
import { useDirectoryBrowser, type DirNode } from '../hooks/useDirectoryBrowser';
import { useInputAction } from '../focus/InputDriver';
import { FocusBoundary } from '../focus/FocusBoundary';
import { FocusItem } from '../focus/FocusItem';
import { useInputMode } from '../focus/FocusProvider';
import { useLinearNavigation } from '../focus/useLinearNavigation';
import { OreButton } from '../primitives/OreButton';
import { GamepadActionHint, GamepadButtonIcon } from './GamepadButtonIcon';

interface DirectoryBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
  showFiles?: boolean;
  allowedExtensions?: string[];
  fileCategories?: string[];
  title?: string;
  allowDirectorySelection?: boolean;
}

interface FileCategoryConfig {
  id: string;
  label: string;
  icon: string;
  extensions: string[];
}

type SortMode = 'folders-first' | 'files-first';

const fileCategories = fileCategoriesConfig.categories as FileCategoryConfig[];

const iconClassName = 'mr-4 shrink-0 transition-colors';

const normalizeExtension = (extension: string) => extension.replace(/^\./, '').toLowerCase();

const getCategoryForExtension = (extension?: string | null) => {
  if (!extension) return null;
  const normalized = normalizeExtension(extension);
  return fileCategories.find((category) =>
    category.extensions.some((item) => normalizeExtension(item) === normalized),
  ) || null;
};

const getExtensionsForCategories = (categoryIds?: string[]) => {
  if (!categoryIds?.length) return [];
  const selectedIds = new Set(categoryIds);
  return fileCategories
    .filter((category) => selectedIds.has(category.id))
    .flatMap((category) => category.extensions);
};

const getNodeFocusKey = (path: string) => `dir-item-${path.replace(/[^a-zA-Z0-9]/g, '-')}`;

const getFileIcon = (node: DirNode, focused: boolean) => {
  const focusRing = focused ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.24)]' : '';
  if (node.is_drive) {
    return <HardDrive size={28} className={`${iconClassName} text-cyan-300 ${focusRing}`} />;
  }
  if (!node.is_file) {
    return <Folder size={28} className={`${iconClassName} text-amber-300 ${focusRing}`} />;
  }

  const category = getCategoryForExtension(node.extension);
  switch (category?.icon) {
    case 'archive':
      return <Archive size={26} className={`${iconClassName} text-orange-300 ${focusRing}`} />;
    case 'image':
      return <FileImage size={26} className={`${iconClassName} text-pink-300 ${focusRing}`} />;
    case 'settings':
      return <Settings size={26} className={`${iconClassName} text-sky-300 ${focusRing}`} />;
    case 'terminal':
      return <TerminalSquare size={26} className={`${iconClassName} text-lime-300 ${focusRing}`} />;
    case 'document':
      return <FileText size={26} className={`${iconClassName} text-blue-300 ${focusRing}`} />;
    case 'cube':
      return <Box size={26} className={`${iconClassName} text-emerald-300 ${focusRing}`} />;
    default:
      return <File size={26} className={`${iconClassName} text-violet-300 ${focusRing}`} />;
  }
};

const buildBreadcrumbs = (path: string) => {
  if (!path) return [{ label: 'This PC', path: '' }];
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  const rootMatch = normalized.match(/^[A-Za-z]:/);
  const crumbs: Array<{ label: string; path: string }> = [];

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

const buildDisplayBreadcrumbs = (crumbs: Array<{ label: string; path: string }>, fullPath: string) => {
  const shouldCompact = crumbs.length > 4 || fullPath.length > 48;
  if (!shouldCompact) return crumbs;

  const firstLayerIndex = crumbs.length > 1 ? 1 : 0;
  const currentIndex = crumbs.length - 1;

  return crumbs.map((crumb, index) => {
    const shouldKeepFull = index === 0 || index === firstLayerIndex || index === currentIndex;
    return shouldKeepFull ? crumb : { ...crumb, label: abbreviateBreadcrumbLabel(crumb.label) };
  });
};

export const DirectoryBrowserModal: React.FC<DirectoryBrowserModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialPath,
  showFiles = false,
  allowedExtensions,
  fileCategories: enabledFileCategories,
  title,
  allowDirectorySelection = true,
}) => {
  const { t } = useTranslation();
  const effectiveExtensions = useMemo(
    () => [...(allowedExtensions || []), ...getExtensionsForCategories(enabledFileCategories)],
    [allowedExtensions, enabledFileCategories],
  );

  const {
    currentPath,
    nodes,
    loading,
    error,
    goUp,
    goToPath,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
    isCreating,
    newDirName,
    setNewDirName,
    startCreating,
    cancelCreating,
    confirmCreateDir,
  } = useDirectoryBrowser(isOpen, initialPath, {
    showFiles,
    allowedExtensions: effectiveExtensions,
  });

  const listContainerRef = useRef<HTMLDivElement>(null);
  const inputMode = useInputMode();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('folders-first');
  const breadcrumbs = useMemo(() => buildBreadcrumbs(currentPath), [currentPath]);
  const displayBreadcrumbs = useMemo(
    () => buildDisplayBreadcrumbs(breadcrumbs, currentPath),
    [breadcrumbs, currentPath],
  );
  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => {
      const aRank = a.is_file ? (sortMode === 'files-first' ? 0 : 1) : sortMode === 'files-first' ? 1 : 0;
      const bRank = b.is_file ? (sortMode === 'files-first' ? 0 : 1) : sortMode === 'files-first' ? 1 : 0;
      return aRank - bRank || a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  }, [nodes, sortMode]);

  const directoryFocusKey = sortedNodes.length > 0 ? getNodeFocusKey(sortedNodes[0].path) : null;
  const footerFocusKey = allowDirectorySelection && currentPath ? 'dir-btn-select' : 'dir-btn-cancel';

  const focusOrder = [
    ...(isMenuOpen ? ['dir-menu-create', 'dir-menu-folders-first', 'dir-menu-files-first'] : []),
    ...(isCreating && !isMenuOpen ? ['dir-btn-confirm-new', 'dir-btn-cancel-new'] : []),
    ...(!isMenuOpen ? sortedNodes.map((node) => getNodeFocusKey(node.path)) : []),
    'dir-btn-cancel',
    ...(allowDirectorySelection ? ['dir-btn-select'] : []),
  ];

  const { handleLinearArrow } = useLinearNavigation(
    focusOrder,
    directoryFocusKey || footerFocusKey,
    true,
    isOpen && !loading,
  );

  useEffect(() => {
    if (listContainerRef.current) listContainerRef.current.scrollTop = 0;
    setIsMenuOpen(false);
  }, [currentPath]);

  useInputAction('CANCEL', () => {
    if (!isOpen) return;
    if (isMenuOpen) setIsMenuOpen(false);
    else if (isCreating) cancelCreating();
    else onClose();
  });

  useInputAction('TAB_LEFT', () => {
    if (isOpen && !isCreating && currentPath) goUp();
  });

  useInputAction('TAB_RIGHT', () => {
    if (isOpen && !isCreating && canGoForward) goForward();
  });

  useInputAction('PAGE_LEFT', () => {
    if (isOpen && !isCreating && currentPath) goUp();
  });

  useInputAction('PAGE_RIGHT', () => {
    if (isOpen && !isCreating && canGoForward) goForward();
  });

  useInputAction('MENU', () => {
    if (!isOpen || isCreating) return;
    setIsMenuOpen((open) => !open);
  });

  useInputAction('ACTION_X', () => {
    if (!isOpen || isCreating || isMenuOpen) return;
    const currentFocusKey = getCurrentFocusKey();
    const isFooterFocused = currentFocusKey === 'dir-btn-cancel' || currentFocusKey === 'dir-btn-select';
    const target = isFooterFocused ? directoryFocusKey || footerFocusKey : footerFocusKey;
    if (doesFocusableExist(target)) setFocus(target);
  });

  useEffect(() => {
    if (isOpen && isCreating) {
      const timer = window.setTimeout(() => {
        if (doesFocusableExist('dir-btn-confirm-new')) setFocus('dir-btn-confirm-new');
      }, 50);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen, isCreating]);

  useEffect(() => {
    if (!isOpen || !isMenuOpen) return;
    const timer = window.setTimeout(() => {
      const target = currentPath ? 'dir-menu-create' : 'dir-menu-folders-first';
      if (doesFocusableExist(target)) setFocus(target);
    }, 50);
    return () => window.clearTimeout(timer);
  }, [currentPath, isOpen, isMenuOpen]);

  if (!isOpen) return null;

  const openNode = (node: DirNode) => {
    if (node.is_file) onSelect(node.path);
    else goToPath(node.path);
  };

  const startCreatingFromMenu = () => {
    setIsMenuOpen(false);
    startCreating();
  };

  const getDisplayCategoryLabel = (extension?: string | null) => {
    const category = getCategoryForExtension(extension);
    if (!category) return extension || t('directoryBrowser.fileCategories.file');
    return t(`directoryBrowser.fileCategories.${category.id}`, { defaultValue: category.label });
  };

  const getDisplayBreadcrumbLabel = (label: string) => {
    if (label === 'This PC') return t('directoryBrowser.roots.thisPc');
    return label;
  };

  const applySortMode = (mode: SortMode) => {
    setSortMode(mode);
    setIsMenuOpen(false);
    window.setTimeout(() => {
      const target = directoryFocusKey || footerFocusKey;
      if (doesFocusableExist(target)) setFocus(target);
    }, 0);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 font-minecraft backdrop-blur-sm"
    >
      <FocusBoundary
        id="directory-browser-boundary"
        trapFocus={isOpen}
        onEscape={onClose}
        className="relative z-10 outline-none"
      >
        <motion.div
          initial={{ scale: 0.95, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          className="flex h-[720px] max-h-[88vh] w-[980px] max-w-[94vw] flex-col overflow-hidden border-2 border-[#1E1E1F] bg-[#18181B] shadow-2xl"
        >
          <div className="flex shrink-0 flex-col gap-4 border-b-2 border-[#1E1E1F] bg-[#1E1E1F] p-5">
            <h3 className="text-xl text-white">
              {title || t(showFiles ? 'directoryBrowser.title.fileOrDirectory' : 'directoryBrowser.title.directory')}
            </h3>
            <div className="flex items-center gap-3">
              <OreButton
                onClick={goBack}
                disabled={!canGoBack}
                variant="secondary"
                size="auto"
                focusable={false}
                className="!h-10 !min-w-0 !px-3"
                tabIndex={-1}
              >
                <ChevronLeft size={18} />
              </OreButton>
              <OreButton
                onClick={goForward}
                disabled={!canGoForward}
                variant="secondary"
                size="auto"
                focusable={false}
                className="!h-10 !min-w-0 !px-3"
                tabIndex={-1}
              >
                <ChevronRight size={18} />
              </OreButton>
              <OreButton
                onClick={goUp}
                disabled={!currentPath}
                variant="secondary"
                size="auto"
                focusable={false}
                className="!h-10 !min-w-0 !px-3"
                tabIndex={-1}
              >
                <CornerLeftUp size={18} />
              </OreButton>

              <div className="flex h-10 min-w-0 flex-1 items-center overflow-hidden border border-[#2A2A2C] bg-[#141415] px-3 text-sm text-ore-text-muted">
                <div className="flex min-w-0 items-center gap-1 overflow-hidden">
                  {displayBreadcrumbs.map((crumb, index) => (
                    <React.Fragment key={`${crumb.path}-${index}`}>
                      {index > 0 && <ChevronRight size={13} className="shrink-0 opacity-45" />}
                      <span
                        className="max-w-[12rem] shrink truncate rounded-sm bg-white/5 px-2 py-1 text-white/80"
                        title={getDisplayBreadcrumbLabel(breadcrumbs[index]?.label || crumb.label)}
                      >
                        {getDisplayBreadcrumbLabel(crumb.label)}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {currentPath && (
                <OreButton
                  onClick={startCreating}
                  variant="primary"
                  size="auto"
                  focusable={false}
                  className="!h-10"
                  tabIndex={-1}
                >
                  <Plus size={18} className="mr-1" /> {t('directoryBrowser.actions.newFolder')}
                </OreButton>
              )}
            </div>
          </div>

          <div ref={listContainerRef} className="custom-scrollbar relative flex-1 overflow-y-auto bg-[#141415] p-3">
            <AnimatePresence>
              {isMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="absolute right-4 top-4 z-30 w-64 border border-[#3A3A3D] bg-[#1E1E1F] p-2 shadow-2xl"
                >
                  <div className="border-b border-white/10 px-3 py-2 text-xs uppercase tracking-[0.14em] text-ore-text-muted">
                    {t('directoryBrowser.menu.currentDirectory')}
                  </div>
                  <FocusItem
                    focusKey="dir-menu-create"
                    disabled={!currentPath}
                    onEnter={startCreatingFromMenu}
                    onArrowPress={handleLinearArrow}
                  >
                    {({ ref, focused }) => (
                      <button
                        ref={ref as any}
                        disabled={!currentPath}
                        onClick={startCreatingFromMenu}
                        className={`flex w-full items-center rounded-sm px-3 py-2 text-left text-sm outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${focused ? 'bg-ore-green text-black' : 'text-white hover:bg-white/10'}`}
                      >
                        <Plus size={16} className="mr-2" /> {t('directoryBrowser.actions.newFolder')}
                      </button>
                    )}
                  </FocusItem>
                  <div className="mt-2 border-t border-white/10 px-3 py-2 text-xs uppercase tracking-[0.14em] text-ore-text-muted">
                    {t('directoryBrowser.menu.sort')}
                  </div>
                  <FocusItem
                    focusKey="dir-menu-folders-first"
                    onEnter={() => applySortMode('folders-first')}
                    onArrowPress={handleLinearArrow}
                  >
                    {({ ref, focused }) => (
                      <button
                        ref={ref as any}
                        onClick={() => applySortMode('folders-first')}
                        className={`flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm outline-none transition-colors ${focused ? 'bg-ore-green text-black' : 'text-white hover:bg-white/10'}`}
                      >
                        <span>{t('directoryBrowser.sort.foldersFirst')}</span>
                        {sortMode === 'folders-first' && <Check size={16} />}
                      </button>
                    )}
                  </FocusItem>
                  <FocusItem
                    focusKey="dir-menu-files-first"
                    onEnter={() => applySortMode('files-first')}
                    onArrowPress={handleLinearArrow}
                  >
                    {({ ref, focused }) => (
                      <button
                        ref={ref as any}
                        onClick={() => applySortMode('files-first')}
                        className={`flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm outline-none transition-colors ${focused ? 'bg-ore-green text-black' : 'text-white hover:bg-white/10'}`}
                      >
                        <span>{t('directoryBrowser.sort.filesFirst')}</span>
                        {sortMode === 'files-first' && <Check size={16} />}
                      </button>
                    )}
                  </FocusItem>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <div className="mx-2 mb-3 flex items-center border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
                <AlertCircle size={16} className="mr-2 shrink-0" /> {error}
              </div>
            )}

            {isCreating && (
              <div className="mb-3 flex items-center gap-3 border border-ore-green/30 bg-ore-green/10 p-3">
                <Folder size={24} className="shrink-0 text-ore-green" />
                <input
                  autoFocus={inputMode !== 'controller'}
                  type="text"
                  value={newDirName}
                  onChange={(e) => setNewDirName(e.target.value.replace(/[^\w\s-]/g, ''))}
                  className="flex-1 border border-[#2A2A2C] bg-black/50 px-3 py-1.5 text-base text-white outline-none focus:border-ore-green"
                />
                <FocusItem
                  focusKey="dir-btn-confirm-new"
                  onEnter={confirmCreateDir}
                  onArrowPress={handleLinearArrow}
                >
                  {({ ref, focused }) => (
                    <button
                      ref={ref as any}
                      onClick={confirmCreateDir}
                      className={`rounded-sm p-1 outline-none transition-all ${focused ? 'scale-110 bg-ore-green text-black' : 'text-ore-green hover:brightness-125'}`}
                    >
                      <Check size={20} />
                    </button>
                  )}
                </FocusItem>
                <FocusItem
                  focusKey="dir-btn-cancel-new"
                  onEnter={cancelCreating}
                  onArrowPress={handleLinearArrow}
                >
                  {({ ref, focused }) => (
                    <button
                      ref={ref as any}
                      onClick={cancelCreating}
                      className={`rounded-sm p-1 outline-none transition-all ${focused ? 'scale-110 bg-red-400 text-black' : 'text-red-400 hover:brightness-125'}`}
                    >
                      <X size={20} />
                    </button>
                  )}
                </FocusItem>
              </div>
            )}

            {loading ? (
              <div className="mt-10 animate-pulse text-center text-base text-ore-text-muted">
                {t('directoryBrowser.status.loading')}
              </div>
            ) : (
              <div className="space-y-1">
                {sortedNodes.map((node) => (
                  <FocusItem
                    key={node.path}
                    focusKey={getNodeFocusKey(node.path)}
                    onEnter={() => openNode(node)}
                    onArrowPress={(direction) => {
                      if (direction === 'up' || direction === 'down') return handleLinearArrow(direction);
                      return false;
                    }}
                  >
                    {({ ref, focused }) => (
                      <div
                        ref={ref as any}
                        onClick={() => {
                          (ref.current as any)?.focus();
                        }}
                        onDoubleClick={() => openNode(node)}
                        className={`group z-0 flex cursor-pointer select-none items-center rounded-sm border-2 p-3 outline-none transition-all ${focused ? 'z-10 scale-[1.01] border-ore-green bg-ore-green/15 text-white shadow-lg' : 'border-transparent bg-transparent text-ore-text-muted hover:bg-white/5 hover:text-white'}`}
                      >
                        {getFileIcon(node, focused)}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-lg font-minecraft">{node.name}</div>
                          {node.is_file && (
                            <div className="truncate text-xs uppercase tracking-[0.12em] text-ore-text-muted">
                              {getDisplayCategoryLabel(node.extension)}
                            </div>
                          )}
                        </div>

                        <AnimatePresence>
                          {focused && (
                            <motion.div
                              initial={{ opacity: 0, x: 5 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 5 }}
                              className="flex items-center gap-2 pl-2 text-xs text-ore-green/80"
                            >
                              <span className="hidden items-center gap-1.5 intent-gamepad:flex">
                                <Gamepad2 size={14} /> <GamepadButtonIcon button="A" />
                                {node.is_file
                                  ? ` ${t('directoryBrowser.actions.select')}`
                                  : ` ${t('directoryBrowser.actions.open')}`}
                              </span>
                              <span className="hidden items-center gap-1.5 intent-mouse:flex">
                                <MousePointer2 size={14} /> {t('directoryBrowser.hints.doubleClick')}
                              </span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </FocusItem>
                ))}
              </div>
            )}

            {!loading && nodes.length === 0 && !isCreating && !error && (
              <div className="mt-16 flex flex-col items-center gap-3 text-center text-base text-ore-text-muted opacity-60">
                <Folder size={40} className="opacity-40" />
                {t(showFiles ? 'directoryBrowser.empty.noMatchingItems' : 'directoryBrowser.empty.noSubdirectories')}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-between border-t-2 border-[#1E1E1F] bg-[#1E1E1F] p-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3 whitespace-nowrap">
              <GamepadActionHint button="A" label={t('directoryBrowser.hints.openConfirm')} />
              <GamepadActionHint button="B" label={t('directoryBrowser.hints.cancel')} />
              <div className="flex items-center gap-2">
                <GamepadButtonIcon button="LB" />
                <GamepadButtonIcon button="RB" />
                <span className="font-minecraft text-[10px] uppercase tracking-[0.14em] text-ore-text-muted">
                  {t('directoryBrowser.hints.upForward')}
                </span>
              </div>
              <GamepadActionHint button="MENU" label={t('directoryBrowser.hints.actions')} />
              <GamepadActionHint button="X" label={t('directoryBrowser.hints.listFooter')} />
            </div>
            <div className="hidden items-center gap-3 whitespace-nowrap intent-mouse:flex">
              <span className="font-minecraft text-[10px] uppercase tracking-[0.14em] text-ore-text-muted">
                {t('directoryBrowser.hints.keyboard')}
              </span>
            </div>
            <div className="flex items-center justify-end gap-4">
              <OreButton
                onClick={onClose}
                variant="ghost"
                size="auto"
                focusKey="dir-btn-cancel"
                className="!h-10"
                onArrowPress={handleLinearArrow}
              >
                {t('directoryBrowser.actions.cancel')}
              </OreButton>
              {allowDirectorySelection && (
                <OreButton
                  onClick={() => onSelect(currentPath)}
                  disabled={!currentPath}
                  variant="primary"
                  size="auto"
                  focusKey="dir-btn-select"
                  className="!h-10"
                  onArrowPress={handleLinearArrow}
                >
                  {t('directoryBrowser.actions.selectCurrentDirectory')}
                </OreButton>
              )}
            </div>
          </div>
        </motion.div>
      </FocusBoundary>
    </motion.div>
  );
};
