import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { listen, type Event } from '@tauri-apps/api/event';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useTranslation } from 'react-i18next';
import {
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  DownloadCloud,
  FileText,
  FolderOpen,
  History,
  Loader2,
  Power,
  RefreshCw,
  Search,
  Square,
  Trash2,
  Type,
  Wand2,
  X
} from 'lucide-react';

import { OreConfirmDialog } from '../../../../ui/primitives/OreConfirmDialog';

import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { useLauncherStore } from '../../../../store/useLauncherStore';
import { useToastStore } from '../../../../store/useToastStore';

import { useModManager, type ModSortType } from '../../hooks/useModManager';
import { ModList } from './mods/ModList';
import { ModPanelDialogs } from './mods/ModPanelDialogs';
import { useModPanelDialogs } from './mods/useModPanelDialogs';

// 普通模式的焦点序列（top-to-bottom，与 ModList 导航配合）
const NORMAL_FOCUS_ORDER = [
  'mod-btn-snapshot',
  'mod-btn-history',
  'mod-btn-folder',
  'mod-btn-cleanup',
  'mod-btn-download',
  'mod-btn-select-all',
  'mod-btn-sort-time',
  'mod-btn-sort-name',
  'mod-btn-sort-filename',
  'mod-search-input',
  'mod-search-clear',
];

// 批量选择模式的焦点序列（排序按钮隐藏，搜索框移至此行）
const BATCH_FOCUS_ORDER = [
  'mod-btn-snapshot',
  'mod-btn-history',
  'mod-btn-folder',
  'mod-btn-download',
  'mod-btn-batch-select',
  'mod-btn-batch-enable',
  'mod-btn-batch-disable',
  'mod-btn-batch-delete',
  'mod-search-input',
  'mod-btn-batch-exit',
];

export const ModPanel: React.FC<{ instanceId: string }> = ({ instanceId }) => {
  const { t } = useTranslation();
  const {
    mods,
    isLoading,
    instanceConfig,
    sortType,
    setSortType,
    sortOrder,
    setSortOrder,
    toggleMod,
    toggleMods,
    deleteMod,
    deleteMods,
    takeSnapshot,
    fetchHistory,
    diffSnapshots,
    doRollback,
    snapshotState,
    snapshotProgress,
    openModFolder,
    executeModFileCleanup,
    loadMods
  } = useModManager(instanceId);

  const setActiveTab = useLauncherStore((state) => state.setActiveTab);
  const setInstanceDownloadTarget = useLauncherStore((state) => state.setInstanceDownloadTarget);

  const [selectedMods, setSelectedMods] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [cleanupItems, setCleanupItems] = useState<{ originalFileName: string; suggestedFileName: string }[] | null>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  const addToast = useToastStore((s) => s.addToast);

  const handleAnalyzeCleanup = useCallback(() => {
    // 匹配如 [玉 🔍] 等包含中文字符的 [] 或者 【】
    const regex = /(?:\[[^\]]*[^\x00-\x7F][^\]]*\]|【[^】]*】)\s*/g;
    const items: { originalFileName: string; suggestedFileName: string }[] = [];

    mods.forEach(mod => {
      let baseName = mod.fileName;
      let isDisabled = false;
      if (baseName.endsWith('.disabled')) {
        isDisabled = true;
        baseName = baseName.replace('.disabled', '');
      }

      let newBaseName = baseName.replace(regex, '').trim();
      newBaseName = newBaseName.replace(/^[-\s]+/, '');

      if (newBaseName !== baseName && newBaseName.length > 0) {
        const suggested = isDisabled ? `${newBaseName}.disabled` : newBaseName;
        items.push({ originalFileName: mod.fileName, suggestedFileName: suggested });
      }
    });

    if (items.length > 0) {
      setCleanupItems(items);
    } else {
      addToast('info', t('modPanel.noModNamesToClean', { defaultValue: '没有找到包含中文或特殊标签的模组文件名。' }));
    }
  }, [mods, addToast, t]);

  const handleConfirmCleanup = useCallback(async () => {
    if (!cleanupItems) return;
    setIsCleaningUp(true);
    try {
      const res = await executeModFileCleanup(cleanupItems);
      addToast('success', t('modPanel.cleanSuccess', { count: res.renamed.length, defaultValue: `成功清理了 ${res.renamed.length} 个文件。` }));
    } catch (e: any) {
      console.error(e);
      addToast('error', t('modPanel.cleanFailed', { error: e.message || String(e), defaultValue: `清理失败: ${e.message || String(e)}` }));
    } finally {
      setIsCleaningUp(false);
      setCleanupItems(null);
    }
  }, [cleanupItems, executeModFileCleanup, addToast, t]);
  const handleDeletedMods = useCallback((fileNames: string[]) => {
    setSelectedMods((prev) => {
      if (prev.size === 0) {
        return prev;
      }

      const next = new Set(prev);
      fileNames.forEach((fileName) => next.delete(fileName));
      return next;
    });
  }, []);

  const { state: dialogState, actions: dialogActions } = useModPanelDialogs({
    fetchHistory,
    diffSnapshots,
    doRollback,
    toggleMod,
    deleteMod,
    deleteMods,
    onDeleteComplete: handleDeletedMods
  });

  const handleCreateSnapshot = async () => {
    try {
      const snapshot = await takeSnapshot(
        'USER_MANUAL',
        t('modSnapshots.messages.manualSnapshot', {
          count: mods.length,
          defaultValue: 'Manual Snapshot ({{count}} mods)'
        })
      );
      addToast('success', t('modSnapshots.messages.createSuccess', {
        count: snapshot.mods.length,
        defaultValue: 'Snapshot created successfully. Recorded {{count}} mods.'
      }));
      await dialogActions.syncHistoryAfterSnapshot();
    } catch (e) {
      console.error(e);
      addToast('error', t('modSnapshots.messages.createFailed', {
        defaultValue: 'Failed to create snapshot. Check the logs for details.'
      }));
    }
  };

  const isBatchMode = selectedMods.size > 0;
  const focusOrder = isBatchMode ? BATCH_FOCUS_ORDER : NORMAL_FOCUS_ORDER;

  const { handleLinearArrow: _handleLinearArrow } = useLinearNavigation(focusOrder, undefined, false);

  // 进入 ModList 区域（通过虚拟入口节点）
  const focusModListEntry = useCallback(() => {
    if (doesFocusableExist('mod-list-entry')) {
      setFocus('mod-list-entry');
      return true;
    }
    return false;
  }, []);

  // 包装 handleLinearArrow：在序列末尾向下时跳入 ModList
  const handleLinearArrow = useCallback((direction: string) => {
    if (direction === 'down') {
      const available = focusOrder.filter((k) => doesFocusableExist(k));
      const currentKey = getCurrentFocusKey();
      if (available.length > 0 && currentKey === available[available.length - 1]) {
        // 已在末尾，尝试跳入列表
        if (focusModListEntry()) return false;
      }
    }
    return _handleLinearArrow(direction);
  }, [_handleLinearArrow, focusModListEntry, focusOrder]);

  useEffect(() => {
    const unlistenPromise = listen<{ current: number; total: number }>(
      'resource-download-progress',
      (event: Event<{ current: number; total: number }>) => {
        const payload = event.payload;
        if (payload && payload.current >= payload.total && payload.total > 0) {
          setTimeout(() => {
            loadMods?.();
          }, 500);
        }
      }
    );

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [loadMods]);

  const handleSortClick = useCallback((type: ModSortType) => {
    if (sortType === type) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      return;
    }

    setSortType(type);
    setSortOrder(type === 'time' ? 'desc' : 'asc');
  }, [setSortOrder, setSortType, sortOrder, sortType]);

  const handleToggleSelection = useCallback((fileName: string) => {
    setSelectedMods((prev) => {
      const next = new Set(prev);
      if (next.has(fileName)) next.delete(fileName);
      else next.add(fileName);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedMods.size === mods.length) {
      setSelectedMods(new Set());
      return;
    }
    setSelectedMods(new Set(mods.map((mod) => mod.fileName)));
  }, [mods, selectedMods.size]);

  const handleBatchEnable = useCallback(() => {
    if (selectedMods.size === 0) return;
    toggleMods(Array.from(selectedMods), true);
  }, [selectedMods, toggleMods]);

  const handleBatchDisable = useCallback(() => {
    if (selectedMods.size === 0) return;
    toggleMods(Array.from(selectedMods), false);
  }, [selectedMods, toggleMods]);

  const openDeleteConfirm = useCallback((fileNames: string[]) => {
    dialogActions.openDeleteConfirm(fileNames);
  }, [dialogActions]);

  const handleBatchDelete = useCallback(() => {
    openDeleteConfirm(Array.from(selectedMods));
  }, [openDeleteConfirm, selectedMods]);

  // 从 ModList 向上导出时，跳回上方控件区域最后一个可用项
  const handleNavigateOutUp = useCallback(() => {
    const available = focusOrder.filter((k) => doesFocusableExist(k));
    const target = available[available.length - 1];
    if (target) {
      setFocus(target);
      return true;
    }
    return false;
  }, [focusOrder]);

  const filteredMods = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return mods;

    return mods.filter((mod) => {
      const haystack = [
        mod.name,
        mod.fileName,
        mod.description,
        mod.version,
        mod.networkInfo?.title,
        mod.networkInfo?.description
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [mods, searchQuery]);

  const isAllSelected = mods.length > 0 && selectedMods.size === mods.length;
  const searchPlaceholder = `搜索 ${mods.length} 个项目...`;

  return (
    <SettingsPageLayout>
      {/* 快照行（含文件夹与下载按钮） */}
      <div className="mb-4 flex items-center justify-between border-2 border-[#2A2A2C] bg-[#18181B] p-4">
        <div>
          <h3 className="flex items-center font-minecraft text-white">
            <History size={18} className="mr-2 text-ore-green" />
            模组快照
          </h3>

        </div>

        <div className="flex items-center gap-3">
          <OreButton
            focusKey="mod-btn-snapshot"
            variant="primary"
            size="auto"
            disabled={snapshotState !== 'idle'}
            onClick={handleCreateSnapshot}
            onArrowPress={handleLinearArrow}
            className="!h-10 !min-h-10"
          >
            {snapshotState === 'snapshotting' ? (
              <Loader2 className="mr-2 animate-spin" size={16} />
            ) : (
              <History size={16} className="mr-2" />
            )}
            {snapshotState === 'snapshotting'
              ? (snapshotProgress ? `${snapshotProgress.phase}` : '创建中...')
              : '创建快照'
            }
          </OreButton>

          <OreButton
            focusKey="mod-btn-history"
            size="auto"
            variant="secondary"
            onClick={dialogActions.openHistoryModal}
            onArrowPress={handleLinearArrow}
            className="!h-10 !min-h-10"
          >
            <RefreshCw size={16} className="mr-2" />
            历史快照
          </OreButton>

          <div className="mx-1 h-6 w-px bg-white/15" />

          <OreButton
            focusKey="mod-btn-folder"
            variant="secondary"
            size="auto"
            onClick={openModFolder}
            onArrowPress={handleLinearArrow}
            className="!h-10 !min-h-10"
          >
            <FolderOpen size={16} className="mr-2" />
            打开文件夹
          </OreButton>

          <div className="mx-1 h-6 w-px bg-white/15" />

          <OreButton
            focusKey="mod-btn-cleanup"
            variant="secondary"
            size="auto"
            onClick={handleAnalyzeCleanup}
            onArrowPress={handleLinearArrow}
            className="!h-10 !min-h-10"
          >
            <Wand2 size={16} className="mr-2" />
            清理名称
          </OreButton>

          <OreButton
            focusKey="mod-btn-download"
            variant="primary"
            size="auto"
            onClick={() => {
              setInstanceDownloadTarget('mod');
              setActiveTab('instance-mod-download');
            }}
            onArrowPress={handleLinearArrow}
            className="!h-10 !min-h-10"
          >
            <DownloadCloud size={16} className="mr-2" />
            下载 MOD
          </OreButton>
        </div>
      </div>

      {/* 控件行 */}
      <div className="mb-3 flex h-[52px] items-center justify-between gap-3 px-2 transition-all">
        {isBatchMode ? (
          /* 批量选择模式 */
          <div className="flex h-full w-full items-center justify-between rounded border-2 border-ore-green/30 bg-ore-green/10 px-3 animate-in fade-in slide-in-from-top-1">
            {/* 左：已选数量 + 操作按钮 */}
            <div className="flex items-center gap-3">
              <FocusItem
                focusKey="mod-btn-batch-select"
                onEnter={handleSelectAll}
                onArrowPress={handleLinearArrow}
              >
                {({ ref, focused }) => (
                  <button
                    ref={ref as React.RefObject<HTMLButtonElement>}
                    onClick={handleSelectAll}
                    className={`flex h-10 cursor-pointer items-center px-2 font-minecraft text-sm text-white hover:text-ore-green hover:underline decoration-ore-green underline-offset-4 transition-all focus:outline-none ${focused ? 'bg-[#2A2A2C] ring-2 ring-white rounded scale-105' : ''}`}
                  >
                    <CheckSquare size={16} className="mr-1.5 text-ore-green" />
                    已选择 {selectedMods.size} 项
                  </button>
                )}
              </FocusItem>

              <div className="mx-1 h-4 w-px bg-white/20" />

              <OreButton
                focusKey="mod-btn-batch-enable"
                size="auto"
                variant="secondary"
                onClick={handleBatchEnable}
                onArrowPress={handleLinearArrow}
                className="!h-10 !min-h-10"
              >
                <Power size={14} className="mr-1.5" />
                启用
              </OreButton>

              <OreButton
                focusKey="mod-btn-batch-disable"
                size="auto"
                variant="secondary"
                onClick={handleBatchDisable}
                onArrowPress={handleLinearArrow}
                className="!h-10 !min-h-10"
              >
                <Power size={14} className="mr-1.5 opacity-50" />
                禁用
              </OreButton>

              <OreButton
                focusKey="mod-btn-batch-delete"
                size="auto"
                variant="danger"
                onClick={handleBatchDelete}
                onArrowPress={handleLinearArrow}
                className="!h-10 !min-h-10"
              >
                <Trash2 size={14} className="mr-1.5" />
                删除
              </OreButton>
            </div>

            {/* 右：搜索框 + 退出多选 */}
            <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
              <div className="max-w-xs flex-1">
                <OreInput
                  focusKey="mod-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onArrowPress={handleLinearArrow}
                  placeholder={searchPlaceholder}
                  containerClassName="w-full"
                  prefixNode={<Search size={16} />}
                />
              </div>

              <OreButton
                focusKey="mod-btn-batch-exit"
                size="auto"
                variant="secondary"
                onClick={() => setSelectedMods(new Set())}
                onArrowPress={handleLinearArrow}
                className="!h-10 !min-h-10 flex-shrink-0"
              >
                <X size={16} className="mr-1.5" />
                退出多选
              </OreButton>
            </div>

          </div>
        ) : (
          /* 普通模式 */
          <>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <FocusItem
                focusKey="mod-btn-select-all"
                onEnter={handleSelectAll}
                onArrowPress={handleLinearArrow}
              >
                {({ ref, focused }) => (
                  <button
                    ref={ref as React.RefObject<HTMLButtonElement>}
                    onClick={handleSelectAll}
                    className={`mr-1 flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center text-gray-400 transition-colors hover:text-white focus:outline-none ${focused ? 'bg-[#2A2A2C] ring-2 ring-white rounded scale-110 shadow-lg z-20' : ''}`}
                    title={isAllSelected ? '取消全选' : '全选'}
                  >
                    {isAllSelected ? <CheckSquare size={18} className="text-ore-green" /> : <Square size={18} />}
                  </button>
                )}
              </FocusItem>

              <div className="relative z-10 flex h-10 flex-shrink-0 border-2 border-[#1E1E1F] bg-[#141415] p-0.5 shadow-inner">
                <FocusItem
                  focusKey="mod-btn-sort-time"
                  onEnter={() => handleSortClick('time')}
                  onArrowPress={handleLinearArrow}
                >
                  {({ ref, focused }) => (
                    <button
                      ref={ref as React.RefObject<HTMLButtonElement>}
                      onClick={() => handleSortClick('time')}
                      className={`flex h-full items-center px-3 font-minecraft text-sm outline-none transition-all ${sortType === 'time' ? 'bg-[#2A2A2C] text-white shadow-md' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'} ${focused ? 'z-20 scale-105 shadow-lg ring-2 ring-white' : ''}`}
                    >
                      <Clock size={14} className="mr-1.5" />
                      更新时间
                      {sortType === 'time' && (sortOrder === 'asc' ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />)}
                    </button>
                  )}
                </FocusItem>

                <FocusItem
                  focusKey="mod-btn-sort-name"
                  onEnter={() => handleSortClick('name')}
                  onArrowPress={handleLinearArrow}
                >
                  {({ ref, focused }) => (
                    <button
                      ref={ref as React.RefObject<HTMLButtonElement>}
                      onClick={() => handleSortClick('name')}
                      className={`flex h-full items-center px-3 font-minecraft text-sm outline-none transition-all ${sortType === 'name' ? 'bg-[#2A2A2C] text-white shadow-md' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'} ${focused ? 'z-20 scale-105 shadow-lg ring-2 ring-white' : ''}`}
                    >
                      <Type size={14} className="mr-1.5" />
                      名称
                      {sortType === 'name' && (sortOrder === 'asc' ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />)}
                    </button>
                  )}
                </FocusItem>

                <FocusItem
                  focusKey="mod-btn-sort-filename"
                  onEnter={() => handleSortClick('fileName')}
                  onArrowPress={handleLinearArrow}
                >
                  {({ ref, focused }) => (
                    <button
                      ref={ref as React.RefObject<HTMLButtonElement>}
                      onClick={() => handleSortClick('fileName')}
                      className={`flex h-full items-center px-3 font-minecraft text-sm outline-none transition-all ${sortType === 'fileName' ? 'bg-[#2A2A2C] text-white shadow-md' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'} ${focused ? 'z-20 scale-105 shadow-lg ring-2 ring-white' : ''}`}
                    >
                      <FileText size={14} className="mr-1.5" />
                      文件名
                      {sortType === 'fileName' && (sortOrder === 'asc' ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />)}
                    </button>
                  )}
                </FocusItem>
              </div>

              <div className="min-w-[15rem] flex-1">
                <OreInput
                  focusKey="mod-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onArrowPress={handleLinearArrow}
                  placeholder={searchPlaceholder}
                  containerClassName="w-full"
                  prefixNode={<Search size={16} />}
                />
              </div>

              {searchQuery && (
                <OreButton
                  focusKey="mod-search-clear"
                  variant="secondary"
                  size="auto"
                  onClick={() => setSearchQuery('')}
                  onArrowPress={handleLinearArrow}
                  className="!h-10 !min-h-10 min-w-[6rem] flex-shrink-0"
                >
                  <X size={16} className="mr-2" />
                  清空
                </OreButton>
              )}
            </div>


          </>
        )}
      </div>


      <ModList
        mods={filteredMods}
        isLoading={isLoading}
        selectedMods={selectedMods}
        onToggleSelection={handleToggleSelection}
        onToggleMod={(fileName, enabled) => toggleMod(fileName, enabled)}
        onSelectMod={dialogActions.openModDetail}
        onDeleteMod={(fileName) => openDeleteConfirm([fileName])}
        emptyMessage={searchQuery ? '没有匹配当前搜索的模组。' : '当前实例还没有模组。'}
        onNavigateOut={(direction) => direction === 'up' ? handleNavigateOutUp() : false}
      />

      <ModPanelDialogs
        instanceConfig={instanceConfig}
        mods={mods}
        snapshotState={snapshotState}
        state={dialogState}
        actions={dialogActions}
      />

      <OreConfirmDialog
        isOpen={cleanupItems !== null}
        onClose={() => setCleanupItems(null)}
        onConfirm={handleConfirmCleanup}
        title="清理模组文件名"
        headline={t('modPanel.cleanupHeadline', { count: cleanupItems?.length, defaultValue: `检测到 ${cleanupItems?.length} 个包含中文或特殊标签的模组文件名，确定要清理它们吗？` })}
        confirmLabel={isCleaningUp ? "清理中..." : "确认清理"}
        cancelLabel="取消"
        confirmVariant="primary"
        confirmFocusKey="mod-cleanup-confirm"
        cancelFocusKey="mod-cleanup-cancel"
        className="w-full max-w-2xl"
      >
        <div className="mt-4 max-h-64 overflow-y-auto rounded bg-[#18181B] p-2 text-sm text-left text-gray-300">
          {cleanupItems?.map((item, idx) => (
            <div key={idx} className="mb-2 border-b border-[#2A2A2C] pb-2 last:border-0 last:pb-0">
              <div className="text-red-400 line-through opacity-80">{item.originalFileName}</div>
              <div className="text-ore-green">{item.suggestedFileName}</div>
            </div>
          ))}
        </div>
      </OreConfirmDialog>
    </SettingsPageLayout>
  );
};
