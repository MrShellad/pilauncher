// src/features/InstanceDetail/components/tabs/achievements/AchievementTimelineView.tsx
import React from 'react';
import { Calendar, Clock, Trophy, ChevronRight, History } from 'lucide-react';
import { FocusItem } from '../../../../../ui/focus/FocusItem';
import { OreTag } from '../../../../../ui/primitives/OreTag';
import type { AdvancementItemDto } from '../../../../../types/achievement';
import type { TimelineDateGroup } from './useAchievementPanel';

interface AchievementTimelineViewProps {
  groups: TimelineDateGroup[];
  onSelectAdvancement: (item: AdvancementItemDto) => void;
}

export const AchievementTimelineView: React.FC<AchievementTimelineViewProps> = ({
  groups,
  onSelectAdvancement,
}) => {
  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-[#2A2A2C] bg-[#161618] text-center p-6">
        <History size={40} className="text-zinc-600 mb-3" />
        <h4 className="font-minecraft text-sm text-zinc-300">暂无时间轴足迹</h4>
        <p className="mt-1 text-xs text-ore-text-muted max-w-md">
          当前存档尚未记录成就达成的具体时刻。进入游戏点亮成就后，系统将按时间倒序自动绘制你的冒险成长轨迹。
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1040px] mx-auto py-3 px-3">
      {groups.map((group) => (
        <div key={group.date} className="mb-10">
          {/* =====================================================================
              1. 居中日期分组徽标
              ===================================================================== */}
          <div className="flex justify-center mb-6">
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-[#1F1F23] border-2 border-[#303036] text-xs font-minecraft text-white shadow-md">
              <Calendar size={13} className="text-ore-green" />
              <span>{group.date}</span>
              <span className="text-[11px] text-ore-text-muted ml-1">
                (达成 {group.items.length} 项)
              </span>
            </div>
          </div>

          {/* =====================================================================
              2. 左右交替排列的双侧时间轴视口
              ===================================================================== */}
          <div className="relative w-full">
            {/* 中间贯穿主轴线 */}
            <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-[#2F2F33] -translate-x-1/2 z-0" />

            <div className="flex flex-col gap-6">
              {group.items.map((item, index) => {
                const advId = item.advancementId || item.advancement_id || '';
                const frameType = item.frameType || item.frame_type || 'task';
                const isChallenge = frameType === 'challenge';
                const isGoal = frameType === 'goal';

                // 偶数在左，奇数在右
                const isLeft = index % 2 === 0;

                const timeStr = item.unlockedAt
                  ? new Date(item.unlockedAt).toTimeString().split(' ')[0]
                  : null;

                // 节点颜色规范
                const nodeColorClass = isChallenge
                  ? 'border-[#F59E0B] bg-[#2E1E05] text-[#FBBF24] shadow-[0_0_10px_rgba(245,158,11,0.45)]'
                  : isGoal
                  ? 'border-[#38BDF8] bg-[#0C2438] text-[#38BDF8] shadow-[0_0_10px_rgba(56,189,248,0.35)]'
                  : 'border-[#52525B] bg-[#1E1E22] text-zinc-300';

                // 卡片材质规范
                const cardBorderClass = isChallenge
                  ? 'border-[#D97706] hover:border-[#F59E0B] bg-gradient-to-br from-[#221605] to-[#16120C]'
                  : isGoal
                  ? 'border-[#0284C7] hover:border-[#38BDF8] bg-gradient-to-br from-[#091D2E] to-[#10161C]'
                  : 'border-[#38383D] hover:border-[#71717A] bg-[#18181B]';

                return (
                  <div
                    key={advId}
                    className={`relative flex items-center w-full ${
                      isLeft ? 'justify-start' : 'justify-end'
                    }`}
                  >
                    {/* 中间主轴上的发光奖杯徽记 (绝对水平居中) */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                      <div
                        className={`w-7 h-7 flex items-center justify-center border-2 transition-transform duration-100 ${nodeColorClass}`}
                      >
                        <Trophy size={13} />
                      </div>
                    </div>

                    {/* 卡片主体：占据一侧，提供充足宽度保证标题完整呈现 */}
                    <div className={`w-[calc(50%-28px)] max-w-[460px] ${isLeft ? 'pr-3' : 'pl-3'}`}>
                      <FocusItem
                        focusKey={`timeline-node-${advId}`}
                        onEnter={() => onSelectAdvancement(item)}
                      >
                        {({ ref, focused, tabIndex }) => (
                          <div
                            ref={ref as any}
                            tabIndex={tabIndex}
                            onClick={() => onSelectAdvancement(item)}
                            className={`group p-3.5 border-2 transition-colors duration-100 cursor-pointer select-none box-border ${
                              focused ? 'ring-2 ring-inset ring-white outline-none z-10' : ''
                            } ${cardBorderClass}`}
                          >
                            {/* 第一行：达成时刻 + 阶层徽章 + 首通标识 */}
                            <div className="flex items-center justify-between gap-2 mb-2">
                              {timeStr ? (
                                <span className="flex items-center gap-1 font-mono text-[11px] text-ore-text-muted shrink-0 bg-[#121214] px-2 py-0.5 border border-[#27272A]">
                                  <Clock size={11} className="text-zinc-400" />
                                  {timeStr}
                                </span>
                              ) : <span />}

                              <div className="flex items-center gap-1.5 shrink-0">
                                {isChallenge && (
                                  <span className="font-pixel text-[10px] px-2 py-0.5 leading-none inline-flex items-center justify-center font-bold tracking-wider bg-[#78350F]/80 text-[#FDE68A] border-2 border-[#D97706] shadow-sm">
                                    史诗挑战
                                  </span>
                                )}
                                {isGoal && (
                                  <span className="font-pixel text-[10px] px-2 py-0.5 leading-none inline-flex items-center justify-center font-bold tracking-wider bg-[#0369A1]/50 text-[#7DD3FC] border-2 border-[#0284C7] shadow-sm">
                                    稀有目标
                                  </span>
                                )}
                                {!isChallenge && !isGoal && (
                                  <span className="font-pixel text-[10px] px-2 py-0.5 leading-none inline-flex items-center justify-center font-bold tracking-wider bg-[#27272A] text-zinc-300 border-2 border-[#3F3F46]">
                                    普通
                                  </span>
                                )}
                                {item.isFirstCareerUnlock && (
                                  <OreTag variant="gold" size="sm" className="px-1 py-0 text-[10px] leading-none font-pixel">
                                    首通
                                  </OreTag>
                                )}
                              </div>
                            </div>

                            {/* 第二行：标题独占一行，字号 16px，完整展现避免被挤压截断 */}
                            <h4
                              className={`font-sans text-[16px] leading-snug font-bold mb-1.5 break-words line-clamp-2 ${
                                isChallenge
                                  ? 'text-[#FBBF24]'
                                  : isGoal
                                  ? 'text-[#38BDF8]'
                                  : 'text-white'
                              }`}
                              title={item.title}
                            >
                              {item.title}
                            </h4>

                            {/* 第三行：成就说明文本（提升至 13px 清晰字号）与展开箭头 */}
                            <div className="flex items-start justify-between gap-2 mt-1">
                              <p className="text-[13px] leading-[20px] text-zinc-300 line-clamp-2 flex-1" title={item.description || ''}>
                                {item.description || '暂无说明'}
                              </p>
                              <ChevronRight
                                size={15}
                                className="text-zinc-500 group-hover:text-white transition-colors shrink-0 mt-0.5 ml-1"
                              />
                            </div>
                          </div>
                        )}
                      </FocusItem>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
