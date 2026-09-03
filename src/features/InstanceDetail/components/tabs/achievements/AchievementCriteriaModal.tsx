// src/features/InstanceDetail/components/tabs/achievements/AchievementCriteriaModal.tsx
import React, { useMemo } from 'react';
import { CheckCircle2, Circle, Clock, Award } from 'lucide-react';
import { OreModal } from '../../../../../ui/primitives/OreModal';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { OreTag } from '../../../../../ui/primitives/OreTag';
import type { AdvancementItemDto } from '../../../../../types/achievement';

interface AchievementCriteriaModalProps {
  advancement: AdvancementItemDto | null;
  onClose: () => void;
}

interface CriterionItem {
  key: string;
  label: string;
  unlockedAt: string | null;
  isDone: boolean;
}

export const AchievementCriteriaModal: React.FC<AchievementCriteriaModalProps> = ({
  advancement,
  onClose,
}) => {
  const advId = advancement?.advancementId || advancement?.advancement_id || '';
  const isCompleted = advancement?.isCompleted ?? advancement?.is_completed ?? false;
  const isFirstCareerUnlock =
    advancement?.isFirstCareerUnlock ?? advancement?.is_first_career_unlock ?? false;

  const criteriaList = useMemo<CriterionItem[]>(() => {
    if (!advancement) return [];

    let parsed: Record<string, string> = {};
    if (advancement.criteriaData && typeof advancement.criteriaData === 'object') {
      parsed = advancement.criteriaData as Record<string, string>;
    } else if (advancement.criteria_json) {
      try {
        parsed = JSON.parse(advancement.criteria_json);
      } catch {
        parsed = {};
      }
    }

    return Object.entries(parsed).map(([key, timeStr]) => {
      // 美化 key 显示，如 "minecraft:desert" -> "desert"
      const label = key.split(':').pop()?.replace(/_/g, ' ') || key;
      return {
        key,
        label,
        unlockedAt: timeStr,
        isDone: true,
      };
    });
  }, [advancement]);

  if (!advancement) return null;

  return (
    <OreModal
      isOpen={!!advancement}
      onClose={onClose}
      title={<span className="font-pixel text-base font-bold tracking-wide">{advancement.title}</span> as any}
      className="w-[560px] max-w-[92vw]"
      actions={
        <OreButton variant="primary" onClick={onClose}>
          我知道了
        </OreButton>
      }
    >
      <div className="flex flex-col gap-4 text-sm text-[#E0E0E0]">
        {/* 顶部简述与徽章 */}
        <div className="flex items-start justify-between gap-3 border-b border-[#2A2A2C] pb-3">
          <div>
            <p className="text-xs text-ore-text-muted mb-1 font-mono">
              {advId}
            </p>
            <p className="text-[#C0C0C4]">{advancement.description || '暂无详细描述'}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {isCompleted ? (
              <OreTag variant="success" size="sm" className="flex items-center gap-1">
                <CheckCircle2 size={12} />
                已完全达成
              </OreTag>
            ) : (
              <OreTag variant="warning" size="sm" className="flex items-center gap-1">
                <Clock size={12} />
                推进中 ({criteriaList.length} 条件满足)
              </OreTag>
            )}
            {isFirstCareerUnlock && (
              <OreTag variant="notice" size="sm" className="flex items-center gap-1">
                <Award size={12} />
                生涯首次
              </OreTag>
            )}
          </div>
        </div>

        {/* 条件清单列表 */}
        <div>
          <h4 className="font-minecraft text-xs text-ore-text-muted mb-2 uppercase tracking-wider">
            达成条件明细 ({criteriaList.length})
          </h4>

          {criteriaList.length === 0 ? (
            <div className="p-4 text-center text-xs text-ore-text-muted bg-[#1A1A1C] border border-[#2A2A2C]">
              暂无可展开的独立子条件记录
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-[320px] overflow-y-auto pr-1">
              {criteriaList.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-2.5 bg-[#18181B] border border-[#262628] hover:border-[#38383B] transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {item.isDone ? (
                      <CheckCircle2 size={15} className="text-ore-green shrink-0" />
                    ) : (
                      <Circle size={15} className="text-zinc-600 shrink-0" />
                    )}
                    <span className="truncate font-medium text-white capitalize">
                      {item.label}
                    </span>
                  </div>
                  {item.unlockedAt && (
                    <span className="text-xs text-ore-text-muted shrink-0 font-mono ml-2">
                      {item.unlockedAt.split(' ')[0]} {item.unlockedAt.split(' ')[1]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </OreModal>
  );
};
