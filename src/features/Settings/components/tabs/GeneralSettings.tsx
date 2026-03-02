// /src/features/Settings/components/tabs/GeneralSettings.tsx
import React from 'react';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { Trash2, RotateCcw, Monitor, Database, ShieldAlert, AlertTriangle } from 'lucide-react';
import { useSettingsStore } from '../../../../store/useSettingsStore';

// 引入新的布局组件
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../ui/layout/FormRow';

export const GeneralSettings: React.FC = () => {
  const { settings, updateGeneralSetting, resetSettings } = useSettingsStore();
  const { general } = settings;

  const selectBaseStyle = "bg-[#141415] border-2 border-ore-gray-border text-white font-minecraft p-2 text-sm focus:outline-none focus:border-ore-green transition-colors min-w-[140px] cursor-pointer";

  return (
    <SettingsPageLayout 
      title="常规设置" 
      subtitle="General Preferences"
    >
      {/* ==================== 1. 基础模块 ==================== */}
      <SettingsSection title="基础" icon={<Monitor size={18} />}>
        <FormRow 
          label="启动器语言" 
          description="更改启动器的显示语言。重启后完全生效。"
          control={
            <select 
              value={general.language} 
              onChange={(e) => updateGeneralSetting('language', e.target.value)} 
              className={selectBaseStyle}
            >
              <option value="zh-CN">简体中文</option>
              <option value="en-US">English</option>
            </select>
          }
        />
        <FormRow 
          label="自动更新启动器" 
          description="在后台静默下载并安装 PiLauncher 的最新版本。"
          control={<OreSwitch checked={general.autoUpdate} onChange={(v) => updateGeneralSetting('autoUpdate', v)} />}
        />
        <FormRow 
          label="启动时检查更新" 
          description="每次打开启动器时，主动向服务器核实是否有新版本。"
          control={<OreSwitch checked={general.checkUpdateOnStart} onChange={(v) => updateGeneralSetting('checkUpdateOnStart', v)} />}
        />
        <FormRow 
          label="启动后最小化" 
          description="开启启动器后自动将其最小化到系统托盘或任务栏。"
          control={<OreSwitch checked={general.minimizeAfterStart} onChange={(v) => updateGeneralSetting('minimizeAfterStart', v)} />}
        />
        <FormRow 
          label="启动游戏后隐藏" 
          description="当 Minecraft 实例成功运行后，自动隐藏启动器主界面。"
          control={<OreSwitch checked={general.hideAfterGameStart} onChange={(v) => updateGeneralSetting('hideAfterGameStart', v)} />}
        />
        <FormRow 
          label="关闭按钮行为" 
          description="点击右上角 'X' 时执行的操作。"
          control={
            <select 
              value={general.closeBehavior} 
              onChange={(e) => updateGeneralSetting('closeBehavior', e.target.value as 'tray' | 'exit')} 
              className={selectBaseStyle}
            >
              <option value="tray">最小化到托盘</option>
              <option value="exit">直接退出程序</option>
            </select>
          }
        />
        <FormRow 
          label="开机自启动" 
          description="在操作系统登录后自动运行 PiLauncher。"
          control={<OreSwitch checked={general.runOnStartup} onChange={(v) => updateGeneralSetting('runOnStartup', v)} />}
        />
      </SettingsSection>

      {/* ==================== 2. 稳定性模块 ==================== */}
      <SettingsSection title="稳定性" icon={<ShieldAlert size={18} />}>
        <FormRow 
          label="崩溃后自动重启" 
          description="当检测到启动器自身发生意外崩溃时，尝试自动重新拉起进程。"
          control={<OreSwitch checked={general.autoRestartOnCrash} onChange={(v) => updateGeneralSetting('autoRestartOnCrash', v)} />}
        />
        <FormRow 
          label="失败自动显示日志" 
          description="当游戏实例启动失败时，自动弹窗展示错误控制台，方便排查原因。"
          control={<OreSwitch checked={general.showLogOnFailure} onChange={(v) => updateGeneralSetting('showLogOnFailure', v)} />}
        />
      </SettingsSection>

      {/* ==================== 3. 日志与数据模块 ==================== */}
      <SettingsSection title="日志与数据" icon={<Database size={18} />}>
        <FormRow 
          label="保留日志天数" 
          description="超过此天数的历史运行日志将被自动删除。"
          control={
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
          }
        />
        <FormRow 
          label="空间清理" 
          description="清理过期的日志文件和下载产生的临时缓存碎片。"
          control={
            <div className="flex space-x-3">
              <OreButton variant="secondary" size="sm" className="flex items-center">
                <Trash2 size={14} className="mr-1.5" /> 清理日志
              </OreButton>
              <OreButton variant="secondary" size="sm" className="flex items-center">
                <Trash2 size={14} className="mr-1.5" /> 清理缓存
              </OreButton>
            </div>
          }
        />
      </SettingsSection>

      {/* ==================== 4. 危险操作模块 ==================== */}
      <SettingsSection title="危险操作" icon={<AlertTriangle size={18} />} danger={true}>
        <FormRow 
          label="恢复默认设置" 
          description="将启动器的所有设置项重置为初始状态 (不会删除实例)。"
          control={
            <OreButton variant="danger" size="sm" className="flex items-center" onClick={resetSettings}>
              <RotateCcw size={14} className="mr-1.5" /> 恢复默认
            </OreButton>
          }
        />
      </SettingsSection>
    </SettingsPageLayout>
  );
};