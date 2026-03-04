// /src/features/Settings/components/tabs/GeneralSettings.tsx
import React from 'react';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../../ui/primitives/OreDropdown';
import { RotateCcw, Monitor, AlertTriangle } from 'lucide-react';
import { useSettingsStore } from '../../../../store/useSettingsStore';

// 引入布局组件
import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../ui/layout/FormRow';

// ✅ 引入焦点导航核心组件
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../ui/focus/FocusItem';

// ✅ 封装一个支持空间导航的 Switch 组件
const FocusableSwitch = ({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) => (
  <FocusItem onEnter={() => onChange(!checked)}>
    {({ ref, focused }) => (
      <div 
        ref={ref as any} 
        className={`
          rounded-full transition-all duration-200 flex items-center justify-center
          ${focused ? 'ring-2 ring-white ring-offset-2 ring-offset-[#18181B] scale-[1.1] shadow-lg brightness-125 z-10' : ''}
        `}
      >
        <OreSwitch checked={checked} onChange={onChange} />
      </div>
    )}
  </FocusItem>
);

export const GeneralSettings: React.FC = () => {
  const { settings, updateGeneralSetting, resetSettings } = useSettingsStore();
  const { general } = settings;

  // 下拉菜单选项定义
  const languageOptions = [
    { label: '简体中文', value: 'zh-CN' },
    { label: 'English', value: 'en-US' },
  ];

  const closeBehaviorOptions = [
    { label: '最小化到托盘', value: 'tray' },
    { label: '直接退出程序', value: 'exit' },
  ];

  return (
    // ✅ 整个标签页包裹在 FocusBoundary 中，便于引擎管理层级
    <FocusBoundary id="settings-general-boundary" className="w-full h-full outline-none">
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
              <OreDropdown 
                options={languageOptions}
                value={general.language}
                onChange={(val) => updateGeneralSetting('language', val)}
                className="w-40"
              />
            }
          />
          <FormRow 
            label="自动更新启动器" 
            description="在后台静默下载并安装 PiLauncher 的最新版本。"
            control={<FocusableSwitch checked={general.autoUpdate} onChange={(v) => updateGeneralSetting('autoUpdate', v)} />}
          />
          <FormRow 
            label="启动时检查更新" 
            description="每次打开启动器时，主动向服务器核实是否有新版本。"
            control={<FocusableSwitch checked={general.checkUpdateOnStart} onChange={(v) => updateGeneralSetting('checkUpdateOnStart', v)} />}
          />
          <FormRow 
            label="启动后最小化" 
            description="开启启动器后自动将其最小化到系统托盘或任务栏。"
            control={<FocusableSwitch checked={general.minimizeAfterStart} onChange={(v) => updateGeneralSetting('minimizeAfterStart', v)} />}
          />
          <FormRow 
            label="关闭按钮行为" 
            description="点击右上角 'X' 时执行的操作。"
            control={
              <OreDropdown 
                options={closeBehaviorOptions}
                value={general.closeBehavior}
                onChange={(val) => updateGeneralSetting('closeBehavior', val as 'tray' | 'exit')}
                className="w-40"
              />
            }
          />
          <FormRow 
            label="开机自启动" 
            description="在操作系统登录后自动运行 PiLauncher。"
            control={<FocusableSwitch checked={general.runOnStartup} onChange={(v) => updateGeneralSetting('runOnStartup', v)} />}
          />
        </SettingsSection>

        {/* ==================== 2. 危险操作模块 ==================== */}
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
    </FocusBoundary>
  );
};