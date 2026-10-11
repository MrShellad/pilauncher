import React from 'react';
import { OreDropdown } from '../../../../../ui/primitives/OreDropdown';
import { OreSegmentedControl } from '../../../../../ui/primitives/OreSegmentedControl';
import { OreSlider } from '../../../../../ui/primitives/OreSlider';
import { OreToggleButton } from '../../../../../ui/primitives/OreToggleButton';

interface OreUiShowcaseSelectorsProps {
  segmentValue: string;
  toggleValue: string;
  dropdownValue: string;
  sliderValue: number;
  onSegmentChange: (value: string) => void;
  onToggleChange: (value: string) => void;
  onDropdownChange: (value: string) => void;
  onSliderChange: (value: number) => void;
}

export const OreUiShowcaseSelectors: React.FC<OreUiShowcaseSelectorsProps> = ({
  segmentValue,
  toggleValue,
  dropdownValue,
  sliderValue,
  onSegmentChange,
  onToggleChange,
  onDropdownChange,
  onSliderChange,
}) => (
  <div className="space-y-6">
    <section className="space-y-3">
      <div className="border-b border-white/10 pb-1">
        <h3 className="text-sm font-minecraft text-white">OreSegmentedControl 分段选择器</h3>
      </div>
      <div className="p-5 bg-black/30 border border-white/5 space-y-4">
        <OreSegmentedControl
          tabs={[
            { id: 'mods', label: '模组 (Mods)' },
            { id: 'resourcepacks', label: '材质包 (Resources)' },
            { id: 'shaderpacks', label: '光影包 (Shaders)' },
            { id: 'saves', label: '存档管理 (Saves)' },
          ]}
          activeTab={segmentValue}
          onChange={onSegmentChange}
        />
        <span className="text-xs font-minecraft text-ore-text-muted block text-center">
          当前选中项: <strong className="text-white">{segmentValue}</strong>
        </span>
      </div>
    </section>

    <section className="space-y-3">
      <div className="border-b border-white/10 pb-1">
        <h3 className="text-sm font-minecraft text-white">OreToggleButton 切换按钮组</h3>
      </div>
      <div className="p-5 bg-black/30 border border-white/5 space-y-4">
        <OreToggleButton
          options={[
            { value: 'list', label: '列表视图' },
            { value: 'grid', label: '网格视图' },
            { value: 'compact', label: '紧凑视图' },
          ]}
          value={toggleValue}
          onChange={onToggleChange}
        />
      </div>
    </section>

    <section className="space-y-3">
      <div className="border-b border-white/10 pb-1">
        <h3 className="text-sm font-minecraft text-white">OreDropdown 3D 拟态下拉选择器</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-black/30 border border-white/5">
        <div className="space-y-1.5">
          <label className="text-xs font-minecraft text-ore-text-muted">选择游戏版本</label>
          <OreDropdown
            options={[
              { value: '1.21.4', label: '1.21.4 (最新发行版)' },
              { value: '1.21.1', label: '1.21.1 (推荐长期支持)' },
              { value: '1.20.1', label: '1.20.1 (模组丰富)' },
              { value: '1.12.2', label: '1.12.2 (经典旧版)' },
            ]}
            value={dropdownValue}
            onChange={onDropdownChange}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-minecraft text-ore-text-muted">滑块组件 (OreSlider)</label>
          <div className="pt-2">
            <OreSlider
              min={0}
              max={100}
              value={sliderValue}
              onChange={onSliderChange}
              step={5}
            />
            <span className="text-xs font-mono text-ore-text-muted mt-1 block">值: {sliderValue}</span>
          </div>
        </div>
      </div>
    </section>
  </div>
);
