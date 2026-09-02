// src/features/InstanceDetail/components/tabs/achievements/AchievementCard.tsx
import React, { useMemo } from 'react';
import { Trophy, CheckCircle2, Clock, ChevronRight } from 'lucide-react';
import { FocusItem } from '../../../../../ui/focus/FocusItem';
import { OreTag } from '../../../../../ui/primitives/OreTag';
import type { AdvancementItemDto } from '../../../../../types/achievement';

interface AchievementCardProps {
  item: AdvancementItemDto;
  onClick: () => void;
}

export const AchievementCard: React.FC<AchievementCardProps> = ({ item, onClick }) => {
  const advId = item.advancementId || item.advancement_id || '';
  const isCompleted = item.isCompleted ?? item.is_completed ?? false;
  const isFirstCareerUnlock = item.isFirstCareerUnlock ?? item.is_first_career_unlock ?? false;
  const frameType = item.frameType || item.frame_type || 'task';
  const unlockedAt = item.unlockedAt ?? item.unlocked_at;

  const isChallenge = frameType === 'challenge';
  const isGoal = frameType === 'goal';

  const criteriaCount = useMemo(() => {
    if (item.criteriaData && typeof item.criteriaData === 'object') {
      return Object.keys(item.criteriaData).length;
    }
    const rawJson = item.criteria_json;
    if (rawJson) {
      try {
        const parsed = JSON.parse(rawJson);
        return Object.keys(parsed).length;
      } catch {
        return 0;
      }
    }
    return 0;
  }, [item.criteriaData, item.criteria_json]);

  const formattedUnlockedTime = useMemo(() => {
    if (!unlockedAt) return null;
    const date = new Date(unlockedAt);
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${m}-${d} ${hh}:${mm}`;
  }, [unlockedAt]);

  // 三档材质与色彩规范
  const theme = useMemo(() => {
    if (isChallenge) {
      return {
        cardBorder: isCompleted
          ? 'border-[#D97706] hover:border-[#F59E0B] bg-gradient-to-br from-[#241704] to-[#15110B] shadow-[0_0_12px_rgba(217,119,6,0.12)]'
          : 'border-[#78350F]/70 hover:border-[#F59E0B] bg-[#16120C] opacity-80 hover:opacity-100',
        iconBox: 'border-2 border-[#D97706] bg-[#2E1E05] shadow-[inset_1px_1px_0_rgba(251,191,36,0.25),inset_-1px_-1px_0_rgba(0,0,0,0.6)]',
        iconColor: isCompleted ? 'text-[#FBBF24]' : 'text-[#B45309]',
        titleColor: isCompleted ? 'text-[#FBBF24]' : 'text-amber-200/80',
        descColor: 'text-zinc-300',
        badgeText: '史诗挑战',
        badgeClass: 'bg-[#78350F]/80 text-[#FDE68A] border-2 border-[#D97706] shadow-sm',
        icon: <Trophy size={20} />,
      };
    }
    if (isGoal) {
      return {
        cardBorder: isCompleted
          ? 'border-[#0284C7] hover:border-[#38BDF8] bg-gradient-to-br from-[#081B2B] to-[#11161B]'
          : 'border-[#0C4A6E]/70 hover:border-[#38BDF8] bg-[#0E151C] opacity-80 hover:opacity-100',
        iconBox: 'border-2 border-[#0369A1] bg-[#0C2438] shadow-[inset_1px_1px_0_rgba(56,189,248,0.2),inset_-1px_-1px_0_rgba(0,0,0,0.5)]',
        iconColor: isCompleted ? 'text-[#38BDF8]' : 'text-[#0284C7]',
        titleColor: isCompleted ? 'text-[#38BDF8]' : 'text-sky-200/80',
        descColor: 'text-zinc-300',
        badgeText: '稀有目标',
        badgeClass: 'bg-[#0369A1]/50 text-[#7DD3FC] border-2 border-[#0284C7] shadow-sm',
        icon: <Trophy size={20} />,
      };
    }
    // 普通任务 (Task)
    return {
      cardBorder: isCompleted
        ? 'border-[#3F3F46] hover:border-[#71717A] bg-[#1A1A1D]'
        : 'border-[#27272A] hover:border-[#52525B] bg-[#141416] opacity-75 hover:opacity-100',
      iconBox: 'border-2 border-[#333338] bg-[#222226] shadow-[inset_1px_1px_0_rgba(255,255,255,0.06),inset_-1px_-1px_0_rgba(0,0,0,0.4)]',
      iconColor: isCompleted ? 'text-zinc-200' : 'text-zinc-500',
      titleColor: isCompleted ? 'text-white' : 'text-zinc-300',
      descColor: 'text-zinc-400',
      badgeText: '普通',
      badgeClass: 'bg-[#27272A] text-zinc-300 border-2 border-[#3F3F46]',
      icon: <Trophy size={20} />,
    };
  }, [isChallenge, isGoal, isCompleted]);

  return (
    <FocusItem
      focusKey={`advancement-card-${advId}`}
      onEnter={onClick}
    >
      {({ ref, focused, tabIndex }) => (
        <div
          ref={ref as any}
          tabIndex={tabIndex}
          onClick={onClick}
          /* 卡片尺寸严格按黄金比例 1.618 : 1 设计 (320px × 198px) */
          className={`group relative flex flex-col justify-between w-[320px] h-[198px] shrink-0 p-3.5 border-2 transition-colors duration-100 cursor-pointer select-none box-border ${
            focused ? 'ring-2 ring-inset ring-white outline-none z-10' : ''
          } ${theme.cardBorder}`}
        >
          {/* =====================================================================
              1. 顶层栏 (约44px)：图标槽 + 标题/ID 与 阶层徽章
              ===================================================================== */}
          <div className="flex items-center gap-3 shrink-0">
            {/* 40×40 像素拟物成就奖杯展示槽 */}
            <div
              className={`w-[40px] h-[40px] shrink-0 flex items-center justify-center transition-colors ${theme.iconBox}`}
            >
              <div className={theme.iconColor}>{theme.icon}</div>
            </div>

            <div className="min-w-0 flex-1 flex flex-col justify-center">
              {/* 标题（默认正常字体 16px）与徽标（像素字 10px，按黄金比例 1.6:1）居中对齐 */}
              <div className="flex items-center justify-between gap-1.5">
                <h4
                  className={`font-sans text-[16px] font-bold leading-tight truncate ${theme.titleColor}`}
                >
                  {item.title}
                </h4>

                <span
                  className={`shrink-0 font-pixel text-[10px] px-2 py-0.5 leading-none inline-flex items-center justify-center font-bold tracking-wider ${theme.badgeClass}`}
                >
                  {theme.badgeText}
                </span>
              </div>

              <p className="text-[11px] text-ore-text-muted/80 font-mono truncate mt-0.5">
                {advId.replace('minecraft:', '')}
              </p>
            </div>
          </div>

          {/* =====================================================================
              2. 中间正文栏：字号优化为 13px，行高 21px，更舒适清晰的阅读体验
              ===================================================================== */}
          <div className="flex-1 flex items-center overflow-hidden my-2">
            <p
              className={`line-clamp-3 text-[13px] leading-[21px] font-normal ${theme.descColor}`}
            >
              {item.description || '暂无详细描述说明'}
            </p>
          </div>

          {/* =====================================================================
              3. 底部状态栏：达成时间/多条件进度 + 首通标识 + 查看箭头
              ===================================================================== */}
          <div className="pt-2 border-t border-[#26262A] flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {isCompleted ? (
                <span className="flex items-center gap-1 text-ore-green font-medium text-[11px] truncate">
                  <CheckCircle2 size={13} className="shrink-0" />
                  已达成 {formattedUnlockedTime && `(${formattedUnlockedTime})`}
                </span>
              ) : criteriaCount > 0 ? (
                <span className="flex items-center gap-1 text-amber-400 font-medium text-[11px] truncate">
                  <Clock size={13} className="shrink-0" />
                  {criteriaCount} 项条件已满足
                </span>
              ) : (
                <span className="flex items-center gap-1 text-zinc-500 text-[11px]">
                  未达成
                </span>
              )}

              {isFirstCareerUnlock && (
                <OreTag variant="gold" size="sm" className="px-1 py-0 text-[10px] leading-none shrink-0 font-pixel">
                  首通
                </OreTag>
              )}
            </div>

            <ChevronRight
              size={14}
              className="text-zinc-500 group-hover:text-white transition-colors shrink-0 ml-1"
            />
          </div>
        </div>
      )}
    </FocusItem>
  );
};
