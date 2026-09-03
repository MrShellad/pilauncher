// src/features/InstanceDetail/components/tabs/AchievementPanel.tsx
import React, { useMemo } from 'react';
import {
  Trophy,
  RefreshCw,
  Compass,
  Flame,
  Globe,
  Sparkles,
  Wheat,
  FolderOpen,
  LayoutGrid,
  History,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreSegmentedControl, type TabItem } from '../../../../ui/primitives/OreSegmentedControl';
import { OreToggleButton, type ToggleOption } from '../../../../ui/primitives/OreToggleButton';
import { OreOverlayScrollArea } from '../../../../ui/primitives/OreOverlayScrollArea';

import {
  useAchievementPanel,
  type AchievementCategory,
  type AchievementViewMode,
} from './achievements/useAchievementPanel';
import { AchievementCard } from './achievements/AchievementCard';
import { AchievementTimelineView } from './achievements/AchievementTimelineView';
import { AchievementCriteriaModal } from './achievements/AchievementCriteriaModal';

export const AchievementPanel: React.FC<{ instanceId: string }> = ({ instanceId }) => {
  const { t } = useTranslation();
  const {
    saves,
    selectedWorld,
    setSelectedWorld,
    advancements,
    timelineGroups,
    allAdvancementsCount,
    isLoading,
    isRefreshing,
    stats,
    viewMode,
    setViewMode,
    activeCategory,
    setActiveCategory,
    selectedAdvancement,
    setSelectedAdvancement,
    refresh,
  } = useAchievementPanel(instanceId);

  // 原版官方五大分类 Tabs（图标文字严格居中）
  const categoryTabs = useMemo<TabItem[]>(
    () => [
      { id: 'all', label: '全部' },
      { id: 'story', label: '故事', icon: <Compass size={14} className="text-[#38BDF8]" /> },
      { id: 'nether', label: '下界', icon: <Flame size={14} className="text-[#F87171]" /> },
      { id: 'the_end', label: '末地', icon: <Sparkles size={14} className="text-[#C084FC]" /> },
      { id: 'adventure', label: '冒险', icon: <Globe size={14} className="text-[#4ADE80]" /> },
      { id: 'husbandry', label: '农业', icon: <Wheat size={14} className="text-[#FACC15]" /> },
    ],
    []
  );

  // 视图模式 OreToggleButton 选项（网格 vs 时间轴）
  const viewModeOptions = useMemo<ToggleOption[]>(
    () => [
      {
        label: (
          <div className="flex items-center justify-center gap-1.5 px-3">
            <LayoutGrid size={14} />
            <span>网格</span>
          </div>
        ),
        value: 'grid',
      },
      {
        label: (
          <div className="flex items-center justify-center gap-1.5 px-3">
            <History size={14} />
            <span>时间轴</span>
          </div>
        ),
        value: 'timeline',
      },
    ],
    []
  );

  return (
    <FocusBoundary
      id="achievement-panel-boundary"
      className="flex flex-1 min-h-0 flex-col overflow-hidden p-3 gap-3 select-none"
    >
      {/* =========================================================================
          顶部统计与世界选择横幅
          ========================================================================= */}
      <div className="flex shrink-0 flex-wrap items-center justify-between border-2 border-[#2A2A2C] bg-[#18181B] py-3.5 px-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#F59E0B]/50 bg-[#2D1E06]">
            <Trophy size={22} className="text-[#F59E0B]" />
          </div>
          <div>
            <h3 className="flex items-center font-minecraft text-white text-base">
              {t('instanceDetail.achievements.title', '游戏成就')}
            </h3>
            <p className="mt-0.5 text-xs text-ore-text-muted">
              {saves.length > 0 ? (
                <>
                  已点亮 <span className="text-ore-green font-bold">{stats.completed}</span> /{' '}
                  {stats.total} 项原版成就
                </>
              ) : (
                '未检测到世界存档'
              )}
            </p>
          </div>
        </div>

        {/* 右侧：世界存档切换器与刷新动作 */}
        <div className="flex items-center gap-2.5">
          {saves.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-ore-text-muted shrink-0 flex items-center gap-1">
                <FolderOpen size={13} />
                世界：
              </span>
              <select
                value={selectedWorld}
                onChange={(e) => setSelectedWorld(e.target.value)}
                className="bg-[#121214] border border-[#3A3A3D] text-white text-xs px-2.5 py-1.5 focus:border-ore-green focus:outline-none cursor-pointer"
              >
                {saves.map((s) => (
                  <option key={s.folderName} value={s.folderName}>
                    {s.worldName} ({s.folderName})
                  </option>
                ))}
              </select>
            </div>
          )}

          <OreButton
            focusKey="achievement-btn-refresh"
            variant="secondary"
            size="sm"
            onClick={refresh}
            disabled={isRefreshing || !selectedWorld}
            className="flex items-center gap-1 text-xs"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            刷新
          </OreButton>
        </div>
      </div>

      {/* =========================================================================
          成就主体区域：包含顶部工具栏与无缝贴合的卡片滚动视口（去除中间冗余间隙与容器嵌套）
          ========================================================================= */}
      <div className="flex flex-1 min-h-0 flex-col border border-[#27272A] bg-[#141416] overflow-hidden">
        {/* 工具栏：分类导航与视图模式切换 */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 bg-[#1C1C1F] border-b border-[#27272A] p-2 z-10">
          {/* 左侧：分类 Tab 切换 (网格模式展示) / 时间轴概览标识 */}
          <div className="overflow-x-auto max-w-full">
            {viewMode === 'grid' ? (
              <OreSegmentedControl
                tabs={categoryTabs}
                activeTab={activeCategory}
                onChange={(id) => setActiveCategory(id as AchievementCategory)}
                focusKeyPrefix="achievement-category"
              />
            ) : (
              <div className="flex items-center gap-2 px-3 h-[var(--seg-height)] bg-[#141416] border border-[#27272A] text-xs text-[#A1A1AA]">
                <History size={14} className="text-ore-green" />
                <span className="font-minecraft text-white">时光足迹</span>
                <span>· 共记录 {timelineGroups.reduce((acc, g) => acc + g.items.length, 0)} 项已达成成就</span>
              </div>
            )}
          </div>

          {/* 右侧：视图切换器 */}
          <div className="shrink-0 flex items-center">
            <OreToggleButton
              options={viewModeOptions}
              value={viewMode}
              onChange={(val) => setViewMode(val as AchievementViewMode)}
              uiScale="adaptive"
              className="w-auto !m-0"
              focusKeyPrefix="achievement-view-mode"
            />
          </div>
        </div>

        {/* 内容主视口：与工具栏无缝衔接，去除多余嵌套，顶部添加 16px 渐隐遮罩消除生硬裁切 */}
        <OreOverlayScrollArea
          className="flex-1 min-h-0 w-full [mask-image:linear-gradient(to_bottom,transparent_0px,black_16px,black_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0px,black_16px,black_100%)]"
          viewportClassName="p-2"
          contentClassName={
            isLoading || (advancements.length > 0 && viewMode === 'grid')
              ? 'flex flex-wrap gap-4 justify-center items-center min-h-full py-2.5'
              : 'min-h-full flex flex-col justify-center py-2.5'
          }
        >
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="w-[320px] h-[198px] shrink-0 bg-[#18181B] border border-[#27272A] animate-pulse p-3.5"
              />
            ))
          ) : saves.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6">
              <div className="flex flex-col items-center justify-center max-w-md w-full border-2 border-dashed border-[#2A2A2C] bg-[#161618] text-center p-8">
                <Trophy size={40} className="text-zinc-600 mb-3" />
                <h4 className="font-minecraft text-sm text-zinc-300">未发现世界存档</h4>
                <p className="mt-1 text-xs text-ore-text-muted max-w-sm">
                  进入游戏创建单人世界或连接服务器游玩后，系统将在退出时自动同步并解析您的成就与进度。
                </p>
              </div>
            </div>
          ) : viewMode === 'timeline' ? (
            <AchievementTimelineView
              groups={timelineGroups}
              onSelectAdvancement={setSelectedAdvancement}
            />
          ) : advancements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6">
              <div className="flex flex-col items-center justify-center max-w-md w-full border border-[#2A2A2C] bg-[#18181B] text-center p-8">
                <Compass size={36} className="text-zinc-600 mb-2" />
                <h4 className="text-sm text-zinc-300">未找到符合条件的成就</h4>
                <p className="mt-1 text-xs text-ore-text-muted">
                  {allAdvancementsCount === 0
                    ? '该存档当前暂未触发任何已完成或进行中的原版成就。'
                    : '请尝试切换其它分类。'}
                </p>
              </div>
            </div>
          ) : (
            advancements.map((item) => (
              <AchievementCard
                key={item.advancementId || item.advancement_id}
                item={item}
                onClick={() => setSelectedAdvancement(item)}
              />
            ))
          )}
        </OreOverlayScrollArea>
      </div>

      {/* =========================================================================
          条件明细模态框
          ========================================================================= */}
      <AchievementCriteriaModal
        advancement={selectedAdvancement}
        onClose={() => setSelectedAdvancement(null)}
      />
    </FocusBoundary>
  );
};
