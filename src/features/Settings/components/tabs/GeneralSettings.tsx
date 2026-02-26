// /src/features/Settings/components/tabs/GeneralSettings.tsx
import React from 'react';
import { SettingItem } from '../SettingItem';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { Trash2, RotateCcw } from 'lucide-react';
import { useSettingsStore } from '../../../../store/useSettingsStore'; // ✅ 引入 Store

export const GeneralSettings: React.FC = () => {
  // ✅ 1. 从 Store 中提取状态和更新方法
  const { settings, updateGeneralSetting, resetSettings } = useSettingsStore();
  const { general } = settings; // 提取出常规配置模块

  const selectBaseStyle = "bg-[#141415] border-2 border-ore-gray-border text-white font-minecraft p-2 text-sm focus:outline-none focus:border-ore-green transition-colors min-w-[140px]";

  return (
    <div className="space-y-4 pb-12">
      <div className="mb-6">
        <h2 className="text-2xl font-minecraft text-white ore-text-shadow mb-1">常规设置</h2>
        <p className="text-sm font-minecraft text-ore-text-muted tracking-widest">General Preferences</p>
      </div>

      {/* ==================== 1. 基础模块 ==================== */}
      <div className="mt-8 mb-4 border-b-2 border-ore-gray-border/50 pb-2">
        <h3 className="text-lg font-minecraft text-white ore-text-shadow flex items-center">
          <span className="w-1.5 h-4 bg-ore-green mr-2 inline-block"></span>
          基础
        </h3>
      </div>

      <SettingItem title="启动器语言" description="更改启动器的显示语言。重启后完全生效。">
        <select 
          value={general.language} 
          onChange={(e) => updateGeneralSetting('language', e.target.value)} 
          className={selectBaseStyle}
        >
          <option value="zh-CN">简体中文</option>
          <option value="en-US">English</option>
        </select>
      </SettingItem>

      <SettingItem title="自动更新启动器" description="在后台静默下载并安装 PiLauncher 的最新版本。">
        <OreSwitch checked={general.autoUpdate} onChange={(v) => updateGeneralSetting('autoUpdate', v)} />
      </SettingItem>

      <SettingItem title="启动时检查更新" description="每次打开启动器时，主动向服务器核实是否有新版本。">
        <OreSwitch checked={general.checkUpdateOnStart} onChange={(v) => updateGeneralSetting('checkUpdateOnStart', v)} />
      </SettingItem>

      <SettingItem title="启动后最小化" description="开启启动器后自动将其最小化到系统托盘或任务栏。">
        <OreSwitch checked={general.minimizeAfterStart} onChange={(v) => updateGeneralSetting('minimizeAfterStart', v)} />
      </SettingItem>

      <SettingItem title="启动游戏后隐藏" description="当 Minecraft 实例成功运行后，自动隐藏启动器主界面。">
        <OreSwitch checked={general.hideAfterGameStart} onChange={(v) => updateGeneralSetting('hideAfterGameStart', v)} />
      </SettingItem>

      <SettingItem title="关闭按钮行为" description="点击右上角 'X' 时执行的操作。">
        <select 
          value={general.closeBehavior} 
          onChange={(e) => updateGeneralSetting('closeBehavior', e.target.value as 'tray' | 'exit')} 
          className={selectBaseStyle}
        >
          <option value="tray">最小化到托盘</option>
          <option value="exit">直接退出程序</option>
        </select>
      </SettingItem>

      <SettingItem title="开机自启动" description="在操作系统登录后自动运行 PiLauncher。">
        <OreSwitch checked={general.runOnStartup} onChange={(v) => updateGeneralSetting('runOnStartup', v)} />
      </SettingItem>


      {/* ==================== 2. 日志与数据模块 ==================== */}
      <div className="mt-10 mb-4 border-b-2 border-ore-gray-border/50 pb-2">
        <h3 className="text-lg font-minecraft text-white ore-text-shadow flex items-center">
          <span className="w-1.5 h-4 bg-ore-green mr-2 inline-block"></span>
          日志与数据
        </h3>
      </div>

      <SettingItem title="保留日志天数" description="超过此天数的历史运行日志将被自动删除。">
        <div className="flex items-center space-x-2">
          <OreInput 
            type="number" 
            value={general.keepLogDays} 
            onChange={(e) => updateGeneralSetting('keepLogDays', Number(e.target.value))} 
            className="w-20 text-center" 
            min={1} 
            max={365}
          />
          <span className="text-ore-text-muted font-minecraft text-sm">天</span>
        </div>
      </SettingItem>

      <SettingItem title="空间清理" description="清理过期的日志文件和下载产生的临时缓存碎片。">
        <div className="flex space-x-3">
          <OreButton variant="secondary" size="sm" className="flex items-center">
            <Trash2 size={14} className="mr-1.5" /> 清理日志
          </OreButton>
          <OreButton variant="danger" size="sm" className="flex items-center border-red-900">
            <Trash2 size={14} className="mr-1.5" /> 清理缓存
          </OreButton>
        </div>
      </SettingItem>

      <SettingItem title="恢复默认设置" description="将启动器的所有设置项重置为初始状态 (不会删除实例)。">
        <OreButton variant="danger" size="sm" className="flex items-center" onClick={resetSettings}>
          <RotateCcw size={14} className="mr-1.5" /> 恢复默认
        </OreButton>
      </SettingItem>


      {/* ==================== 3. 稳定性模块 ==================== */}
      <div className="mt-10 mb-4 border-b-2 border-ore-gray-border/50 pb-2">
        <h3 className="text-lg font-minecraft text-white ore-text-shadow flex items-center">
          <span className="w-1.5 h-4 bg-ore-green mr-2 inline-block"></span>
          稳定性
        </h3>
      </div>

      <SettingItem title="崩溃后自动重启" description="当检测到启动器自身发生意外崩溃时，尝试自动重新拉起进程。">
        <OreSwitch checked={general.autoRestartOnCrash} onChange={(v) => updateGeneralSetting('autoRestartOnCrash', v)} />
      </SettingItem>

      <SettingItem title="失败自动显示日志" description="当游戏实例启动失败时，自动弹窗展示错误控制台，方便排查原因。">
        <OreSwitch checked={general.showLogOnFailure} onChange={(v) => updateGeneralSetting('showLogOnFailure', v)} />
      </SettingItem>

    </div>
  );
};