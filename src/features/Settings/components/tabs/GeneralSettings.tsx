// src/features/Settings/components/tabs/GeneralSettings.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
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

import { useSettingsStore } from '../../../../store/useSettingsStore';
import { useAppUpdater } from '../../../../hooks/useAppUpdater';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../ui/layout/FormRow';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreConfirmDialog } from '../../../../ui/primitives/OreConfirmDialog';
import { OreDropdown } from '../../../../ui/primitives/OreDropdown';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';



export const GeneralSettings: React.FC = () => {
  const { t } = useTranslation();
  const { settings, updateGeneralSetting, resetSettings } = useSettingsStore();
  const { checkStatus, checkForUpdate } = useAppUpdater();
  const { general } = settings;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFullscreenTransitioning, setIsFullscreenTransitioning] = useState(false);
  const fullscreenCooldownRef = useRef<number | null>(null);

  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);



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

      void unlistenResize.then((dispose) => dispose());
    };
  }, []);

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
          <OreButton focusKey="settings-btn-check-update" className="w-[200px] justify-center whitespace-nowrap" onClick={checkForUpdate}>
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
              <div className="relative focus-within:z-50 w-[200px]">
                <OreInput
                  focusKey="settings-device-name"
                  value={general.deviceName}
                  onChange={(event) => updateGeneralSetting('deviceName', event.target.value)}
                  placeholder={t('settings.general.deviceName.placeholder')}
                  containerClassName="!space-y-0 w-full"
                />
              </div>
            }
          />

          <FormRow
            label={t('settings.general.language.label')}
            description={t('settings.general.language.description')}
            control={
              <div className="relative focus-within:z-50 w-[200px]">
                <OreDropdown
                  options={languageOptions}
                  value={general.language}
                  onChange={(value) => updateGeneralSetting('language', value)}
                  className="w-full"
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
              <div className="relative focus-within:z-50 w-[200px]">
                <OreDropdown
                  options={closeBehaviorOptions}
                  value={general.closeBehavior}
                  onChange={(value) => updateGeneralSetting('closeBehavior', value as 'tray' | 'exit')}
                  className="w-full"
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
            label={t('settings.general.linuxDisableDmabuf.label')}
            description={t('settings.general.linuxDisableDmabuf.description')}
            control={
              <OreSwitch
                focusKey="settings-linux-disable-dmabuf"
                checked={general.linuxDisableDmabuf}
                onChange={(value) => updateGeneralSetting('linuxDisableDmabuf', value)}
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
