// /src/features/Settings/components/tabs/GeneralSettings.tsx
import React, { useState, useEffect } from 'react';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../../ui/primitives/OreDropdown';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { RotateCcw, Monitor, AlertTriangle, PowerOff, Maximize, RefreshCw, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useSettingsStore } from '../../../../store/useSettingsStore';
import { useAccountStore } from '../../../../store/useAccountStore';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { relaunch } from '@tauri-apps/plugin-process';

// 引入布局组件
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../ui/layout/FormRow';

// 引入焦点导航核心组件
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../ui/focus/FocusItem';

// 引入更新弹窗
import { UpdateDialog, type UpdateInfo } from '../modals/UpdateDialog';

// 封装一个支持空间导航的 Switch 组件
const FocusableSwitch = ({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) => (
  <FocusItem onEnter={() => onChange(!checked)}>
    {({ ref, focused }) => (
      <div
        ref={ref as any}
        className={`
          rounded-full transition-all duration-200 flex items-center justify-center
          ${focused ? 'ring-2 ring-white ring-offset-2 ring-offset-[#18181B] scale-[1.1] shadow-lg brightness-125 z-10' : ''}
        `}
      >
        <OreSwitch checked={checked} onChange={onChange} />
      </div>
    )}
  </FocusItem>
);

/** 将无分隔符的 UUID 格式化为带连字符的标准格式 */
function normalizeUuid(raw: string): string {
  const hex = raw.replace(/-/g, '');
  if (hex.length !== 32) return raw; // 非标准长度，原样返回
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

type CheckStatus = 'idle' | 'checking' | 'up-to-date' | 'error';

export const GeneralSettings: React.FC = () => {
  const { settings, updateGeneralSetting, resetSettings } = useSettingsStore();
  const { general } = settings;
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ==================== 更新状态 ====================
  const [checkStatus, setCheckStatus] = useState<CheckStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // 获取活跃账号（用于注入 UUID 到灰度更新接口）
  const { accounts, activeAccountId } = useAccountStore();
  const activeAccount = accounts.find(a => a.uuid === activeAccountId) ?? null;

  useEffect(() => {
    getCurrentWindow().isFullscreen().then(setIsFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    const win = getCurrentWindow();
    const current = await win.isFullscreen();
    await win.setFullscreen(!current);
    setIsFullscreen(!current);
  };

  // ==================== 检查更新 ====================
  const handleCheckUpdate = async () => {
    if (checkStatus === 'checking') return;

    setCheckStatus('checking');
    setUpdateInfo(null);

    // 构造 UUID：优先使用正版 Microsoft 账号的 UUID（带分隔符）
    const rawUuid = activeAccount?.uuid ?? '';
    const uuid = rawUuid ? normalizeUuid(rawUuid) : 'anonymous';

    try {
      const info = await invoke<UpdateInfo>('check_update', {
        uuid,
        region: 'CN',
      });

      setUpdateInfo(info);

      if (info.available) {
        setIsUpdateDialogOpen(true);
        setCheckStatus('idle');
      } else {
        setCheckStatus('up-to-date');
        // 3 秒后恢复 idle 状态
        setTimeout(() => setCheckStatus('idle'), 3000);
      }
    } catch (err) {
      console.error('[Updater] 检查更新失败:', err);
      setCheckStatus('error');
      setTimeout(() => setCheckStatus('idle'), 4000);
    }
  };

  // ==================== 安装更新 ====================
  const handleInstallUpdate = async () => {
    if (!updateInfo?.url) {
      // 没有直接下载链接，尝试调用 Tauri 内置 updater
      try {
        setIsInstalling(true);
        await invoke('plugin:updater|check');
        await relaunch();
      } catch (e) {
        console.error('[Updater] 安装失败:', e);
        setIsInstalling(false);
      }
      return;
    }

    // 有下载链接时，使用 shell 打开浏览器下载
    try {
      setIsInstalling(true);
      await invoke('plugin:shell|open', { path: updateInfo.url });
      setIsInstalling(false);
      setIsUpdateDialogOpen(false);
    } catch (e) {
      console.error('[Updater] 打开下载链接失败:', e);
      setIsInstalling(false);
    }
  };

  // 下拉菜单选项定义
  const languageOptions = [
    { label: '简体中文', value: 'zh-CN' },
    { label: 'English', value: 'en-US' },
  ];

  const closeBehaviorOptions = [
    { label: '最小化到托盘', value: 'tray' },
    { label: '直接退出程序', value: 'exit' },
  ];

  // 检查更新按钮内容
  const renderCheckUpdateButton = () => {
    switch (checkStatus) {
      case 'checking':
        return (
          <OreButton focusKey="settings-btn-check-update" size="sm" className="flex items-center gap-1.5" disabled>
            <Loader2 size={14} className="animate-spin" />
            检查中...
          </OreButton>
        );
      case 'up-to-date':
        return (
          <OreButton focusKey="settings-btn-check-update" size="sm" className="flex items-center gap-1.5" variant="secondary" disabled>
            <CheckCircle2 size={14} className="text-ore-green" />
            已是最新版本
          </OreButton>
        );
      case 'error':
        return (
          <OreButton focusKey="settings-btn-check-update" size="sm" className="flex items-center gap-1.5" variant="danger" disabled>
            <XCircle size={14} />
            检查失败
          </OreButton>
        );
      default:
        return (
          <OreButton focusKey="settings-btn-check-update" size="sm" className="flex items-center gap-1.5" onClick={handleCheckUpdate}>
            <RefreshCw size={14} />
            检查更新
          </OreButton>
        );
    }
  };

  return (
    <FocusBoundary id="settings-general-boundary" className="w-full h-full outline-none">
      <SettingsPageLayout>
        {/* ==================== 1. 基础模块 ==================== */}
        <SettingsSection title="基础" icon={<Monitor size={18} />}>

          {/* 设备名称配置 */}
          <FormRow
            label="设备名称"
            description="用于局域网发现与互联传输时的身份展示标识。"
            control={
              <div className="relative focus-within:z-50">
                <OreInput
                  focusKey="settings-device-name"
                  width="180px"
                  height="36px"
                  value={general.deviceName}
                  onChange={(e) => updateGeneralSetting('deviceName', e.target.value)}
                  placeholder="输入设备名称"
                  containerClassName="!space-y-0"
                />
              </div>
            }
          />

          <FormRow
            label="启动器语言"
            description="更改启动器的显示语言。重启后完全生效。"
            control={
              <div className="relative focus-within:z-50">
                <OreDropdown
                  options={languageOptions}
                  value={general.language}
                  onChange={(val) => updateGeneralSetting('language', val)}
                  className="w-40"
                  focusKey="settings-language"
                />
              </div>
            }
          />

          {/* 检查更新（替换原来的自动更新开关） */}
          <FormRow
            label="检查更新"
            description="手动向服务器核实是否有新版本，灰度更新已根据账号自动配置。"
            control={renderCheckUpdateButton()}
          />

          <FormRow
            label="启动时检查更新"
            description="每次打开启动器时，主动向服务器核实是否有新版本。"
            control={<FocusableSwitch checked={general.checkUpdateOnStart} onChange={(v) => updateGeneralSetting('checkUpdateOnStart', v)} />}
          />
          <FormRow
            label="启动后最小化"
            description="开启启动器后自动将其最小化到系统托盘或任务栏。"
            control={<FocusableSwitch checked={general.minimizeAfterStart} onChange={(v) => updateGeneralSetting('minimizeAfterStart', v)} />}
          />
          <FormRow
            label="阻止触控操作 (触屏优化)"
            description="全局禁用网页默认触控行为（如双指缩放、下拉等），可能会使部分原生滚动失效。"
            control={<FocusableSwitch checked={general.preventTouchAction} onChange={(v) => updateGeneralSetting('preventTouchAction', v)} />}
          />
          <FormRow
            label="关闭按钮行为"
            description="点击右上角 'X' 时执行的操作。"
            control={
              <div className="relative focus-within:z-50">
                <OreDropdown
                  options={closeBehaviorOptions}
                  value={general.closeBehavior}
                  onChange={(val) => updateGeneralSetting('closeBehavior', val as 'tray' | 'exit')}
                  className="w-40"
                  focusKey="settings-close-behavior"
                />
              </div>
            }
          />
          <FormRow
            label="开机自启动"
            description="在操作系统登录后自动运行 PiLauncher。"
            control={<FocusableSwitch checked={general.runOnStartup} onChange={(v) => updateGeneralSetting('runOnStartup', v)} />}
          />
        </SettingsSection>

        {/* ==================== 2. 窗口与应用 ==================== */}
        <SettingsSection title="窗口与应用" icon={<PowerOff size={18} />}>
          <FormRow
            label="切换全屏/手柄模式"
            description="您可以手动开启或关闭全屏模式（Gamepad 专属体验）。"
            control={
              <OreButton focusKey="settings-btn-exit-fullscreen" size="sm" className="flex items-center" onClick={toggleFullscreen}>
                <Maximize size={14} className="mr-1.5" /> {isFullscreen ? '退出全屏' : '进入全屏'}
              </OreButton>
            }
          />
          <FormRow
            label="完全退出启动器"
            description="直接关闭 PiLauncher 应用程序的所有进程。"
            control={
              <OreButton focusKey="settings-btn-exit-app" variant="danger" size="sm" className="flex items-center" onClick={() => invoke('plugin:process|exit', { code: 0 })}>
                <PowerOff size={14} className="mr-1.5" /> 退出应用
              </OreButton>
            }
          />
        </SettingsSection>

        {/* ==================== 3. 危险操作模块 ==================== */}
        <SettingsSection title="危险操作" icon={<AlertTriangle size={18} />} danger={true}>
          <FormRow
            label="恢复默认设置"
            description="将启动器的所有设置项重置为初始状态 (不会删除实例)。"
            control={
              <OreButton variant="danger" size="sm" className="flex items-center" onClick={resetSettings}>
                <RotateCcw size={14} className="mr-1.5" /> 恢复默认
              </OreButton>
            }
          />
        </SettingsSection>
      </SettingsPageLayout>

      {/* 更新弹窗 */}
      <UpdateDialog
        isOpen={isUpdateDialogOpen}
        onClose={() => setIsUpdateDialogOpen(false)}
        updateInfo={updateInfo}
        isInstalling={isInstalling}
        onConfirm={handleInstallUpdate}
      />
    </FocusBoundary>
  );
};