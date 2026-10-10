import type React from 'react';
import { Image as ImageIcon, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { AppearanceSettings } from '@/types/settings';
import { FocusItem } from '../../../../../ui/focus/FocusItem';
import { FormRow } from '../../../../../ui/layout/FormRow';
import { SettingsSection } from '../../../../../ui/layout/SettingsSection';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../../../ui/primitives/OreDropdown';
import { OreSlider } from '../../../../../ui/primitives/OreSlider';
import { OreSwitch } from '../../../../../ui/primitives/OreSwitch';
import { APPEARANCE_PREDEFINED_COLORS } from './appearanceSettingsConstants';
import type {
  AppearanceArrowHandler,
  AppearanceImageAction,
  AppearanceNewsCover,
  UpdateAppearanceSetting,
} from './appearanceSettingsTypes';

interface StaticBackgroundSettingsSectionProps {
  appearance: AppearanceSettings;
  updateAppearanceSetting: UpdateAppearanceSetting;
  hasMicrosoftAccount: boolean;
  latestNews: AppearanceNewsCover | null;
  backgroundPreviewUrl: string | null;
  onSelectImage: () => void;
  onRemoveImage: AppearanceImageAction;
  onArrowPress: AppearanceArrowHandler;
}

export const StaticBackgroundSettingsSection = ({
  appearance,
  updateAppearanceSetting,
  hasMicrosoftAccount,
  latestNews,
  backgroundPreviewUrl,
  onSelectImage,
  onRemoveImage,
  onArrowPress,
}: StaticBackgroundSettingsSectionProps) => {
  const { t } = useTranslation();
  const themeOptions = [
    { label: t('settings.appearance.themeOptions.light', '浅色'), value: 'light' },
    { label: t('settings.appearance.themeOptions.dark', '深色'), value: 'dark' },
    { label: t('settings.appearance.themeOptions.system', '跟随系统'), value: 'system' },
  ];

  return (
    <SettingsSection title={t('settings.appearance.sections.background', '静态背景')} icon={<ImageIcon size={18} />}>
      <FormRow
        className="relative z-[60]"
        label={t('settings.appearance.theme', '界面主题')}
        description={t('settings.appearance.themeDesc', '切换启动器在浅色模式、深色模式或跟随系统默认主题之间的显示效果。')}
        control={
          <div className="relative focus-within:z-50 w-[240px]">
            <OreDropdown
              focusKey="settings-appearance-theme"
              onArrowPress={onArrowPress}
              options={themeOptions}
              value={appearance.theme || 'system'}
              onChange={(value) => updateAppearanceSetting('theme', value as AppearanceSettings['theme'])}
              className="w-full"
            />
          </div>
        }
      />

      <FormRow
        label={t('settings.appearance.subscribeNewsCover', '订阅更新日志封面背景')}
        description={t(
          'settings.appearance.subscribeNewsCoverDesc',
          '开启后，启动器背景将自动同步为 Minecraft 官方最新发布的版本更新封面画卷。',
        )}
        control={
          <OreSwitch
            focusKey="settings-appearance-subscribe-news-cover"
            onArrowPress={onArrowPress}
            checked={!!appearance.subscribeNewsCoverBackground}
            onChange={(checked) => updateAppearanceSetting('subscribeNewsCoverBackground', checked)}
          />
        }
      />

      <div className="p-6">
        <div className="group relative flex h-56 w-full flex-col items-center justify-center overflow-hidden border-2 border-dashed border-ore-gray-border bg-[#141415] transition-colors">
          {backgroundPreviewUrl ? (
            <>
              <img
                src={backgroundPreviewUrl}
                alt="Background Preview"
                className="h-full w-full object-cover transition-all"
                style={{ filter: `blur(${appearance.backgroundBlur}px)` }}
              />

              {appearance.subscribeNewsCoverBackground && latestNews && (
                <div className="absolute left-3 bottom-3 z-10 flex items-center gap-1.5 border border-white/20 bg-black/75 px-3 py-1 text-xs font-minecraft text-[#6CC349] backdrop-blur-sm shadow-md">
                  <Sparkles size={13} className="shrink-0 text-[#6CC349]" />
                  <span className="truncate max-w-[280px]">
                    {t('settings.appearance.subscribedCoverBadge', '当前订阅')}：{latestNews.version}
                  </span>
                </div>
              )}

              <div className="absolute inset-0 z-10 flex items-center justify-center gap-4 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <OreButton
                  variant="secondary"
                  size="sm"
                  onClick={onSelectImage}
                  focusKey="btn-bg-change"
                  onArrowPress={onArrowPress}
                >
                  {t('settings.appearance.btnChangeBg')}
                </OreButton>
                <OreButton
                  variant="danger"
                  size="sm"
                  onClick={onRemoveImage}
                  focusKey="btn-bg-remove"
                  onArrowPress={onArrowPress}
                >
                  {t('settings.appearance.btnRemoveBg')}
                </OreButton>
              </div>
            </>
          ) : (
            <FocusItem
              focusKey="btn-bg-add"
              onEnter={onSelectImage}
              onArrowPress={onArrowPress}
            >
              {({ ref, focused }) => (
                <div
                  ref={ref as React.RefObject<HTMLDivElement>}
                  tabIndex={-1}
                  onClick={onSelectImage}
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
              onArrowPress={onArrowPress}
              value={appearance.backgroundBlur}
              min={0}
              max={30}
              step={1}
              valueFormatter={(value) => `${value}px`}
              onChange={(value) => updateAppearanceSetting('backgroundBlur', value)}
              disabled={
                !appearance.backgroundImage &&
                !appearance.subscribeNewsCoverBackground &&
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
            {APPEARANCE_PREDEFINED_COLORS.map((color, index) => (
              <FocusItem
                key={color}
                focusKey={`color-preset-${index}`}
                onEnter={() => updateAppearanceSetting('maskColor', color)}
                onArrowPress={onArrowPress}
              >
                {({ ref, focused }) => (
                  <button
                    ref={ref as React.RefObject<HTMLButtonElement>}
                    onClick={() => updateAppearanceSetting('maskColor', color)}
                    tabIndex={-1}
                    className={`h-7 w-7 rounded-none border-2 outline-none transition-transform ${
                      appearance.maskColor.toUpperCase() === color
                        ? 'scale-110 border-black shadow-[inset_0_-3px_rgba(0,0,0,0.35),inset_2px_2px_rgba(255,255,255,0.3)]'
                        : 'border-[#58585A] hover:scale-105 shadow-[inset_0_-3px_rgba(0,0,0,0.2),inset_2px_2px_rgba(255,255,255,0.15)]'
                    } ${
                      focused
                        ? 'z-10 scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#1E1E1F]'
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
              onArrowPress={onArrowPress}
            >
              {({ ref, focused }) => (
                <label
                  ref={ref as React.RefObject<HTMLLabelElement>}
                  tabIndex={-1}
                  className={`relative flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-none border-2 border-dashed border-[#58585A] bg-[#2A2A2C] outline-none transition-all hover:border-ore-green hover:bg-[#3C8527]/10 ${
                    focused
                      ? 'z-10 scale-110 border-white text-white ring-2 ring-white ring-offset-2 ring-offset-[#1E1E1F]'
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
                    onChange={(event) => updateAppearanceSetting('maskColor', event.target.value)}
                  />
                  <span className={`text-[14px] font-bold ${focused ? 'text-white' : 'text-ore-text-muted'}`}>
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
              onArrowPress={onArrowPress}
              value={appearance.maskOpacity}
              min={0}
              max={100}
              step={5}
              valueFormatter={(value) => (value / 100).toFixed(2)}
              onChange={(value) => updateAppearanceSetting('maskOpacity', value)}
            />
          </div>
        }
      />
    </SettingsSection>
  );
};
