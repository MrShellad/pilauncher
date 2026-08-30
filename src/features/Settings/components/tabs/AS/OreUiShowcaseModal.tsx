import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Palette,
  Sparkles,
  Download,
  Trash2,
  Settings,
  Search,
  RefreshCw,
  Sliders,
  Box,
  Layers,
  Play,
} from 'lucide-react';
import { OreModal } from '../../../../../ui/primitives/OreModal';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { OreHeroButton } from '../../../../../ui/primitives/OreHeroButton';
import { OreProgressBar } from '../../../../../ui/primitives/OreProgressBar';
import { OreInput } from '../../../../../ui/primitives/OreInput';
import { OrePinInput } from '../../../../../ui/primitives/OrePinInput';
import { OreSwitch } from '../../../../../ui/primitives/OreSwitch';
import { OreCheckbox } from '../../../../../ui/primitives/OreCheckbox';
import { OreRadio } from '../../../../../ui/primitives/OreRadio';
import { OreSlider } from '../../../../../ui/primitives/OreSlider';
import { OreSegmentedControl } from '../../../../../ui/primitives/OreSegmentedControl';
import { OreToggleButton } from '../../../../../ui/primitives/OreToggleButton';
import { OreDropdown } from '../../../../../ui/primitives/OreDropdown';
import { OreTag } from '../../../../../ui/primitives/OreTag';
import { OreBanner } from '../../../../../ui/primitives/OreBanner';
import { OreCard } from '../../../../../ui/primitives/OreCard';
import { OreAccordion } from '../../../../../ui/primitives/OreAccordion';
import { OreTooltip } from '../../../../../ui/primitives/OreTooltip';
import { FocusBoundary } from '../../../../../ui/focus/FocusBoundary';

interface OreUiShowcaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ShowcaseCategory = 'buttons' | 'progress' | 'inputs' | 'selectors' | 'feedback';

export const OreUiShowcaseModal: React.FC<OreUiShowcaseModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<ShowcaseCategory>('buttons');

  // 动态交互测试状态
  const [btnLoading, setBtnLoading] = useState(false);
  const [btnDisabled, setBtnDisabled] = useState(false);
  const [progressVal, setProgressVal] = useState(48);
  const [inputValue, setInputValue] = useState('Minecraft Bedrock');
  const [pinValue, setPinValue] = useState('');
  const [switchA, setSwitchA] = useState(true);
  const [switchB, setSwitchB] = useState(false);
  const [checkboxA, setCheckboxA] = useState(true);
  const [checkboxB, setCheckboxB] = useState(false);
  const [radioVal, setRadioVal] = useState('opt1');
  const [sliderVal, setSliderVal] = useState(75);
  const [segmentVal, setSegmentVal] = useState('mods');
  const [toggleVal, setToggleVal] = useState('list');
  const [dropdownVal, setDropdownVal] = useState('1.21.4');

  const categories = [
    { id: 'buttons', label: '按钮体系 (Buttons)' },
    { id: 'progress', label: '进度条 (Progress)' },
    { id: 'inputs', label: '表单与输入 (Inputs)' },
    { id: 'selectors', label: '选择器 (Selectors)' },
    { id: 'feedback', label: '反馈与卡片 (Feedback)' },
  ];

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('settings.about.componentShowcase.title', { defaultValue: 'OreUI 设计规范与组件工坊' })}
      defaultFocusKey="showcase-category-tab"
      className="w-full max-w-[980px]"
      contentClassName="p-0 overflow-hidden"
      actions={
        <div className="flex w-full justify-between items-center px-2">
          <div className="flex items-center gap-2 text-xs text-ore-text-muted font-minecraft">
            <Layers size={14} className="text-ore-green" />
            <span>Minecraft Bedrock OreUI Standard Edition</span>
          </div>
          <OreButton
            focusKey="showcase-close-btn"
            variant="primary"
            size="sm"
            onClick={onClose}
          >
            {t('common.finish', { defaultValue: '完成' })}
          </OreButton>
        </div>
      }
    >
      <FocusBoundary id="oreui-showcase-boundary" className="flex h-[620px] flex-col outline-none">
        {/* 顶部标题与分类导航栏 */}
        <div className="border-b-[3px] border-[var(--ore-border-color)] bg-[#18181A] px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center bg-ore-green text-black border-2 border-[#1E1E1F]">
                <Palette size={18} />
              </div>
              <div>
                <h2 className="text-base font-minecraft text-white">
                  {t('settings.about.componentShowcase.headline', { defaultValue: 'OreUI Design Tokens & Components' })}
                </h2>
                <p className="text-xs text-ore-text-muted">
                  {t('settings.about.componentShowcase.description', { defaultValue: '展示 PiLauncher 内置的基岩版像素物理拟态组件，支持实时交互测试。' })}
                </p>
              </div>
            </div>
          </div>

          <OreSegmentedControl
            tabs={categories}
            activeTab={activeCategory}
            onChange={(val) => setActiveCategory(val as ShowcaseCategory)}
            className="w-full"
          />
        </div>

        {/* 内容展示滚动区域 */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[#141415] space-y-6">

          {/* ======================================================== */}
          {/* TAB 1: 按钮体系 (BUTTONS) */}
          {/* ======================================================== */}
          {activeCategory === 'buttons' && (
            <div className="space-y-6">
              {/* 控制面板 */}
              <div className="flex items-center justify-between p-3 border-2 border-[#1E1E1F] bg-[#1E1E1F]/50">
                <span className="text-xs font-minecraft text-white">交互控制台 (Live Controls):</span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs font-minecraft text-gray-300 cursor-pointer">
                    <OreSwitch checked={btnLoading} onChange={setBtnLoading} />
                    <span>Loading 状态</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-minecraft text-gray-300 cursor-pointer">
                    <OreSwitch checked={btnDisabled} onChange={setBtnDisabled} />
                    <span>Disabled 状态</span>
                  </label>
                </div>
              </div>

              {/* 1. 4 档标准尺寸 */}
              <section className="space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-1">
                  <h3 className="text-sm font-minecraft text-white flex items-center gap-2">
                    <Box size={14} className="text-ore-green" />
                    4 档标准高度 (Standard Heights)
                  </h3>
                  <span className="text-[11px] font-mono text-ore-text-muted">xs: 32px | sm: 36px | md: 40px | lg: 48px</span>
                </div>
                <div className="flex flex-wrap items-end gap-3 p-4 bg-black/30 border border-white/5">
                  <OreButton size="xs" variant="primary" loading={btnLoading} disabled={btnDisabled}>
                    XS 尺寸 (32px)
                  </OreButton>
                  <OreButton size="sm" variant="primary" loading={btnLoading} disabled={btnDisabled}>
                    SM 尺寸 (36px)
                  </OreButton>
                  <OreButton size="md" variant="primary" loading={btnLoading} disabled={btnDisabled}>
                    MD 尺寸 (40px)
                  </OreButton>
                  <OreButton size="lg" variant="primary" loading={btnLoading} disabled={btnDisabled}>
                    LG 尺寸 (48px)
                  </OreButton>
                </div>
              </section>

              {/* 2. 视觉变体与正交下压 */}
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
                    <OreButton size="md" variant="primary" fullWidth loading={btnLoading} disabled={btnDisabled}>
                      Primary 动作
                    </OreButton>
                    <span className="text-[10px] font-mono text-ore-text-muted">主色绿 (#3C8527)</span>
                  </div>
                  <div className="space-y-1.5 text-center">
                    <OreButton size="md" variant="secondary" fullWidth loading={btnLoading} disabled={btnDisabled}>
                      Secondary 次要
                    </OreButton>
                    <span className="text-[10px] font-mono text-ore-text-muted">次要灰 (#D0D1D4)</span>
                  </div>
                  <div className="space-y-1.5 text-center">
                    <OreButton size="md" variant="danger" fullWidth loading={btnLoading} disabled={btnDisabled}>
                      Danger 危险
                    </OreButton>
                    <span className="text-[10px] font-mono text-ore-text-muted">警告红 (#C33636)</span>
                  </div>
                  <div className="space-y-1.5 text-center">
                    <OreButton size="md" variant="purple" fullWidth loading={btnLoading} disabled={btnDisabled}>
                      Purple 史诗
                    </OreButton>
                    <span className="text-[10px] font-mono text-ore-text-muted">史诗紫 (#9333EA)</span>
                  </div>
                  <div className="space-y-1.5 text-center">
                    <OreButton size="md" variant="ghost" fullWidth loading={btnLoading} disabled={btnDisabled}>
                      Ghost 幽灵
                    </OreButton>
                    <span className="text-[10px] font-mono text-ore-text-muted">透明边框</span>
                  </div>
                </div>
              </section>

              {/* 3. 图标按钮与前缀后缀 */}
              <section className="space-y-3">
                <div className="border-b border-white/10 pb-1">
                  <h3 className="text-sm font-minecraft text-white flex items-center gap-2">
                    <Sparkles size={14} className="text-amber-400" />
                    正方形图标按钮与图文混排 (Icon-Only & Slots)
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-4 p-4 bg-black/30 border border-white/5">
                  <div className="flex items-center gap-2">
                    <OreButton size="xs" variant="secondary" iconOnly loading={btnLoading} disabled={btnDisabled} title="设置">
                      <Settings size={14} />
                    </OreButton>
                    <OreButton size="sm" variant="secondary" iconOnly loading={btnLoading} disabled={btnDisabled} title="下载">
                      <Download size={16} />
                    </OreButton>
                    <OreButton size="md" variant="secondary" iconOnly loading={btnLoading} disabled={btnDisabled} title="删除">
                      <Trash2 size={18} />
                    </OreButton>
                    <OreButton size="lg" variant="secondary" iconOnly loading={btnLoading} disabled={btnDisabled} title="刷新">
                      <RefreshCw size={20} />
                    </OreButton>
                  </div>

                  <div className="h-6 w-px bg-white/10" />

                  <OreButton
                    size="md"
                    variant="primary"
                    prefixIcon={<Sparkles size={16} />}
                    loading={btnLoading}
                    disabled={btnDisabled}
                  >
                    带前缀图标
                  </OreButton>

                  <OreButton
                    size="md"
                    variant="secondary"
                    suffixIcon={<Download size={16} />}
                    loading={btnLoading}
                    disabled={btnDisabled}
                  >
                    带后缀图标
                  </OreButton>
                </div>
              </section>

              {/* 4. OreHeroButton */}
              <section className="space-y-3">
                <div className="border-b border-white/10 pb-1">
                  <h3 className="text-sm font-minecraft text-white">OreHeroButton 巨型行动按钮</h3>
                </div>
                <div className="p-4 bg-black/30 border border-white/5">
                  <OreHeroButton
                    icon={<Play size={24} className="fill-white" />}
                    onClick={() => {}}
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-base font-bold">启动游戏 (PLAY)</span>
                      <span className="text-xs opacity-80 font-normal">Minecraft 1.21.4 • Fabric 0.16.9</span>
                    </div>
                  </OreHeroButton>
                </div>
              </section>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: 进度与指示 (PROGRESS) */}
          {/* ======================================================== */}
          {activeCategory === 'progress' && (
            <div className="space-y-6">
              {/* 动态滑块调节测试 */}
              <div className="p-4 border-2 border-[#1E1E1F] bg-[#1E1E1F]/50 space-y-3">
                <div className="flex items-center justify-between text-xs font-minecraft text-white">
                  <span>实时进度测试滑块 (Live Progress Control):</span>
                  <span className="font-bold text-ore-green">{progressVal}%</span>
                </div>
                <OreSlider
                  min={0}
                  max={100}
                  value={progressVal}
                  onChange={setProgressVal}
                />
              </div>

              {/* 1. 基岩版双层间隙进度条各尺寸展示 */}
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
                    <OreProgressBar percent={progressVal} size="thin" variant="primary" showPercentage={false} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-ore-text-muted font-mono">SM (12px 高度)</span>
                    <OreProgressBar percent={progressVal} size="sm" variant="primary" showPercentage={false} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-ore-text-muted font-mono">MD (16px 基岩版标准高度)</span>
                    <OreProgressBar percent={progressVal} size="md" variant="primary" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-ore-text-muted font-mono">LG (20px 高度)</span>
                    <OreProgressBar percent={progressVal} size="lg" variant="primary" />
                  </div>
                </div>
              </section>

              {/* 2. 颜色变体 */}
              <section className="space-y-3">
                <div className="border-b border-white/10 pb-1">
                  <h3 className="text-sm font-minecraft text-white">色彩主题 (Color Variants)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-black/30 border border-white/5">
                  <div className="space-y-1">
                    <span className="text-xs text-ore-text-muted font-minecraft">Primary 原版绿</span>
                    <OreProgressBar percent={progressVal} variant="primary" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-ore-text-muted font-minecraft">Info 科技蓝</span>
                    <OreProgressBar percent={progressVal} variant="info" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-ore-text-muted font-minecraft">Gold 金黄色</span>
                    <OreProgressBar percent={progressVal} variant="gold" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-ore-text-muted font-minecraft">White 纯白</span>
                    <OreProgressBar percent={progressVal} variant="white" />
                  </div>
                </div>
              </section>

              {/* 3. 标签与对齐位置 */}
              <section className="space-y-3">
                <div className="border-b border-white/10 pb-1">
                  <h3 className="text-sm font-minecraft text-white">标签位置与对齐 (Label Positions & Alignment)</h3>
                </div>
                <div className="space-y-4 p-5 bg-black/30 border border-white/5">
                  <OreProgressBar
                    percent={progressVal}
                    label="下载模组资产中..."
                    labelPosition="top"
                    labelAlign="between"
                  />
                  <OreProgressBar
                    percent={progressVal}
                    label="世界备份打包中..."
                    labelPosition="bottom"
                    labelAlign="between"
                  />
                </div>
              </section>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: 表单与输入 (INPUTS) */}
          {/* ======================================================== */}
          {activeCategory === 'inputs' && (
            <div className="space-y-6">
              {/* 1. 文本输入框 */}
              <section className="space-y-3">
                <div className="border-b border-white/10 pb-1">
                  <h3 className="text-sm font-minecraft text-white">OreInput 文本输入框 (3D Inset Cavity)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-black/30 border border-white/5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-minecraft text-ore-text-muted">标准文本输入</label>
                    <OreInput
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
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
                    <OreInput
                      type="password"
                      defaultValue="Minecraft123"
                      placeholder="输入密码..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-minecraft text-ore-text-muted">禁用输入框</label>
                    <OreInput
                      disabled
                      value="只读实例锁定状态"
                    />
                  </div>
                </div>
              </section>

              {/* 2. PIN / 验证码输入框 */}
              <section className="space-y-3">
                <div className="border-b border-white/10 pb-1">
                  <h3 className="text-sm font-minecraft text-white">OrePinInput 验证码/PIN 输入框</h3>
                </div>
                <div className="p-5 bg-black/30 border border-white/5 flex flex-col items-center gap-3">
                  <OrePinInput
                    length={6}
                    value={pinValue}
                    onChange={setPinValue}
                  />
                  <span className="text-xs font-mono text-ore-text-muted">当前输入: {pinValue || '(空)'}</span>
                </div>
              </section>

              {/* 3. 开关、复选框与单选框 */}
              <section className="space-y-3">
                <div className="border-b border-white/10 pb-1">
                  <h3 className="text-sm font-minecraft text-white">开关与多选/单选 (Switches & Checks)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 bg-black/30 border border-white/5">
                  {/* 开关 */}
                  <div className="space-y-3 border-r border-white/10 pr-4">
                    <span className="text-xs font-minecraft text-white block mb-2">OreSwitch 拟态开关</span>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-xs text-gray-300 font-minecraft">启用光影着色器</span>
                      <OreSwitch checked={switchA} onChange={setSwitchA} />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-xs text-gray-300 font-minecraft">离线模式</span>
                      <OreSwitch checked={switchB} onChange={setSwitchB} />
                    </label>
                  </div>

                  {/* 复选框 */}
                  <div className="space-y-3 border-r border-white/10 pr-4">
                    <span className="text-xs font-minecraft text-white block mb-2">OreCheckbox 复选框</span>
                    <OreCheckbox checked={checkboxA} onChange={setCheckboxA} label="自动检查模组更新" />
                    <OreCheckbox checked={checkboxB} onChange={setCheckboxB} label="开启手柄震动反馈" />
                    <OreCheckbox checked={false} onChange={() => {}} disabled label="禁用选项 (Disabled)" />
                  </div>

                  {/* 单选框 */}
                  <div className="space-y-2">
                    <span className="text-xs font-minecraft text-white block mb-2">OreRadio 单选框</span>
                    <OreRadio
                      name="showcase-radio"
                      value="opt1"
                      checked={radioVal === 'opt1'}
                      onChange={() => setRadioVal('opt1')}
                      label="Vanilla 原版内核"
                    />
                    <OreRadio
                      name="showcase-radio"
                      value="opt2"
                      checked={radioVal === 'opt2'}
                      onChange={() => setRadioVal('opt2')}
                      label="Fabric 模组加载器"
                    />
                    <OreRadio
                      name="showcase-radio"
                      value="opt3"
                      checked={radioVal === 'opt3'}
                      onChange={() => setRadioVal('opt3')}
                      label="NeoForge 模组加载器"
                    />
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: 选择器与导航 (SELECTORS) */}
          {/* ======================================================== */}
          {activeCategory === 'selectors' && (
            <div className="space-y-6">
              {/* 1. 分段选择器 */}
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
                    activeTab={segmentVal}
                    onChange={setSegmentVal}
                  />
                  <span className="text-xs font-minecraft text-ore-text-muted block text-center">
                    当前选中项: <strong className="text-white">{segmentVal}</strong>
                  </span>
                </div>
              </section>

              {/* 2. 切换按钮 */}
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
                    value={toggleVal}
                    onChange={setToggleVal}
                  />
                </div>
              </section>

              {/* 3. 下拉选择器 */}
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
                      value={dropdownVal}
                      onChange={setDropdownVal}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-minecraft text-ore-text-muted">滑块组件 (OreSlider)</label>
                    <div className="pt-2">
                      <OreSlider
                        min={0}
                        max={100}
                        value={sliderVal}
                        onChange={setSliderVal}
                        step={5}
                      />
                      <span className="text-xs font-mono text-ore-text-muted mt-1 block">值: {sliderVal}</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 5: 反馈与卡片 (FEEDBACK) */}
          {/* ======================================================== */}
          {activeCategory === 'feedback' && (
            <div className="space-y-6">
              {/* 1. 标签 Tag */}
              <section className="space-y-3">
                <div className="border-b border-white/10 pb-1">
                  <h3 className="text-sm font-minecraft text-white">OreTag 状态徽标体系</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 p-5 bg-black/30 border border-white/5">
                  <OreTag variant="primary">Primary 正常</OreTag>
                  <OreTag variant="success">Success 成功</OreTag>
                  <OreTag variant="warning">Warning 警告</OreTag>
                  <OreTag variant="error">Error 错误</OreTag>
                  <OreTag variant="informative">Informative 提示</OreTag>
                  <OreTag variant="neutral">Neutral 中性</OreTag>
                  <OreTag variant="realms">Realms 领域</OreTag>
                </div>
              </section>

              {/* 2. 通知横幅 Banner */}
              <section className="space-y-3">
                <div className="border-b border-white/10 pb-1">
                  <h3 className="text-sm font-minecraft text-white">OreBanner 通知信息条</h3>
                </div>
                <div className="space-y-3 p-5 bg-black/30 border border-white/5">
                  <OreBanner variant="info">
                    PiLauncher v0.9.8 已发布，包含全新的 OreUI 3D 像素拟态组件库！
                  </OreBanner>
                  <OreBanner variant="warning">
                    检测到您正在使用 Java 8 运行 1.21 实例，建议切换至 Java 21。
                  </OreBanner>
                  <OreBanner variant="danger">
                    OptiFine 与 Sodium 存在严重着色器管线冲突，无法同时载入。
                  </OreBanner>
                </div>
              </section>

              {/* 3. 卡片与折叠面板 */}
              <section className="space-y-3">
                <div className="border-b border-white/10 pb-1">
                  <h3 className="text-sm font-minecraft text-white">OreCard 卡片与 OreAccordion 折叠面板</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-black/30 border border-white/5">
                  <OreCard
                    title="Minecraft 实例卡片"
                    subtitle="Fabric 1.21.4 • 48 个模组"
                    description="基于 OreUI 9-Slice 方块网格构建的高保真卡片容器。"
                    className="p-4"
                  />

                  <div className="space-y-2">
                    <OreAccordion
                      title="折叠面板 1: 内存优化参数"
                      defaultExpanded
                    >
                      <p className="text-xs text-ore-text-muted p-2">
                        推荐 JVM 参数：-XX:+UseG1GC -XX:+ParallelRefProcEnabled
                      </p>
                    </OreAccordion>
                    <OreAccordion
                      title="折叠面板 2: 渲染优化配置"
                    >
                      <p className="text-xs text-ore-text-muted p-2">
                        开启 Sodium 块更新批处理与 GPU 实例化渲染管线。
                      </p>
                    </OreAccordion>
                  </div>
                </div>
              </section>

              {/* 4. Tooltip 提示 */}
              <section className="space-y-3">
                <div className="border-b border-white/10 pb-1">
                  <h3 className="text-sm font-minecraft text-white">OreTooltip 悬浮提示</h3>
                </div>
                <div className="flex items-center gap-4 p-5 bg-black/30 border border-white/5">
                  <OreTooltip content="这里是 OreUI 悬浮提示框">
                    <OreButton size="sm" variant="secondary">
                      将鼠标悬停在我身上
                    </OreButton>
                  </OreTooltip>
                </div>
              </section>
            </div>
          )}

        </div>
      </FocusBoundary>
    </OreModal>
  );
};
