// /src/features/Settings/components/tabs/AppearanceSettings.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';

import { OreSlider } from '../../../../ui/primitives/OreSlider';
import { OreDropdown } from '../../../../ui/primitives/OreDropdown';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { useSettingsStore } from '../../../../store/useSettingsStore';

// ✅ 引入焦点组件
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';

import { Image as ImageIcon, Type, Sparkles } from 'lucide-react';

// 引入新的布局组件
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../ui/layout/FormRow';

const PREDEFINED_COLORS = ['#000000', '#FFFFFF', '#18181B', '#2A2A2C', '#3C8527'];

export const AppearanceSettings: React.FC = () => {
  const { settings, updateAppearanceSetting } = useSettingsStore();
  const { appearance } = settings;

  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [isLoadingFonts, setIsLoadingFonts] = useState(true);

  useEffect(() => {
    invoke<string[]>('get_system_fonts')
      .then(fonts => setSystemFonts(fonts))
      .catch(console.error)
      .finally(() => setIsLoadingFonts(false));
  }, []);

  const handleRemoveImage = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    if (appearance.backgroundImage) {
      try {
        await invoke('delete_background_image', { path: appearance.backgroundImage });
      } catch (err) {
        console.error("彻底删除旧背景图失败:", err);
      }
    }

    updateAppearanceSetting('backgroundImage', null);
  };

  const handleSelectImage = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
      });

      if (selected && typeof selected === 'string') {
        const newPath = await invoke<string>('import_background_image', { sourcePath: selected });

        if (appearance.backgroundImage) {
          try {
            await invoke('delete_background_image', { path: appearance.backgroundImage });
          } catch (err) {
            console.error("清理上一张背景图失败:", err);
          }
        }

        updateAppearanceSetting('backgroundImage', newPath);
      }
    } catch (e) {
      console.error("图片选择失败:", e);
    }
  };

  const bgPreviewUrl = useMemo(() => {
    return appearance.backgroundImage ? convertFileSrc(appearance.backgroundImage) : null;
  }, [appearance.backgroundImage]);

  const fontOptions = useMemo(() => {
    const base = [{ label: '默认 (Minecraft)', value: 'Minecraft' }];
    const sysOpts = systemFonts.map(f => ({ label: f, value: f }));
    return [...base, ...sysOpts];
  }, [systemFonts]);

  const focusOrder = useMemo(() => {
    const keys = [];
    if (appearance.backgroundImage) {
      keys.push('btn-bg-change', 'btn-bg-remove');
    } else {
      keys.push('btn-bg-add');
    }
    keys.push('settings-appearance-blur');
    PREDEFINED_COLORS.forEach((_, idx) => keys.push(`color-preset-${idx}`));
    keys.push('color-custom');
    keys.push('settings-appearance-opacity');
    keys.push('settings-appearance-font');
    keys.push('settings-appearance-gradient');
    return keys;
  }, [appearance.backgroundImage]);

  const { handleLinearArrow } = useLinearNavigation(focusOrder);

  return (
    <SettingsPageLayout adaptiveScale>

      <SettingsSection title="背景与主题" icon={<ImageIcon size={18} />}>

        <div className="p-6">
          <div className="relative w-full h-56 bg-[#141415] border-2 border-dashed border-ore-gray-border flex flex-col items-center justify-center overflow-hidden group transition-colors">

            {bgPreviewUrl ? (
              <>
                <img
                  src={bgPreviewUrl}
                  alt="Background Preview"
                  className="w-full h-full object-cover transition-all"
                  style={{ filter: `blur(${appearance.backgroundBlur}px)` }}
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center justify-center gap-4 transition-opacity z-10">
                  <OreButton
                    variant="secondary"
                    size="sm"
                    onClick={handleSelectImage}
                    focusKey="btn-bg-change"
                    onArrowPress={handleLinearArrow}
                  >
                    更换图片
                  </OreButton>
                  <OreButton
                    variant="danger"
                    size="sm"
                    onClick={handleRemoveImage}
                    focusKey="btn-bg-remove"
                    onArrowPress={handleLinearArrow}
                  >
                    移除背景
                  </OreButton>
                </div>
              </>
            ) : (
              <FocusItem focusKey="btn-bg-add" onEnter={handleSelectImage} onArrowPress={handleLinearArrow}>
                {({ ref, focused }) => (
                  <div
                    ref={ref as any}
                    tabIndex={-1} /* ✅ 核心修复 1：赋予 div 编程可聚焦能力，防止焦点跳过 */
                    onClick={handleSelectImage}
                    className={`w-full h-full flex flex-col items-center justify-center cursor-pointer outline-none transition-all ${focused ? 'bg-white/10 ring-2 ring-inset ring-white border-white' : 'hover:bg-white/5 hover:border-ore-green'
                      }`}
                  >
                    <div className={`flex flex-col items-center transition-opacity ${focused ? 'opacity-100 text-white' : 'text-ore-text-muted opacity-60 group-hover:opacity-100'}`}>
                      <ImageIcon size={40} className="mb-3" />
                      <span className="font-minecraft text-lg">无背景</span>
                      <span className="font-minecraft text-xs mt-1">点击选择本地图片</span>
                    </div>
                  </div>
                )}
              </FocusItem>
            )}
          </div>
        </div>

        {/* 细节调节控件 */}
        <FormRow
          label="背景模糊度"
          description="调节主界面背景图片的模糊效果。"
          vertical={true}
          control={
            <div className="w-full">
              <OreSlider
                focusKey="settings-appearance-blur"
                onArrowPress={handleLinearArrow}
                value={appearance.backgroundBlur}
                min={0} max={30} step={1}
                valueFormatter={(v) => `${v}px`}
                onChange={(v) => updateAppearanceSetting('backgroundBlur', v)}
                disabled={!appearance.backgroundImage}
              />
            </div>
          }
        />

        <FormRow
          label="遮罩颜色"
          description="覆盖在背景图上方的颜色，用于确保文字可读性。"
          control={
            <div className="flex items-center space-x-3">
              {PREDEFINED_COLORS.map((color, idx) => (
                <FocusItem key={color} focusKey={`color-preset-${idx}`} onEnter={() => updateAppearanceSetting('maskColor', color)} onArrowPress={handleLinearArrow}>
                  {({ ref, focused }) => (
                    <button
                      ref={ref as any}
                      onClick={() => updateAppearanceSetting('maskColor', color)}
                      tabIndex={-1}
                      className={`w-7 h-7 rounded-full border-2 shadow-md transition-transform outline-none ${appearance.maskColor.toUpperCase() === color
                        ? 'border-ore-green scale-125'
                        : 'border-ore-gray-border hover:scale-110'
                        } ${focused ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1E1E1F] scale-125 z-10' : ''}`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  )}
                </FocusItem>
              ))}

              <FocusItem focusKey="color-custom" onEnter={() => document.getElementById('custom-color-input')?.click()} onArrowPress={handleLinearArrow}>
                {({ ref, focused }) => (
                  <label
                    ref={ref as any}
                    tabIndex={-1} /* ✅ 核心修复 2：赋予 label 编程可聚焦能力，保证焦点链完整 */
                    className={`w-7 h-7 rounded-full border-2 border-dashed border-ore-gray-border flex items-center justify-center cursor-pointer transition-all hover:border-ore-green relative overflow-hidden outline-none ${focused ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1E1E1F] scale-125 z-10 border-white text-white' : ''
                      }`}
                    title="自定义颜色"
                  >
                    <input
                      id="custom-color-input"
                      type="color"
                      tabIndex={-1}
                      className="absolute inset-[-10px] w-[50px] h-[50px] cursor-pointer opacity-0"
                      value={appearance.maskColor}
                      onChange={e => updateAppearanceSetting('maskColor', e.target.value)}
                    />
                    <span className={`text-[14px] font-bold ${focused ? 'text-white' : 'text-ore-text-muted'}`}>+</span>
                  </label>
                )}
              </FocusItem>
            </div>
          }
        />

        <FormRow
          label="遮罩透明度"
          description="调节颜色遮罩的透明级别，数值越大背景越暗。"
          vertical={true}
          control={
            <div className="w-full">
              <OreSlider
                focusKey="settings-appearance-opacity"
                onArrowPress={handleLinearArrow}
                value={appearance.maskOpacity}
                min={0} max={100} step={5}
                valueFormatter={(v) => (v / 100).toFixed(2)}
                onChange={(v) => updateAppearanceSetting('maskOpacity', v)}
              />
            </div>
          }
        />
      </SettingsSection>

      <SettingsSection title="排版与特效" icon={<Sparkles size={18} />}>
        <FormRow
          className="relative z-50"
          label="启动器全局字体"
          description="更改全局界面的主要字体。遇到不支持的字符时，会自动回退使用默认的 Minecraft 字体。"
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
                className="w-56"
              />
            </div>
          }
        />
        <FormRow
          className="relative z-40"
          label="启用底部黑色渐变"
          description="在启动器底部增加一层黑色渐变投影，使文字和导航更加清晰。"
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
