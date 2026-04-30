import React from 'react';
import { Image as ImageIcon, Save, Loader2 } from 'lucide-react';

import { OreInput } from '../../../../../../ui/primitives/OreInput';
import { OreButton } from '../../../../../../ui/primitives/OreButton';
import { FocusItem } from '../../../../../../ui/focus/FocusItem';
import { SettingsSection } from '../../../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../../../ui/layout/FormRow';
import { useBasicInfoSection } from '../hooks/useBasicInfoSection';
import type { BasicInfoSectionProps } from '../schemas/basicPanelSchemas';

export const BasicInfoSection: React.FC<BasicInfoSectionProps> = ({
  initialName,
  coverUrl,
  isInitializing,
  onUpdateName,
  onUpdateCover,
  onSuccess,
  isGlobalSaving,
  setIsGlobalSaving,
}) => {
  const {
    editName,
    setEditName,
    isNameChanged,
    handleSaveName,
    handleChangeCover,
  } = useBasicInfoSection({
    initialName,
    onUpdateName,
    onUpdateCover,
    onSuccess,
    setIsGlobalSaving,
  });

  return (
    <SettingsSection title="基本信息" icon={<ImageIcon size="1.125rem" />}>
      <FormRow
        label="实例名称"
        description="用于在列表中显示的自定义名称。"
        className="!lg:items-center"
        control={
          <div className="flex w-full flex-col items-stretch gap-3 lg:w-[30rem]">
            <OreInput
              focusKey="basic-input-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              disabled={isGlobalSaving || isInitializing}
              placeholder="输入实例名称"
              containerClassName="w-full"
            />
            <OreButton
              focusKey="basic-btn-save-name"
              variant={isNameChanged ? 'primary' : 'secondary'}
              onClick={handleSaveName}
              disabled={!isNameChanged || isGlobalSaving || isInitializing}
              className="w-full"
            >
              <Save size="1rem" className="mr-2" /> 保存
            </OreButton>
          </div>
        }
      />

      <FormRow
        label="实例封面"
        description="支持 .png 或 .jpg 格式，建议比例 16:9。"
        control={
          <FocusItem
            focusKey="basic-btn-change-cover"
            disabled={isGlobalSaving || isInitializing}
            onEnter={handleChangeCover}
          >
            {({ ref, focused }) => (
              <button
                ref={ref as React.RefObject<HTMLButtonElement>}
                type="button"
                onClick={handleChangeCover}
                disabled={isGlobalSaving || isInitializing}
                tabIndex={-1}
                className={`relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-sm border-2 bg-[#141415] shadow-[inset_0_0.125rem_0.25rem_rgba(0,0,0,0.4)] outline-none transition-colors lg:w-[30rem] ${
                  focused
                    ? 'border-ore-focus outline outline-[0.1875rem] outline-ore-focus outline-offset-[0.125rem] drop-shadow-ore-glow brightness-110'
                    : 'border-[#1E1E1F] hover:border-white/60'
                } disabled:opacity-60`}
              >
                {coverUrl ? (
                  <img src={coverUrl} alt="Cover" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-ore-text-muted">
                    <ImageIcon size="1.5rem" className="opacity-60" />
                    <span className="text-sm">更换封面</span>
                  </div>
                )}
                {coverUrl && (
                  <div className="absolute inset-x-0 bottom-0 bg-black/65 px-4 py-2 text-left text-sm text-white">
                    更换封面
                  </div>
                )}
                {isGlobalSaving && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <Loader2 size="1.5rem" className="animate-spin text-white" />
                  </div>
                )}
              </button>
            )}
          </FocusItem>
        }
      />
    </SettingsSection>
  );
};
