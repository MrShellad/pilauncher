import React from 'react';
import { Sliders } from 'lucide-react';
import { OreProgressBar } from '../../../../../ui/primitives/OreProgressBar';
import { OreSlider } from '../../../../../ui/primitives/OreSlider';

interface OreUiShowcaseProgressProps {
  value: number;
  onChange: (value: number) => void;
}

export const OreUiShowcaseProgress: React.FC<OreUiShowcaseProgressProps> = ({ value, onChange }) => (
  <div className="space-y-6">
    <div className="p-4 border-2 border-[#1E1E1F] bg-[#1E1E1F]/50 space-y-3">
      <div className="flex items-center justify-between text-xs font-minecraft text-white">
        <span>实时进度测试滑块 (Live Progress Control):</span>
        <span className="font-bold text-ore-green">{value}%</span>
      </div>
      <OreSlider min={0} max={100} value={value} onChange={onChange} />
    </div>

    <section className="space-y-3">
      <div className="flex items-center justify-between border-b border-white/10 pb-1">
        <h3 className="text-sm font-minecraft text-white flex items-center gap-2">
          <Sliders size={14} className="text-ore-green" />
          Minecraft 基岩版标准双层间隙尺寸 (Sizes)
        </h3>
        <span className="text-[11px] text-ore-text-muted">四周 2px 均等物理内间隙</span>
      </div>
      <div className="space-y-5 p-5 bg-black/30 border border-white/5">
        <div className="space-y-1">
          <span className="text-xs text-ore-text-muted font-mono">Thin (8px 高度)</span>
          <OreProgressBar percent={value} size="thin" variant="primary" showPercentage={false} />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-ore-text-muted font-mono">SM (12px 高度)</span>
          <OreProgressBar percent={value} size="sm" variant="primary" showPercentage={false} />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-ore-text-muted font-mono">MD (16px 基岩版标准高度)</span>
          <OreProgressBar percent={value} size="md" variant="primary" />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-ore-text-muted font-mono">LG (20px 高度)</span>
          <OreProgressBar percent={value} size="lg" variant="primary" />
        </div>
      </div>
    </section>

    <section className="space-y-3">
      <div className="border-b border-white/10 pb-1">
        <h3 className="text-sm font-minecraft text-white">色彩主题 (Color Variants)</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-black/30 border border-white/5">
        <div className="space-y-1">
          <span className="text-xs text-ore-text-muted font-minecraft">Primary 原版绿</span>
          <OreProgressBar percent={value} variant="primary" />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-ore-text-muted font-minecraft">Info 科技蓝</span>
          <OreProgressBar percent={value} variant="info" />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-ore-text-muted font-minecraft">Gold 金黄色</span>
          <OreProgressBar percent={value} variant="gold" />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-ore-text-muted font-minecraft">White 纯白</span>
          <OreProgressBar percent={value} variant="white" />
        </div>
      </div>
    </section>

    <section className="space-y-3">
      <div className="border-b border-white/10 pb-1">
        <h3 className="text-sm font-minecraft text-white">标签位置与对齐 (Label Positions & Alignment)</h3>
      </div>
      <div className="space-y-4 p-5 bg-black/30 border border-white/5">
        <OreProgressBar
          percent={value}
          label="下载模组资产中..."
          labelPosition="top"
          labelAlign="between"
        />
        <OreProgressBar
          percent={value}
          label="世界备份打包中..."
          labelPosition="bottom"
          labelAlign="between"
        />
      </div>
    </section>
  </div>
);
