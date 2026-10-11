import React from 'react';
import { Search } from 'lucide-react';
import { OreCheckbox } from '../../../../../ui/primitives/OreCheckbox';
import { OreInput } from '../../../../../ui/primitives/OreInput';
import { OrePinInput } from '../../../../../ui/primitives/OrePinInput';
import { OreRadio } from '../../../../../ui/primitives/OreRadio';
import { OreSwitch } from '../../../../../ui/primitives/OreSwitch';

interface OreUiShowcaseInputsProps {
  inputValue: string;
  pinValue: string;
  switchA: boolean;
  switchB: boolean;
  checkboxA: boolean;
  checkboxB: boolean;
  radioValue: string;
  onInputChange: (value: string) => void;
  onPinChange: (value: string) => void;
  onSwitchAChange: (value: boolean) => void;
  onSwitchBChange: (value: boolean) => void;
  onCheckboxAChange: (value: boolean) => void;
  onCheckboxBChange: (value: boolean) => void;
  onRadioChange: (value: string) => void;
}

export const OreUiShowcaseInputs: React.FC<OreUiShowcaseInputsProps> = ({
  inputValue,
  pinValue,
  switchA,
  switchB,
  checkboxA,
  checkboxB,
  radioValue,
  onInputChange,
  onPinChange,
  onSwitchAChange,
  onSwitchBChange,
  onCheckboxAChange,
  onCheckboxBChange,
  onRadioChange,
}) => (
  <div className="space-y-6">
    <section className="space-y-3">
      <div className="border-b border-white/10 pb-1">
        <h3 className="text-sm font-minecraft text-white">OreInput 文本输入框 (3D Inset Cavity)</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-black/30 border border-white/5">
        <div className="space-y-1.5">
          <label className="text-xs font-minecraft text-ore-text-muted">标准文本输入</label>
          <OreInput
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="输入实例名称..."
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-minecraft text-ore-text-muted">搜索框 (带前缀图标与清除)</label>
          <OreInput
            prefixNode={<Search size={16} className="text-ore-text-muted" />}
            placeholder="搜索 Mod、材质包..."
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-minecraft text-ore-text-muted">密码输入</label>
          <OreInput type="password" defaultValue="Minecraft123" placeholder="输入密码..." />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-minecraft text-ore-text-muted">禁用输入框</label>
          <OreInput disabled value="只读实例锁定状态" />
        </div>
      </div>
    </section>

    <section className="space-y-3">
      <div className="border-b border-white/10 pb-1">
        <h3 className="text-sm font-minecraft text-white">OrePinInput 验证码/PIN 输入框</h3>
      </div>
      <div className="p-5 bg-black/30 border border-white/5 flex flex-col items-center gap-3">
        <OrePinInput length={6} value={pinValue} onChange={onPinChange} />
        <span className="text-xs font-mono text-ore-text-muted">当前输入: {pinValue || '(空)'}</span>
      </div>
    </section>

    <section className="space-y-3">
      <div className="border-b border-white/10 pb-1">
        <h3 className="text-sm font-minecraft text-white">开关与多选/单选 (Switches & Checks)</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 bg-black/30 border border-white/5">
        <div className="space-y-3 border-r border-white/10 pr-4">
          <span className="text-xs font-minecraft text-white block mb-2">OreSwitch 拟态开关</span>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-xs text-gray-300 font-minecraft">启用光影着色器</span>
            <OreSwitch checked={switchA} onChange={onSwitchAChange} />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-xs text-gray-300 font-minecraft">离线模式</span>
            <OreSwitch checked={switchB} onChange={onSwitchBChange} />
          </label>
        </div>

        <div className="space-y-3 border-r border-white/10 pr-4">
          <span className="text-xs font-minecraft text-white block mb-2">OreCheckbox 复选框</span>
          <OreCheckbox checked={checkboxA} onChange={onCheckboxAChange} label="自动检查模组更新" />
          <OreCheckbox checked={checkboxB} onChange={onCheckboxBChange} label="开启手柄震动反馈" />
          <OreCheckbox checked={false} onChange={() => {}} disabled label="禁用选项 (Disabled)" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-minecraft text-white block mb-2">OreRadio 单选框</span>
          <OreRadio
            name="showcase-radio"
            value="opt1"
            checked={radioValue === 'opt1'}
            onChange={() => onRadioChange('opt1')}
            label="Vanilla 原版内核"
          />
          <OreRadio
            name="showcase-radio"
            value="opt2"
            checked={radioValue === 'opt2'}
            onChange={() => onRadioChange('opt2')}
            label="Fabric 模组加载器"
          />
          <OreRadio
            name="showcase-radio"
            value="opt3"
            checked={radioValue === 'opt3'}
            onChange={() => onRadioChange('opt3')}
            label="NeoForge 模组加载器"
          />
        </div>
      </div>
    </section>
  </div>
);
