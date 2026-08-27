// /src/features/InstanceDetail/components/header/InstanceDetailHeader.tsx
import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { GamepadButtonIcon } from '../../../../ui/components/GamepadButtonIcon';

interface InstanceDetailHeaderProps {
  instanceName?: string;
  onBack: () => void;
}

export const InstanceDetailHeader: React.FC<InstanceDetailHeaderProps> = ({
  instanceName,
  onBack,
}) => {
  const { t } = useTranslation();

  return (
    <header className="relative flex h-[52px] w-full flex-shrink-0 items-center justify-between border-b-[2px] border-[#1E1E1F] bg-[#313233] px-4 select-none z-20 shadow-[inset_0_2px_rgba(255,255,255,0.1),inset_0_-2px_rgba(0,0,0,0.4)]">
      {/* 左侧返回按钮 */}
      <div className="flex items-center gap-3">
        <FocusItem
          focusKey="instance-header-back"
          onEnter={onBack}
        >
          {({ ref, focused, tabIndex }) => (
            <button
              ref={ref as any}
              type="button"
              tabIndex={tabIndex}
              onClick={onBack}
              className={`group flex h-9 items-center gap-2 border-[2px] border-[#1E1E1F] bg-[#48494A] px-3 font-minecraft text-xs font-bold uppercase tracking-wider text-white transition-none cursor-pointer outline-none shadow-[inset_0_-2px_#333334,inset_1px_1px_rgba(255,255,255,0.2)] hover:bg-[#58585A] active:bg-[#38383A] ${
                focused ? 'outline outline-2 outline-white outline-offset-1 z-10' : ''
              }`}
            >
              <ChevronLeft size={16} className="text-white group-hover:-translate-x-0.5 transition-transform" />
              <span>{t('common.back', '返回')}</span>
              <GamepadButtonIcon button="B" size="sm" tone="dark" className="ml-0.5" />
            </button>
          )}
        </FocusItem>
      </div>

      {/* 中间基岩版大标题 */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
        <h1 className="font-minecraft text-base font-bold uppercase tracking-[0.16em] text-white ore-text-shadow">
          {t('instanceDetail.headerTitle', 'EDIT INSTANCE')}
        </h1>
      </div>

      {/* 右侧实例名称信息角标 */}
      <div className="flex items-center gap-2">
        {instanceName && (
          <span className="hidden md:inline-block max-w-[200px] truncate font-minecraft text-xs text-[#A1A3A5]">
            {instanceName}
          </span>
        )}
      </div>
    </header>
  );
};
