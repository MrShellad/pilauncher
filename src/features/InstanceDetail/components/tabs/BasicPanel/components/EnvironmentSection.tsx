import React from 'react';
import { motion } from 'framer-motion';
import { Check, Cpu, Loader2, RotateCw } from 'lucide-react';

import { OreAccordion } from '../../../../../../ui/primitives/OreAccordion';
import { OreButton } from '../../../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../../../ui/primitives/OreModal';
import { OreToggleButton, type ToggleOption } from '../../../../../../ui/primitives/OreToggleButton';
import { GamepadActionHint } from '../../../../../../ui/components/GamepadButtonIcon';
import { FocusItem } from '../../../../../../ui/focus/FocusItem';
import { SettingsSection } from '../../../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../../../ui/layout/FormRow';
import { OreMotionTokens } from '../../../../../../style/tokens/motion';
import {
  ENVIRONMENT_LOADER_TYPES,
  ENVIRONMENT_VERSION_TYPES,
  LOADER_ICON_MAP,
  VERSION_TYPE_LABELS,
  vanillaIcon,
} from '../utils/environmentSectionData';
import { useEnvironmentSection } from '../hooks/useEnvironmentSection';
import type { EnvironmentSectionProps } from '../schemas/basicPanelSchemas';

export type { InstanceEnvironmentUpdate } from '../schemas/basicPanelSchemas';

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
  const {
    normalizedCurrentLoader,
    currentLoaderLabel,
    isOpen,
    openModal,
    closeModal,
    gameVersion,
    setGameVersion,
    versionType,
    selectVersionType,
    loaderType,
    selectLoaderType,
    loaderVersion,
    setLoaderVersion,
    filteredVersionGroups,
    loaderVersions,
    isLoadingVersions,
    isLoadingLoaders,
    errorText,
    canApply,
    handleApply,
    refreshVersions,
  } = useEnvironmentSection({
    currentGameVersion,
    currentLoaderType,
    currentLoaderVersion,
    isGlobalSaving,
    setIsGlobalSaving,
    onUpdateEnvironment,
    onSuccess,
  });

  const versionTypeOptions = React.useMemo<ToggleOption[]>(
    () => ENVIRONMENT_VERSION_TYPES.map((type) => ({
      value: type,
      label: VERSION_TYPE_LABELS[type],
    })),
    [],
  );

  const loaderTypeOptions = React.useMemo<ToggleOption[]>(
    () => ENVIRONMENT_LOADER_TYPES.map((type) => ({
      value: type,
      label: (
        <span className="flex items-center justify-center gap-2">
          <img
            src={LOADER_ICON_MAP[type]}
            className={`h-4 w-4 object-contain ${loaderType === type ? 'brightness-0' : 'brightness-0 invert'}`}
            alt=""
          />
          <span>{type}</span>
        </span>
      ),
    })),
    [loaderType],
  );

  return (
    <SettingsSection title="运行环境" icon={<Cpu size="1.125rem" />}>
      <FormRow
        label="游戏与 Loader 版本"
        description="切换当前实例的 Minecraft、Fabric、Forge、NeoForge 或 Quilt 环境。"
        control={
          <div className="flex w-full flex-col items-stretch gap-3 lg:w-[30rem]">
            <div className="grid grid-cols-2 gap-3">
              <div className="border-2 border-[#1E1E1F] bg-[#141415] px-4 py-3">
                <div className="text-[0.625rem] uppercase tracking-[0.16em] text-ore-text-muted">Minecraft</div>
                <div className="mt-1 truncate text-base text-white">{currentGameVersion || '-'}</div>
              </div>
              <div className="border-2 border-[#1E1E1F] bg-[#141415] px-4 py-3">
                <div className="text-[0.625rem] uppercase tracking-[0.16em] text-ore-text-muted">Loader</div>
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
              onClick={openModal}
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
        onClose={closeModal}
        title="切换实例环境"
        className="w-[min(76rem,94vw)] h-[82vh]"
        contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
        actions={
          <>
            <OreButton
              focusKey="basic-env-cancel"
              variant="secondary"
              onClick={closeModal}
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
              {isGlobalSaving ? <Loader2 size="1rem" className="mr-2 animate-spin" /> : <Check size="1rem" className="mr-2" />}
              应用
            </OreButton>
          </>
        }
      >
        <div className="grid min-h-0 flex-1 grid-cols-1 divide-y-2 divide-[#1E1E1F] lg:grid-cols-2 lg:divide-x-2 lg:divide-y-0">
          <div className="flex min-h-0 flex-col p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg text-white">Minecraft 版本</h3>
                <p className="mt-1 text-xs text-ore-text-muted">当前选择: {gameVersion || '-'}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden items-center gap-2 lg:flex">
                  <GamepadActionHint button="LB" label="分类" />
                  <GamepadActionHint button="RB" label="分类" />
                  <GamepadActionHint button="X" label="刷新" />
                </div>
                <FocusItem focusKey="basic-env-refresh" disabled={isLoadingVersions}>
                  {({ ref, focused }) => (
                    <button
                      ref={ref as React.RefObject<HTMLButtonElement>}
                      type="button"
                      onClick={() => void refreshVersions(true)}
                      disabled={isLoadingVersions}
                      tabIndex={-1}
                      className={`flex h-9 items-center gap-2 border-2 bg-[#1E1E1F] px-3 text-sm text-ore-text-muted hover:border-white hover:text-white disabled:opacity-50 ${
                        focused
                          ? 'border-ore-focus outline outline-[0.1875rem] outline-ore-focus outline-offset-[0.125rem] drop-shadow-ore-glow brightness-110'
                          : 'border-ore-gray-border'
                      }`}
                    >
                      <RotateCw size="1rem" className={isLoadingVersions ? 'animate-spin' : ''} />
                      刷新
                    </button>
                  )}
                </FocusItem>
              </div>
            </div>

            <OreToggleButton
              options={versionTypeOptions}
              value={versionType}
              onChange={(value) => selectVersionType(value as typeof versionType)}
              focusable={false}
              size="sm"
              className="mb-4"
              buttonClassName="text-xs"
            />

            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar pr-1">
              {isLoadingVersions ? (
                <div className="flex h-40 items-center justify-center text-ore-text-muted">
                  <Loader2 size="1.125rem" className="mr-2 animate-spin" />
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
                                ref={ref as React.RefObject<HTMLDivElement>}
                                whileHover={OreMotionTokens.buttonHover}
                                whileTap={OreMotionTokens.buttonTap}
                                onClick={() => setGameVersion(version.id)}
                                className={`relative cursor-pointer border-2 p-3 outline-none ${
                                  gameVersion === version.id
                                    ? 'border-ore-green bg-ore-green/20'
                                    : 'border-ore-gray-border bg-[#1E1E1F] hover:border-white/60'
                                } ${
                                  focused
                                    ? 'z-20 outline outline-[0.1875rem] outline-ore-focus outline-offset-[0.125rem] drop-shadow-ore-glow brightness-110'
                                    : ''
                                }`}
                              >
                                {gameVersion === version.id && <Check size="0.875rem" className="absolute right-2 top-2 text-ore-green" />}
                                <div className="truncate pr-5 text-sm font-bold text-white">{version.id}</div>
                                <div className="mt-2 truncate text-[0.625rem] text-ore-text-muted">{version.release_time}</div>
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
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg text-white">Loader 版本</h3>
                <p className="mt-1 text-xs text-ore-text-muted">
                  {loaderType === 'Vanilla' ? '原版实例不需要额外 Loader。' : `当前选择: ${loaderType} ${loaderVersion || '-'}`}
                </p>
              </div>
              <div className="hidden items-center gap-2 lg:flex">
                <GamepadActionHint button="LT" label="Loader" />
                <GamepadActionHint button="RT" label="Loader" />
                <GamepadActionHint button="Y" label="底部" />
              </div>
            </div>

            <OreToggleButton
              options={loaderTypeOptions}
              value={loaderType}
              onChange={(value) => selectLoaderType(value as typeof loaderType)}
              focusable={false}
              size="sm"
              className="mb-4"
              buttonClassName="text-xs"
            />

            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
              {loaderType === 'Vanilla' ? (
                <FocusItem focusKey="basic-env-loader-vanilla-card">
                  {({ ref, focused }) => (
                    <div
                      ref={ref as React.RefObject<HTMLDivElement>}
                      className={`flex h-48 flex-col items-center justify-center border-2 border-dashed text-ore-text-muted outline-none ${
                        focused
                          ? 'border-ore-focus outline outline-[0.1875rem] outline-ore-focus outline-offset-[0.125rem] drop-shadow-ore-glow brightness-110'
                          : 'border-ore-gray-border'
                      }`}
                    >
                      <img src={vanillaIcon} className="mb-3 h-12 w-12 object-contain opacity-50 invert-[.3]" alt="Vanilla" />
                      <span className="text-lg text-white">原版环境</span>
                    </div>
                  )}
                </FocusItem>
              ) : isLoadingLoaders ? (
                <div className="flex h-40 items-center justify-center text-ore-text-muted">
                  <Loader2 size="1.125rem" className="mr-2 animate-spin" />
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
                          ref={ref as React.RefObject<HTMLDivElement>}
                          whileHover={OreMotionTokens.buttonHover}
                          whileTap={OreMotionTokens.buttonTap}
                          onClick={() => setLoaderVersion(version)}
                          className={`cursor-pointer border-2 p-3 outline-none ${
                            loaderVersion === version
                              ? 'border-ore-green bg-ore-green/20'
                              : 'border-ore-gray-border bg-[#1E1E1F] hover:border-white/60'
                          } ${
                            focused
                              ? 'z-20 outline outline-[0.1875rem] outline-ore-focus outline-offset-[0.125rem] drop-shadow-ore-glow brightness-110'
                              : ''
                          }`}
                        >
                          <div className="truncate text-sm font-bold text-white">{version}</div>
                          <div className="mt-2 truncate text-[0.625rem] text-ore-text-muted">{gameVersion}</div>
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
