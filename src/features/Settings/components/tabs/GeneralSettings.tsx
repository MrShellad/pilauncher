// src/features/Settings/components/tabs/GeneralSettings.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      { label: t('settings.general.language.options.zhCN', '简体中文'), value: 'zh-CN' },
      { label: t('settings.general.language.options.enUS', 'English'), value: 'en-US' },
    ],
    [t]
  );

  const closeBehaviorOptions = useMemo(
    () => [
      { label: t('settings.general.closeBehavior.options.tray', '最小化窗口'), value: 'tray' },
      { label: t('settings.general.closeBehavior.options.exit', '退出应用'), value: 'exit' },
    ],
    [t]
  );

  const renderCheckUpdateButton = () => {
    switch (checkStatus) {
      case 'checking':
        return (
          <OreButton focusKey="settings-btn-check-update" className="w-[200px] justify-center whitespace-nowrap" disabled>
            <Loader2 size={14} className="animate-spin mr-1.5" />
            {t('settings.general.checkUpdate.checking')}
          </OreButton>
        );
      case 'up-to-date':
        return (
          <OreButton focusKey="settings-btn-check-update" className="w-[200px] justify-center whitespace-nowrap" variant="secondary" disabled>
            <CheckCircle2 size={14} className="text-ore-green mr-1.5" />
            {t('settings.general.checkUpdate.upToDate')}
          </OreButton>
        );
      case 'error':
        return (
          <OreButton focusKey="settings-btn-check-update" className="w-[200px] justify-center whitespace-nowrap" variant="danger" disabled>
            <XCircle size={14} className="mr-1.5" />
            {t('settings.general.checkUpdate.error')}
          </OreButton>
        );
      default:
        return (
          <OreButton focusKey="settings-btn-check-update" className="w-[200px] justify-center whitespace-nowrap" onClick={handleCheckUpdate}>
            <RefreshCw size={14} className="mr-1.5" />
            {t('settings.general.checkUpdate.check')}
          </OreButton>
        );
    }
  };

  return (
    <FocusBoundary id="settings-general-boundary" className="h-full w-full outline-none">
      <SettingsPageLayout adaptiveScale>
        <SettingsSection title={t('settings.general.sections.basic')} icon={<Monitor size={18} />}>
          <FormRow
            label={t('settings.general.deviceName.label')}
            description={t('settings.general.deviceName.description')}
            control={
              <div className="relative focus-within:z-50">
                <OreInput
                  focusKey="settings-device-name"
                  value={general.deviceName}
                  onChange={(event) => updateGeneralSetting('deviceName', event.target.value)}
                  placeholder={t('settings.general.deviceName.placeholder')}
                  containerClassName="!space-y-0 w-[200px]"
                />
              </div>
            }
          />

          <FormRow
            label={t('settings.general.language.label')}
            description={t('settings.general.language.description')}
            control={
              <div className="relative focus-within:z-50">
                <OreDropdown
                  options={languageOptions}
                  value={general.language}
                  onChange={(value) => updateGeneralSetting('language', value)}
                  className="w-[200px]"
                  focusKey="settings-language"
                />
              </div>
            }
          />

          <FormRow
            label={t('settings.general.checkUpdate.label')}
            description={t('settings.general.checkUpdate.description')}
            control={renderCheckUpdateButton()}
          />

          <FormRow
            label={t('settings.general.checkUpdateOnStart.label')}
            description={t('settings.general.checkUpdateOnStart.description')}
            control={
              <OreSwitch
                focusKey="settings-check-update-on-start"
                checked={general.checkUpdateOnStart}
                onChange={(value) => updateGeneralSetting('checkUpdateOnStart', value)}
              />
            }
          />
        </SettingsSection>

        <SettingsSection title={t('settings.general.sections.window')} icon={<Settings2 size={18} />}>
          <FormRow
            label={t('settings.general.closeBehavior.label')}
            description={t('settings.general.closeBehavior.description')}
            control={
              <div className="relative focus-within:z-50">
                <OreDropdown
                  options={closeBehaviorOptions}
                  value={general.closeBehavior}
                  onChange={(value) => updateGeneralSetting('closeBehavior', value as 'tray' | 'exit')}
                  className="w-[200px]"
                  focusKey="settings-close-behavior"
                />
              </div>
            }
          />

          <FormRow
            label={t('settings.general.preventTouchAction.label')}
            description={t('settings.general.preventTouchAction.description')}
            control={
              <OreSwitch
                focusKey="settings-prevent-touch-action"
                checked={general.preventTouchAction}
                onChange={(value) => updateGeneralSetting('preventTouchAction', value)}
              />
            }
          />

          <FormRow
            label={t('settings.general.toggleFullscreen.label')}
            description={t('settings.general.toggleFullscreen.description')}
            control={
              <OreButton
                focusKey="settings-btn-toggle-fullscreen"
                className="w-[200px] justify-center whitespace-nowrap"
                onClick={toggleFullscreen}
                disabled={isFullscreenTransitioning}
              >
                {isFullscreenTransitioning ? (
                  <Loader2 size={14} className="mr-1.5 animate-spin" />
                ) : (
                  <Maximize size={14} className="mr-1.5" />
                )}
                {isFullscreen ? t('settings.general.toggleFullscreen.exit') : t('settings.general.toggleFullscreen.enter')}
              </OreButton>
            }
          />

          <FormRow
            label={t('settings.general.exitApp.label')}
            description={t('settings.general.exitApp.description')}
            control={
              <OreButton
                focusKey="settings-btn-exit-app"
                variant="danger"
                className="w-[200px] justify-center whitespace-nowrap"
                onClick={() => setIsExitConfirmOpen(true)}
              >
                <PowerOff size={14} className="mr-1.5" />
                {t('settings.general.exitApp.label')}
              </OreButton>
            }
          />
        </SettingsSection>

        <SettingsSection title={t('settings.general.sections.danger')} icon={<AlertTriangle size={18} />} danger={true}>
          <FormRow
            label={t('settings.general.resetSettings.label')}
            description={t('settings.general.resetSettings.description')}
            control={
              <OreButton
                focusKey="settings-btn-reset-settings"
                variant="danger"
                className="w-[200px] justify-center whitespace-nowrap"
                onClick={() => setIsResetConfirmOpen(true)}
              >
                <RotateCcw size={14} className="mr-1.5" />
                {t('settings.general.resetSettings.label')}
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
        title={t('settings.general.exitConfirm.title')}
        headline={t('settings.general.exitConfirm.headline')}
        description={t('settings.general.exitConfirm.description')}
        confirmLabel={t('settings.general.exitConfirm.confirm')}
        cancelLabel={t('settings.general.exitConfirm.cancel')}
        confirmVariant="danger"
        tone="warning"
        cancelFocusKey="settings-exit-confirm-cancel"
        confirmFocusKey="settings-exit-confirm-confirm"
      />

      <OreConfirmDialog
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={handleResetSettings}
        title={t('settings.general.resetConfirm.title')}
        headline={t('settings.general.resetConfirm.headline')}
        description={t('settings.general.resetConfirm.description')}
        confirmLabel={t('settings.general.resetConfirm.confirm')}
        cancelLabel={t('settings.general.resetConfirm.cancel')}
        confirmVariant="danger"
        tone="danger"
        cancelFocusKey="settings-reset-confirm-cancel"
        confirmFocusKey="settings-reset-confirm-confirm"
      />
    </FocusBoundary>
  );
};
