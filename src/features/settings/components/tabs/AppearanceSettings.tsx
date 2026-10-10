import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

import { useAccountStore } from '@/features/account';
import { useNewsStore } from '@/features/home';
import { useSettingsStore } from '@/app/stores/useSettingsStore';
import { normalizeMinecraftNewsItems } from '@/shared/data/newsItems';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { APPEARANCE_PREDEFINED_COLORS } from './appearance-settings/appearanceSettingsConstants';
import type { PanoramaSetInfo } from './appearance-settings/appearanceSettingsTypes';
import { DonorLogoSettingsSection } from './appearance-settings/DonorLogoSettingsSection';
import { NavigationSettingsSection } from './appearance-settings/NavigationSettingsSection';
import { PanoramaSettingsSection } from './appearance-settings/PanoramaSettingsSection';
import { StaticBackgroundSettingsSection } from './appearance-settings/StaticBackgroundSettingsSection';
import { TypographySettingsSection } from './appearance-settings/TypographySettingsSection';

interface DonorRecord {
  mcUuid?: string;
  mcName?: string;
}

export const AppearanceSettings = () => {
  const { t } = useTranslation();
  const { settings, updateAppearanceSetting } = useSettingsStore();
  const { appearance } = settings;

  const hasMicrosoftAccount = useAccountStore((state) =>
    state.accounts.some((account) => account.type?.toLowerCase() === 'microsoft'),
  );

  const [panoramaSets, setPanoramaSets] = useState<PanoramaSetInfo[]>([]);
  const [selectedPanoramaSet, setSelectedPanoramaSet] = useState('');
  const [isImportingPanorama, setIsImportingPanorama] = useState(false);
  const [panoramaImportError, setPanoramaImportError] = useState<string | null>(null);

  const loadPanoramaSets = useCallback(async () => {
    try {
      const sets = await invoke<PanoramaSetInfo[]>('list_background_panoramas');
      setPanoramaSets(sets);
      if (sets.length > 0 && !selectedPanoramaSet) {
        setSelectedPanoramaSet(sets[0].name);
      }
    } catch (error) {
      console.error('加载全景图列表失败:', error);
    }
  }, [selectedPanoramaSet]);

  useEffect(() => {
    if (hasMicrosoftAccount) {
      void loadPanoramaSets();
    }
  }, [hasMicrosoftAccount, loadPanoramaSets]);

  const handleImportPanorama = async () => {
    setPanoramaImportError(null);
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [{ name: 'MC Resource Pack', extensions: ['zip'] }],
      });
      if (!selected || typeof selected !== 'string') return;

      setIsImportingPanorama(true);
      const packName = await invoke<string>('import_panorama_from_pack', { packPath: selected });
      await loadPanoramaSets();
      setSelectedPanoramaSet(packName);
    } catch (error) {
      const message = String(error);
      setPanoramaImportError(message);
      console.error('导入全景图失败:', error);
    } finally {
      setIsImportingPanorama(false);
    }
  };

  const panoramaSetOptions = useMemo(
    () => panoramaSets.map((set) => ({ label: set.name, value: set.name })),
    [panoramaSets],
  );

  const { accounts, activeAccountId } = useAccountStore();
  const currentAccount = useMemo(
    () => accounts.find((account) => account.uuid === activeAccountId),
    [accounts, activeAccountId],
  );
  const [isDonor, setIsDonor] = useState(false);

  useEffect(() => {
    invoke<DonorRecord[]>('fetch_donors')
      .then((data) => {
        if (Array.isArray(data) && currentAccount) {
          const found = data.some(
            (donor) => donor.mcUuid === currentAccount.uuid || donor.mcName === currentAccount.name,
          );
          setIsDonor(found);
        }
      })
      .catch(console.error);
  }, [currentAccount]);

  const handleSelectCustomLogo = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'] }],
      });
      if (selected && typeof selected === 'string') {
        const newPath = await invoke<string>('import_background_image', { sourcePath: selected });
        if (appearance.customLogo) {
          try {
            await invoke('delete_background_image', { path: appearance.customLogo });
          } catch {
            // Preserve the imported logo even if cleanup of the previous file fails.
          }
        }
        updateAppearanceSetting('customLogo', newPath);
      }
    } catch (error) {
      console.error('图片选择失败:', error);
    }
  };

  const handleRemoveCustomLogo = async (event?: MouseEvent) => {
    event?.stopPropagation();
    if (appearance.customLogo) {
      try {
        await invoke('delete_background_image', { path: appearance.customLogo });
      } catch {
        // Clearing the setting remains the source of truth if file cleanup fails.
      }
    }
    updateAppearanceSetting('customLogo', null);
  };

  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [isLoadingFonts, setIsLoadingFonts] = useState(true);

  useEffect(() => {
    invoke<string[]>('get_system_fonts')
      .then((fonts) => setSystemFonts(fonts))
      .catch(console.error)
      .finally(() => setIsLoadingFonts(false));
  }, []);

  const handleRemoveImage = async (event?: MouseEvent) => {
    event?.stopPropagation();

    if (appearance.backgroundImage) {
      try {
        await invoke('delete_background_image', { path: appearance.backgroundImage });
      } catch (error) {
        console.error('彻底删除旧背景图失败:', error);
      }
    }

    updateAppearanceSetting('backgroundImage', null);
  };

  const handleSelectImage = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      });

      if (selected && typeof selected === 'string') {
        const newPath = await invoke<string>('import_background_image', { sourcePath: selected });

        if (appearance.backgroundImage) {
          try {
            await invoke('delete_background_image', { path: appearance.backgroundImage });
          } catch (error) {
            console.error('清理上一张背景图失败:', error);
          }
        }

        updateAppearanceSetting('backgroundImage', newPath);
      }
    } catch (error) {
      console.error('图片选择失败:', error);
    }
  };

  const rawNewsItems = useNewsStore((state) => state.rawItems);
  const latestNews = useMemo(() => {
    if (rawNewsItems.length === 0) return null;
    const items = normalizeMinecraftNewsItems(rawNewsItems, 'zh');
    return items[0] || null;
  }, [rawNewsItems]);

  const backgroundPreviewUrl = useMemo(() => {
    if (appearance.subscribeNewsCoverBackground && latestNews?.coverImageUrl) {
      return latestNews.coverImageUrl;
    }
    return appearance.backgroundImage ? convertFileSrc(appearance.backgroundImage) : null;
  }, [appearance.subscribeNewsCoverBackground, latestNews, appearance.backgroundImage]);

  const fontOptions = useMemo(() => {
    const base = [{ label: t('settings.appearance.defaultFont'), value: 'Minecraft' }];
    const systemOptions = systemFonts.map((font) => ({ label: font, value: font }));
    return [...base, ...systemOptions];
  }, [systemFonts, t]);

  const focusOrder = useMemo(() => {
    const keys: string[] = ['settings-appearance-theme', 'settings-appearance-subscribe-news-cover'];

    if (appearance.backgroundImage) {
      keys.push('btn-bg-change', 'btn-bg-remove');
    } else {
      keys.push('btn-bg-add');
    }

    keys.push('settings-appearance-blur');
    APPEARANCE_PREDEFINED_COLORS.forEach((_, index) => keys.push(`color-preset-${index}`));
    keys.push('color-custom');
    keys.push('settings-appearance-opacity');

    if (hasMicrosoftAccount) {
      keys.push('settings-appearance-panorama-enabled');
      if (panoramaSets.length > 0) keys.push('settings-appearance-panorama-set');
      keys.push('settings-appearance-panorama-import');
      keys.push('settings-appearance-panorama-speed');
      keys.push('settings-appearance-panorama-direction');
    }

    if (isDonor) {
      if (appearance.customLogo) {
        keys.push('btn-logo-change', 'btn-logo-remove');
        keys.push('settings-appearance-logo-scale');
      } else {
        keys.push('btn-logo-add');
      }
    }

    keys.push('settings-appearance-font');
    keys.push('settings-appearance-gradient');
    keys.push(
      'settings-appearance-nav-instances',
      'settings-appearance-nav-multiplayer',
      'settings-appearance-nav-downloads',
      'settings-appearance-nav-library',
      'settings-appearance-skip-exit-confirm',
    );

    return keys;
  }, [appearance.backgroundImage, appearance.customLogo, hasMicrosoftAccount, panoramaSets.length, isDonor]);

  const { handleLinearArrow } = useLinearNavigation(focusOrder);

  return (
    <SettingsPageLayout adaptiveScale>
      <StaticBackgroundSettingsSection
        appearance={appearance}
        updateAppearanceSetting={updateAppearanceSetting}
        hasMicrosoftAccount={hasMicrosoftAccount}
        latestNews={latestNews}
        backgroundPreviewUrl={backgroundPreviewUrl}
        onSelectImage={handleSelectImage}
        onRemoveImage={handleRemoveImage}
        onArrowPress={handleLinearArrow}
      />

      {hasMicrosoftAccount && (
        <PanoramaSettingsSection
          appearance={appearance}
          updateAppearanceSetting={updateAppearanceSetting}
          panoramaSetOptions={panoramaSetOptions}
          selectedPanoramaSet={selectedPanoramaSet}
          isImportingPanorama={isImportingPanorama}
          panoramaImportError={panoramaImportError}
          onSelectPanoramaSet={setSelectedPanoramaSet}
          onImportPanorama={handleImportPanorama}
          onArrowPress={handleLinearArrow}
        />
      )}

      {isDonor && (
        <DonorLogoSettingsSection
          appearance={appearance}
          updateAppearanceSetting={updateAppearanceSetting}
          onSelectLogo={handleSelectCustomLogo}
          onRemoveLogo={handleRemoveCustomLogo}
          onArrowPress={handleLinearArrow}
        />
      )}

      <TypographySettingsSection
        appearance={appearance}
        updateAppearanceSetting={updateAppearanceSetting}
        fontOptions={fontOptions}
        isLoadingFonts={isLoadingFonts}
        onArrowPress={handleLinearArrow}
      />

      <NavigationSettingsSection
        appearance={appearance}
        updateAppearanceSetting={updateAppearanceSetting}
        onArrowPress={handleLinearArrow}
      />
    </SettingsPageLayout>
  );
};
