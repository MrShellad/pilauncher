import { Sparkles, Type } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { AppearanceSettings } from '@/types/settings';
import { FormRow } from '../../../../../ui/layout/FormRow';
import { SettingsSection } from '../../../../../ui/layout/SettingsSection';
import { OreDropdown } from '../../../../../ui/primitives/OreDropdown';
import { OreSwitch } from '../../../../../ui/primitives/OreSwitch';
import type { AppearanceArrowHandler, UpdateAppearanceSetting } from './appearanceSettingsTypes';

interface TypographySettingsSectionProps {
  appearance: AppearanceSettings;
  updateAppearanceSetting: UpdateAppearanceSetting;
  fontOptions: Array<{ label: string; value: string }>;
  isLoadingFonts: boolean;
  onArrowPress: AppearanceArrowHandler;
}

export const TypographySettingsSection = ({
  appearance,
  updateAppearanceSetting,
  fontOptions,
  isLoadingFonts,
  onArrowPress,
}: TypographySettingsSectionProps) => {
  const { t } = useTranslation();

  return (
    <SettingsSection title={t('settings.appearance.sections.typography')} icon={<Sparkles size={18} />}>
      <FormRow
        className="relative z-50"
        label={t('settings.appearance.fontFamily')}
        description={t('settings.appearance.fontFamilyDesc')}
        control={
          <div className="flex items-center space-x-2">
            {isLoadingFonts && <Type size={16} className="animate-pulse text-ore-text-muted" />}
            <div className="relative focus-within:z-50 w-[240px]">
              <OreDropdown
                focusKey="settings-appearance-font"
                onArrowPress={onArrowPress}
                options={fontOptions}
                value={appearance.fontFamily}
                onChange={(value) => updateAppearanceSetting('fontFamily', value)}
                disabled={isLoadingFonts}
                searchable={true}
                className="w-full"
              />
            </div>
          </div>
        }
      />

      <FormRow
        className="relative z-40"
        label={t('settings.appearance.maskGradient')}
        description={t('settings.appearance.maskGradientDesc')}
        control={
          <OreSwitch
            focusKey="settings-appearance-gradient"
            onArrowPress={onArrowPress}
            checked={appearance.maskGradient}
            onChange={(value) => updateAppearanceSetting('maskGradient', value)}
          />
        }
      />
    </SettingsSection>
  );
};
