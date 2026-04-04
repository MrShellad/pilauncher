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
  { w: 854, h: 480, value: '854x480', label: '默认', desc: '854x480 (经典窗口比例)' },
  { w: 1280, h: 720, value: '1280x720', label: '720p', desc: '1280x720 (HD 高清)' },
  { w: 1366, h: 768, value: '1366x768', label: '768p', desc: '1366x768 (常见笔记本)' },
  { w: 1600, h: 900, value: '1600x900', label: '900p', desc: '1600x900 (宽屏)' },
  { w: 1920, h: 1080, value: '1920x1080', label: '1080p', desc: '1920x1080 (FHD 全高清)' },
  { w: 2560, h: 1440, value: '2560x1440', label: '2K', desc: '2560x1440 (QHD 超清)' },
  { w: 3840, h: 2160, value: '3840x2160', label: '4K', desc: '3840x2160 (UHD 超高清)' },
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
      label: <span className="font-minecraft text-sm tracking-wider">{r.label}</span>,
      value: r.value,
      description: r.desc
    }));

    if (maxRes && !STANDARD_RESOLUTIONS.find(r => r.w === maxRes.w && r.h === maxRes.h)) {
      options.push({
        label: <span className="font-minecraft text-sm tracking-wider">原生</span>,
        value: `${maxRes.w}x${maxRes.h}`,
        description: `${maxRes.w}x${maxRes.h} (自动检测的显示器物理分辨率)`
      });
    }
    return options;
  }, [maxRes]);

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
                  { value: 'keep', label: '保持窗口打开', desc: '启动器维持原样，方便你查看日志或管理其他实例。' },
                  { value: 'minimize', label: '自动最小化到托盘', desc: '隐藏主界面释放系统资源，游戏结束后自动恢复。' },
                  { value: 'close', label: '直接退出启动器', desc: '最大化节省性能，但游戏结束后需要重新打开启动器。' }
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
