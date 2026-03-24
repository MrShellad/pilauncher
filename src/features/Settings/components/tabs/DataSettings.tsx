import React, { useMemo } from 'react';
import { Archive, Trash2, FolderOpen } from 'lucide-react';

import { SettingsPageLayout } from '../../../../ui/layout/SettingsPageLayout';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../ui/layout/FormRow';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';
import { FocusItem } from '../../../../ui/focus/FocusItem';

import { useSettingsStore } from '../../../../store/useSettingsStore';

export const DataSettings: React.FC = () => {
  const { settings, updateGeneralSetting } = useSettingsStore();
  const thirdPartyDirs = settings.general.thirdPartyDirs || [];

  const handleRemoveDir = (dirToRemove: string) => {
    const updatedDirs = thirdPartyDirs.filter(d => d !== dirToRemove);
    updateGeneralSetting('thirdPartyDirs', updatedDirs);
  };

  const focusOrder = useMemo(() => {
    return thirdPartyDirs.map((_, idx) => `settings-data-remove-dir-${idx}`);
  }, [thirdPartyDirs]);

  const { handleLinearArrow } = useLinearNavigation(focusOrder);

  return (
    <SettingsPageLayout title="数据管理" subtitle="Data Management">
      <SettingsSection title="导入的实例目录" icon={<Archive size={18} />}>
        <FormRow
          label="已关联的第三方文件夹"
          description="这些文件夹内的实例会在启动器启动时被自动扫描。移除关联不会删除本地文件和数据。"
          vertical={true}
          control={
            <div className="w-full mt-[var(--ore-spacing-base)]">
              {thirdPartyDirs.length === 0 ? (
                <div className="text-[length:var(--ore-typography-size-sm)] font-minecraft text-[color:var(--ore-color-text-muted-default)] mt-[var(--ore-spacing-xs)] border-2 border-dashed border-[color:var(--ore-color-border-neutral-default)] p-[var(--ore-spacing-lg)] text-center">
                  暂无导入的外部目录
                </div>
              ) : (
                <div className="flex flex-col space-y-[length:var(--ore-spacing-sm)] mt-[var(--ore-spacing-md)] max-w-2xl">
                  {thirdPartyDirs.map((dir, idx) => (
                    <FocusItem
                      key={dir}
                      focusKey={`settings-data-remove-dir-${idx}`}
                      onArrowPress={handleLinearArrow}
                    >
                      {({ ref, focused }) => (
                        <div
                          ref={ref}
                          className={`
                            flex items-center justify-between p-[var(--ore-spacing-md)] border-[length:var(--ore-unit-borderWidth)] transition-all duration-200
                            ${focused ? 'border-[color:var(--ore-color-border-focus-default)] bg-[color:var(--ore-color-surface-raised)] ring-[length:var(--ore-unit-borderWidth)] ring-[color:var(--ore-focus-glow)] scale-[1.01] z-10' : 'border-[color:var(--ore-color-border-primary-default)] bg-[color:var(--ore-color-surface-sunken)]'}
                          `}
                        >
                          <div className="flex items-center space-x-3 overflow-hidden">
                            <FolderOpen size={16} className="text-ore-orange flex-shrink-0" />
                            <span className="text-white font-minecraft text-sm truncate" title={dir}>
                              {dir}
                            </span>
                          </div>
                          <OreButton
                            variant="danger"
                            size="sm"
                            onClick={() => handleRemoveDir(dir)}
                            tabIndex={-1}
                          >
                            <Trash2 size={14} className="mr-1.5" />
                            移除
                          </OreButton>
                        </div>
                      )}
                    </FocusItem>
                  ))}
                </div>
              )}
            </div>
          }
        />
      </SettingsSection>
    </SettingsPageLayout>
  );
};
