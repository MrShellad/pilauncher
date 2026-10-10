import { LayoutDashboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { AppearanceSettings } from '@/types/settings';
import { FormRow } from '../../../../../ui/layout/FormRow';
import { SettingsSection } from '../../../../../ui/layout/SettingsSection';
import { OreSwitch } from '../../../../../ui/primitives/OreSwitch';
import type { AppearanceArrowHandler, UpdateAppearanceSetting } from './appearanceSettingsTypes';

interface NavigationSettingsSectionProps {
  appearance: AppearanceSettings;
  updateAppearanceSetting: UpdateAppearanceSetting;
  onArrowPress: AppearanceArrowHandler;
}

export const NavigationSettingsSection = ({
  appearance,
  updateAppearanceSetting,
  onArrowPress,
}: NavigationSettingsSectionProps) => {
  const { t } = useTranslation();

  const updateTabVisibility = (tabId: string, visible: boolean) => {
    const next = visible
      ? appearance.hiddenNavTabs.filter((id) => id !== tabId)
      : [...appearance.hiddenNavTabs, tabId];
    updateAppearanceSetting('hiddenNavTabs', next);
  };

  return (
    <SettingsSection title={t('settings.appearance.sections.navigation', '导航与行为')} icon={<LayoutDashboard size={18} />}>
      <FormRow
        label={t('settings.appearance.showInstances', '显示「实例」')}
        description={t('settings.appearance.showInstancesDesc', '在顶部导航栏中显示实例入口')}
        control={
          <OreSwitch
            focusKey="settings-appearance-nav-instances"
            onArrowPress={onArrowPress}
            checked={!appearance.hiddenNavTabs.includes('instances')}
            onChange={(visible) => updateTabVisibility('instances', visible)}
          />
        }
      />
      <FormRow
        label={t('settings.appearance.showMultiplayer', '显示「联机」')}
        description={t('settings.appearance.showMultiplayerDesc', '在顶部导航栏中显示联机入口')}
        control={
          <OreSwitch
            focusKey="settings-appearance-nav-multiplayer"
            onArrowPress={onArrowPress}
            checked={!appearance.hiddenNavTabs.includes('multiplayer')}
            onChange={(visible) => updateTabVisibility('multiplayer', visible)}
          />
        }
      />
      <FormRow
        label={t('settings.appearance.showDownloads', '显示「下载」')}
        description={t('settings.appearance.showDownloadsDesc', '在顶部导航栏中显示下载入口')}
        control={
          <OreSwitch
            focusKey="settings-appearance-nav-downloads"
            onArrowPress={onArrowPress}
            checked={!appearance.hiddenNavTabs.includes('downloads')}
            onChange={(visible) => updateTabVisibility('downloads', visible)}
          />
        }
      />
      <FormRow
        label={t('settings.appearance.showLibrary', '显示「收藏」')}
        description={t('settings.appearance.showLibraryDesc', '在顶部导航栏中显示收藏入口')}
        control={
          <OreSwitch
            focusKey="settings-appearance-nav-library"
            onArrowPress={onArrowPress}
            checked={!appearance.hiddenNavTabs.includes('library')}
            onChange={(visible) => updateTabVisibility('library', visible)}
          />
        }
      />
      <FormRow
        label={t('settings.appearance.skipExitConfirm', '跳过退出确认')}
        description={t('settings.appearance.skipExitConfirmDesc', '关闭窗口时不再弹出确认对话框，直接退出应用（仅在关闭行为为「退出」时生效）')}
        control={
          <OreSwitch
            focusKey="settings-appearance-skip-exit-confirm"
            onArrowPress={onArrowPress}
            checked={appearance.skipExitConfirm}
            onChange={(value) => updateAppearanceSetting('skipExitConfirm', value)}
          />
        }
      />
    </SettingsSection>
  );
};
