import React, { type RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  Archive,
  Box,
  Check,
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
  X
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { DirNode } from '../hooks/useDirectoryBrowser';
import { FocusItem } from '../focus/FocusItem';
import { GamepadButtonIcon } from './GamepadButtonIcon';
import {
  getCategoryForExtension,
  getDirectoryNodeFocusKey,
  type DirectorySortMode
} from './directoryBrowserModel';

interface DirectoryBrowserContentProps {
  containerRef: RefObject<HTMLDivElement | null>;
  isMenuOpen: boolean;
  currentPath: string;
  sortMode: DirectorySortMode;
  error: string | null;
  isCreating: boolean;
  autoFocusTextInput: boolean;
  newDirName: string;
  loading: boolean;
  nodes: DirNode[];
  showFiles: boolean;
  onStartCreatingFromMenu: () => void;
  onApplySortMode: (mode: DirectorySortMode) => void;
  onArrowPress: (direction: string) => boolean;
  onNewDirNameChange: (value: string) => void;
  onConfirmCreate: () => void | Promise<boolean>;
  onCancelCreate: () => void;
  onOpenNode: (node: DirNode) => void;
}

const iconClassName = 'mr-4 shrink-0 transition-colors';

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

export const DirectoryBrowserContent: React.FC<DirectoryBrowserContentProps> = ({
  containerRef,
  isMenuOpen,
  currentPath,
  sortMode,
  error,
  isCreating,
  autoFocusTextInput,
  newDirName,
  loading,
  nodes,
  showFiles,
  onStartCreatingFromMenu,
  onApplySortMode,
  onArrowPress,
  onNewDirNameChange,
  onConfirmCreate,
  onCancelCreate,
  onOpenNode
}) => {
  const { t } = useTranslation();

  const getDisplayCategoryLabel = (extension?: string | null) => {
    const category = getCategoryForExtension(extension);
    if (!category) return extension || t('directoryBrowser.fileCategories.file');
    return t(`directoryBrowser.fileCategories.${category.id}`, { defaultValue: category.label });
  };

  return (
    <div ref={containerRef} className="custom-scrollbar relative flex-1 overflow-y-auto bg-[#141415] p-3">
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
              onEnter={onStartCreatingFromMenu}
              onArrowPress={onArrowPress}
            >
              {({ ref, focused }) => (
                <button
                  ref={ref as React.Ref<HTMLButtonElement>}
                  disabled={!currentPath}
                  onClick={onStartCreatingFromMenu}
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
              onEnter={() => onApplySortMode('folders-first')}
              onArrowPress={onArrowPress}
            >
              {({ ref, focused }) => (
                <button
                  ref={ref as React.Ref<HTMLButtonElement>}
                  onClick={() => onApplySortMode('folders-first')}
                  className={`flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm outline-none transition-colors ${focused ? 'bg-ore-green text-black' : 'text-white hover:bg-white/10'}`}
                >
                  <span>{t('directoryBrowser.sort.foldersFirst')}</span>
                  {sortMode === 'folders-first' && <Check size={16} />}
                </button>
              )}
            </FocusItem>
            <FocusItem
              focusKey="dir-menu-files-first"
              onEnter={() => onApplySortMode('files-first')}
              onArrowPress={onArrowPress}
            >
              {({ ref, focused }) => (
                <button
                  ref={ref as React.Ref<HTMLButtonElement>}
                  onClick={() => onApplySortMode('files-first')}
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
            autoFocus={autoFocusTextInput}
            type="text"
            value={newDirName}
            onChange={(event) => onNewDirNameChange(event.target.value.replace(/[^\w\s-]/g, ''))}
            className="flex-1 border border-[#2A2A2C] bg-black/50 px-3 py-1.5 text-base text-white outline-none focus:border-ore-green"
          />
          <FocusItem
            focusKey="dir-btn-confirm-new"
            onEnter={onConfirmCreate}
            onArrowPress={onArrowPress}
          >
            {({ ref, focused }) => (
              <button
                ref={ref as React.Ref<HTMLButtonElement>}
                onClick={onConfirmCreate}
                className={`rounded-sm p-1 outline-none transition-all ${focused ? 'scale-110 bg-ore-green text-black' : 'text-ore-green hover:brightness-125'}`}
              >
                <Check size={20} />
              </button>
            )}
          </FocusItem>
          <FocusItem
            focusKey="dir-btn-cancel-new"
            onEnter={onCancelCreate}
            onArrowPress={onArrowPress}
          >
            {({ ref, focused }) => (
              <button
                ref={ref as React.Ref<HTMLButtonElement>}
                onClick={onCancelCreate}
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
        <div className="space-y-1" role="list" aria-label="文件与文件夹列表">
          {nodes.map((node) => (
            <FocusItem
              key={node.path}
              focusKey={getDirectoryNodeFocusKey(node.path)}
              onEnter={() => onOpenNode(node)}
              onArrowPress={(direction) => {
                if (direction === 'up' || direction === 'down') return onArrowPress(direction);
                return false;
              }}
            >
              {({ ref, focused, tabIndex }) => (
                <div
                  ref={ref as React.Ref<HTMLDivElement>}
                  onClick={() => ref.current?.focus()}
                  onDoubleClick={() => onOpenNode(node)}
                  role="listitem"
                  aria-label={`${node.name} - ${node.is_file ? getDisplayCategoryLabel(node.extension) : t('directoryBrowser.fileCategories.folder', '文件夹')}`}
                  tabIndex={tabIndex}
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
                        <span className="hidden items-center gap-1.5 [.intent-controller_&]:flex">
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
  );
};
