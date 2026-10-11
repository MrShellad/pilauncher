import React from 'react';
import { BoxSelect, CheckCircle2, CheckSquare, Loader2, Monitor, Square } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import {
  getInstanceFocusKey,
  type CompatibleInstance,
} from './instanceSelectModel';

interface InstanceSelectionListProps {
  instances: CompatibleInstance[];
  selectedIds: string[];
  alreadyInstalledInstanceIds: Set<string>;
  isLoading: boolean;
  onToggle: (instanceId: string) => void;
  onClick: (instanceId: string) => void;
  onArrowPress: (direction: string) => boolean;
}

export const InstanceSelectionList: React.FC<InstanceSelectionListProps> = ({
  instances,
  selectedIds,
  alreadyInstalledInstanceIds,
  isLoading,
  onToggle,
  onClick,
  onArrowPress,
}) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-[3rem] text-[#6CC349]">
        <Loader2 className="mb-[0.75rem] animate-spin" size={32} />
        <span className="font-minecraft text-[0.875rem]">
          {t('download.instanceSelect.matchingInstances', { defaultValue: '正在匹配兼容的实例...' })}
        </span>
      </div>
    );
  }

  if (instances.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-[3rem] text-[#B1B2B5]">
        <BoxSelect size={48} className="mb-[1rem] opacity-70" />
        <div className="mb-[0.25rem] text-center font-minecraft text-[1.125rem] text-white">
          {t('download.instanceSelect.noMatchingInstancesTitle', { defaultValue: '未找到匹配实例' })}
        </div>
        <div className="px-[2rem] text-center font-minecraft text-[0.75rem] leading-[1.55]">
          {t('download.instanceSelect.noMatchingInstancesDesc', {
            defaultValue: '该 Mod 的运行环境与您现有的实例不兼容，请先创建一个匹配的实例。',
          })}
        </div>
      </div>
    );
  }

  return instances.map((instance, index) => {
    const isSelected = selectedIds.includes(instance.id);
    const isAlreadyInstalled = alreadyInstalledInstanceIds.has(instance.id);

    return (
      <FocusItem
        key={instance.id}
        focusKey={getInstanceFocusKey(instance.id)}
        onEnter={() => onToggle(instance.id)}
        onArrowPress={onArrowPress}
      >
        {({ ref, focused }) => (
          <motion.div
            ref={ref as React.RefObject<HTMLDivElement>}
            onClick={() => onClick(instance.id)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30, delay: index * 0.02 }}
            className={`
              relative flex cursor-pointer items-center gap-[0.75rem] overflow-hidden border-[0.125rem] p-[0.75rem] transition-none
              ${isSelected ? 'border-[#1D4D13] bg-[#6CC349]' : isAlreadyInstalled ? 'border-[#D6A02A] bg-[#3A300F] hover:border-[#F5C542]' : 'border-[#1E1E1F] bg-[#D0D1D4] hover:bg-[#B1B2B5]'}
              ${focused ? 'z-10 outline outline-[0.125rem] outline-offset-[0.1875rem] outline-white brightness-[1.06]' : ''}
            `}
            style={{
              boxShadow: isSelected
                ? 'inset 0 -0.25rem 0 #3C8527, inset 0.125rem 0.125rem 0 rgba(255,255,255,0.24)'
                : isAlreadyInstalled
                  ? 'inset 0 -0.25rem 0 #6B4F00, inset 0.125rem 0.125rem 0 rgba(255,255,255,0.12)'
                  : 'inset 0 -0.25rem 0 #58585A, inset 0.125rem 0.125rem 0 rgba(255,255,255,0.68)',
            }}
          >
            <div className={`flex h-[2rem] w-[2rem] items-center justify-center border-[0.125rem] ${
              isSelected
                ? 'border-[#1D4D13] bg-[#D0D1D4] text-[#111214]'
                : isAlreadyInstalled
                  ? 'border-[#D6A02A] bg-[#1E1E1F] text-[#F5C542]'
                  : 'border-[#1E1E1F] bg-[#48494A] text-[#D0D1D4]'
            }`}>
              {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
            </div>

            <Monitor
              size={24}
              className={`transition-colors ${isSelected ? 'text-[#1D4D13]' : isAlreadyInstalled ? 'text-[#F5C542]' : 'text-[#24563C]'}`}
            />

            <div className="min-w-0 flex-1">
              <div className={`truncate font-minecraft text-[1rem] leading-[1.35] ${isSelected ? 'font-bold text-[#111214]' : isAlreadyInstalled ? 'font-bold text-[#FFE08A]' : 'text-[#111214]'}`}>
                {instance.name}
              </div>
              <div className={`mt-[0.125rem] font-mono text-[0.625rem] ${isSelected ? 'text-[#1D4D13]' : isAlreadyInstalled ? 'text-[#F5C542]' : 'text-[#313233]'}`}>
                {instance.version || t('download.instanceSelect.unknownVersion', { defaultValue: '未知版本' })}
                {' | '}
                {instance.loader || t('download.instanceSelect.unknownLoader', { defaultValue: '未知 Loader' })}
              </div>
            </div>

            {isSelected ? (
              <div className="ml-[0.75rem] flex-shrink-0 text-right">
                <CheckCircle2 className="ml-auto text-[#1D4D13]" size={20} />
                <div className="mt-[0.25rem] font-minecraft text-[0.625rem] uppercase tracking-[0.12em] text-[#1D4D13]">
                  {t('download.instanceSelect.selectedStatus', { defaultValue: '已选择' })}
                </div>
              </div>
            ) : isAlreadyInstalled ? (
              <div className="ml-[0.75rem] flex-shrink-0 text-right">
                <CheckCircle2 className="ml-auto text-[#F5C542]" size={20} />
                <div className="mt-[0.25rem] font-minecraft text-[0.625rem] uppercase tracking-[0.12em] text-[#F5C542]">
                  {t('download.instanceSelect.alreadyInstalled', { defaultValue: '已存在' })}
                </div>
              </div>
            ) : null}
          </motion.div>
        )}
      </FocusItem>
    );
  });
};
