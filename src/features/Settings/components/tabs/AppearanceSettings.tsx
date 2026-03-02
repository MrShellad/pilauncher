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

  const handleSelectImage = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
      });
      if (selected && typeof selected === 'string') {
        const newPath = await invoke<string>('import_background_image', { sourcePath: selected });
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

  return (
    <SettingsPageLayout title="界面与外观" subtitle="Appearance & Styling">
      
      {/* ==================== 核心：背景与主题 ==================== */}
      <SettingsSection title="背景与主题" icon={<ImageIcon size={18} />}>
        
        {/* 图片预览区 - 独立于 FormRow 之外，保持大尺寸横跨 */}
        <div className="p-6">
          <div 
            onClick={handleSelectImage}
            className="relative w-full h-56 bg-[#141415] border-2 border-dashed border-ore-gray-border flex flex-col items-center justify-center cursor-pointer overflow-hidden group hover:border-ore-green transition-colors"
          >
            {bgPreviewUrl ? (
              <>
                <img 
                  src={bgPreviewUrl} 
                  alt="Background Preview"
                  className="w-full h-full object-cover transition-all"
                  style={{ filter: `blur(${appearance.backgroundBlur}px)` }}
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <OreButton 
                    variant="danger" 
                    size="sm" 
                    onClick={(e) => { e.stopPropagation(); updateAppearanceSetting('backgroundImage', null); }}
                  >
                    移除背景
                  </OreButton>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center text-ore-text-muted opacity-60 group-hover:opacity-100 transition-opacity">
                <ImageIcon size={40} className="mb-3" />
                <span className="font-minecraft text-lg">无背景</span>
                <span className="font-minecraft text-xs mt-1">点击选择本地图片</span>
              </div>
            )}
          </div>
        </div>

        {/* 细节调节控件 */}
        <FormRow 
          label="背景模糊度" 
          description="调节主界面背景图片的模糊效果。"
          vertical={true} // ✅ 强制换行显示
          control={
            <div className="w-full">
              <OreSlider 
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
              {PREDEFINED_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => updateAppearanceSetting('maskColor', color)}
                  className={`w-7 h-7 rounded-full border-2 shadow-md transition-transform ${
                    appearance.maskColor.toUpperCase() === color 
                      ? 'border-ore-green scale-125' 
                      : 'border-ore-gray-border hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
              <label 
                className="w-7 h-7 rounded-full border-2 border-dashed border-ore-gray-border flex items-center justify-center cursor-pointer hover:border-ore-green relative overflow-hidden"
                title="自定义颜色"
              >
                <input 
                  type="color" 
                  className="absolute inset-[-10px] w-[50px] h-[50px] cursor-pointer opacity-0" 
                  value={appearance.maskColor} 
                  onChange={e => updateAppearanceSetting('maskColor', e.target.value)} 
                />
                <span className="text-[14px] text-ore-text-muted font-bold">+</span>
              </label>
            </div>
          }
        />

      <FormRow 
          label="遮罩透明度" 
          description="调节颜色遮罩的透明级别，数值越大背景越暗。"
          vertical={true} // ✅ 强制换行显示
          control={
            <div className="w-full">
              <OreSlider 
                value={appearance.maskOpacity} 
                min={0} max={100} step={5} 
                valueFormatter={(v) => (v / 100).toFixed(2)}
                onChange={(v) => updateAppearanceSetting('maskOpacity', v)}
              />
            </div>
          }
        />
      </SettingsSection>

      {/* ==================== 独立选项：排版与渐变 ==================== */}
      <SettingsSection title="排版与特效" icon={<Sparkles size={18} />}>
        <FormRow 
          label="启动器全局字体" 
          description="更改全局界面的主要字体。遇到不支持的字符时，会自动回退使用默认的 Minecraft 字体。"
          control={
            <div className="flex items-center space-x-2">
              {isLoadingFonts && <Type size={14} className="animate-pulse text-ore-text-muted" />}
              <OreDropdown 
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
          label="启用底部黑色渐变" 
          description="在启动器底部增加一层黑色渐变投影，使文字和导航更加清晰。"
          control={
            <OreSwitch 
              checked={appearance.maskGradient} 
              onChange={(v) => updateAppearanceSetting('maskGradient', v)} 
            />
          }
        />
      </SettingsSection>

    </SettingsPageLayout>
  );
};