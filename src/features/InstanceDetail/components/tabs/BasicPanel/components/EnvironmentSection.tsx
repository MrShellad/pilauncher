import React, { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion } from 'framer-motion';
import { Check, Cpu, Loader2, RotateCw } from 'lucide-react';

import { OreAccordion } from '../../../../../../ui/primitives/OreAccordion';
import { OreButton } from '../../../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../../../ui/primitives/OreModal';
import { FocusItem } from '../../../../../../ui/focus/FocusItem';
import { SettingsSection } from '../../../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../../../ui/layout/FormRow';
import { OreMotionTokens } from '../../../../../../style/tokens/motion';
import {
  filterVersionGroups,
  LOADER_TYPES,
  normalizeLoaderType,
  normalizeLoaderVersion,
  sortLoaderVersionsDesc,
  VERSION_TYPES,
  type LoaderType,
  type McVersionType,
  type VersionGroup,
} from '../../../../../Instances/logic/environmentSelection';

import vanillaIcon from '../../../../../../assets/icons/tags/loaders/vanilla.svg';
import fabricIcon from '../../../../../../assets/icons/tags/loaders/fabric.svg';
import quiltIcon from '../../../../../../assets/icons/tags/loaders/quilt.svg';
import forgeIcon from '../../../../../../assets/icons/tags/loaders/forge.svg';
import neoforgeIcon from '../../../../../../assets/icons/tags/loaders/neoforge.svg';

export interface InstanceEnvironmentUpdate {
  gameVersion: string;
  loaderType: LoaderType;
  loaderVersion: string;
}

interface EnvironmentSectionProps {
  currentGameVersion?: string;
  currentLoaderType?: string;
  currentLoaderVersion?: string;
  isInitializing: boolean;
  isGlobalSaving: boolean;
  setIsGlobalSaving: (val: boolean) => void;
  onUpdateEnvironment: (update: InstanceEnvironmentUpdate) => Promise<void>;
  onSuccess: (msg: string) => void;
}

const VERSION_TYPE_LABELS: Record<McVersionType, string> = {
  release: '正式版',
  snapshot: '快照',
  rc: '候选版',
  pre: '预览版',
  special: '特殊',
};

const LOADER_ICON_MAP: Record<LoaderType, string> = {
  Vanilla: vanillaIcon,
  Fabric: fabricIcon,
  Forge: forgeIcon,
  NeoForge: neoforgeIcon,
  Quilt: quiltIcon,
};

export const EnvironmentSection: React.FC<EnvironmentSectionProps> = ({
  currentGameVersion,
  currentLoaderType,
  currentLoaderVersion,
  isInitializing,
  isGlobalSaving,
  setIsGlobalSaving,
  onUpdateEnvironment,
  onSuccess,
}) => {
  const normalizedCurrentLoader = normalizeLoaderType(currentLoaderType);
  const normalizedCurrentLoaderVersion = normalizeLoaderVersion(
    normalizedCurrentLoader,
    currentLoaderVersion,
  );

  const [isOpen, setIsOpen] = useState(false);
  const [gameVersion, setGameVersion] = useState(currentGameVersion || '');
  const [versionType, setVersionType] = useState<McVersionType>('release');
  const [loaderType, setLoaderType] = useState<LoaderType>(normalizedCurrentLoader);
  const [loaderVersion, setLoaderVersion] = useState<string | null>(normalizedCurrentLoaderVersion);
  const [versionGroups, setVersionGroups] = useState<VersionGroup[]>([]);
  const [loaderVersions, setLoaderVersions] = useState<string[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isLoadingLoaders, setIsLoadingLoaders] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setGameVersion(currentGameVersion || '');
    setLoaderType(normalizedCurrentLoader);
    setLoaderVersion(normalizedCurrentLoaderVersion);
    setErrorText('');
  }, [isOpen, currentGameVersion, normalizedCurrentLoader, normalizedCurrentLoaderVersion]);

  const fetchVersions = async (force = false) => {
    try {
      setIsLoadingVersions(true);
      const data = await invoke<VersionGroup[]>('get_minecraft_versions', { force });
      setVersionGroups(data);
    } catch (error) {
      console.error('Failed to fetch Minecraft versions:', error);
      setErrorText('获取 Minecraft 版本列表失败');
    } finally {
      setIsLoadingVersions(false);
    }
  };

  useEffect(() => {
    if (isOpen && versionGroups.length === 0) {
      void fetchVersions(false);
    }
  }, [isOpen, versionGroups.length]);

  useEffect(() => {
    if (!isOpen) return;

    if (loaderType === 'Vanilla') {
      setLoaderVersions([]);
      setLoaderVersion('Vanilla');
      return;
    }

    if (!gameVersion) {
      setLoaderVersions([]);
      setLoaderVersion(null);
      return;
    }

    let cancelled = false;

    const fetchLoaders = async () => {
      try {
        setIsLoadingLoaders(true);
        setErrorText('');
        const data = await invoke<string[]>('get_loader_versions', {
          loaderType,
          gameVersion,
        });
        if (cancelled) return;

        const sorted = sortLoaderVersionsDesc(data);
        setLoaderVersions(sorted);
        setLoaderVersion((prev) => {
          if (prev && sorted.includes(prev)) return prev;
          if (normalizedCurrentLoader === loaderType && sorted.includes(normalizedCurrentLoaderVersion)) {
            return normalizedCurrentLoaderVersion;
          }
          return sorted[0] || null;
        });
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch loader versions:', error);
          setLoaderVersions([]);
          setLoaderVersion(null);
          setErrorText('获取 Loader 版本列表失败');
        }
      } finally {
        if (!cancelled) setIsLoadingLoaders(false);
      }
    };

    void fetchLoaders();
    return () => {
      cancelled = true;
    };
  }, [isOpen, loaderType, gameVersion, normalizedCurrentLoader, normalizedCurrentLoaderVersion]);

  const filteredVersionGroups = useMemo(
    () => filterVersionGroups(versionGroups, versionType),
    [versionGroups, versionType],
  );

  const targetLoaderVersion = normalizeLoaderVersion(loaderType, loaderVersion);
  const hasEnvironmentChanged =
    gameVersion !== (currentGameVersion || '') ||
    loaderType !== normalizedCurrentLoader ||
    targetLoaderVersion !== normalizedCurrentLoaderVersion;

  const canApply =
    !!gameVersion &&
    !isLoadingVersions &&
    !isLoadingLoaders &&
    (loaderType === 'Vanilla' || !!targetLoaderVersion) &&
    hasEnvironmentChanged;

  const handleApply = async () => {
    if (!canApply) return;

    try {
      setIsGlobalSaving(true);
      setErrorText('');
      await onUpdateEnvironment({
        gameVersion,
        loaderType,
        loaderVersion: targetLoaderVersion,
      });
      setIsOpen(false);
      onSuccess('实例环境已更新');
    } catch (error) {
      console.error('Failed to update instance environment:', error);
      setErrorText(`更新实例环境失败: ${String(error)}`);
    } finally {
      setIsGlobalSaving(false);
    }
  };

  const currentLoaderLabel =
    normalizedCurrentLoader === 'Vanilla'
      ? 'Vanilla'
      : `${normalizedCurrentLoader} ${normalizedCurrentLoaderVersion || '-'}`;

  return (
    <SettingsSection title="运行环境" icon={<Cpu size={18} />}>
      <FormRow
        label="游戏与 Loader 版本"
        description="切换当前实例的 Minecraft、Fabric、Forge、NeoForge 或 Quilt 环境。"
        control={
          <div className="flex w-full flex-col items-stretch gap-3 lg:w-[480px]">
            <div className="grid grid-cols-2 gap-3">
              <div className="border-2 border-[#1E1E1F] bg-[#141415] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-ore-text-muted">Minecraft</div>
                <div className="mt-1 truncate text-base text-white">{currentGameVersion || '-'}</div>
              </div>
              <div className="border-2 border-[#1E1E1F] bg-[#141415] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-ore-text-muted">Loader</div>
                <div className="mt-1 flex min-w-0 items-center gap-2 text-base text-white">
                  <img
                    src={LOADER_ICON_MAP[normalizedCurrentLoader]}
                    className="h-4 w-4 flex-shrink-0 object-contain brightness-0 invert"
                    alt={normalizedCurrentLoader}
                  />
                  <span className="truncate">{currentLoaderLabel}</span>
                </div>
              </div>
            </div>
            <OreButton
              focusKey="basic-btn-edit-environment"
              variant="secondary"
              onClick={() => setIsOpen(true)}
              disabled={isInitializing || isGlobalSaving}
              className="w-full"
            >
              更改版本
            </OreButton>
          </div>
        }
      />

      <OreModal
        isOpen={isOpen}
        onClose={() => {
          if (!isGlobalSaving) setIsOpen(false);
        }}
        title="切换实例环境"
        className="w-[min(72rem,94vw)] h-[82vh]"
        contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
        actions={
          <>
            <OreButton
              focusKey="basic-env-cancel"
              variant="secondary"
              onClick={() => setIsOpen(false)}
              disabled={isGlobalSaving}
            >
              取消
            </OreButton>
            <OreButton
              focusKey="basic-env-apply"
              variant="primary"
              onClick={handleApply}
              disabled={!canApply || isGlobalSaving}
            >
              {isGlobalSaving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Check size={16} className="mr-2" />}
              应用
            </OreButton>
          </>
        }
      >
        <div className="grid min-h-0 flex-1 grid-cols-1 divide-y-2 divide-[#1E1E1F] lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] lg:divide-x-2 lg:divide-y-0">
          <div className="flex min-h-0 flex-col p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg text-white">Minecraft 版本</h3>
                <p className="mt-1 text-xs text-ore-text-muted">当前选择: {gameVersion || '-'}</p>
              </div>
              <button
                type="button"
                onClick={() => void fetchVersions(true)}
                disabled={isLoadingVersions}
                tabIndex={-1}
                className="flex h-9 items-center gap-2 border-2 border-ore-gray-border bg-[#1E1E1F] px-3 text-sm text-ore-text-muted hover:border-white hover:text-white disabled:opacity-50"
              >
                <RotateCw size={16} className={isLoadingVersions ? 'animate-spin' : ''} />
                刷新
              </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {VERSION_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setVersionType(type)}
                  tabIndex={-1}
                  className={`border-2 px-3 py-2 text-xs transition-colors ${
                    versionType === type
                      ? 'border-ore-green bg-ore-green/20 text-white'
                      : 'border-ore-gray-border bg-[#1E1E1F] text-ore-text-muted hover:border-white hover:text-white'
                  }`}
                >
                  {VERSION_TYPE_LABELS[type]}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar pr-1">
              {isLoadingVersions ? (
                <div className="flex h-40 items-center justify-center text-ore-text-muted">
                  <Loader2 size={18} className="mr-2 animate-spin" />
                  正在加载版本列表...
                </div>
              ) : (
                <div className="space-y-3 pb-4">
                  {filteredVersionGroups.map((group, groupIndex) => (
                    <OreAccordion key={group.group_name} title={group.group_name} defaultExpanded={groupIndex === 0}>
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(8.75rem,1fr))] gap-2 p-2">
                        {group.versions.map((version) => (
                          <FocusItem
                            key={version.id}
                            focusKey={`basic-env-version-${version.id}`}
                            onEnter={() => setGameVersion(version.id)}
                          >
                            {({ ref, focused }) => (
                              <motion.div
                                ref={ref as any}
                                whileHover={OreMotionTokens.buttonHover}
                                whileTap={OreMotionTokens.buttonTap}
                                onClick={() => setGameVersion(version.id)}
                                className={`relative cursor-pointer border-2 p-3 outline-none ${
                                  gameVersion === version.id
                                    ? 'border-ore-green bg-ore-green/20'
                                    : 'border-ore-gray-border bg-[#1E1E1F] hover:border-white/60'
                                } ${
                                  focused
                                    ? 'z-20 outline outline-[3px] outline-ore-focus outline-offset-[2px] drop-shadow-ore-glow brightness-110'
                                    : ''
                                }`}
                              >
                                {gameVersion === version.id && <Check size={14} className="absolute right-2 top-2 text-ore-green" />}
                                <div className="truncate pr-5 text-sm font-bold text-white">{version.id}</div>
                                <div className="mt-2 truncate text-[10px] text-ore-text-muted">{version.release_time}</div>
                              </motion.div>
                            )}
                          </FocusItem>
                        ))}
                      </div>
                    </OreAccordion>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col p-5">
            <div className="mb-4">
              <h3 className="text-lg text-white">Loader 版本</h3>
              <p className="mt-1 text-xs text-ore-text-muted">
                {loaderType === 'Vanilla' ? '原版实例不需要额外 Loader。' : `当前选择: ${loaderType} ${loaderVersion || '-'}`}
              </p>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {LOADER_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setLoaderType(type);
                    if (type === 'Vanilla') setLoaderVersion('Vanilla');
                  }}
                  tabIndex={-1}
                  className={`flex items-center gap-2 border-2 px-3 py-2 text-sm transition-colors ${
                    loaderType === type
                      ? 'border-ore-green bg-ore-green/20 text-white'
                      : 'border-ore-gray-border bg-[#1E1E1F] text-ore-text-muted hover:border-white hover:text-white'
                  }`}
                >
                  <img src={LOADER_ICON_MAP[type]} className="h-4 w-4 object-contain brightness-0 invert" alt={type} />
                  {type}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
              {loaderType === 'Vanilla' ? (
                <div className="flex h-48 flex-col items-center justify-center border-2 border-dashed border-ore-gray-border text-ore-text-muted">
                  <img src={vanillaIcon} className="mb-3 h-12 w-12 object-contain opacity-50 invert-[.3]" alt="Vanilla" />
                  <span className="text-lg text-white">原版环境</span>
                </div>
              ) : isLoadingLoaders ? (
                <div className="flex h-40 items-center justify-center text-ore-text-muted">
                  <Loader2 size={18} className="mr-2 animate-spin" />
                  正在查找兼容版本...
                </div>
              ) : loaderVersions.length === 0 ? (
                <div className="flex h-40 items-center justify-center border-2 border-dashed border-ore-gray-border px-4 text-center text-ore-text-muted">
                  没有找到兼容 {gameVersion || '当前 Minecraft'} 的 {loaderType} 版本
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2 pb-4">
                  {loaderVersions.map((version) => (
                    <FocusItem
                      key={version}
                      focusKey={`basic-env-loader-${version}`}
                      onEnter={() => setLoaderVersion(version)}
                    >
                      {({ ref, focused }) => (
                        <motion.div
                          ref={ref as any}
                          whileHover={OreMotionTokens.buttonHover}
                          whileTap={OreMotionTokens.buttonTap}
                          onClick={() => setLoaderVersion(version)}
                          className={`cursor-pointer border-2 p-3 outline-none ${
                            loaderVersion === version
                              ? 'border-ore-green bg-ore-green/20'
                              : 'border-ore-gray-border bg-[#1E1E1F] hover:border-white/60'
                          } ${
                            focused
                              ? 'z-20 outline outline-[3px] outline-ore-focus outline-offset-[2px] drop-shadow-ore-glow brightness-110'
                              : ''
                          }`}
                        >
                          <div className="truncate text-sm font-bold text-white">{version}</div>
                          <div className="mt-2 truncate text-[10px] text-ore-text-muted">{gameVersion}</div>
                        </motion.div>
                      )}
                    </FocusItem>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {errorText && (
          <div className="border-t-2 border-red-500/20 bg-red-500/10 px-5 py-3 text-sm text-red-300">
            {errorText}
          </div>
        )}
      </OreModal>
    </SettingsSection>
  );
};
