// src/features/Settings/components/tabs/GeneralSettings.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Maximize,
  Monitor,
  PowerOff,
  RefreshCw,
  RotateCcw,
  Settings2,
  XCircle,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

import { useAccountStore } from '../../../../store/useAccountStore';
import { useSettingsStore } from '../../../../store/useSettingsStore';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../ui/layout/FormRow';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreConfirmDialog } from '../../../../ui/primitives/OreConfirmDialog';
import { OreDropdown } from '../../../../ui/primitives/OreDropdown';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';
import { UpdateDialog, type UpdateInfo } from '../modals/UpdateDialog';

type CheckStatus = 'idle' | 'checking' | 'up-to-date' | 'error';

interface RustUpdateInfo {
  available: boolean;
  version: string;
  body: string;
  url: string;
  signature: string;
}

interface PendingUpdateContext {
  version: string;
  uuid: string;
  region: string;
}

export const GeneralSettings: React.FC = () => {
  const { settings, updateGeneralSetting, resetSettings } = useSettingsStore();
  const { accounts, activeAccountId } = useAccountStore();
  const { general } = settings;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFullscreenTransitioning, setIsFullscreenTransitioning] = useState(false);
  const fullscreenCooldownRef = useRef<number | null>(null);

  const [checkStatus, setCheckStatus] = useState<CheckStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdateContext | null>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const currentAccount = useMemo(
    () => accounts.find((account) => account.uuid === activeAccountId) ?? null,
    [accounts, activeAccountId]
  );

  const updateRequest = useMemo(
    () => ({
      uuid: currentAccount?.uuid || general.deviceId || 'anonymous',
      region: 'CN',
    }),
    [currentAccount?.uuid, general.deviceId]
  );

  const clearPendingUpdate = useCallback(() => {
    setPendingUpdate(null);
    setUpdateInfo(null);
  }, []);

  useEffect(() => {
    const appWindow = getCurrentWindow();

    void appWindow.isFullscreen().then(setIsFullscreen);

    const unlistenResize = appWindow.onResized(async () => {
      const fullscreen = await appWindow.isFullscreen().catch(() => false);
      setIsFullscreen(fullscreen);
    });

    return () => {
      if (fullscreenCooldownRef.current) {
        window.clearTimeout(fullscreenCooldownRef.current);
      }

      clearPendingUpdate();
      void unlistenResize.then((dispose) => dispose());
    };
  }, [clearPendingUpdate]);

  const toggleFullscreen = async () => {
    if (isFullscreenTransitioning) return;

    setIsFullscreenTransitioning(true);

    try {
      const appWindow = getCurrentWindow();
      const current = await appWindow.isFullscreen();
      const next = !current;

      await appWindow.setFullscreen(next);
      setIsFullscreen(next);
    } finally {
      fullscreenCooldownRef.current = window.setTimeout(() => {
        setIsFullscreenTransitioning(false);
        fullscreenCooldownRef.current = null;
      }, 420);
    }
  };

  const handleCheckUpdate = async () => {
    if (checkStatus === 'checking') return;

    setCheckStatus('checking');
    clearPendingUpdate();

    try {
      const update = await invoke<RustUpdateInfo>('check_update', updateRequest);

      if (update.available) {
        if (!update.url || !update.signature) {
          throw new Error('Current platform updater manifest is missing url/signature');
        }

        setPendingUpdate({
          version: update.version,
          uuid: updateRequest.uuid,
          region: updateRequest.region,
        });
        setUpdateInfo({
          version: update.version,
          body: update.body,
        });
        setIsUpdateDialogOpen(true);
        setCheckStatus('idle');
      } else {
        setCheckStatus('up-to-date');
        window.setTimeout(() => setCheckStatus('idle'), 3000);
      }
    } catch (error) {
      console.error('[Updater] 检查更新失败:', error);
      setCheckStatus('error');
      window.setTimeout(() => setCheckStatus('idle'), 4000);
    }
  };

  const handleInstallUpdate = async () => {
    if (!pendingUpdate) {
      console.warn('[Updater] 没有可安装的更新对象');
      return;
    }

    try {
      setIsInstalling(true);
      await invoke('install_update', {
        uuid: pendingUpdate.uuid,
        region: pendingUpdate.region,
        expectedVersion: pendingUpdate.version,
      });
      clearPendingUpdate();
      setIsUpdateDialogOpen(false);
      setIsInstalling(false);
    } catch (error) {
      console.error('[Updater] 应用内更新失败:', error);
      setIsInstalling(false);
    }
  };

  const handleCloseUpdateDialog = () => {
    setIsUpdateDialogOpen(false);
    clearPendingUpdate();
  };

  const handleExitApp = async () => {
    setIsExitConfirmOpen(false);
    await invoke('plugin:process|exit', { code: 0 });
  };

  const handleResetSettings = () => {
    resetSettings();
    setIsResetConfirmOpen(false);
  };

  const languageOptions = useMemo(
    () => [
      { label: '简体中文', value: 'zh-CN' },
      { label: 'English', value: 'en-US' },
    ],
    []
  );

  const closeBehaviorOptions = useMemo(
    () => [
      { label: '最小化窗口', value: 'tray' },
      { label: '退出应用', value: 'exit' },
    ],
    []
  );

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
    <FocusBoundary id="settings-general-boundary" className="h-full w-full outline-none">
      <SettingsPageLayout adaptiveScale>
        <SettingsSection title="基础" icon={<Monitor size={18} />}>
          <FormRow
            label="设备名称"
            description="用于局域网发现与互联传输时的身份展示标识。"
            control={
              <div className="relative focus-within:z-50">
                <OreInput
                  focusKey="settings-device-name"
                  width="11.25rem"
                  height="2.25rem"
                  value={general.deviceName}
                  onChange={(event) => updateGeneralSetting('deviceName', event.target.value)}
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
                  onChange={(value) => updateGeneralSetting('language', value)}
                  className="w-40"
                  focusKey="settings-language"
                />
              </div>
            }
          />

          <FormRow
            label="检查更新"
            description="通过 Tauri 应用内更新检查新版本，并在应用内直接下载与安装。"
            control={renderCheckUpdateButton()}
          />

          <FormRow
            label="启动时检查更新"
            description="每次打开启动器时，主动检查是否存在新的应用版本。"
            control={
              <OreSwitch
                focusKey="settings-check-update-on-start"
                checked={general.checkUpdateOnStart}
                onChange={(value) => updateGeneralSetting('checkUpdateOnStart', value)}
              />
            }
          />
        </SettingsSection>

        <SettingsSection title="窗口与应用" icon={<Settings2 size={18} />}>
          <FormRow
            label="关闭按钮行为"
            description="点击右上角“X”时执行的操作。当前设置会立即作用到标题栏关闭按钮。"
            control={
              <div className="relative focus-within:z-50">
                <OreDropdown
                  options={closeBehaviorOptions}
                  value={general.closeBehavior}
                  onChange={(value) => updateGeneralSetting('closeBehavior', value as 'tray' | 'exit')}
                  className="w-40"
                  focusKey="settings-close-behavior"
                />
              </div>
            }
          />

          <FormRow
            label="阻止触碰操作"
            description="全局禁用网页默认触控行为，如双指缩放、下拉刷新与系统级手势冲突。"
            control={
              <OreSwitch
                focusKey="settings-prevent-touch-action"
                checked={general.preventTouchAction}
                onChange={(value) => updateGeneralSetting('preventTouchAction', value)}
              />
            }
          />

          <FormRow
            label="切换全屏"
            description="手动进入或退出全屏模式。已加入短暂间隔，避免连续双击导致闪烁。"
            control={
              <OreButton
                focusKey="settings-btn-toggle-fullscreen"
                size="sm"
                className="flex items-center"
                onClick={toggleFullscreen}
                disabled={isFullscreenTransitioning}
              >
                {isFullscreenTransitioning ? (
                  <Loader2 size={14} className="mr-1.5 animate-spin" />
                ) : (
                  <Maximize size={14} className="mr-1.5" />
                )}
                {isFullscreen ? '退出全屏' : '进入全屏'}
              </OreButton>
            }
          />

          <FormRow
            label="退出应用"
            description="关闭 PiLauncher 的当前应用进程。退出前会弹出确认提示。"
            control={
              <OreButton
                focusKey="settings-btn-exit-app"
                variant="danger"
                size="sm"
                className="flex items-center"
                onClick={() => setIsExitConfirmOpen(true)}
              >
                <PowerOff size={14} className="mr-1.5" />
                退出应用
              </OreButton>
            }
          />
        </SettingsSection>

        <SettingsSection title="危险操作" icon={<AlertTriangle size={18} />} danger={true}>
          <FormRow
            label="恢复默认设置"
            description="将启动器的所有设置项重置为初始状态，不会删除实例数据。"
            control={
              <OreButton
                focusKey="settings-btn-reset-settings"
                variant="danger"
                size="sm"
                className="flex items-center"
                onClick={() => setIsResetConfirmOpen(true)}
              >
                <RotateCcw size={14} className="mr-1.5" />
                恢复默认
              </OreButton>
            }
          />
        </SettingsSection>
      </SettingsPageLayout>

      <UpdateDialog
        isOpen={isUpdateDialogOpen}
        onClose={handleCloseUpdateDialog}
        updateInfo={updateInfo}
        isInstalling={isInstalling}
        onConfirm={handleInstallUpdate}
      />

      <OreConfirmDialog
        isOpen={isExitConfirmOpen}
        onClose={() => setIsExitConfirmOpen(false)}
        onConfirm={handleExitApp}
        title="确认退出"
        headline="退出 PiLauncher"
        description="确认后会直接退出当前应用。若仍有下载、安装或其他后台任务，它们也会一起停止。"
        confirmLabel="确认退出"
        cancelLabel="取消"
        confirmVariant="danger"
        tone="warning"
        cancelFocusKey="settings-exit-confirm-cancel"
        confirmFocusKey="settings-exit-confirm-confirm"
      />

      <OreConfirmDialog
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={handleResetSettings}
        title="恢复默认设置"
        headline="确认重置设置"
        description="这会恢复启动器设置项，但不会删除实例、存档和下载内容。"
        confirmLabel="确认重置"
        cancelLabel="取消"
        confirmVariant="danger"
        tone="danger"
        cancelFocusKey="settings-reset-confirm-cancel"
        confirmFocusKey="settings-reset-confirm-confirm"
      />
    </FocusBoundary>
  );
};
