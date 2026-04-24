// src/features/Settings/components/tabs/GameSettings.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { Monitor, Eye } from 'lucide-react';

import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../ui/layout/FormRow';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';
import { OreToggleButton, type ToggleOption } from '../../../../ui/primitives/OreToggleButton';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';
import { FocusItem } from '../../../../ui/focus/FocusItem';

import { useSettingsStore } from '../../../../store/useSettingsStore';
import { DEFAULT_SETTINGS } from '../../../../types/settings';

const STANDARD_RESOLUTIONS = [
  { w: 854, h: 480, value: '854x480', labelKey: 'settings.game.resolutions.standard' },
  { w: 1280, h: 720, value: '1280x720', labelKey: 'settings.game.resolutions.hd' },
  { w: 1366, h: 768, value: '1366x768', labelKey: 'settings.game.resolutions.laptop' },
  { w: 1600, h: 900, value: '1600x900', labelKey: 'settings.game.resolutions.widescreen' },
  { w: 1920, h: 1080, value: '1920x1080', labelKey: 'settings.game.resolutions.fhd' },
  { w: 2560, h: 1440, value: '2560x1440', labelKey: 'settings.game.resolutions.qhd' },
  { w: 3840, h: 2160, value: '3840x2160', labelKey: 'settings.game.resolutions.uhd' },
];

export const GameSettings: React.FC = () => {
  const { t } = useTranslation();
  const { settings, updateGameSetting } = useSettingsStore();
  const game = settings.game || DEFAULT_SETTINGS.game;

  const [maxRes, setMaxRes] = useState<{ w: number, h: number } | null>(null);

  useEffect(() => {
    invoke<[number, number]>('get_primary_monitor_resolution')
      .then(([w, h]) => setMaxRes({ w, h }))
      .catch(err => console.error("无法获取屏幕分辨率:", err));
  }, []);

  const resolutionOptions: ToggleOption[] = useMemo(() => {
    let options: ToggleOption[] = STANDARD_RESOLUTIONS.filter(
      r => !maxRes || (r.w <= maxRes.w && r.h <= maxRes.h)
    ).map(r => ({
      label: <span className="font-minecraft text-sm tracking-wider">{t(r.labelKey!)}</span>,
      value: r.value,
      description: t(r.labelKey!)
    }));

    if (maxRes && !STANDARD_RESOLUTIONS.find(r => r.w === maxRes.w && r.h === maxRes.h)) {
      options.push({
        label: <span className="font-minecraft text-sm tracking-wider">{t('settings.game.resolutions.native')}</span>,
        value: `${maxRes.w}x${maxRes.h}`,
        description: t('settings.game.resolutions.nativeDesc')
      });
    }
    return options;
  }, [maxRes, t]);

  // ✅ 核心修复 1：使用 Index (idx) 而不是 Value 来生成焦点链
  const focusOrder = useMemo(() => {
    const resolutionKeys = resolutionOptions.map(
      (_, idx) => `settings-game-resolution-${idx}`
    );

    return [
      'settings-game-window-title',
      'settings-game-fullscreen',
      ...resolutionKeys, // 展开所有分辨率的 index key
      'settings-game-show-log',
      'launcher-vis-keep',
      'launcher-vis-minimize',
      'launcher-vis-close'
    ];
  }, [resolutionOptions]);

  const { handleLinearArrow } = useLinearNavigation(focusOrder);

  return (
    <SettingsPageLayout adaptiveScale>

      <SettingsSection title={t('settings.game.sections.window')} icon={<Monitor size={18} />}>

        <FormRow
          label={t('settings.game.windowTitle')}
          description={t('settings.game.windowTitleDesc')}
          control={
            <div className="w-56">
              <OreInput
                focusKey="settings-game-window-title"
                onArrowPress={handleLinearArrow}
                value={game.windowTitle}
                onChange={(e) => updateGameSetting('windowTitle', e.target.value)}
                placeholder="Minecraft"
              />
            </div>
          }
        />

        <FormRow
          label={t('settings.game.fullscreen')}
          description={t('settings.game.fullscreenDesc')}
          control={
            <OreSwitch
              focusKey="settings-game-fullscreen"
              onArrowPress={handleLinearArrow}
              checked={game.fullscreen}
              onChange={(v) => updateGameSetting('fullscreen', v)}
            />
          }
        />

        <FormRow
          label={t('settings.game.resolution')}
          description={t('settings.game.resolutionDesc')}
          vertical={true}
          control={
            /* ✅ 核心修复 2：外层隐藏破版，内层提供充足 padding 容纳焦点发光 */
            <div className="w-full mt-2 -mx-2 overflow-hidden">
              <div className="w-full overflow-x-auto no-scrollbar px-2 py-2">
                <div className="min-w-[600px]">
                  <OreToggleButton
                    focusKeyPrefix="settings-game-resolution"
                    onArrowPress={handleLinearArrow}
                    options={resolutionOptions}
                    value={game.resolution}
                    onChange={(v) => updateGameSetting('resolution', v)}
                    disabled={game.fullscreen}
                  />
                </div>
              </div>
            </div>
          }
        />
      </SettingsSection>

      <SettingsSection title={t('settings.game.sections.behavior')} icon={<Eye size={18} />}>

        <FormRow
          label={t('settings.game.showLog')}
          description={t('settings.game.showLogDesc')}
          control={
            <OreSwitch
              focusKey="settings-game-show-log"
              onArrowPress={handleLinearArrow}
              checked={game.showGameLog ?? true}
              onChange={(v) => updateGameSetting('showGameLog', v)}
            />
          }
        />

        <FormRow
          label={t('settings.game.visibility')}
          description={t('settings.game.visibilityDesc')}
          vertical={true}
          control={
            <div className="w-full mt-2">
              <div className="flex flex-col space-y-2 max-w-md">
                {[
                  { value: 'keep', label: t('settings.game.visibilityOptions.keep.label'), desc: t('settings.game.visibilityOptions.keep.desc') },
                  { value: 'minimize', label: t('settings.game.visibilityOptions.minimize.label'), desc: t('settings.game.visibilityOptions.minimize.desc') },
                  { value: 'close', label: t('settings.game.visibilityOptions.close.label'), desc: t('settings.game.visibilityOptions.close.desc') }
                ].map((opt) => (
                  <FocusItem
                    key={opt.value}
                    focusKey={`launcher-vis-${opt.value}`}
                    onArrowPress={handleLinearArrow}
                  >
                    {({ ref, focused }) => (
                      <label
                        ref={ref}
                        className={`
                          flex flex-col p-3 border-2 cursor-pointer transition-all duration-200 outline-none
                          ${game.launcherVisibility === opt.value ? 'bg-[#2A2A2C] border-ore-green shadow-[0_0_8px_rgba(56,133,39,0.2)]' : 'bg-[#141415] border-[#1E1E1F] hover:border-white/30'}
                          ${focused ? 'border-white ring-2 ring-white/20 scale-[1.01] z-10' : ''}
                        `}
                        onClick={() => updateGameSetting('launcherVisibility', opt.value as any)}
                      >
                        <span className="text-white font-minecraft text-sm mb-1">{opt.label}</span>
                        <span className="text-ore-text-muted font-minecraft text-xs">{opt.desc}</span>
                      </label>
                    )}
                  </FocusItem>
                ))}
              </div>
            </div>
          }
        />
      </SettingsSection>

    </SettingsPageLayout>
  );
};
