import type React from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Crown, Image as ImageIcon } from 'lucide-react';

import type { AppearanceSettings } from '@/types/settings';
import { FocusItem } from '../../../../../ui/focus/FocusItem';
import { FormRow } from '../../../../../ui/layout/FormRow';
import { SettingsSection } from '../../../../../ui/layout/SettingsSection';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { OreSlider } from '../../../../../ui/primitives/OreSlider';
import type {
  AppearanceArrowHandler,
  AppearanceImageAction,
  UpdateAppearanceSetting,
} from './appearanceSettingsTypes';

interface DonorLogoSettingsSectionProps {
  appearance: AppearanceSettings;
  updateAppearanceSetting: UpdateAppearanceSetting;
  onSelectLogo: () => void;
  onRemoveLogo: AppearanceImageAction;
  onArrowPress: AppearanceArrowHandler;
}

export const DonorLogoSettingsSection = ({
  appearance,
  updateAppearanceSetting,
  onSelectLogo,
  onRemoveLogo,
  onArrowPress,
}: DonorLogoSettingsSectionProps) => (
  <SettingsSection title="自定义 Logo (赞助者专属)" icon={<Crown size={18} className="text-[#FFD700]" />}>
    <div className="p-6">
      <div className="group relative flex h-32 w-full flex-col items-center justify-center overflow-hidden border-2 border-dashed border-ore-gray-border bg-[#141415] transition-colors">
        {appearance.customLogo ? (
          <>
            <img
              src={convertFileSrc(appearance.customLogo)}
              alt="Custom Logo"
              className="h-full w-full object-contain p-4 transition-all"
              style={{ transform: `scale(${(appearance.customLogoScale ?? 100) / 100})` }}
            />
            <div className="absolute inset-0 z-10 flex items-center justify-center gap-4 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <OreButton
                variant="secondary"
                size="sm"
                onClick={onSelectLogo}
                focusKey="btn-logo-change"
                onArrowPress={onArrowPress}
              >
                更换 Logo
              </OreButton>
              <OreButton
                variant="danger"
                size="sm"
                onClick={onRemoveLogo}
                focusKey="btn-logo-remove"
                onArrowPress={onArrowPress}
              >
                移除 Logo
              </OreButton>
            </div>
          </>
        ) : (
          <FocusItem
            focusKey="btn-logo-add"
            onEnter={onSelectLogo}
            onArrowPress={onArrowPress}
          >
            {({ ref, focused }) => (
              <div
                ref={ref as React.RefObject<HTMLDivElement>}
                tabIndex={-1}
                onClick={onSelectLogo}
                className={`flex h-full w-full cursor-pointer flex-col items-center justify-center outline-none transition-all ${
                  focused
                    ? 'border-white bg-white/10 ring-2 ring-inset ring-white'
                    : 'hover:border-ore-green hover:bg-white/5'
                }`}
              >
                <div
                  className={`flex flex-col items-center transition-opacity ${
                    focused
                      ? 'text-white opacity-100'
                      : 'text-ore-text-muted opacity-60 group-hover:opacity-100'
                  }`}
                >
                  <ImageIcon size={32} className="mb-2" />
                  <span className="font-minecraft text-sm">选择自定义 Logo</span>
                </div>
              </div>
            )}
          </FocusItem>
        )}
      </div>
    </div>
    <FormRow
      label="Logo 大小"
      description="调节自定义 Logo 的缩放比例"
      vertical={true}
      control={
        <div className="w-full">
          <OreSlider
            focusKey="settings-appearance-logo-scale"
            onArrowPress={onArrowPress}
            value={appearance.customLogoScale ?? 100}
            min={10}
            max={200}
            step={5}
            valueFormatter={(value) => `${value}%`}
            onChange={(value) => updateAppearanceSetting('customLogoScale', value)}
          />
        </div>
      }
    />
  </SettingsSection>
);
