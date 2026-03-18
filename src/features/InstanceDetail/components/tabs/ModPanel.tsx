// /src/features/InstanceDetail/components/tabs/ModPanel.tsx
import React, { useEffect, useState } from 'react';
import { listen, type Event } from '@tauri-apps/api/event';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { History, Loader2, RefreshCw, HardDriveDownload, FolderOpen, DownloadCloud, Clock, Type } from 'lucide-react';

import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { focusManager } from '../../../../ui/focus/FocusManager';
import { useLauncherStore } from '../../../../store/useLauncherStore';

import { useModManager } from '../../hooks/useModManager';
import { ModList } from './mods/ModList';
import { ModDetailModal } from './mods/ModDetailModal';
import type { ModMeta } from '../../logic/modService';

export const ModPanel: React.FC<{ instanceId: string }> = ({ instanceId }) => {
  const {
    mods,
    isLoading,
    instanceConfig,
    isCreatingSnapshot,
    sortType,
    setSortType,
    toggleMod,
    deleteMod,
    createSnapshot,
    openModFolder,
    loadMods
  } = useModManager(instanceId);

  const setActiveTab = useLauncherStore((state) => state.setActiveTab);
  const setInstanceDownloadTarget = useLauncherStore((state) => state.setInstanceDownloadTarget);
  const [selectedMod, setSelectedMod] = useState<ModMeta | null>(null);

  useEffect(() => {
    const unlistenPromise = listen<{ current: number; total: number }>(
      'resource-download-progress',
      (event: Event<{ current: number; total: number }>) => {
        const payload = event.payload;
        if (payload && payload.current >= payload.total && payload.total > 0) {
          setTimeout(() => {
            if (loadMods) loadMods();
          }, 500);
        }
      }
    );

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [loadMods]);

  const handleCloseModal = () => {
    setSelectedMod(null);
    setTimeout(() => focusManager.restoreFocus('tab-boundary-mods'), 50);
  };

  const handleToggle = (fileName: string, currentEnabled: boolean) => {
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
  };

  const focusFirstModItem = () => {
    if (doesFocusableExist('mod-item-0')) {
      setFocus('mod-item-0');
      return false;
    }
    return true;
  };

  const topRowKeys = ['mod-btn-history', 'mod-btn-snapshot'] as const;
  const actionRowKeys = ['mod-btn-sort-time', 'mod-btn-sort-name', 'mod-btn-folder', 'mod-btn-download'] as const;

  const handleTopRowArrow = (key: (typeof topRowKeys)[number]) => (direction: string) => {
    const index = topRowKeys.indexOf(key);

    if (direction === 'left' || direction === 'right') {
      const nextIndex = direction === 'right'
        ? (index + 1) % topRowKeys.length
        : (index - 1 + topRowKeys.length) % topRowKeys.length;
      setFocus(topRowKeys[nextIndex]);
      return false;
    }

    if (direction === 'down') {
      const nextKey = index === 0 ? 'mod-btn-sort-time' : 'mod-btn-download';
      if (doesFocusableExist(nextKey)) {
        setFocus(nextKey);
        return false;
      }
      return focusFirstModItem();
    }

    if (direction === 'up') return false;
    return true;
  };

  const handleActionRowArrow = (key: (typeof actionRowKeys)[number]) => (direction: string) => {
    const index = actionRowKeys.indexOf(key);

    if (direction === 'left' || direction === 'right') {
      const nextIndex = direction === 'right'
        ? (index + 1) % actionRowKeys.length
        : (index - 1 + actionRowKeys.length) % actionRowKeys.length;
      setFocus(actionRowKeys[nextIndex]);
      return false;
    }

    if (direction === 'down') return focusFirstModItem();

    if (direction === 'up') {
      const nextKey = index < 2 ? 'mod-btn-history' : 'mod-btn-snapshot';
      if (doesFocusableExist(nextKey)) {
        setFocus(nextKey);
        return false;
      }
      return false;
    }

    return true;
  };

  return (
    <SettingsPageLayout title="MOD 管理" subtitle="模组与快照">
      <div className="mb-4 flex items-center justify-between border-2 border-[#2A2A2C] bg-[#18181B] p-4">
        <div>
          <h3 className="flex items-center font-minecraft text-white">
            <History size={18} className="mr-2 text-ore-green" />
            模组快照
          </h3>
          <p className="mt-1 text-sm text-ore-text-muted">更新模组前建议先创建快照，方便快速回滚。</p>
        </div>

        <div className="flex space-x-3">
          <OreButton
            focusKey="mod-btn-history"
            onArrowPress={handleTopRowArrow('mod-btn-history')}
            variant="secondary"
          >
            <RefreshCw size={16} className="mr-2" />
            历史快照
          </OreButton>

          <OreButton
            focusKey="mod-btn-snapshot"
            onArrowPress={handleTopRowArrow('mod-btn-snapshot')}
            variant="primary"
            onClick={createSnapshot}
            disabled={isLoading || isCreatingSnapshot}
          >
            {isCreatingSnapshot
              ? <Loader2 size={16} className="mr-2 animate-spin" />
              : <HardDriveDownload size={16} className="mr-2" />}
            创建快照
          </OreButton>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between px-2">
        <div className="relative z-10 flex border-2 border-[#1E1E1F] bg-[#141415] p-0.5 shadow-inner">
          <FocusItem
            focusKey="mod-btn-sort-time"
            onArrowPress={handleActionRowArrow('mod-btn-sort-time')}
            onEnter={() => setSortType('time')}
          >
            {({ ref, focused }) => (
              <button
                ref={ref as React.RefObject<HTMLButtonElement>}
                onClick={() => setSortType('time')}
                className={`flex items-center px-3 py-1.5 font-minecraft text-sm outline-none transition-all ${sortType === 'time' ? 'bg-[#2A2A2C] text-white shadow-md' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'} ${focused ? 'z-20 scale-105 shadow-lg ring-2 ring-white' : ''}`}
              >
                <Clock size={14} className="mr-1.5" />
                按时间
              </button>
            )}
          </FocusItem>

          <FocusItem
            focusKey="mod-btn-sort-name"
            onArrowPress={handleActionRowArrow('mod-btn-sort-name')}
            onEnter={() => setSortType('name')}
          >
            {({ ref, focused }) => (
              <button
                ref={ref as React.RefObject<HTMLButtonElement>}
                onClick={() => setSortType('name')}
                className={`flex items-center px-3 py-1.5 font-minecraft text-sm outline-none transition-all ${sortType === 'name' ? 'bg-[#2A2A2C] text-white shadow-md' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'} ${focused ? 'z-20 scale-105 shadow-lg ring-2 ring-white' : ''}`}
              >
                <Type size={14} className="mr-1.5" />
                按名称
              </button>
            )}
          </FocusItem>
        </div>

        <div className="flex space-x-3">
          <OreButton
            focusKey="mod-btn-folder"
            onArrowPress={handleActionRowArrow('mod-btn-folder')}
            variant="secondary"
            size="sm"
            onClick={openModFolder}
          >
            <FolderOpen size={16} className="mr-2" />
            打开文件夹
          </OreButton>

          <OreButton
            focusKey="mod-btn-download"
            onArrowPress={handleActionRowArrow('mod-btn-download')}
            variant="primary"
            size="sm"
            onClick={() => {
              setInstanceDownloadTarget('mod');
              setActiveTab('instance-mod-download');
            }}
          >
            <DownloadCloud size={16} className="mr-2" />
            下载 MOD
          </OreButton>
        </div>
      </div>

      <ModList mods={mods} isLoading={isLoading} onSelectMod={setSelectedMod} />

      <ModDetailModal
        mod={selectedMod}
        instanceConfig={instanceConfig}
        onClose={handleCloseModal}
        onToggle={handleToggle}
        onDelete={deleteMod}
      />
    </SettingsPageLayout>
  );
};
