import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Blocks, Loader2, RefreshCw, CheckSquare, Square, Trash2, ArrowUpCircle } from 'lucide-react';

import { FocusBoundary } from '../../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../../ui/focus/FocusItem';
import { useInputMode } from '../../../../../ui/focus/FocusProvider';
import { OreAssetRow } from '../../../../../ui/primitives/OreAssetRow';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { OreSwitch } from '../../../../../ui/primitives/OreSwitch';
import { useInputAction } from '../../../../../ui/focus/InputDriver';
import { useLinearNavigation } from '../../../../../ui/focus/useLinearNavigation';

import type { ModMeta } from '../../../logic/modService';
import { subscribeToModIcon, type ModIconPriority, type ModIconSnapshot } from '../../../logic/modIconService';

interface ModListProps {
  mods: ModMeta[];
  isLoading: boolean;
  selectedMods: Set<string>;
  onToggleSelection: (fileName: string) => void;
  onToggleMod: (fileName: string, currentEnabled: boolean) => void;
  onSelectMod: (mod: ModMeta) => void;
  onDeleteMod: (fileName: string) => void;
  emptyMessage?: string;
  onNavigateOut?: (direction: 'up' | 'down') => boolean;
}

type RowAction = 'select' | 'toggle' | 'delete';

const ROW_ACTIONS: RowAction[] = ['toggle', 'select', 'delete'];
const LIST_ENTRY_FOCUS_KEY = 'mod-list-entry';
const LIST_GUARD_TOP = 'mod-list-guard-top';
const LIST_GUARD_BOTTOM = 'mod-list-guard-bottom';
const LIST_GUARD_LEFT = 'mod-list-guard-left';
const LIST_GUARD_RIGHT = 'mod-list-guard-right';

const toFocusSlug = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_');

const PAGE_SIZE = 20;

const getIconPriority = (
  modIndex: number,
  focusedIndex: number,
  visibleCount: number
): ModIconPriority => {
  if (focusedIndex >= 0 && Math.abs(modIndex - focusedIndex) <= 2) {
    return 'high';
  }

  if (modIndex < Math.min(visibleCount, 10)) {
    return 'high';
  }

  if (focusedIndex >= 0 && Math.abs(modIndex - focusedIndex) <= 8) {
    return 'medium';
  }

  return 'low';
};


const ModRowItem = React.memo((props: {
  mod: ModMeta;
  modIndex: number;
  iconSnapshot?: ModIconSnapshot;
  focusedRowFileName: string | null;
  operationRowFileName: string | null;
  requiresRowOperation: boolean;
  isSelected: boolean;
  inputMode: string;
  rowFocusKey: string;
  setFocusedRowFileName: (fileName: string) => void;
  enterRowOperation: (fileName: string) => void;
  handleRowArrow: (direction: string) => boolean;
  focusRow: (fileName: string) => void;
  setOperationRowFileName: (fileName: string | null) => void;
  onSelectMod: (mod: ModMeta) => void;
  handleActionArrow: (fileName: string, action: RowAction, direction: string) => boolean;
  preventLockedAction: (fileName: string, e?: any) => boolean;
  onToggleMod: (fileName: string, enabled: boolean) => void;
  onToggleSelection: (fileName: string) => void;
  onDeleteMod: (fileName: string) => void;
  getActionFocusKey: (fileName: string, action: RowAction) => string;
}) => {
  const {
    mod, iconSnapshot, focusedRowFileName, operationRowFileName, requiresRowOperation,
    isSelected, inputMode, rowFocusKey, setFocusedRowFileName, enterRowOperation, handleRowArrow,
    focusRow, setOperationRowFileName, onSelectMod, handleActionArrow, preventLockedAction,
    onToggleMod, onToggleSelection, onDeleteMod, getActionFocusKey
  } = props;

  const displayName = mod.name || mod.networkInfo?.title || mod.fileName;
  const displayDesc = mod.description || mod.networkInfo?.description || '暂无描述';

  const iconUrl = iconSnapshot?.src || null;
  const isIconLoading = iconSnapshot?.status === 'loading' || (!!mod.isFetchingNetwork && !iconUrl);

  const isRowInOperationMode = operationRowFileName === mod.fileName;
  const isActionLocked = requiresRowOperation && !isRowInOperationMode;
  const isEnabled = !!mod.isEnabled;

  const formattedSize = mod.fileSize ? `${(mod.fileSize / 1024 / 1024).toFixed(1)} MB` : '未知大小';

  return (
    <FocusItem
      key={mod.fileName}
      focusKey={rowFocusKey}
      onFocus={() => setFocusedRowFileName(mod.fileName)}
      onEnter={() => enterRowOperation(mod.fileName)}
      onArrowPress={handleRowArrow}
    >
      {({ ref, focused, hasFocusedChild }) => {
        const isPrimaryRow = focusedRowFileName === mod.fileName;

        return (
          <div ref={ref as React.RefObject<HTMLDivElement>}>
            <OreAssetRow
              focusable={false}
              focused={focused}
              hasFocusedChild={hasFocusedChild}
              inactive={!isEnabled}
              selected={isSelected}
              operationActive={isRowInOperationMode}
              onClick={() => {
                setFocusedRowFileName(mod.fileName);
                if (inputMode !== 'mouse') {
                  focusRow(mod.fileName);
                  return;
                }
                setOperationRowFileName(null);
                onSelectMod(mod);
              }}
              leading={(
                <div className="relative h-full w-full">
                  {iconUrl ? (
                    <img src={iconUrl} alt="icon" className="h-full w-full object-cover" />
                  ) : (
                    <div
                      className={`flex h-full w-full items-center justify-center ${
                        isIconLoading
                          ? 'animate-pulse bg-[radial-gradient(circle_at_top,rgba(62,180,137,0.3),rgba(0,0,0,0.12)_58%)]'
                          : 'bg-[linear-gradient(135deg,rgba(255,255,255,0.14),rgba(0,0,0,0.08))]'
                      }`}
                    >
                      {isIconLoading ? (
                        <Loader2 size={16} className="animate-spin text-ore-green" />
                      ) : (
                        <Blocks size={28} className="text-[var(--ore-downloadDetail-labelText)] drop-shadow-md" />
                      )}
                    </div>
                  )}
                  {isIconLoading && !iconUrl && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-transparent via-ore-green to-transparent opacity-80" />
                  )}
                </div>
              )}
              title={displayName}
              titleClassName={isPrimaryRow ? 'brightness-100' : ''}
              badges={(
                <>
                  {mod.version && (
                    <span
                      className="flex-shrink-0 border-[2px] px-2 py-0.5 font-mono text-[10px] text-[#D0D1D4]"
                      style={{
                        backgroundColor: 'var(--ore-downloadDetail-base)',
                        borderColor: 'var(--ore-downloadDetail-divider)'
                      }}
                    >
                      v{mod.version}
                    </span>
                  )}
                  {mod.isCheckingUpdate && (
                    <span className="ml-2 flex items-center text-[10px] text-[#6B4F00]">
                      <Loader2 size={12} className="mr-1 animate-spin" />
                      检查更新中...
                    </span>
                  )}
                  {mod.hasUpdate && (
                    <span
                      title={`Available update: ${mod.updateVersionName}`}
                      className="ml-2 flex items-center border-[2px] bg-[#24563C] px-2 py-0.5 text-[10px] text-white"
                      style={{ borderColor: 'var(--ore-downloadDetail-divider)' }}
                    >
                      <ArrowUpCircle size={12} className="mr-1" />
                      可更新
                    </span>
                  )}
                </>
              )}
              description={displayDesc}
              metaItems={[`文件名：${mod.fileName}    大小：${formattedSize}`]}
              trailingClassName={`grid grid-cols-[58px_40px_40px] items-center gap-2 ${isActionLocked ? 'opacity-90' : 'opacity-100'}`}
              trailing={(
                <>
                  <div className="flex h-10 w-[58px] items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    <OreSwitch
                      focusKey={getActionFocusKey(mod.fileName, 'toggle')}
                      checked={isEnabled}
                      onArrowPress={(direction) => handleActionArrow(mod.fileName, 'toggle', direction)}
                      onChange={() => {
                        if (preventLockedAction(mod.fileName)) return;
                        onToggleMod(mod.fileName, isEnabled);
                      }}
                    />
                  </div>
                  <OreButton
                    focusKey={getActionFocusKey(mod.fileName, 'select')}
                    variant={isSelected ? 'primary' : 'secondary'}
                    size="auto"
                    onArrowPress={(direction) => handleActionArrow(mod.fileName, 'select', direction)}
                    onClick={(e) => {
                      if (preventLockedAction(mod.fileName, e)) return;
                      e.stopPropagation();
                      onToggleSelection(mod.fileName);
                    }}
                    className={`!h-10 !min-h-10 !min-w-10 !w-10 !px-0 ${isSelected ? 'text-white' : ''}`}
                  >
                    {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                  </OreButton>
                  <OreButton
                    focusKey={getActionFocusKey(mod.fileName, 'delete')}
                    variant="danger"
                    size="auto"
                    onArrowPress={(direction) => handleActionArrow(mod.fileName, 'delete', direction)}
                    onClick={(e) => {
                      if (preventLockedAction(mod.fileName, e)) return;
                      e.stopPropagation();
                      onDeleteMod(mod.fileName);
                    }}
                    className="!h-10 !min-h-10 !min-w-10 !w-10 !px-0"
                  >
                    <Trash2 size={16} />
                  </OreButton>
                </>
              )}
            />
          </div>
        );
      }}
    </FocusItem>
  );
}, (prev, next) => {
  return prev.mod.fileName === next.mod.fileName &&
         prev.iconSnapshot === next.iconSnapshot &&
         prev.focusedRowFileName === next.focusedRowFileName &&
         prev.operationRowFileName === next.operationRowFileName &&
         prev.requiresRowOperation === next.requiresRowOperation &&
         prev.isSelected === next.isSelected &&
         prev.inputMode === next.inputMode &&
         prev.mod.isEnabled === next.mod.isEnabled &&
         prev.mod.isCheckingUpdate === next.mod.isCheckingUpdate &&
         prev.mod.hasUpdate === next.mod.hasUpdate &&
         prev.mod.isFetchingNetwork === next.mod.isFetchingNetwork;
});

export const ModList: React.FC<ModListProps> = ({
  mods,
  isLoading,
  selectedMods,
  onToggleSelection,
  onToggleMod,
  onSelectMod,
  onDeleteMod,
  emptyMessage = '当前没有可用模组。',
  onNavigateOut
}) => {
  const inputMode = useInputMode();
  const requiresRowOperation = inputMode !== 'mouse';
  const [focusedRowFileName, setFocusedRowFileName] = useState<string | null>(mods[0]?.fileName ?? null);
  const [operationRowFileName, setOperationRowFileName] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [iconSnapshots, setIconSnapshots] = useState<Record<string, ModIconSnapshot>>({});
  const sentinelRef = useRef<HTMLDivElement>(null);

  const rowFocusKeyByFileName = useMemo(() => {
    const map = new Map<string, string>();
    mods.forEach((mod) => {
      map.set(mod.fileName, `mod-row-${toFocusSlug(mod.fileName)}`);
    });
    return map;
  }, [mods]);

  const rowFocusOrder = useMemo(
    () => mods.map((mod) => rowFocusKeyByFileName.get(mod.fileName) ?? ''),
    [mods, rowFocusKeyByFileName]
  );
  const availableRowFocusOrder = useMemo(
    () => rowFocusOrder.filter((key) => key && doesFocusableExist(key)),
    [rowFocusOrder]
  );

  const getActionFocusKey = useCallback((fileName: string, action: RowAction) => {
    return `mod-row-action-${action}-${toFocusSlug(fileName)}`;
  }, []);

  const focusKeyToFileName = useMemo(() => {
    const map = new Map<string, string>();

    mods.forEach((mod) => {
      const rowKey = rowFocusKeyByFileName.get(mod.fileName);
      if (rowKey) {
        map.set(rowKey, mod.fileName);
      }

      ROW_ACTIONS.forEach((action) => {
        map.set(getActionFocusKey(mod.fileName, action), mod.fileName);
      });
    });

    return map;
  }, [getActionFocusKey, mods, rowFocusKeyByFileName]);
  const focusedRowIndex = useMemo(
    () => mods.findIndex((mod) => mod.fileName === focusedRowFileName),
    [focusedRowFileName, mods]
  );

  // 当 mods 列表变化时（搜索/排序）重置懖载数
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [mods]);

  useEffect(() => {
    const activeFileNames = new Set(mods.map((mod) => mod.fileName));
    setIconSnapshots((current) => {
      const nextEntries = Object.entries(current).filter(([fileName]) => activeFileNames.has(fileName));
      if (nextEntries.length === Object.keys(current).length) {
        return current;
      }
      return Object.fromEntries(nextEntries);
    });
  }, [mods]);

  useEffect(() => {
    let disposed = false;
    const disposers: Array<() => void> = [];

    mods.slice(0, visibleCount).forEach((mod, modIndex) => {
      const priority = getIconPriority(modIndex, focusedRowIndex, visibleCount);

      void subscribeToModIcon(mod, priority, (snapshot) => {
        if (disposed) return;

        startTransition(() => {
          setIconSnapshots((current) => {
            const previous = current[mod.fileName];
            if (
              previous?.key === snapshot.key &&
              previous?.src === snapshot.src &&
              previous?.status === snapshot.status &&
              previous?.isPlaceholder === snapshot.isPlaceholder
            ) {
              return current;
            }

            return {
              ...current,
              [mod.fileName]: snapshot
            };
          });
        });
      }).then((disconnect) => {
        if (disposed) {
          disconnect();
          return;
        }
        disposers.push(disconnect);
      });
    });

    return () => {
      disposed = true;
      disposers.forEach((dispose) => dispose());
    };
  }, [focusedRowIndex, mods, visibleCount]);

  // 手柄导航到尚未渲染的行时，自动扩展可见范围
  useEffect(() => {
    if (!focusedRowFileName) return;
    const idx = mods.findIndex((m) => m.fileName === focusedRowFileName);
    if (idx >= 0 && idx >= visibleCount) {
      setVisibleCount(idx + PAGE_SIZE);
    }
  }, [focusedRowFileName, mods, visibleCount]);
  useEffect(() => {
    if (mods.length === 0) {
      setFocusedRowFileName(null);
      setOperationRowFileName(null);
      return;
    }

    if (focusedRowFileName && !mods.some((mod) => mod.fileName === focusedRowFileName)) {
      setFocusedRowFileName(mods[0].fileName);
    }

    if (operationRowFileName && !mods.some((mod) => mod.fileName === operationRowFileName)) {
      setOperationRowFileName(null);
    }
  }, [focusedRowFileName, mods, operationRowFileName]);

  // IntersectionObserver：哨兵进入视口时加载下一页
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, mods.length));
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [mods.length, visibleCount]);

  const { handleLinearArrow } = useLinearNavigation(
    rowFocusOrder,
    rowFocusOrder[0],
    true,
    mods.length > 0 && operationRowFileName === null
  );

  const focusRow = useCallback((fileName: string) => {
    const rowFocusKey = rowFocusKeyByFileName.get(fileName);
    if (!rowFocusKey || !doesFocusableExist(rowFocusKey)) return;
    setFocus(rowFocusKey);
  }, [rowFocusKeyByFileName]);

  const getSafeFocusKey = useCallback((fallback: 'current' | 'first' | 'last' = 'current') => {
    const currentFocusKey = getCurrentFocusKey();
    if (currentFocusKey && focusKeyToFileName.has(currentFocusKey) && doesFocusableExist(currentFocusKey)) {
      return currentFocusKey;
    }

    const preferredFileName = operationRowFileName ?? focusedRowFileName;
    if (preferredFileName) {
      if (operationRowFileName === preferredFileName) {
        const toggleFocusKey = getActionFocusKey(preferredFileName, 'toggle');
        if (doesFocusableExist(toggleFocusKey)) {
          return toggleFocusKey;
        }
      }

      const rowFocusKey = rowFocusKeyByFileName.get(preferredFileName);
      if (rowFocusKey && doesFocusableExist(rowFocusKey)) {
        return rowFocusKey;
      }
    }

    if (fallback === 'first') {
      return availableRowFocusOrder[0] ?? null;
    }

    if (fallback === 'last') {
      return availableRowFocusOrder[availableRowFocusOrder.length - 1] ?? null;
    }

    return availableRowFocusOrder[0] ?? null;
  }, [availableRowFocusOrder, focusKeyToFileName, focusedRowFileName, getActionFocusKey, operationRowFileName, rowFocusKeyByFileName]);

  const restoreSafeFocus = useCallback((fallback: 'current' | 'first' | 'last' = 'current') => {
    const targetFocusKey = getSafeFocusKey(fallback);
    if (targetFocusKey && doesFocusableExist(targetFocusKey)) {
      setFocus(targetFocusKey);
    }
  }, [getSafeFocusKey]);

  const enterRowOperation = useCallback((fileName: string) => {
    setFocusedRowFileName(fileName);
    setOperationRowFileName(fileName);

    const actionFocusKey = getActionFocusKey(fileName, 'toggle');
    window.setTimeout(() => {
      if (doesFocusableExist(actionFocusKey)) {
        setFocus(actionFocusKey);
      }
    }, 20);
  }, [getActionFocusKey]);

  const exitRowOperation = useCallback(() => {
    if (!operationRowFileName) return;

    const rowFileName = operationRowFileName;
    setOperationRowFileName(null);
    window.setTimeout(() => focusRow(rowFileName), 20);
  }, [focusRow, operationRowFileName]);

  const getFocusedMod = useCallback(() => {
    const currentFocusKey = getCurrentFocusKey();
    if (!currentFocusKey) return null;

    const fileName = focusKeyToFileName.get(currentFocusKey);
    if (!fileName) return null;

    return mods.find((mod) => mod.fileName === fileName) ?? null;
  }, [focusKeyToFileName, mods]);

  const handleCancelHierarchy = useCallback(() => {
    const currentFocusKey = getCurrentFocusKey();
    if (!currentFocusKey) return false;

    if (currentFocusKey === LIST_ENTRY_FOCUS_KEY) {
      if (doesFocusableExist('mod-btn-history')) {
        setFocus('mod-btn-history');
        return true;
      }
      return false;
    }

    const focusedFileName = focusKeyToFileName.get(currentFocusKey);
    if (!focusedFileName) return false;

    if (operationRowFileName === focusedFileName) {
      exitRowOperation();
      return true;
    }

    const rowFocusKey = rowFocusKeyByFileName.get(focusedFileName);
    if (currentFocusKey !== rowFocusKey) {
      focusRow(focusedFileName);
      return true;
    }

    if (doesFocusableExist('mod-btn-history')) {
      setFocus('mod-btn-history');
      return true;
    }

    return true;
  }, [exitRowOperation, focusKeyToFileName, focusRow, operationRowFileName, rowFocusKeyByFileName]);

  useEffect(() => {
    const handleEscapeCapture = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (!handleCancelHierarchy()) return;

      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener('keydown', handleEscapeCapture, true);
    return () => window.removeEventListener('keydown', handleEscapeCapture, true);
  }, [handleCancelHierarchy]);

  useInputAction('ACTION_X', () => {
    const focusedMod = getFocusedMod();
    if (!focusedMod) return;
    onToggleSelection(focusedMod.fileName);
  });

  useInputAction('ACTION_Y', () => {
    const focusedMod = getFocusedMod();
    if (!focusedMod) return;
    onSelectMod(focusedMod);
  });

  const handleRowArrow = useCallback((direction: string) => {
    if (operationRowFileName) return false;
    if (direction === 'up' || direction === 'down') {
      const currentFocusKey = getCurrentFocusKey();
      const firstRowKey = availableRowFocusOrder[0];
      const lastRowKey = availableRowFocusOrder[availableRowFocusOrder.length - 1];

      if (direction === 'up' && currentFocusKey && firstRowKey && currentFocusKey === firstRowKey) {
        return !(onNavigateOut?.('up') ?? false);
      }

      if (direction === 'down' && currentFocusKey && lastRowKey && currentFocusKey === lastRowKey) {
        return !(onNavigateOut?.('down') ?? false);
      }

      return handleLinearArrow(direction);
    }
    return false;
  }, [availableRowFocusOrder, handleLinearArrow, onNavigateOut, operationRowFileName]);

  const handleActionArrow = useCallback((fileName: string, action: RowAction, direction: string) => {
    if (inputMode === 'mouse') return true;
    if (operationRowFileName !== fileName) return false;

    if (direction === 'up' || direction === 'down') {
      const currentRowKey = rowFocusKeyByFileName.get(fileName);
      if (!currentRowKey) return false;

      const availableRows = availableRowFocusOrder;
      const currentIndex = availableRows.indexOf(currentRowKey);

      if (direction === 'up' && currentIndex === 0) {
        setOperationRowFileName(null);
        window.setTimeout(() => {
          if (!(onNavigateOut?.('up') ?? false) && doesFocusableExist(currentRowKey)) {
            setFocus(currentRowKey);
          }
        }, 20);
        return false;
      }

      const nextIndex = direction === 'down'
        ? Math.min(availableRows.length - 1, currentIndex + 1)
        : Math.max(0, currentIndex - 1);
      const targetRowKey = currentIndex >= 0 ? availableRows[nextIndex] : currentRowKey;

      setOperationRowFileName(null);
      window.setTimeout(() => {
        if (targetRowKey && doesFocusableExist(targetRowKey)) {
          setFocus(targetRowKey);
        } else if (doesFocusableExist(currentRowKey)) {
          setFocus(currentRowKey);
        }
      }, 20);
      return false;
    }

    if (direction === 'left' || direction === 'right') {
      const index = ROW_ACTIONS.indexOf(action);
      const nextIndex = direction === 'right'
        ? Math.min(ROW_ACTIONS.length - 1, index + 1)
        : Math.max(0, index - 1);

      const nextFocusKey = getActionFocusKey(fileName, ROW_ACTIONS[nextIndex]);
      if (doesFocusableExist(nextFocusKey)) {
        setFocus(nextFocusKey);
      }
      return false;
    }

    return false;
  }, [availableRowFocusOrder, getActionFocusKey, inputMode, onNavigateOut, operationRowFileName, rowFocusKeyByFileName]);

  const preventLockedAction = useCallback((fileName: string, e?: { preventDefault?: () => void; stopPropagation?: () => void }) => {
    if (!requiresRowOperation || operationRowFileName === fileName) {
      return false;
    }

    e?.preventDefault?.();
    e?.stopPropagation?.();
    setFocusedRowFileName(fileName);
    focusRow(fileName);
    return true;
  }, [focusRow, operationRowFileName, requiresRowOperation]);

  if (isLoading && mods.length === 0) {
    return (
      <div className="flex justify-center px-4 py-12">
        <div
          className="flex items-center gap-3 border-[2px] px-4 py-3 font-minecraft text-sm text-[var(--ore-downloadDetail-labelText)]"
          style={{
            backgroundColor: 'var(--ore-downloadDetail-surface)',
            borderColor: 'var(--ore-downloadDetail-divider)',
            boxShadow: 'var(--ore-downloadDetail-sectionShadow)'
          }}
        >
          <Loader2 size={18} className="animate-spin text-ore-green" />
          正在加载模组...
        </div>
      </div>
    );
  }

  if (!isLoading && mods.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div
          className="w-full max-w-xl rounded-sm border-[2px] px-6 py-10 text-center"
          style={{
            backgroundColor: 'var(--ore-downloadDetail-surface)',
            borderColor: 'var(--ore-downloadDetail-divider)',
            boxShadow: 'var(--ore-downloadDetail-sectionShadow)'
          }}
        >
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-sm border-[2px] text-[var(--ore-downloadDetail-labelText)]"
            style={{
              backgroundColor: 'var(--ore-downloadDetail-base)',
              borderColor: 'var(--ore-downloadDetail-divider)',
              boxShadow: 'var(--ore-downloadDetail-sectionInset)'
            }}
          >
            <Blocks size={22} />
          </div>
          <h3 className="font-minecraft text-base text-white">模组列表为空</h3>
          <p className="mt-2 text-sm text-[var(--ore-downloadDetail-labelText)]">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      {isLoading && mods.length > 0 && (
        <div
          className="absolute top-0 right-6 z-50 flex items-center rounded-b-md border-x-[2px] border-b-[2px] px-3 py-1.5 shadow-lg"
          style={{
            backgroundColor: 'var(--ore-downloadDetail-surface)',
            borderColor: 'var(--ore-downloadDetail-divider)',
            boxShadow: 'var(--ore-downloadDetail-sectionShadow)'
          }}
        >
          <RefreshCw size={14} className="animate-spin text-ore-green mr-2" />
          <span className="text-xs font-minecraft text-[var(--ore-downloadDetail-labelText)]">正在同步模组...</span>
        </div>
      )}

      <FocusBoundary
        id="mod-list-grid"
        trapFocus={requiresRowOperation && operationRowFileName !== null}
        onEscape={handleCancelHierarchy}
        defaultFocusKey={rowFocusOrder[0] || LIST_ENTRY_FOCUS_KEY}
        className="flex-1 min-h-0 flex flex-col overflow-y-auto custom-scrollbar px-2 pb-4 space-y-1.5"
      >
        <FocusItem focusKey={LIST_GUARD_TOP} onFocus={() => restoreSafeFocus('first')}>
          {({ ref }) => <div ref={ref as React.RefObject<HTMLDivElement>} className="absolute top-0 left-0 h-px w-full opacity-0 pointer-events-none" tabIndex={-1} />}
        </FocusItem>
        <FocusItem focusKey={LIST_GUARD_BOTTOM} onFocus={() => restoreSafeFocus('last')}>
          {({ ref }) => <div ref={ref as React.RefObject<HTMLDivElement>} className="absolute bottom-0 left-0 h-px w-full opacity-0 pointer-events-none" tabIndex={-1} />}
        </FocusItem>
        <FocusItem focusKey={LIST_GUARD_LEFT} onFocus={() => restoreSafeFocus()}>
          {({ ref }) => <div ref={ref as React.RefObject<HTMLDivElement>} className="absolute top-0 left-0 h-full w-px opacity-0 pointer-events-none" tabIndex={-1} />}
        </FocusItem>
        <FocusItem focusKey={LIST_GUARD_RIGHT} onFocus={() => restoreSafeFocus()}>
          {({ ref }) => <div ref={ref as React.RefObject<HTMLDivElement>} className="absolute top-0 right-0 h-full w-px opacity-0 pointer-events-none" tabIndex={-1} />}
        </FocusItem>

        <FocusItem
          focusKey={LIST_ENTRY_FOCUS_KEY}
          onFocus={() => restoreSafeFocus('first')}
        >
          {({ ref }) => (
            <div ref={ref as React.RefObject<HTMLDivElement>} className="h-px w-full opacity-0 pointer-events-none" />
          )}
        </FocusItem>

        {mods.map((mod, modIndex) => {
          if (modIndex >= visibleCount) return null;
          const rowFocusKey = rowFocusKeyByFileName.get(mod.fileName) ?? `mod-row-${toFocusSlug(mod.fileName)}`;

          return (
            <ModRowItem
              key={mod.fileName}
              mod={mod}
              modIndex={modIndex}
              iconSnapshot={iconSnapshots[mod.fileName]}
              focusedRowFileName={focusedRowFileName}
              operationRowFileName={operationRowFileName}
              requiresRowOperation={requiresRowOperation}
              isSelected={selectedMods.has(mod.fileName)}
              inputMode={inputMode}
              rowFocusKey={rowFocusKey}
              setFocusedRowFileName={setFocusedRowFileName}
              enterRowOperation={enterRowOperation}
              handleRowArrow={handleRowArrow}
              focusRow={focusRow}
              setOperationRowFileName={setOperationRowFileName}
              onSelectMod={onSelectMod}
              handleActionArrow={handleActionArrow}
              preventLockedAction={preventLockedAction}
              onToggleMod={onToggleMod}
              onToggleSelection={onToggleSelection}
              onDeleteMod={onDeleteMod}
              getActionFocusKey={getActionFocusKey}
            />
          );
        })}

        {/* 懖载哨兵 — 放在列表末尾 */}
        {visibleCount < mods.length && (
          <div
            ref={sentinelRef}
            className="flex items-center justify-center gap-2 py-4 text-xs font-minecraft"
            style={{ color: 'var(--ore-downloadDetail-labelText)' }}
          >
            已显示 {Math.min(visibleCount, mods.length)} / {mods.length}，养动加载更多...
          </div>
        )}
      </FocusBoundary>
    </div>
  );
};
