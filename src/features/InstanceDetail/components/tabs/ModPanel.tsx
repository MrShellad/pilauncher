import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { listen, type Event } from '@tauri-apps/api/event';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import {
  AlertTriangle,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  DownloadCloud,
  FileText,
  FolderOpen,
  HardDriveDownload,
  History,
  Loader2,
  Power,
  RefreshCw,
  Search,
  Square,
  Trash2,
  Type,
  X
} from 'lucide-react';

import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { focusManager } from '../../../../ui/focus/FocusManager';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreConfirmDialog } from '../../../../ui/primitives/OreConfirmDialog';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { useLauncherStore } from '../../../../store/useLauncherStore';

import { useModManager, type ModSortType } from '../../hooks/useModManager';
import { ModDetailModal } from './mods/ModDetailModal';
import { ModList } from './mods/ModList';
import type { ModMeta } from '../../logic/modService';

interface PendingDeleteState {
  fileNames: string[];
  title: string;
  description: string;
}

// 普通模式的焦点序列（top-to-bottom，与 ModList 导航配合）
const NORMAL_FOCUS_ORDER = [
  'mod-btn-folder',
  'mod-btn-download',
  'mod-btn-history',
  'mod-btn-snapshot',
  'mod-btn-select-all',
  'mod-btn-sort-time',
  'mod-btn-sort-name',
  'mod-btn-sort-filename',
  'mod-search-input',
  'mod-search-clear',
];

// 批量选择模式的焦点序列（排序按钮隐藏，搜索框移至此行）
const BATCH_FOCUS_ORDER = [
  'mod-btn-folder',
  'mod-btn-download',
  'mod-btn-history',
  'mod-btn-snapshot',
  'mod-btn-batch-select',
  'mod-btn-batch-enable',
  'mod-btn-batch-disable',
  'mod-btn-batch-delete',
  'mod-search-input',
  'mod-btn-batch-exit',
];

export const ModPanel: React.FC<{ instanceId: string }> = ({ instanceId }) => {
  const {
    mods,
    isLoading,
    instanceConfig,
    isCreatingSnapshot,
    sortType,
    setSortType,
    sortOrder,
    setSortOrder,
    toggleMod,
    toggleMods,
    deleteMod,
    deleteMods,
    createSnapshot,
    openModFolder,
    loadMods
  } = useModManager(instanceId);

  const setActiveTab = useLauncherStore((state) => state.setActiveTab);
  const setInstanceDownloadTarget = useLauncherStore((state) => state.setInstanceDownloadTarget);

  const [selectedMod, setSelectedMod] = useState<ModMeta | null>(null);
  const [selectedMods, setSelectedMods] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteState | null>(null);
  const [lastDeleteFocusKey, setLastDeleteFocusKey] = useState<string | null>(null);

  // 根据当前模式选择焦点序列
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

  const handleCloseModal = useCallback(() => {
    setSelectedMod(null);
    setTimeout(() => focusManager.restoreFocus('tab-boundary-mods'), 50);
  }, []);

  const handleSortClick = useCallback((type: ModSortType) => {
    if (sortType === type) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      return;
    }

    setSortType(type);
    setSortOrder(type === 'time' ? 'desc' : 'asc');
  }, [setSortOrder, setSortType, sortOrder, sortType]);

  const handleToggle = useCallback((fileName: string, currentEnabled: boolean) => {
    setSelectedMod((prev) => (
      prev
        ? {
          ...prev,
          isEnabled: !currentEnabled,
          fileName: currentEnabled ? `${fileName}.disabled` : fileName.replace('.disabled', '')
        }
        : null
    ));
    toggleMod(fileName, currentEnabled);
  }, [toggleMod]);

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
    if (fileNames.length === 0) return;

    const currentFocusKey = getCurrentFocusKey();
    if (currentFocusKey && currentFocusKey !== 'SN:ROOT') {
      setLastDeleteFocusKey(currentFocusKey);
    }

    const isBatch = fileNames.length > 1;
    setPendingDelete({
      fileNames,
      title: isBatch ? `删除 ${fileNames.length} 个模组` : '删除模组',
      description: isBatch
        ? `这会从当前实例中永久删除选中的 ${fileNames.length} 个模组文件。`
        : `这会从当前实例中永久删除"${fileNames[0]}"。`
    });
  }, []);

  const handleBatchDelete = useCallback(() => {
    openDeleteConfirm(Array.from(selectedMods));
  }, [openDeleteConfirm, selectedMods]);

  const handleCloseDeleteConfirm = useCallback(() => {
    setPendingDelete(null);
    window.setTimeout(() => {
      if (lastDeleteFocusKey && doesFocusableExist(lastDeleteFocusKey)) {
        setFocus(lastDeleteFocusKey);
      }
    }, 50);
  }, [lastDeleteFocusKey]);

  const handleConfirmDelete = useCallback(() => {
    if (!pendingDelete) return;

    if (pendingDelete.fileNames.length === 1) {
      deleteMod(pendingDelete.fileNames[0]);
    } else {
      deleteMods(pendingDelete.fileNames);
    }

    setSelectedMods((prev) => {
      const next = new Set(prev);
      pendingDelete.fileNames.forEach((fileName) => next.delete(fileName));
      return next;
    });

    handleCloseDeleteConfirm();
  }, [deleteMod, deleteMods, handleCloseDeleteConfirm, pendingDelete]);

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
          <p className="mt-1 text-sm text-ore-text-muted">更新模组前先创建快照，方便快速回滚。</p>
        </div>

        <div className="flex items-center gap-3">
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

          <div className="mx-1 h-6 w-px bg-white/15" />

          <OreButton
            focusKey="mod-btn-history"
            variant="secondary"
            onArrowPress={handleLinearArrow}
          >
            <RefreshCw size={16} className="mr-2" />
            历史快照
          </OreButton>

          <OreButton
            focusKey="mod-btn-snapshot"
            variant="primary"
            onClick={createSnapshot}
            disabled={isLoading || isCreatingSnapshot}
            onArrowPress={handleLinearArrow}
          >
            {isCreatingSnapshot
              ? <Loader2 size={16} className="mr-2 animate-spin" />
              : <HardDriveDownload size={16} className="mr-2" />}
            创建快照
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
        onSelectMod={setSelectedMod}
        onDeleteMod={(fileName) => openDeleteConfirm([fileName])}
        emptyMessage={searchQuery ? '没有匹配当前搜索的模组。' : '当前实例还没有模组。'}
        onNavigateOut={(direction) => direction === 'up' ? handleNavigateOutUp() : false}
      />

      <ModDetailModal
        mod={selectedMod}
        instanceConfig={instanceConfig}
        onClose={handleCloseModal}
        onToggle={handleToggle}
        onDelete={deleteMod}
      />

      <OreConfirmDialog
        isOpen={pendingDelete !== null}
        onClose={handleCloseDeleteConfirm}
        onConfirm={handleConfirmDelete}
        title={pendingDelete?.title ?? '删除模组'}
        headline={pendingDelete?.description}
        confirmLabel="确认删除"
        cancelLabel="取消"
        confirmVariant="danger"
        confirmFocusKey="mod-delete-confirm"
        cancelFocusKey="mod-delete-cancel"
        className="w-full max-w-lg"
        dialogIcon={<AlertTriangle size={24} className="text-red-400" />}
        confirmationNote="删除后无法通过启动器撤销。"
        confirmationNoteTone="danger"
      />
    </SettingsPageLayout>
  );
};
