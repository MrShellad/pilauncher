import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Save, Loader2 } from 'lucide-react';

import { OreInput } from '../../../../../../ui/primitives/OreInput';
import { OreButton } from '../../../../../../ui/primitives/OreButton';
import { SettingsSection } from '../../../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../../../ui/layout/FormRow';

interface BasicInfoSectionProps {
  initialName: string;
  coverUrl?: string;
  isInitializing: boolean;
  onUpdateName: (newName: string) => Promise<void>;
  onUpdateCover: () => Promise<void>;
  onSuccess: (msg: string) => void;
  isGlobalSaving: boolean;
  setIsGlobalSaving: (val: boolean) => void;
}

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
  const [editName, setEditName] = useState(initialName || '');

  useEffect(() => {
    setEditName(initialName);
  }, [initialName]);

  const handleSaveName = async () => {
    if (editName !== initialName && editName.trim() !== '') {
      setIsGlobalSaving(true);
      await onUpdateName(editName);
      setIsGlobalSaving(false);
      onSuccess('名称已保存');
    } else {
      setEditName(initialName || '');
    }
  };

  const handleChangeCover = async () => {
    setIsGlobalSaving(true);
    await onUpdateCover();
    setIsGlobalSaving(false);
  };

  const isNameChanged = editName !== initialName && editName.trim() !== '';

  return (
    <SettingsSection title="基本信息" icon={<ImageIcon size={18} />}>
      <FormRow
        label="实例名称"
        description="用于在列表中显示的自定义名称。"
        className="!lg:items-center"
        control={
          <div className="flex items-center gap-3 w-full lg:w-[480px]">
            <OreInput
              focusKey="basic-input-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              disabled={isGlobalSaving || isInitializing}
              placeholder="输入实例名称"
              containerClassName="flex-1"
            />
            <OreButton
              focusKey="basic-btn-save-name"
              variant={isNameChanged ? 'primary' : 'secondary'}
              onClick={handleSaveName}
              disabled={!isNameChanged || isGlobalSaving || isInitializing}
              className="flex-shrink-0"
            >
              <Save size={16} className="mr-2" /> 保存
            </OreButton>
          </div>
        }
      />

      <FormRow
        label="实例封面"
        description="支持 .png 或 .jpg 格式，建议比例 16:9。"
        control={
          <div className="flex items-center gap-4">
            <div className="w-32 h-18 bg-[#141415] border-2 border-[#1E1E1F] rounded-sm flex items-center justify-center overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] relative">
              {coverUrl ? (
                <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon size={24} className="text-ore-text-muted opacity-60" />
              )}
              {isGlobalSaving && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-white" />
                </div>
              )}
            </div>
            <OreButton
              focusKey="basic-btn-change-cover"
              variant="secondary"
              onClick={handleChangeCover}
              disabled={isGlobalSaving || isInitializing}
            >
              更换封面
            </OreButton>
          </div>
        }
      />
    </SettingsSection>
  );
};
