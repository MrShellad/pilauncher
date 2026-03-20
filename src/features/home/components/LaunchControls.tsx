// /src/features/home/components/LaunchControls.tsx
import React, { useEffect, useState } from 'react';
import { OreButton } from '../../../ui/primitives/OreButton';
import { Play, Folder, Settings, AlertTriangle, UserPlus } from 'lucide-react';

import { FocusItem } from '../../../ui/focus/FocusItem';
import { focusManager } from '../../../ui/focus/FocusManager';
import { useInputMode } from '../../../ui/focus/FocusProvider';
import { OreModal } from '../../../ui/primitives/OreModal'; // ✅ 引入绝美弹窗组件

import { useLauncherStore } from '../../../store/useLauncherStore';
import { useAccountStore } from '../../../store/useAccountStore'; // ✅ 引入账号 Store 进行前置校验

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

  const setActiveTab = useLauncherStore(state => state.setActiveTab);
  const setSelectedInstanceId = useLauncherStore(state => state.setSelectedInstanceId);

  // ✅ 控制缺失账号弹窗的显示状态
  const [showNoAccountModal, setShowNoAccountModal] = useState(false);
  const inputMode = useInputMode(); // 获取当前的输入模型

  const innerButtonClass = "h-[clamp(48px,6vh,64px)] text-[clamp(16px,1.8vh,20px)] flex items-center justify-center gap-3 w-full transition-colors duration-200";
  const iconClass = "flex-shrink-0 w-[clamp(20px,2.5vh,28px)] h-[clamp(20px,2.5vh,28px)]";
  const heroButtonClass = "h-[clamp(56px,7.5vh,76px)] text-[clamp(18px,2.2vh,24px)] flex items-center justify-center gap-3 w-full transition-colors duration-200";
  const heroIconClass = "flex-shrink-0 w-[clamp(24px,3vh,32px)] h-[clamp(24px,3vh,32px)]";

  useEffect(() => {
    const timer = setTimeout(() => {
      focusManager.focus('play-button');
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSettingsClick = () => {
    if (instanceId) {
      setSelectedInstanceId(instanceId);
      setActiveTab('instances');
    }
    if (onSettings) onSettings();
  };

  // ✅ 核心逻辑：拦截启动事件，进行账号前置校验
  const handlePlayClick = () => {
    const { accounts, activeAccountId } = useAccountStore.getState();
    const currentAccount = accounts.find(a => a.uuid === activeAccountId);

    // 如果找不到账号，拦截执行并唤出 UI 弹窗
    if (!currentAccount) {
      setShowNoAccountModal(true);
      return;
    }

    // 校验通过，放行调用原本的启动逻辑，根据当前输入模式判断是否是手柄启动
    onLaunch(inputMode === 'controller');
  };

  // ✅ 一键跳转路由到设置页的快捷方法
  const handleGoToSettings = () => {
    setShowNoAccountModal(false);
    setActiveTab('settings');
  };

  return (
    <>
      <div className="flex flex-col items-center justify-center space-y-[clamp(20px,3vh,32px)] w-[clamp(280px,25vw,420px)]">

        {/* 1. Play 主按钮 (✅ 绑定为新的拦截方法 handlePlayClick) */}
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
                    ? 'outline outline-[3px] outline-offset-[4px] outline-ore-green shadow-[0_0_20px_rgba(56,133,39,0.6)]'
                    : 'outline outline-[3px] outline-offset-[4px] outline-transparent'
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
                  <Play fill="currentColor" className={heroIconClass} />
                  <span className="font-minecraft font-bold tracking-[0.1em] uppercase leading-none">
                    启动游戏
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
                  ? 'outline outline-[3px] outline-offset-[4px] outline-white/60 shadow-[0_0_15px_rgba(255,255,255,0.2)] z-10'
                  : 'outline outline-[3px] outline-offset-[4px] outline-transparent'
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
                <Folder className={iconClass} />
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
                  ? 'outline outline-[3px] outline-offset-[4px] outline-white/60 shadow-[0_0_15px_rgba(255,255,255,0.2)] z-10'
                  : 'outline outline-[3px] outline-offset-[4px] outline-transparent'
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
                <Settings className={iconClass} />
                <span className="font-minecraft font-medium tracking-wide leading-none">
                  实例详情
                </span>
              </OreButton>
            </div>
          )}
        </FocusItem>

      </div>

      {/* ==================================================== */}
      {/* ✅ 绝美基岩版风格：缺失账号拦截弹窗 */}
      {/* ==================================================== */}
      <OreModal
        isOpen={showNoAccountModal}
        onClose={() => setShowNoAccountModal(false)}
        title="无法启动实例"
        className="w-[420px]"
      >
        <div className="flex flex-col items-center justify-center pt-2 pb-4 px-4 text-center">

          {/* 红色发光的警告图标 */}
          <div className="w-16 h-16 rounded-full bg-[#E52E3D]/10 border-2 border-[#E52E3D]/20 flex items-center justify-center mb-4 shadow-[inset_0_0_15px_rgba(229,46,61,0.2)]">
            <AlertTriangle size={32} className="text-[#E52E3D] drop-shadow-[0_0_8px_rgba(229,46,61,0.8)]" />
          </div>

          <h3 className="text-white font-minecraft font-bold text-xl mb-2 ore-text-shadow">未检测到游戏账号</h3>

          <p className="text-[#A0A0A0] font-minecraft text-sm mb-6 leading-relaxed px-2">
            启动 Minecraft 需要至少一个有效的游戏账号。<br />请前往设置页面添加微软账号。
          </p>

          {/* 底部操作按钮：内置在 Modal 内容区，完美继承空间导航功能 */}
          <div className="flex space-x-4 w-full px-2">
            <OreButton
              variant="secondary"
              size="full"
              onClick={() => setShowNoAccountModal(false)}
            >
              取消
            </OreButton>

            <OreButton
              variant="primary"
              size="full"
              onClick={handleGoToSettings}
            >
              <div className="flex items-center justify-center">
                <UserPlus size={18} className="mr-2" />
                <span>添加</span>
              </div>
            </OreButton>
          </div>

        </div>
      </OreModal>
    </>
  );
};