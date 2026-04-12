import React, { useState, useEffect, useMemo } from 'react';
import { Link2, Plus, Save, X } from 'lucide-react';
import { BUTTON_TYPES, getButtonIcon } from '../../../../../../ui/icons/SocialIcons';

import { OreInput } from '../../../../../../ui/primitives/OreInput';
import { OreButton } from '../../../../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../../../../ui/primitives/OreDropdown';
import { SettingsSection } from '../../../../../../ui/layout/SettingsSection';
import { FormRow } from '../../../../../../ui/layout/FormRow';
import { FocusItem } from '../../../../../../ui/focus/FocusItem';

import type { CustomButton } from '../../../../../../hooks/pages/InstanceDetail/useInstanceDetail';

interface CustomLinksSectionProps {
  initialButtons?: CustomButton[];
  isInitializing: boolean;
  onUpdateCustomButtons: (buttons: CustomButton[]) => Promise<void>;
  onSuccess: (msg: string) => void;
  isGlobalSaving: boolean;
  setIsGlobalSaving: (val: boolean) => void;
}

export const CustomLinksSection: React.FC<CustomLinksSectionProps> = ({
  initialButtons = [],
  isInitializing,
  onUpdateCustomButtons,
  onSuccess,
  isGlobalSaving,
  setIsGlobalSaving,
}) => {
  const [customButtons, setCustomButtons] = useState<CustomButton[]>(initialButtons);

  useEffect(() => {
    setCustomButtons(initialButtons);
  }, [initialButtons]);

  const handleSaveCustomButtons = async () => {
    setIsGlobalSaving(true);
    await onUpdateCustomButtons(customButtons);
    setIsGlobalSaving(false);
    onSuccess('自定义链接已保存');
  };

  const handleAddButton = () => {
    setCustomButtons([...customButtons, { type: 'wiki', url: '', label: '' }]);
  };

  const handleRemoveButton = (index: number) => {
    setCustomButtons(customButtons.filter((_, i) => i !== index));
  };

  const handleChangeButton = (index: number, field: keyof CustomButton, value: string) => {
    const newBtns = [...customButtons];
    newBtns[index] = { ...newBtns[index], [field]: value };
    setCustomButtons(newBtns);
  };

  const dropdownOptions = useMemo(() => {
    return BUTTON_TYPES.map(t => ({ label: t.label, value: t.value }));
  }, []);

  return (
    <SettingsSection title="自定义链接管理" icon={<Link2 size={18} />}>
      <FormRow
        label="快速链接"
        description="为整合包添加快速链接按钮（如 Wiki、社区、官网等），将展示在主页和概览页。留空标题时将使用平台名称。"
        vertical
        control={
          <div className="w-full space-y-3">
            {customButtons.map((btn, idx) => {
              const IconComp = getButtonIcon(btn.type);
              return (
                <div
                  key={idx}
                  className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 p-3 bg-[#18181B] border-2 border-[#2A2A2C] rounded-sm transition-colors hover:border-[#3A3A3C]"
                >
                  <div className="w-full lg:w-[160px] flex-shrink-0">
                    <OreDropdown
                      focusKey={`btn-type-select-${idx}`}
                      options={dropdownOptions}
                      value={btn.type}
                      onChange={(val) => handleChangeButton(idx, 'type', val)}
                      disabled={isGlobalSaving || isInitializing}
                      prefixNode={<IconComp size={18} />}
                      className="w-full"
                    />
                  </div>

                  <div className="w-full lg:w-[140px] flex-shrink-0">
                    <OreInput
                      focusKey={`btn-label-${idx}`}
                      value={btn.label || ''}
                      onChange={(e) => handleChangeButton(idx, 'label', e.target.value)}
                      disabled={isGlobalSaving || isInitializing}
                      placeholder="自定义标题"
                    />
                  </div>

                  <div className="flex-1 w-full min-w-0">
                    <OreInput
                      focusKey={`btn-url-${idx}`}
                      value={btn.url}
                      onChange={(e) => handleChangeButton(idx, 'url', e.target.value)}
                      disabled={isGlobalSaving || isInitializing}
                      placeholder="https://..."
                    />
                  </div>

                  <FocusItem focusKey={`btn-remove-${idx}`}>
                    {({ ref, focused }) => (
                      <button
                        ref={ref as any}
                        onClick={() => handleRemoveButton(idx)}
                        disabled={isGlobalSaving || isInitializing}
                        className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-sm outline-none transition-all ${
                          focused
                            ? 'bg-red-500/20 text-red-400 ring-2 ring-red-400'
                            : 'text-ore-text-muted hover:text-white hover:bg-[#2A2A2C]'
                        } disabled:opacity-40`}
                        title="删除链接"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </FocusItem>
                </div>
              );
            })}

            {customButtons.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-[#1E1E1F] rounded-sm bg-[#141415]/20">
                <Link2 size={24} className="text-ore-text-muted opacity-40 mb-2" />
                <span className="text-sm text-ore-text-muted font-minecraft">暂无自定义链接，点击下方添加</span>
              </div>
            )}
          </div>
        }
      />

      <FormRow
        label="管理链接"
        control={
          <div className="flex items-center gap-3">
            <OreButton
              focusKey="btn-add-link"
              variant="secondary"
              onClick={handleAddButton}
              disabled={isGlobalSaving || isInitializing}
            >
              <Plus size={16} className="mr-1.5" /> 添加链接
            </OreButton>
            <OreButton
              focusKey="btn-save-links"
              variant="primary"
              onClick={handleSaveCustomButtons}
              disabled={isGlobalSaving || isInitializing || customButtons.length === 0}
            >
              <Save size={16} className="mr-1.5" /> 保存配置
            </OreButton>
          </div>
        }
      />
    </SettingsSection>
  );
};
