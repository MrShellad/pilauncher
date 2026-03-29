import React, { useEffect, useMemo, useState } from 'react';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useTranslation } from 'react-i18next';

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
  controlsEnabled?: boolean;
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
  setActiveVersion,
  controlsEnabled = true
}) => {
  const { t } = useTranslation();
  const [isAnyDropdownOpen, setIsAnyDropdownOpen] = useState(false);
  const [pressingLB, setPressingLB] = useState(false);
  const [pressingRB, setPressingRB] = useState(false);

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
        { label: t('download.actions.clearSelection', { defaultValue: `Clear (${major})` }), value: '' },
        ...majorGroups[major].map((version) => ({ label: version, value: version }))
      ]
    }));

    if (moreReleases.length > 0) {
      configs.push({
        key: 'history',
        placeholder: t('download.filters.moreHistory', { defaultValue: 'More History' }),
        options: [
          { label: t('download.actions.clearHistory', { defaultValue: 'Clear history filter' }), value: '' },
          ...moreReleases.map((version) => ({ label: version, value: version }))
        ]
      });
    }

    if (snapshots.length > 0) {
      configs.push({
        key: 'snapshot',
        placeholder: t('download.filters.snapshots', { defaultValue: 'Snapshots / Preview' }),
        options: [
          { label: t('download.actions.clearSnapshots', { defaultValue: 'Clear snapshot filter' }), value: '' },
          ...snapshots.map((version) => ({ label: version, value: version }))
        ]
      });
    }

    return configs;
  }, [majorGroups, moreReleases, snapshots, t, topMajors]);

  useEffect(() => {
    if (controlsEnabled) return;
    setPressingLB(false);
    setPressingRB(false);
  }, [controlsEnabled]);

  const cycleLoaderBy = (direction: -1 | 1) => {
    if (!controlsEnabled || isAnyDropdownOpen || loaderOptions.length === 0) return;

    if (direction === -1) {
      setPressingLB(true);
      setTimeout(() => setPressingLB(false), 150);
    } else {
      setPressingRB(true);
      setTimeout(() => setPressingRB(false), 150);
    }

    const currentIndex = loaderOptions.findIndex((option) => option.value === activeLoader);
    const nextIndex = currentIndex === -1
      ? 0
      : (currentIndex + direction + loaderOptions.length) % loaderOptions.length;

    setActiveLoader(loaderOptions[nextIndex].value);
  };

  useInputAction('TAB_LEFT', () => cycleLoaderBy(-1));
  useInputAction('TAB_RIGHT', () => cycleLoaderBy(1));

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
      if (doesFocusableExist('download-modal-version-row-0')) {
        setFocus('download-modal-version-row-0');
      }
      return false;
    }

    if (direction === 'up') return false;
    return true;
  };

  const loaderLabel = useMemo(() => {
    if (loaderOptions.length === 0) {
      return t('download.loader.noneAvailable', { defaultValue: 'No loaders available' });
    }
    return loaderOptions.find((option) => option.value === activeLoader)?.value
      || t('download.filters.loaderAll', { defaultValue: 'All Loaders' });
  }, [activeLoader, loaderOptions, t]);

  return (
    <div
      className="flex w-full flex-shrink-0 flex-col gap-3 border-b-[2px] border-[var(--ore-downloadDetail-divider)] bg-[var(--ore-downloadDetail-base)] px-4 py-3"
      style={{ boxShadow: 'var(--ore-downloadDetail-sectionInset)' }}
    >
      <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="font-minecraft text-base uppercase tracking-[0.16em] text-white">
            {t('download.filters.versionFilters', { defaultValue: 'Version Filters' })}
          </div>
          <div className="mt-1 font-minecraft text-[10px] uppercase tracking-[0.16em] text-[var(--ore-downloadDetail-mutedText)]">
            {t('download.meta.matchedFiles', {
              defaultValue: '{{count}} matching files',
              count: versionsCount
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <div className="hidden items-center gap-2 intent-gamepad:flex">
            <div
              className={`transition-transform duration-150 ${pressingLB ? 'scale-75' : 'scale-90'}`}
            >
              <ControlHint label="LB" variant="bumper" tone={pressingLB ? 'green' : 'neutral'} />
            </div>
            <div
              className={`transition-transform duration-150 ${pressingRB ? 'scale-75' : 'scale-90'}`}
            >
              <ControlHint label="RB" variant="bumper" tone={pressingRB ? 'green' : 'neutral'} />
            </div>
            <span className="font-minecraft text-[10px] uppercase tracking-[0.14em] text-[var(--ore-downloadDetail-hintText)]">
              {t('download.actions.cycleLoader', { defaultValue: 'Cycle Loader' })}
            </span>
          </div>
          <div className="flex items-center gap-2 intent-gamepad:hidden">
            <ControlHint label="[" variant="keyboard" tone="neutral" />
            <ControlHint label="]" variant="keyboard" tone="neutral" />
            <span className="font-minecraft text-[10px] uppercase tracking-[0.14em] text-[var(--ore-downloadDetail-hintText)]">
              {t('download.actions.cycleLoader', { defaultValue: 'Cycle Loader' })}
            </span>
          </div>
          <div className="font-minecraft text-[10px] uppercase tracking-[0.14em] text-[var(--ore-downloadDetail-labelText)]">
            {t('download.meta.current', { defaultValue: 'Current' })}: <span className="text-white">{loaderLabel}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div
          className="border-[2px] border-[var(--ore-downloadDetail-divider)] bg-[var(--ore-downloadDetail-surface)] px-3 py-3"
          style={{ boxShadow: 'var(--ore-downloadDetail-sectionShadow)' }}
        >
          <div className="mb-2 font-minecraft text-[10px] uppercase tracking-[0.18em] text-[var(--ore-downloadDetail-labelText)]">
            {t('download.filters.loader', { defaultValue: 'Loader' })}
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
            {t('download.filters.gameVersion', { defaultValue: 'Minecraft Version' })}
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
