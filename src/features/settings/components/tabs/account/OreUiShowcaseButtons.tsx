import React from 'react';
import {
  Box,
  Download,
  Palette,
  Play,
  RefreshCw,
  Settings,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { OreHeroButton } from '../../../../../ui/primitives/OreHeroButton';
import { OreSwitch } from '../../../../../ui/primitives/OreSwitch';

interface OreUiShowcaseButtonsProps {
  loading: boolean;
  disabled: boolean;
  onLoadingChange: (value: boolean) => void;
  onDisabledChange: (value: boolean) => void;
}

export const OreUiShowcaseButtons: React.FC<OreUiShowcaseButtonsProps> = ({
  loading,
  disabled,
  onLoadingChange,
  onDisabledChange,
}) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between p-3 border-2 border-[#1E1E1F] bg-[#1E1E1F]/50">
      <span className="text-xs font-minecraft text-white">交互控制台 (Live Controls):</span>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-xs font-minecraft text-gray-300 cursor-pointer">
          <OreSwitch checked={loading} onChange={onLoadingChange} />
          <span>Loading 状态</span>
        </label>
        <label className="flex items-center gap-2 text-xs font-minecraft text-gray-300 cursor-pointer">
          <OreSwitch checked={disabled} onChange={onDisabledChange} />
          <span>Disabled 状态</span>
        </label>
      </div>
    </div>

    <section className="space-y-3">
      <div className="flex items-center justify-between border-b border-white/10 pb-1">
        <h3 className="text-sm font-minecraft text-white flex items-center gap-2">
          <Box size={14} className="text-ore-green" />
          4 档标准高度 (Standard Heights)
        </h3>
        <span className="text-[11px] font-mono text-ore-text-muted">xs: 32px | sm: 36px | md: 40px | lg: 48px</span>
      </div>
      <div className="flex flex-wrap items-end gap-3 p-4 bg-black/30 border border-white/5">
        <OreButton size="xs" variant="primary" loading={loading} disabled={disabled}>
          XS 尺寸 (32px)
        </OreButton>
        <OreButton size="sm" variant="primary" loading={loading} disabled={disabled}>
          SM 尺寸 (36px)
        </OreButton>
        <OreButton size="md" variant="primary" loading={loading} disabled={disabled}>
          MD 尺寸 (40px)
        </OreButton>
        <OreButton size="lg" variant="primary" loading={loading} disabled={disabled}>
          LG 尺寸 (48px)
        </OreButton>
      </div>
    </section>

    <section className="space-y-3">
      <div className="flex items-center justify-between border-b border-white/10 pb-1">
        <h3 className="text-sm font-minecraft text-white flex items-center gap-2">
          <Palette size={14} className="text-sky-400" />
          色彩变体与 9-Slice 拟态物理反馈 (Variants & Press Physics)
        </h3>
        <span className="text-[11px] text-ore-text-muted">点击体验 4px 平移下沉手感</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-black/30 border border-white/5">
        <div className="space-y-1.5 text-center">
          <OreButton size="md" variant="primary" fullWidth loading={loading} disabled={disabled}>
            Primary 动作
          </OreButton>
          <span className="text-[10px] font-mono text-ore-text-muted">主色绿 (#3C8527)</span>
        </div>
        <div className="space-y-1.5 text-center">
          <OreButton size="md" variant="secondary" fullWidth loading={loading} disabled={disabled}>
            Secondary 次要
          </OreButton>
          <span className="text-[10px] font-mono text-ore-text-muted">次要灰 (#D0D1D4)</span>
        </div>
        <div className="space-y-1.5 text-center">
          <OreButton size="md" variant="danger" fullWidth loading={loading} disabled={disabled}>
            Danger 危险
          </OreButton>
          <span className="text-[10px] font-mono text-ore-text-muted">警告红 (#C33636)</span>
        </div>
        <div className="space-y-1.5 text-center">
          <OreButton size="md" variant="purple" fullWidth loading={loading} disabled={disabled}>
            Purple 史诗
          </OreButton>
          <span className="text-[10px] font-mono text-ore-text-muted">史诗紫 (#9333EA)</span>
        </div>
        <div className="space-y-1.5 text-center">
          <OreButton size="md" variant="ghost" fullWidth loading={loading} disabled={disabled}>
            Ghost 幽灵
          </OreButton>
          <span className="text-[10px] font-mono text-ore-text-muted">透明边框</span>
        </div>
      </div>
    </section>

    <section className="space-y-3">
      <div className="border-b border-white/10 pb-1">
        <h3 className="text-sm font-minecraft text-white flex items-center gap-2">
          <Sparkles size={14} className="text-amber-400" />
          正方形图标按钮与图文混排 (Icon-Only & Slots)
        </h3>
      </div>
      <div className="flex flex-wrap items-center gap-4 p-4 bg-black/30 border border-white/5">
        <div className="flex items-center gap-2">
          <OreButton size="xs" variant="secondary" iconOnly loading={loading} disabled={disabled} title="设置">
            <Settings size={14} />
          </OreButton>
          <OreButton size="sm" variant="secondary" iconOnly loading={loading} disabled={disabled} title="下载">
            <Download size={16} />
          </OreButton>
          <OreButton size="md" variant="secondary" iconOnly loading={loading} disabled={disabled} title="删除">
            <Trash2 size={18} />
          </OreButton>
          <OreButton size="lg" variant="secondary" iconOnly loading={loading} disabled={disabled} title="刷新">
            <RefreshCw size={20} />
          </OreButton>
        </div>

        <div className="h-6 w-px bg-white/10" />

        <OreButton
          size="md"
          variant="primary"
          prefixIcon={<Sparkles size={16} />}
          loading={loading}
          disabled={disabled}
        >
          带前缀图标
        </OreButton>
        <OreButton
          size="md"
          variant="secondary"
          suffixIcon={<Download size={16} />}
          loading={loading}
          disabled={disabled}
        >
          带后缀图标
        </OreButton>
      </div>
    </section>

    <section className="space-y-3">
      <div className="border-b border-white/10 pb-1">
        <h3 className="text-sm font-minecraft text-white">OreHeroButton 巨型行动按钮</h3>
      </div>
      <div className="p-4 bg-black/30 border border-white/5">
        <OreHeroButton icon={<Play size={24} className="fill-white" />} onClick={() => {}}>
          <div className="flex flex-col items-center">
            <span className="text-base font-bold">启动游戏 (PLAY)</span>
            <span className="text-xs opacity-80 font-normal">Minecraft 1.21.4 • Fabric 0.16.9</span>
          </div>
        </OreHeroButton>
      </div>
    </section>
  </div>
);
