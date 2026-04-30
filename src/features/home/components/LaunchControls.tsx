// /src/features/home/components/LaunchControls.tsx
import React, { useEffect, useState } from 'react';
import { OreButton } from '../../../ui/primitives/OreButton';
import { useTranslation } from 'react-i18next';

import { FocusItem } from '../../../ui/focus/FocusItem';
import { focusManager } from '../../../ui/focus/FocusManager';
import { useInputMode } from '../../../ui/focus/FocusProvider';

import { useLauncherStore } from '../../../store/useLauncherStore';
import { useAccountStore } from '../../../store/useAccountStore';
import { useInstances } from '../../../hooks/pages/Instances/useInstances';
import { NoAccountModal } from '../../../ui/components/NoAccountModal';
import { NoInstanceModal } from '../../../ui/components/NoInstanceModal';

interface LaunchControlsProps {
  instanceId?: string;
  instanceName: string;
  onLaunch: (isGamepad: boolean) => void;
  onSettings?: () => void;
  onSelectInstance: () => void;
}

export const LaunchControls: React.FC<LaunchControlsProps> = ({
  instanceId,
  instanceName,
  onLaunch,
  onSettings,
  onSelectInstance,
}) => {
  const { t } = useTranslation();

  const setActiveTab = useLauncherStore(state => state.setActiveTab);
  const setSelectedInstanceId = useLauncherStore(state => state.setSelectedInstanceId);

  const [showNoAccountModal, setShowNoAccountModal] = useState(false);
  const [showNoInstanceModal, setShowNoInstanceModal] = useState(false);

  const inputMode = useInputMode();
  const { instances } = useInstances();

  const scaleStyle = {
    '--launch-control-w': 'clamp(20rem, 42vmin, 96rem)',
    '--launch-control-gap': 'calc(var(--launch-control-w) * 0.055)',
    '--launch-action-h': 'calc(var(--launch-control-w) * 0.155)',
    '--launch-hero-h': 'calc(var(--launch-control-w) * 0.195)',
    '--launch-action-font': 'calc(var(--launch-control-w) * 0.052)',
    '--launch-hero-font': 'calc(var(--launch-control-w) * 0.064)',
    '--launch-action-gap': 'calc(var(--launch-control-w) * 0.035)',
  } as React.CSSProperties;

  const innerButtonClass = "!h-[var(--launch-action-h)] !text-[length:var(--launch-action-font)] !text-[#111214] [&_svg]:!text-[#111214] flex items-center justify-center gap-[var(--launch-action-gap)] w-full transition-colors duration-200";
  const heroButtonClass = "!h-[var(--launch-hero-h)] !text-[length:var(--launch-hero-font)] !text-white [&_svg]:!text-white flex items-center justify-center gap-[var(--launch-action-gap)] w-full transition-colors duration-200";

  useEffect(() => {
    const timer = setTimeout(() => {
      focusManager.focus('play-button');
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  /**
   * 前置状态检查：
   * 1. 实例列表为空 → 弹出 NoInstanceModal
   * 2. 有实例但当前未选中 → 唤起实例选择弹窗
   * 3. 通过 → 执行回调
   * @returns true 表示前置检查通过，false 表示已被拦截
   */
  const checkInstanceState = (): boolean => {
    if (instances.length === 0) {
      setShowNoInstanceModal(true);
      return false;
    }
    if (!instanceId) {
      onSelectInstance();
      return false;
    }
    return true;
  };

  const handleSettingsClick = () => {
    if (!checkInstanceState()) return;

    if (instanceId) {
      setSelectedInstanceId(instanceId);
      setActiveTab('instances');
    }
    if (onSettings) onSettings();
  };

  const handlePlayClick = () => {
    if (!checkInstanceState()) return;

    const { accounts, activeAccountId } = useAccountStore.getState();
    const currentAccount = accounts.find(a => a.uuid === activeAccountId);

    if (!currentAccount) {
      setShowNoAccountModal(true);
      return;
    }

    onLaunch(inputMode === 'controller');
  };


  return (
    <>
      <div
        className="pointer-events-auto flex w-[var(--launch-control-w)] flex-col items-center justify-center gap-[var(--launch-control-gap)]"
        style={scaleStyle}
      >

        {/* 1. Play 主按钮 */}
        <FocusItem focusKey="play-button" onEnter={handlePlayClick} autoScroll={false}>
          {({ ref, focused }) => (
            <div className="relative w-full group">
              <div
                className={`
                  absolute inset-0 bg-ore-green/40 blur-xl rounded-sm pointer-events-none transition-all duration-500
                  ${focused ? 'bg-ore-green/70 blur-2xl scale-105' : 'group-hover:bg-ore-green/60 group-hover:blur-2xl'}
                `}
              />
              <div
                ref={ref}
                className={`
                  relative w-full rounded-sm transition-shadow duration-150 z-10
                  ${focused
                    ? 'outline outline-[0.1875rem] outline-offset-[0.25rem] outline-ore-green shadow-[0_0_1.25rem_rgba(56,133,39,0.6)]'
                    : 'outline outline-[0.1875rem] outline-offset-[0.25rem] outline-transparent'
                  }
                `}
              >
                <OreButton
                  variant="primary"
                  size="full"
                  className={heroButtonClass}
                  onClick={handlePlayClick}
                  tabIndex={-1}
                >
                  <span className="font-minecraft font-bold tracking-[0.1em] uppercase leading-none">
                    {t('home.launchGame')}
                  </span>
                </OreButton>
              </div>
            </div>
          )}
        </FocusItem>

        {/* 2. 实例选择按钮 */}
        <FocusItem focusKey="instance-button" onEnter={onSelectInstance} autoScroll={false}>
          {({ ref, focused }) => (
            <div
              ref={ref}
              className={`
                w-full rounded-sm transition-shadow duration-150
                ${focused
                  ? 'z-10 outline outline-[0.1875rem] outline-offset-[0.25rem] outline-white/60 shadow-[0_0_0.9375rem_rgba(255,255,255,0.2)]'
                  : 'outline outline-[0.1875rem] outline-offset-[0.25rem] outline-transparent'
                }
              `}
            >
              <OreButton
                variant="secondary"
                size="full"
                className={innerButtonClass}
                onClick={onSelectInstance}
                tabIndex={-1}
              >
                <span className="font-minecraft truncate max-w-[70%] tracking-wide leading-none">
                  {instanceName}
                </span>
              </OreButton>
            </div>
          )}
        </FocusItem>

        {/* 3. 设置按钮 */}
        <FocusItem focusKey="settings-button" onEnter={handleSettingsClick} autoScroll={false}>
          {({ ref, focused }) => (
            <div
              ref={ref}
              className={`
                w-full rounded-sm transition-shadow duration-150
                ${focused
                  ? 'z-10 outline outline-[0.1875rem] outline-offset-[0.25rem] outline-white/60 shadow-[0_0_0.9375rem_rgba(255,255,255,0.2)]'
                  : 'outline outline-[0.1875rem] outline-offset-[0.25rem] outline-transparent'
                }
              `}
            >
              <OreButton
                variant="secondary"
                size="full"
                className={innerButtonClass}
                onClick={handleSettingsClick}
                tabIndex={-1}
              >
                <span className="font-minecraft font-medium tracking-wide leading-none">
                  {t('home.instanceDetail')}
                </span>
              </OreButton>
            </div>
          )}
        </FocusItem>

      </div>

      <NoAccountModal
        isOpen={showNoAccountModal}
        onClose={() => setShowNoAccountModal(false)}
      />

      <NoInstanceModal
        isOpen={showNoInstanceModal}
        onClose={() => setShowNoInstanceModal(false)}
      />
    </>
  );
};
