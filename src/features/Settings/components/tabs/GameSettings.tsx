// src/features/Settings/components/tabs/GameSettings.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Gamepad2, Monitor, Eye } from 'lucide-react';

import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../ui/layout/FormRow';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';
import { OreToggleButton, type ToggleOption } from '../../../../ui/primitives/OreToggleButton';

import { useSettingsStore } from '../../../../store/useSettingsStore';
import { DEFAULT_SETTINGS } from '../../../../types/settings';

// 预定义的主流标准分辨率库 (提取了简短的 Label 适合 Toggle 按钮)
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
  const { settings, updateGameSetting } = useSettingsStore();
  const game = settings.game || DEFAULT_SETTINGS.game; // 防御性读取

  // 存储系统实际的物理分辨率
  const [maxRes, setMaxRes] = useState<{w: number, h: number} | null>(null);

  useEffect(() => {
    // 从 Rust 后端获取当前主屏幕的真实分辨率
    invoke<[number, number]>('get_primary_monitor_resolution')
      .then(([w, h]) => setMaxRes({ w, h }))
      .catch(err => console.error("无法获取屏幕分辨率:", err));
  }, []);

  // 智能过滤并映射为 ToggleOption 格式
  const resolutionOptions: ToggleOption[] = useMemo(() => {
    let options: ToggleOption[] = STANDARD_RESOLUTIONS.filter(
      r => !maxRes || (r.w <= maxRes.w && r.h <= maxRes.h)
    ).map(r => ({
      label: <span className="font-minecraft text-sm tracking-wider">{r.label}</span>,
      value: r.value,
      description: r.desc
    }));

    // 如果玩家的屏幕是一个奇怪的比例(比如带鱼屏)，并且不在标准列表里，把原生分辨率补进去
    if (maxRes && !STANDARD_RESOLUTIONS.find(r => r.w === maxRes.w && r.h === maxRes.h)) {
      options.push({ 
        label: <span className="font-minecraft text-sm tracking-wider">原生</span>, 
        value: `${maxRes.w}x${maxRes.h}`,
        description: `${maxRes.w}x${maxRes.h} (自动检测的显示器物理分辨率)`
      });
    }
    return options;
  }, [maxRes]);

  return (
    <SettingsPageLayout title="游戏设定" subtitle="Game Launch Preferences">
      
      {/* ==================== 1. 窗口与渲染 ==================== */}
      <SettingsSection title="窗口与渲染" icon={<Monitor size={18} />}>
        
        <FormRow 
          label="自定义游戏标题" 
          description="修改 Minecraft 游戏窗口顶部显示的文字名称。"
          control={
            <div className="w-56">
              <OreInput 
                value={game.windowTitle} 
                onChange={(e) => updateGameSetting('windowTitle', e.target.value)} 
                placeholder="Minecraft"
              />
            </div>
          }
        />

        <FormRow 
          label="全屏模式" 
          description="启动游戏后直接进入独占全屏状态。如果你的游戏经常切出导致卡顿，建议关闭此项使用无边框窗口化。"
          control={<OreSwitch checked={game.fullscreen} onChange={(v) => updateGameSetting('fullscreen', v)} />}
        />

        <FormRow 
          label="启动分辨率" 
          description="设定游戏初始窗口的大小 (全屏模式下此项仅影响 UI 缩放)。已根据你的显示器自动隐藏不支持的超大分辨率。"
          vertical={true} // ✅ 强制换行，让拨片按钮占据全部宽度
          control={
            <div className="w-full mt-2 overflow-x-auto no-scrollbar pb-2">
              <div className="min-w-[600px]"> {/* 确保在小屏下不会过度挤压，触发横向滚动 */}
                <OreToggleButton 
                  options={resolutionOptions}
                  value={game.resolution}
                  onChange={(v) => updateGameSetting('resolution', v)}
                  disabled={game.fullscreen}
                />
              </div>
            </div>
          }
        />
      </SettingsSection>

      {/* ==================== 2. 启动器行为 ==================== */}
      <SettingsSection title="启动器行为" icon={<Eye size={18} />}>
        <FormRow 
          label="游戏运行时的可见性" 
          description="当 Minecraft 实例成功拉起并运行后，主启动器界面的处理方式。"
          vertical={true} // 强制换行更美观
          control={
            <div className="w-full mt-2">
              <div className="flex flex-col space-y-2 max-w-md">
                {[
                  { value: 'keep', label: '保持窗口打开', desc: '启动器维持原样，方便你查看日志或管理其他实例。' },
                  { value: 'minimize', label: '自动最小化到托盘', desc: '隐藏主界面释放系统资源，游戏结束后自动恢复。' },
                  { value: 'close', label: '直接退出启动器', desc: '最大化节省性能，但游戏结束后需要重新打开启动器。' }
                ].map((opt) => (
                  <label 
                    key={opt.value} 
                    className={`
                      flex flex-col p-3 border-2 cursor-pointer transition-all duration-200 outline-none
                      ${game.launcherVisibility === opt.value ? 'bg-[#2A2A2C] border-ore-green shadow-[0_0_8px_rgba(56,133,39,0.2)]' : 'bg-[#141415] border-[#1E1E1F] hover:border-white/30'}
                    `}
                    onClick={() => updateGameSetting('launcherVisibility', opt.value as any)}
                  >
                    <span className="text-white font-minecraft text-sm mb-1">{opt.label}</span>
                    <span className="text-ore-text-muted font-minecraft text-xs">{opt.desc}</span>
                  </label>
                ))}
              </div>
            </div>
          }
        />
      </SettingsSection>

    </SettingsPageLayout>
  );
};