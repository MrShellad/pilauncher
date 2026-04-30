import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Image as ImageIcon, Sparkles, Type, Crown } from 'lucide-react';

import { useAccountStore } from '../../../../store/useAccountStore';
import { useSettingsStore } from '../../../../store/useSettingsStore';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';
import { FormRow } from '../../../../ui/layout/FormRow';
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../../ui/primitives/OreDropdown';
import { OreSlider } from '../../../../ui/primitives/OreSlider';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';

const PREDEFINED_COLORS = ['#000000', '#FFFFFF', '#18181B', '#2A2A2C', '#3C8527'];

export const AppearanceSettings: React.FC = () => {
  const { t } = useTranslation();
  const { settings, updateAppearanceSetting } = useSettingsStore();
  const { appearance } = settings;

  const hasMicrosoftAccount = useAccountStore((state) =>
    state.accounts.some((account) => account.type?.toLowerCase() === 'microsoft'),
  );

  const { accounts, activeAccountId } = useAccountStore();
  const currentAccount = useMemo(() => accounts.find(a => a.uuid === activeAccountId), [accounts, activeAccountId]);
  const [isDonor, setIsDonor] = useState(false);

  useEffect(() => {
    invoke('fetch_donors')
      .then((data) => {
        if (Array.isArray(data) && currentAccount) {
          const found = data.some((d: any) => d.mcUuid === currentAccount.uuid || d.mcName === currentAccount.name);
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
          try { await invoke('delete_background_image', { path: appearance.customLogo }); } catch (err) {}
        }
        updateAppearanceSetting('customLogo', newPath);
      }
    } catch (err) { console.error('图片选择失败:', err); }
  };

  const handleRemoveCustomLogo = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (appearance.customLogo) {
      try { await invoke('delete_background_image', { path: appearance.customLogo }); } catch (err) {}
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

  const handleRemoveImage = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    if (appearance.backgroundImage) {
      try {
        await invoke('delete_background_image', { path: appearance.backgroundImage });
      } catch (err) {
        console.error('彻底删除旧背景图失败:', err);
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
          } catch (err) {
            console.error('清理上一张背景图失败:', err);
          }
        }

        updateAppearanceSetting('backgroundImage', newPath);
      }
    } catch (err) {
      console.error('图片选择失败:', err);
    }
  };

  const bgPreviewUrl = useMemo(() => {
    return appearance.backgroundImage ? convertFileSrc(appearance.backgroundImage) : null;
  }, [appearance.backgroundImage]);

  const fontOptions = useMemo(() => {
    const base = [{ label: t('settings.appearance.defaultFont'), value: 'Minecraft' }];
    const sysOpts = systemFonts.map((font) => ({ label: font, value: font }));
    return [...base, ...sysOpts];
  }, [systemFonts, t]);

  const focusOrder = useMemo(() => {
    const keys: string[] = [];

    if (appearance.backgroundImage) {
      keys.push('btn-bg-change', 'btn-bg-remove');
    } else {
      keys.push('btn-bg-add');
    }

    keys.push('settings-appearance-blur');

    if (hasMicrosoftAccount) {
      keys.push('settings-appearance-panorama-enabled');
      keys.push('settings-appearance-panorama-speed');
      keys.push('settings-appearance-panorama-direction');
    }
    if (appearance.customLogo) {
      keys.push('settings-appearance-logo-scale');
    }

    PREDEFINED_COLORS.forEach((_, idx) => keys.push(`color-preset-${idx}`));
    keys.push('color-custom');
    keys.push('settings-appearance-opacity');
    keys.push('settings-appearance-font');
    keys.push('settings-appearance-gradient');

    return keys;
  }, [appearance.backgroundImage, hasMicrosoftAccount]);

  const { handleLinearArrow } = useLinearNavigation(focusOrder);

  return (
    <SettingsPageLayout adaptiveScale>
      <SettingsSection title={t('settings.appearance.sections.background', '静态背景')} icon={<ImageIcon size={18} />}>
        <div className="p-6">
          <div className="group relative flex h-56 w-full flex-col items-center justify-center overflow-hidden border-2 border-dashed border-ore-gray-border bg-[#141415] transition-colors">
            {bgPreviewUrl ? (
              <>
                <img
                  src={bgPreviewUrl}
                  alt="Background Preview"
                  className="h-full w-full object-cover transition-all"
                  style={{ filter: `blur(${appearance.backgroundBlur}px)` }}
                />
                <div className="absolute inset-0 z-10 flex items-center justify-center gap-4 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <OreButton
                    variant="secondary"
                    size="sm"
                    onClick={handleSelectImage}
                    focusKey="btn-bg-change"
                    onArrowPress={handleLinearArrow}
                  >
                    {t('settings.appearance.btnChangeBg')}
                  </OreButton>
                  <OreButton
                    variant="danger"
                    size="sm"
                    onClick={handleRemoveImage}
                    focusKey="btn-bg-remove"
                    onArrowPress={handleLinearArrow}
                  >
                    {t('settings.appearance.btnRemoveBg')}
                  </OreButton>
                </div>
              </>
            ) : (
              <FocusItem
                focusKey="btn-bg-add"
                onEnter={handleSelectImage}
                onArrowPress={handleLinearArrow}
              >
                {({ ref, focused }) => (
                  <div
                    ref={ref as any}
                    tabIndex={-1}
                    onClick={handleSelectImage}
                    className={`flex h-full w-full cursor-pointer flex-col items-center justify-center outline-none transition-all ${
                      focused
                        ? 'border-white bg-white/10 ring-2 ring-inset ring-white'
                        : 'hover:border-ore-green hover:bg-white/5'
                    }`}
                  >
                    <div
                      className={`flex flex-col items-center transition-opacity ${
                        focused
                          ? 'text-white opacity-100'
                          : 'text-ore-text-muted opacity-60 group-hover:opacity-100'
                      }`}
                    >
                      <ImageIcon size={40} className="mb-3" />
                      <span className="font-minecraft text-lg">{t('settings.appearance.noBg')}</span>
                      <span className="mt-1 font-minecraft text-xs">{t('settings.appearance.selectLocalInfo')}</span>
                    </div>
                  </div>
                )}
              </FocusItem>
            )}
          </div>
        </div>

        <FormRow
          label={t('settings.appearance.bgBlur')}
          description={t('settings.appearance.bgBlurDesc')}
          vertical={true}
          control={
            <div className="w-full">
              <OreSlider
                focusKey="settings-appearance-blur"
                onArrowPress={handleLinearArrow}
                value={appearance.backgroundBlur}
                min={0}
                max={30}
                step={1}
                valueFormatter={(v) => `${v}px`}
                onChange={(v) => updateAppearanceSetting('backgroundBlur', v)}
                disabled={
                  !appearance.backgroundImage &&
                  !(hasMicrosoftAccount && appearance.panoramaEnabled)
                }
              />
            </div>
          }
        />



        <FormRow
          label={t('settings.appearance.maskColor')}
          description={t('settings.appearance.maskColorDesc')}
          control={
            <div className="flex items-center space-x-3">
              {PREDEFINED_COLORS.map((color, idx) => (
                <FocusItem
                  key={color}
                  focusKey={`color-preset-${idx}`}
                  onEnter={() => updateAppearanceSetting('maskColor', color)}
                  onArrowPress={handleLinearArrow}
                >
                  {({ ref, focused }) => (
                    <button
                      ref={ref as any}
                      onClick={() => updateAppearanceSetting('maskColor', color)}
                      tabIndex={-1}
                      className={`h-7 w-7 rounded-full border-2 shadow-md outline-none transition-transform ${
                        appearance.maskColor.toUpperCase() === color
                          ? 'scale-125 border-ore-green'
                          : 'border-ore-gray-border hover:scale-110'
                      } ${
                        focused
                          ? 'z-10 scale-125 ring-2 ring-white ring-offset-2 ring-offset-[#1E1E1F]'
                          : ''
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  )}
                </FocusItem>
              ))}

              <FocusItem
                focusKey="color-custom"
                onEnter={() => document.getElementById('custom-color-input')?.click()}
                onArrowPress={handleLinearArrow}
              >
                {({ ref, focused }) => (
                  <label
                    ref={ref as any}
                    tabIndex={-1}
                    className={`relative flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-ore-gray-border outline-none transition-all hover:border-ore-green ${
                      focused
                        ? 'z-10 scale-125 border-white text-white ring-2 ring-white ring-offset-2 ring-offset-[#1E1E1F]'
                        : ''
                    }`}
                    title={t('settings.appearance.customColor')}
                  >
                    <input
                      id="custom-color-input"
                      type="color"
                      tabIndex={-1}
                      className="absolute inset-[-10px] h-[50px] w-[50px] cursor-pointer opacity-0"
                      value={appearance.maskColor}
                      onChange={(e) => updateAppearanceSetting('maskColor', e.target.value)}
                    />
                    <span
                      className={`text-[14px] font-bold ${
                        focused ? 'text-white' : 'text-ore-text-muted'
                      }`}
                    >
                      +
                    </span>
                  </label>
                )}
              </FocusItem>
            </div>
          }
        />

        <FormRow
          label={t('settings.appearance.maskOpacity')}
          description={t('settings.appearance.maskOpacityDesc')}
          vertical={true}
          control={
            <div className="w-full">
              <OreSlider
                focusKey="settings-appearance-opacity"
                onArrowPress={handleLinearArrow}
                value={appearance.maskOpacity}
                min={0}
                max={100}
                step={5}
                valueFormatter={(v) => (v / 100).toFixed(2)}
                onChange={(v) => updateAppearanceSetting('maskOpacity', v)}
              />
            </div>
          }
        />
      </SettingsSection>

      {hasMicrosoftAccount && (
        <SettingsSection title={t('settings.appearance.sections.dynamicBackground', '动态背景')} icon={<ImageIcon size={18} />}>
<FormRow
              label={t('settings.appearance.panoramaEnabled')}
              description={t('settings.appearance.panoramaEnabledDesc')}
              control={
                <OreSwitch
                  focusKey="settings-appearance-panorama-enabled"
                  onArrowPress={handleLinearArrow}
                  checked={appearance.panoramaEnabled}
                  onChange={(v) => updateAppearanceSetting('panoramaEnabled', v)}
                />
              }
            />

            <FormRow
              label={t('settings.appearance.panoramaSpeed')}
              description={t('settings.appearance.panoramaSpeedDesc')}
              vertical={true}
              control={
                <div className="w-full">
                  <OreSlider
                    focusKey="settings-appearance-panorama-speed"
                    onArrowPress={handleLinearArrow}
                    value={appearance.panoramaRotationSpeed}
                    min={0}
                    max={0.12}
                    step={0.002}
                    valueFormatter={(v) => `${v.toFixed(3)} rad/s`}
                    onChange={(v) =>
                      updateAppearanceSetting('panoramaRotationSpeed', Number(v.toFixed(3)))
                    }
                    disabled={!appearance.panoramaEnabled}
                  />
                </div>
              }
            />

            <FormRow
              label={t('settings.appearance.panoramaDirection')}
              description={t('settings.appearance.panoramaDirectionDesc', { dir: appearance.panoramaRotationDirection === 'clockwise' ? t('settings.appearance.clockwise') : t('settings.appearance.counterclockwise') })}
              control={
                <OreSwitch
                  focusKey="settings-appearance-panorama-direction"
                  onArrowPress={handleLinearArrow}
                  checked={appearance.panoramaRotationDirection === 'clockwise'}
                  onChange={(v) =>
                    updateAppearanceSetting(
                      'panoramaRotationDirection',
                      v ? 'clockwise' : 'counterclockwise',
                    )
                  }
                  disabled={!appearance.panoramaEnabled}
                />
              }
            />
        </SettingsSection>
      )}
  
      {isDonor && (
        <SettingsSection title="自定义 Logo (赞助者专属)" icon={<Crown size={18} className="text-[#FFD700]" />}>
          <div className="p-6">
            <div className="group relative flex h-32 w-full flex-col items-center justify-center overflow-hidden border-2 border-dashed border-ore-gray-border bg-[#141415] transition-colors">
              {appearance.customLogo ? (
                <>
                  <img
                    src={convertFileSrc(appearance.customLogo)}
                    alt="Custom Logo"
                    className="h-full w-full object-contain p-4 transition-all"
                    style={{ transform: `scale(${(appearance.customLogoScale ?? 100) / 100})` }}
                  />
                  <div className="absolute inset-0 z-10 flex items-center justify-center gap-4 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <OreButton variant="secondary" size="sm" onClick={handleSelectCustomLogo}>更换 Logo</OreButton>
                    <OreButton variant="danger" size="sm" onClick={handleRemoveCustomLogo}>移除 Logo</OreButton>
                  </div>
                </>
              ) : (
                <div onClick={handleSelectCustomLogo} className="flex h-full w-full cursor-pointer flex-col items-center justify-center outline-none transition-all hover:border-ore-green hover:bg-white/5">
                  <div className="flex flex-col items-center opacity-60 transition-opacity group-hover:opacity-100">
                    <ImageIcon size={32} className="mb-2" />
                    <span className="font-minecraft text-sm">选择自定义 Logo</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <FormRow
            label="Logo 大小"
            description="调节自定义 Logo 的缩放比例"
            vertical={true}
            control={
              <div className="w-full">
                <OreSlider
                  focusKey="settings-appearance-logo-scale"
                  onArrowPress={handleLinearArrow}
                  value={appearance.customLogoScale ?? 100}
                  min={10}
                  max={200}
                  step={5}
                  valueFormatter={(v) => `${v}%`}
                  onChange={(v) => updateAppearanceSetting('customLogoScale', v)}
                />
              </div>
            }
          />
        </SettingsSection>
      )}

      <SettingsSection title={t('settings.appearance.sections.typography')} icon={<Sparkles size={18} />}>
        <FormRow
          className="relative z-50"
          label={t('settings.appearance.fontFamily')}
          description={t('settings.appearance.fontFamilyDesc')}
          control={
            <div className="flex items-center space-x-2">
              {isLoadingFonts && <Type size={14} className="animate-pulse text-ore-text-muted" />}
              <OreDropdown
                focusKey="settings-appearance-font"
                onArrowPress={handleLinearArrow}
                options={fontOptions}
                value={appearance.fontFamily}
                onChange={(val) => updateAppearanceSetting('fontFamily', val)}
                disabled={isLoadingFonts}
                searchable={true}
                className="w-56 shrink-0"
              />
            </div>
          }
        />

        <FormRow
          className="relative z-40"
          label={t('settings.appearance.maskGradient')}
          description={t('settings.appearance.maskGradientDesc')}
          control={
            <OreSwitch
              focusKey="settings-appearance-gradient"
              onArrowPress={handleLinearArrow}
              checked={appearance.maskGradient}
              onChange={(v) => updateAppearanceSetting('maskGradient', v)}
            />
          }
        />
      </SettingsSection>
    </SettingsPageLayout>
  );
};
