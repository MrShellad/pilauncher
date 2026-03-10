import React, { useMemo, useState } from 'react';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { useInputAction } from '../../../../ui/focus/InputDriver';
import { ControlHint } from '../../../../ui/components/ControlHint';
import { OreDropdown } from '../../../../ui/primitives/OreDropdown';
import { OreToggleButton, type ToggleOption } from '../../../../ui/primitives/OreToggleButton';

interface VersionFiltersProps {
  versionsCount: number;
  loaderOptions: ToggleOption[];
  activeLoader: string;
  setActiveLoader: (val: string) => void;
  availableVersions: string[];
  activeVersion: string;
  setActiveVersion: (val: string) => void;
}

interface DropdownConfig {
  key: string;
  placeholder: string;
  options: Array<{ label: string; value: string }>;
}

export const VersionFilters: React.FC<VersionFiltersProps> = ({
  versionsCount,
  loaderOptions,
  activeLoader,
  setActiveLoader,
  availableVersions,
  activeVersion,
  setActiveVersion
}) => {
  const [isAnyDropdownOpen, setIsAnyDropdownOpen] = useState(false);

  const { majorGroups, topMajors, moreReleases, snapshots } = useMemo(() => {
    const groups: Record<string, string[]> = {};
    const snapshotVersions: string[] = [];
    const sortDesc = (a: string, b: string) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' });

    availableVersions.forEach((version) => {
      const lowerVersion = version.toLowerCase();
      if (
        /^\d{2}w\d{2}[a-z]$/.test(lowerVersion) ||
        lowerVersion.includes('snapshot') ||
        lowerVersion.includes('experimental') ||
        lowerVersion.includes('alpha') ||
        lowerVersion.includes('beta')
      ) {
        snapshotVersions.push(version);
        return;
      }

      if (/^1\.\d+/.test(version)) {
        const match = version.match(/^1\.(\d+)/);
        const major = match ? match[0] : '1.x';
        if (!groups[major]) groups[major] = [];
        groups[major].push(version);
        return;
      }

      snapshotVersions.push(version);
    });

    const sortedMajors = Object.keys(groups).sort((a, b) => {
      const numA = parseInt(a.split('.')[1] || '0', 10);
      const numB = parseInt(b.split('.')[1] || '0', 10);
      return numB - numA;
    });

    const pinnedMajors = sortedMajors.slice(0, 4);
    const olderMajors = sortedMajors.slice(4);
    const olderVersions: string[] = [];

    olderMajors.forEach((major) => {
      groups[major].sort(sortDesc);
      olderVersions.push(...groups[major]);
    });

    pinnedMajors.forEach((major) => groups[major].sort(sortDesc));
    snapshotVersions.sort(sortDesc);

    return {
      majorGroups: groups,
      topMajors: pinnedMajors,
      moreReleases: olderVersions,
      snapshots: snapshotVersions
    };
  }, [availableVersions]);

  const dropdownConfigs = useMemo<DropdownConfig[]>(() => {
    const configs = topMajors.map((major) => ({
      key: `major-${major}`,
      placeholder: major,
      options: [
        { label: `清除选择 (${major})`, value: '' },
        ...majorGroups[major].map((version) => ({ label: version, value: version }))
      ]
    }));

    if (moreReleases.length > 0) {
      configs.push({
        key: 'history',
        placeholder: '更多历史',
        options: [
          { label: '清除选择 (历史)', value: '' },
          ...moreReleases.map((version) => ({ label: version, value: version }))
        ]
      });
    }

    if (snapshots.length > 0) {
      configs.push({
        key: 'snapshot',
        placeholder: '快照 / 预览',
        options: [
          { label: '清除选择 (快照)', value: '' },
          ...snapshots.map((version) => ({ label: version, value: version }))
        ]
      });
    }

    return configs;
  }, [topMajors, majorGroups, moreReleases, snapshots]);

  const cycleLoader = () => {
    if (isAnyDropdownOpen || loaderOptions.length === 0) return;

    const currentIndex = loaderOptions.findIndex((option) => option.value === activeLoader);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % loaderOptions.length;
    setActiveLoader(loaderOptions[nextIndex].value);
  };

  useInputAction('ACTION_Y', cycleLoader);

  const handleDropdownArrow = (idx: number) => (direction: string) => {
    if (direction === 'left' || direction === 'right') {
      if (dropdownConfigs.length === 0) return false;

      const nextIndex = direction === 'right'
        ? (idx + 1) % dropdownConfigs.length
        : (idx - 1 + dropdownConfigs.length) % dropdownConfigs.length;

      setFocus(`download-modal-mc-dropdown-${nextIndex}`);
      return false;
    }

    if (direction === 'down') {
      if (doesFocusableExist('download-modal-version-action-0')) {
        setFocus('download-modal-version-action-0');
      }
      return false;
    }

    if (direction === 'up') return false;
    return true;
  };

  const loaderLabel = useMemo(() => {
    if (loaderOptions.length === 0) return '无可用 Loader';
    return loaderOptions.find((option) => option.value === activeLoader)?.value || '全部 Loader';
  }, [loaderOptions, activeLoader]);

  return (
    <div
      className="flex w-full flex-shrink-0 flex-col gap-3 border-b-[2px] border-[var(--ore-downloadDetail-divider)] bg-[var(--ore-downloadDetail-base)] px-4 py-3"
      style={{ boxShadow: 'var(--ore-downloadDetail-sectionInset)' }}
    >
      <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="font-minecraft text-base uppercase tracking-[0.16em] text-white">版本筛选</div>
          <div className="mt-1 font-minecraft text-[10px] uppercase tracking-[0.16em] text-[var(--ore-downloadDetail-mutedText)]">
            共找到 <span className="text-white">{versionsCount}</span> 个匹配文件
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <div className="hidden items-center gap-2 intent-gamepad:flex">
            <ControlHint label="Y" variant="face" tone="yellow" />
            <span className="font-minecraft text-[10px] uppercase tracking-[0.14em] text-[var(--ore-downloadDetail-hintText)]">
              切换 Loader
            </span>
          </div>
          <div className="flex items-center gap-2 intent-gamepad:hidden">
            <ControlHint label="Y" variant="keyboard" tone="neutral" />
            <span className="font-minecraft text-[10px] uppercase tracking-[0.14em] text-[var(--ore-downloadDetail-hintText)]">
              切换 Loader
            </span>
          </div>
          <div className="font-minecraft text-[10px] uppercase tracking-[0.14em] text-[var(--ore-downloadDetail-labelText)]">
            当前: <span className="text-white">{loaderLabel}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div
          className="border-[2px] border-[var(--ore-downloadDetail-divider)] bg-[var(--ore-downloadDetail-surface)] px-3 py-3"
          style={{ boxShadow: 'var(--ore-downloadDetail-sectionShadow)' }}
        >
          <div className="mb-2 font-minecraft text-[10px] uppercase tracking-[0.18em] text-[var(--ore-downloadDetail-labelText)]">
            加载器
          </div>
          <div className="h-10">
            <OreToggleButton
              options={loaderOptions}
              value={activeLoader}
              onChange={setActiveLoader}
              focusable={false}
              className="!m-0 h-full w-full [&>.ore-toggle-btn-group]:!h-full [&>.ore-toggle-btn-group]:!w-full"
              buttonClassName="text-[11px]"
            />
          </div>
        </div>

        <div
          className="border-[2px] border-[var(--ore-downloadDetail-divider)] bg-[var(--ore-downloadDetail-surface)] px-3 py-3"
          style={{ boxShadow: 'var(--ore-downloadDetail-sectionShadow)' }}
        >
          <div className="mb-2 font-minecraft text-[10px] uppercase tracking-[0.18em] text-[var(--ore-downloadDetail-labelText)]">
            Minecraft 版本
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dropdownConfigs.map((config, idx) => (
              <OreDropdown
                key={config.key}
                focusKey={`download-modal-mc-dropdown-${idx}`}
                searchable
                className="min-w-[132px] flex-1 sm:min-w-[156px]"
                placeholder={config.placeholder}
                value={activeVersion}
                onChange={setActiveVersion}
                onArrowPress={handleDropdownArrow(idx)}
                onOpenChange={setIsAnyDropdownOpen}
                options={config.options}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
