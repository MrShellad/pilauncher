// /src/features/home/components/LaunchControls.tsx
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { OreButton } from '../../../ui/primitives/OreButton';
import { useTranslation } from 'react-i18next';

import { useScreenDensity, type ScreenDensity } from '../../../hooks/ui/useScreenDensity';
import { focusManager } from '../../../ui/focus/FocusManager';
import { useInputMode } from '../../../ui/focus/FocusProvider';

import { useLauncherStore } from '@/app/stores/useLauncherStore';
import { useAccountStore } from '@/features/account';
import { useInstances } from '@/features/instances';
import { useToastStore } from '@/shared/stores/useToastStore';
import { NoAccountModal } from '../../../ui/components/NoAccountModal';
import { NoInstanceModal } from '../../../ui/components/NoInstanceModal';

interface LaunchControlsProps {
  instanceId?: string;
  instanceName: string;
  onLaunch: (isGamepad: boolean) => void;
  onSettings?: () => void;
  onSelectInstance: () => void;
}

type LaunchControlStyle = React.CSSProperties & {
  [key: `--${string}`]: string | number;
};

const LAUNCH_CONTROL_STYLE_BY_DENSITY: Record<ScreenDensity, LaunchControlStyle> = {
  compact: {
    '--launch-control-w': '352px',
    '--launch-control-gap': '8px',
    '--launch-action-h': '36px',
    '--launch-hero-h': '44px',
    '--launch-action-font': '14px',
    '--launch-hero-font': '16px',
    '--launch-action-gap': '6px',
    '--launch-action-unit': '2px',
    '--launch-hero-unit': '2px',
  },
  deck: {
    '--launch-control-w': '384px',
    '--launch-control-gap': '20px',
    '--launch-action-h': '56px',
    '--launch-hero-h': '72px',
    '--launch-action-font': '20px',
    '--launch-hero-font': '26px',
    '--launch-action-gap': '12px',
    '--launch-action-unit': '3px',
    '--launch-hero-unit': '3px',
  },
  desktop: {
    '--launch-control-w': '448px',
    '--launch-control-gap': '24px',
    '--launch-action-h': '64px',
    '--launch-hero-h': '80px',
    '--launch-action-font': '22px',
    '--launch-hero-font': '28px',
    '--launch-action-gap': '14px',
    '--launch-action-unit': '3px',
    '--launch-hero-unit': '4px',
  },
  wide: {
    '--launch-control-w': '512px',
    '--launch-control-gap': '28px',
    '--launch-action-h': '72px',
    '--launch-hero-h': '88px',
    '--launch-action-font': '24px',
    '--launch-hero-font': '32px',
    '--launch-action-gap': '16px',
    '--launch-action-unit': '4px',
    '--launch-hero-unit': '4px',
  },
  tv: {
    '--launch-control-w': '576px',
    '--launch-control-gap': '32px',
    '--launch-action-h': '80px',
    '--launch-hero-h': '96px',
    '--launch-action-font': '28px',
    '--launch-hero-font': '36px',
    '--launch-action-gap': '18px',
    '--launch-action-unit': '4px',
    '--launch-hero-unit': '4px',
  },
};

export const LaunchControls: React.FC<LaunchControlsProps> = ({
  instanceId,
  instanceName,
  onLaunch,
  onSettings,
  onSelectInstance,
}) => {
  const { t } = useTranslation();
  const addToast = useToastStore(state => state.addToast);

  const setActiveTab = useLauncherStore(state => state.setActiveTab);
  const setSelectedInstanceId = useLauncherStore(state => state.setSelectedInstanceId);

  const [showNoAccountModal, setShowNoAccountModal] = useState(false);
  const [showNoInstanceModal, setShowNoInstanceModal] = useState(false);
  const [pixelSnapX, setPixelSnapX] = useState(0);
  const controlsRef = useRef<HTMLDivElement>(null);

  const inputMode = useInputMode();
  const { instances } = useInstances();

  const density = useScreenDensity();
  const isCompact = density === 'compact';

  const scaleStyle = LAUNCH_CONTROL_STYLE_BY_DENSITY[density];

  const innerButtonClass = "[--ore-btn-unit:var(--launch-action-unit)] !h-[var(--launch-action-h)] !text-[length:var(--launch-action-font)] !text-[#111214] [&_svg]:!text-[#111214] flex items-center justify-center gap-[var(--launch-action-gap)] w-full !m-0";
  const heroButtonClass = "[--ore-btn-unit:var(--launch-hero-unit)] !h-[var(--launch-hero-h)] !text-[length:var(--launch-hero-font)] !text-white [&_svg]:!text-white flex items-center justify-center gap-[var(--launch-action-gap)] w-full !m-0";

  useLayoutEffect(() => {
    const controls = controlsRef.current;
    const container = controls?.parentElement;
    if (!controls || !container) return;

    let frameId = 0;

    const snapToDevicePixel = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        const containerRect = container.getBoundingClientRect();
        const controlsWidth = controls.getBoundingClientRect().width;
        const unsnappedLeft = containerRect.left + (containerRect.width - controlsWidth) / 2;
        const devicePixelRatio = window.devicePixelRatio || 1;
        const snappedLeft = Math.round(unsnappedLeft * devicePixelRatio) / devicePixelRatio;
        const nextOffset = snappedLeft - unsnappedLeft;

        setPixelSnapX(currentOffset => (
          Math.abs(currentOffset - nextOffset) < 0.001 ? currentOffset : nextOffset
        ));
      });
    };

    snapToDevicePixel();

    const resizeObserver = new ResizeObserver(snapToDevicePixel);
    resizeObserver.observe(container);
    resizeObserver.observe(controls);
    window.addEventListener('resize', snapToDevicePixel);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', snapToDevicePixel);
    };
  }, [density]);

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
    const isSelectedDeleted = !!instanceId && instances.length > 0 && !instances.some(i => i.id === instanceId);
    if (isSelectedDeleted) {
      addToast('warning', t('home.selectedInstanceDeleted', '已选中的实例已被删除，请重新选择实例'));
      onSelectInstance();
      return;
    }

    if (!checkInstanceState()) return;

    if (instanceId) {
      setSelectedInstanceId(instanceId);
      setActiveTab('instances');
    }
    if (onSettings) onSettings();
  };

  const handlePlayClick = () => {
    const isSelectedDeleted = !!instanceId && instances.length > 0 && !instances.some(i => i.id === instanceId);
    if (isSelectedDeleted) {
      addToast('warning', t('home.selectedInstanceDeleted', '已选中的实例已被删除，请重新选择实例'));
      onSelectInstance();
      return;
    }

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
        ref={controlsRef}
        className="pointer-events-auto relative flex w-[var(--launch-control-w)] flex-col items-center justify-center gap-[var(--launch-control-gap)]"
        style={{ ...scaleStyle, left: pixelSnapX }}
      >

        {/* 1. Play 主按钮 */}
        <OreButton
          focusKey="play-button"
          variant="primary"
          size="full"
          className={heroButtonClass}
          onClick={handlePlayClick}
          autoScroll={false}
        >
          <span className="font-minecraft font-bold text-center uppercase leading-none">
            {t('home.launchGame')}
          </span>
        </OreButton>

        {/* 2. 实例选择与设置按钮 */}
        <div className={`w-full flex ${isCompact ? 'flex-row gap-2' : 'flex-col gap-[var(--launch-control-gap)]'}`}>
          <OreButton
            focusKey="instance-button"
            variant="secondary"
            size="full"
            className={innerButtonClass}
            onClick={onSelectInstance}
            autoScroll={false}
          >
            <span className="max-w-[80%] truncate text-center font-minecraft leading-none">
              {instanceName}
            </span>
          </OreButton>

          <OreButton
            focusKey="settings-button"
            variant="secondary"
            size="full"
            className={innerButtonClass}
            onClick={handleSettingsClick}
            autoScroll={false}
          >
            <span className="font-minecraft font-medium text-center leading-none">
              {t('home.instanceDetail')}
            </span>
          </OreButton>
        </div>

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
