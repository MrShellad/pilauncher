// /src/features/Settings/components/tabs/AppearanceSettings.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';

import { SettingItem } from '../SettingItem';
import { OreSlider } from '../../../../ui/primitives/OreSlider';
import { OreDropdown } from '../../../../ui/primitives/OreDropdown';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { useSettingsStore } from '../../../../store/useSettingsStore';

import { Image as ImageIcon, Moon, Palette, Type, Layers } from 'lucide-react';

// 预设的遮罩颜色选项
const PREDEFINED_COLORS = ['#000000', '#FFFFFF', '#18181B', '#2A2A2C', '#3C8527'];

export const AppearanceSettings: React.FC = () => {
  const { settings, updateAppearanceSetting } = useSettingsStore();
  const { appearance } = settings;

  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [isLoadingFonts, setIsLoadingFonts] = useState(true);

  // 1. 获取系统字体列表
  useEffect(() => {
    invoke<string[]>('get_system_fonts')
      .then(fonts => setSystemFonts(fonts))
      .catch(console.error)
      .finally(() => setIsLoadingFonts(false));
  }, []);

  // 2. 选择背景图片
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

  // 获取可安全渲染的图片 URL
  const bgPreviewUrl = useMemo(() => {
    return appearance.backgroundImage ? convertFileSrc(appearance.backgroundImage) : null;
  }, [appearance.backgroundImage]);

  // 组装字体下拉菜单的 Options
  const fontOptions = useMemo(() => {
    const base = [{ label: '默认 (Minecraft)', value: 'Minecraft' }];
    const sysOpts = systemFonts.map(f => ({ label: f, value: f }));
    return [...base, ...sysOpts];
  }, [systemFonts]);

  return (
    <div className="space-y-6 pb-12">
      <div className="mb-6">
        <h2 className="text-2xl font-minecraft text-white ore-text-shadow mb-1">界面与外观</h2>
        <p className="text-sm font-minecraft text-ore-text-muted tracking-widest">Appearance & Styling</p>
      </div>

      {/* ==================== 核心卡片：背景与主题 (高度还原截图) ==================== */}
      <div className="bg-[#1E1E1F] border-2 border-ore-gray-border p-4 shadow-lg">
        
        {/* 上方：大尺寸预览区 */}
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
              {/* 悬浮时显示清除按钮 */}
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

        {/* 下方：精细调节控件 */}
        <div className="mt-6 space-y-6 px-2">
          
          <div className="flex items-center text-white font-minecraft text-lg ore-text-shadow border-b-2 border-ore-gray-border/50 pb-2">
            <Moon size={18} className="mr-2 text-ore-text-muted" />
            <span>视觉调节</span>
          </div>

          <OreSlider 
            label="背景模糊度" 
            value={appearance.backgroundBlur} 
            min={0} max={30} step={1} 
            valueFormatter={(v) => `${v}px`}
            onChange={(v) => updateAppearanceSetting('backgroundBlur', v)}
            disabled={!appearance.backgroundImage}
          />

          {/* 遮罩颜色：拨片式选择器 */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center text-ore-text-muted font-minecraft font-bold text-sm ore-text-shadow">
              <Palette size={16} className="mr-2" /> 遮罩颜色
            </div>
            <div className="flex items-center space-x-3">
              {PREDEFINED_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => updateAppearanceSetting('maskColor', color)}
                  className={`w-6 h-6 rounded-full border-2 shadow-md transition-transform ${
                    appearance.maskColor.toUpperCase() === color 
                      ? 'border-ore-green scale-125' 
                      : 'border-ore-gray-border hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
              
              {/* 自定义颜色入口 (伪装成一个带 + 号的圆圈) */}
              <label 
                className="w-6 h-6 rounded-full border-2 border-dashed border-ore-gray-border flex items-center justify-center cursor-pointer hover:border-ore-green relative overflow-hidden"
                title="自定义颜色"
              >
                <input 
                  type="color" 
                  className="absolute inset-[-10px] w-[50px] h-[50px] cursor-pointer opacity-0" 
                  value={appearance.maskColor} 
                  onChange={e => updateAppearanceSetting('maskColor', e.target.value)} 
                />
                <span className="text-[12px] text-ore-text-muted font-bold">+</span>
              </label>
            </div>
          </div>

          <OreSlider 
            label="遮罩透明度" 
            value={appearance.maskOpacity} 
            min={0} max={100} step={5} 
            valueFormatter={(v) => (v / 100).toFixed(2)} // 格式化为 0.00 ~ 1.00，完美还原截图
            onChange={(v) => updateAppearanceSetting('maskOpacity', v)}
          />
        </div>
      </div>


      {/* ==================== 独立选项：排版与渐变 ==================== */}
      <div className="mt-8 mb-4 border-b-2 border-ore-gray-border/50 pb-2">
        <h3 className="text-lg font-minecraft text-white ore-text-shadow flex items-center">
          <span className="w-1.5 h-4 bg-ore-green mr-2 inline-block"></span>
          排版与特效
        </h3>
      </div>

      <SettingItem title="启动器全局字体" description="更改全局界面的主要字体。遇到不支持的字符时，会自动回退使用默认的 Minecraft 字体。">
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
      </SettingItem>

      <SettingItem title="启用底部黑色渐变" description="在启动器底部增加一层黑色渐变投影，使文字和导航更加清晰。">
        <OreSwitch 
          checked={appearance.maskGradient} 
          onChange={(v) => updateAppearanceSetting('maskGradient', v)} 
        />
      </SettingItem>

    </div>
  );
};