// src/features/Settings/components/tabs/GameSettings.tsx
import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
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

const STEAM_DECK_TOGGLE_DEBOUNCE_MS = 350;

export const GameSettings: React.FC = () => {
  const { t } = useTranslation();
  const { settings, updateGameSetting } = useSettingsStore();
  const game = settings.game || DEFAULT_SETTINGS.game;

  const [maxRes, setMaxRes] = useState<{ w: number, h: number } | null>(null);
  const [steamDeckToggleLocked, setSteamDeckToggleLocked] = useState(false);
  const steamDeckToggleLockRef = useRef(false);
  const steamDeckToggleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    invoke<[number, number]>('get_primary_monitor_resolution')
      .then(([w, h]) => setMaxRes({ w, h }))
      .catch(err => console.error("无法获取屏幕分辨率:", err));
  }, []);

  useEffect(() => {
    return () => {
      if (steamDeckToggleTimerRef.current !== null) {
        window.clearTimeout(steamDeckToggleTimerRef.current);
      }
    };
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
      'settings-game-steamdeck-keymap',
      'settings-game-show-log',
      'launcher-vis-keep',
      'launcher-vis-minimize',
      'launcher-vis-close'
    ];
  }, [resolutionOptions]);

  const { handleLinearArrow } = useLinearNavigation(focusOrder);

  const steamDeckKeymapColumns = useMemo(() => [
    [
      ['A', t('settings.game.steamDeckMap.confirm')],
      ['B / Menu', t('settings.game.steamDeckMap.cancel')],
      ['Left Stick / WASD', t('settings.game.steamDeckMap.move')],
      ['Right Trackpad', t('settings.game.steamDeckMap.pointer')],
    ],
    [
      ['X / Right Click', t('settings.game.steamDeckMap.actionX')],
      ['Y / F', t('settings.game.steamDeckMap.actionY')],
      ['L1 / R1 / D-Pad', t('settings.game.steamDeckMap.scroll')],
      ['L2 / R2', t('settings.game.steamDeckMap.mouseButtons')],
    ],
  ], [t]);

  const handleSteamDeckKeymapChange = useCallback((enabled: boolean) => {
    if (steamDeckToggleLockRef.current) return;

    steamDeckToggleLockRef.current = true;
    setSteamDeckToggleLocked(true);
    updateGameSetting('steamDeckKeymap', enabled);

    if (steamDeckToggleTimerRef.current !== null) {
      window.clearTimeout(steamDeckToggleTimerRef.current);
    }
    steamDeckToggleTimerRef.current = window.setTimeout(() => {
      steamDeckToggleLockRef.current = false;
      setSteamDeckToggleLocked(false);
      steamDeckToggleTimerRef.current = null;
    }, STEAM_DECK_TOGGLE_DEBOUNCE_MS);
  }, [updateGameSetting]);

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

        <div className="flex flex-col">
          <FormRow
            label={t('settings.game.steamDeckKeymap')}
            description={t('settings.game.steamDeckKeymapDesc')}
            control={
              <OreSwitch
                focusKey="settings-game-steamdeck-keymap"
                onArrowPress={handleLinearArrow}
                checked={game.steamDeckKeymap ?? false}
                disabled={steamDeckToggleLocked}
                onChange={handleSteamDeckKeymapChange}
              />
            }
          />
          {game.steamDeckKeymap && (
            <div className="px-6 pb-5 -mt-2">
              <div className="grid w-full gap-x-6 gap-y-2 rounded-sm border border-white/10 bg-black/25 p-3 text-xs text-ore-text-muted lg:grid-cols-2">
                {steamDeckKeymapColumns.map((column, columnIndex) => (
                  <div key={columnIndex} className="grid auto-rows-[2.25rem] gap-2">
                    {column.map(([button, desc]) => (
                      <div
                        key={button}
                        className="grid min-w-0 grid-cols-[8.75rem_minmax(0,1fr)] items-center gap-3 leading-none"
                      >
                        <span className="flex h-8 items-center justify-center rounded-sm border border-white/10 bg-white/10 px-2 text-center font-minecraft text-white">
                          {button}
                        </span>
                        <span className="flex min-h-8 min-w-0 items-center leading-4">{desc}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

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
