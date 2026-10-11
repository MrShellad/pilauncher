import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  CornerLeftUp,
  Plus
} from 'lucide-react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useTranslation } from 'react-i18next';

import { useDirectoryBrowser, type DirNode } from '../hooks/useDirectoryBrowser';
import { useInputAction } from '../focus/InputDriver';
import { FocusBoundary } from '../focus/FocusBoundary';
import { useInputMode } from '../focus/FocusProvider';
import { useLinearNavigation } from '../focus/useLinearNavigation';
import { OreButton } from '../primitives/OreButton';
import { GamepadActionHint, GamepadButtonIcon } from './GamepadButtonIcon';
import { DirectoryBrowserContent } from './DirectoryBrowserContent';
import {
  buildDirectoryBreadcrumbs,
  buildDisplayBreadcrumbs,
  getDirectoryNodeFocusKey,
  getExtensionsForCategories,
  sortDirectoryNodes,
  type DirectorySortMode
} from './directoryBrowserModel';

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
  const [sortMode, setSortMode] = useState<DirectorySortMode>('folders-first');
  const breadcrumbs = useMemo(() => buildDirectoryBreadcrumbs(currentPath), [currentPath]);
  const displayBreadcrumbs = useMemo(
    () => buildDisplayBreadcrumbs(breadcrumbs, currentPath),
    [breadcrumbs, currentPath],
  );
  const sortedNodes = useMemo(() => sortDirectoryNodes(nodes, sortMode), [nodes, sortMode]);

  const directoryFocusKey = sortedNodes.length > 0 ? getDirectoryNodeFocusKey(sortedNodes[0].path) : null;
  const footerFocusKey = allowDirectorySelection && currentPath ? 'dir-btn-select' : 'dir-btn-cancel';

  const focusOrder = [
    ...(isMenuOpen ? ['dir-menu-create', 'dir-menu-folders-first', 'dir-menu-files-first'] : []),
    ...(isCreating && !isMenuOpen ? ['dir-btn-confirm-new', 'dir-btn-cancel-new'] : []),
    ...(!isMenuOpen ? sortedNodes.map((node) => getDirectoryNodeFocusKey(node.path)) : []),
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
    // Closing the contextual menu is part of synchronizing the view to a new path.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const getDisplayBreadcrumbLabel = (label: string) => {
    if (label === 'This PC') return t('directoryBrowser.roots.thisPc');
    return label;
  };

  const applySortMode = (mode: DirectorySortMode) => {
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

          <DirectoryBrowserContent
            containerRef={listContainerRef}
            isMenuOpen={isMenuOpen}
            currentPath={currentPath}
            sortMode={sortMode}
            error={error}
            isCreating={isCreating}
            autoFocusTextInput={inputMode !== 'controller'}
            newDirName={newDirName}
            loading={loading}
            nodes={sortedNodes}
            showFiles={showFiles}
            onStartCreatingFromMenu={startCreatingFromMenu}
            onApplySortMode={applySortMode}
            onArrowPress={handleLinearArrow}
            onNewDirNameChange={setNewDirName}
            onConfirmCreate={confirmCreateDir}
            onCancelCreate={cancelCreating}
            onOpenNode={openNode}
          />

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
