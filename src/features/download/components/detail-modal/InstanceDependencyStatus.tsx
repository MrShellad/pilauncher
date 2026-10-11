import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OreCheckbox } from '../../../../ui/primitives/OreCheckbox';
import {
  AUTO_DEPS_FOCUS_KEY,
  type MissingDependency,
} from './instanceSelectModel';

interface InstanceDependencyStatusProps {
  isChecking: boolean;
  missingDependencies: MissingDependency[];
  selectedCount: number;
  autoInstall: boolean;
  onAutoInstallChange: (checked: boolean) => void;
  onArrowPress: (direction: string) => boolean;
}

export const InstanceDependencyStatus: React.FC<InstanceDependencyStatusProps> = ({
  isChecking,
  missingDependencies,
  selectedCount,
  autoInstall,
  onAutoInstallChange,
  onArrowPress,
}) => {
  const { t } = useTranslation();

  if (isChecking) {
    return (
      <div className="flex h-full items-center border-[0.125rem] border-[#3C8527] bg-[#1E1E1F] px-[0.75rem] font-minecraft text-[0.75rem] text-[#6CC349] shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.08)]">
        <Loader2 size={14} className="mr-[0.5rem] animate-spin" />
        {t('download.instanceSelect.checkingDeps', { defaultValue: '正在分析前置依赖环境...' })}
      </div>
    );
  }

  if (missingDependencies.length > 0) {
    return (
      <div className="h-full border-[0.125rem] border-[#D6A02A] bg-[#3A300F] p-[0.75rem] shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.12)]">
        <div className="mb-[0.5rem] flex items-start text-[#F5C542]">
          <AlertTriangle size={16} className="mr-[0.5rem] mt-[0.125rem] flex-shrink-0" />
          <div className="font-minecraft text-[0.75rem] leading-[1.55]">
            {t('download.instanceSelect.missingDepsPrefix', { defaultValue: '已选实例缺少 ' })}
            <span className="font-bold">{missingDependencies.length}</span>
            {t('download.instanceSelect.missingDepsSuffix', { defaultValue: ' 个必需的前置：' })}
            <br />
            <span className="break-words font-bold text-[#FFE08A]">
              {missingDependencies
                .map((dependency) => dependency.name)
                .join(t('download.instanceSelect.commaSeparator', { defaultValue: '、' }))}
            </span>
          </div>
        </div>

        <OreCheckbox
          focusKey={AUTO_DEPS_FOCUS_KEY}
          checked={autoInstall}
          onChange={onAutoInstallChange}
          onArrowPress={onArrowPress}
          label={t('download.instanceSelect.autoDownloadDeps', { defaultValue: '自动下载并补全前置模组' })}
          className="mt-2"
        />
      </div>
    );
  }

  return (
    <div className="flex h-full items-center border-[0.125rem] border-[#1E1E1F] bg-[#242425] px-[0.75rem] font-minecraft text-[0.75rem] text-[#B1B2B5] shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.06)]">
      {selectedCount > 0
        ? t('download.instanceSelect.depCheckStatusEmpty', {
          defaultValue: '已选实例的前置检查结果会显示在这里',
        })
        : t('download.instanceSelect.depCheckStatusIdle', {
          defaultValue: '选择实例后将在这里分析前置依赖',
        })}
    </div>
  );
};
