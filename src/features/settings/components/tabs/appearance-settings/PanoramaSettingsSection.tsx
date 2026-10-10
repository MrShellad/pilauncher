import { Image as ImageIcon, Loader2, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { AppearanceSettings } from '@/types/settings';
import { FormRow } from '../../../../../ui/layout/FormRow';
import { SettingsSection } from '../../../../../ui/layout/SettingsSection';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../../../ui/primitives/OreDropdown';
import { OreSlider } from '../../../../../ui/primitives/OreSlider';
import { OreSwitch } from '../../../../../ui/primitives/OreSwitch';
import type { AppearanceArrowHandler, UpdateAppearanceSetting } from './appearanceSettingsTypes';

interface PanoramaSettingsSectionProps {
  appearance: AppearanceSettings;
  updateAppearanceSetting: UpdateAppearanceSetting;
  panoramaSetOptions: Array<{ label: string; value: string }>;
  selectedPanoramaSet: string;
  isImportingPanorama: boolean;
  panoramaImportError: string | null;
  onSelectPanoramaSet: (setName: string) => void;
  onImportPanorama: () => void;
  onArrowPress: AppearanceArrowHandler;
}

export const PanoramaSettingsSection = ({
  appearance,
  updateAppearanceSetting,
  panoramaSetOptions,
  selectedPanoramaSet,
  isImportingPanorama,
  panoramaImportError,
  onSelectPanoramaSet,
  onImportPanorama,
  onArrowPress,
}: PanoramaSettingsSectionProps) => {
  const { t } = useTranslation();

  return (
    <SettingsSection title={t('settings.appearance.sections.dynamicBackground', '动态背景')} icon={<ImageIcon size={18} />}>
      <FormRow
        label={t('settings.appearance.panoramaEnabled')}
        description={t('settings.appearance.panoramaEnabledDesc')}
        control={
          <OreSwitch
            focusKey="settings-appearance-panorama-enabled"
            onArrowPress={onArrowPress}
            checked={appearance.panoramaEnabled}
            onChange={(value) => updateAppearanceSetting('panoramaEnabled', value)}
          />
        }
      />

      <FormRow
        label="全景图资源"
        description="从 MC 材质包中导入全景图，或选择已导入的全景图组。"
        vertical
        control={
          <div className="flex w-full flex-col gap-3">
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
              {panoramaSetOptions.length > 0 && (
                <div className="min-w-0 flex-1">
                  <OreDropdown
                    focusKey="settings-appearance-panorama-set"
                    onArrowPress={onArrowPress}
                    options={panoramaSetOptions}
                    value={selectedPanoramaSet}
                    onChange={onSelectPanoramaSet}
                    placeholder="选择全景图组..."
                    disabled={!appearance.panoramaEnabled}
                  />
                </div>
              )}
              <OreButton
                focusKey="settings-appearance-panorama-import"
                onArrowPress={onArrowPress}
                variant="secondary"
                size="auto"
                onClick={onImportPanorama}
                disabled={!appearance.panoramaEnabled || isImportingPanorama}
                className="shrink-0 !min-w-[9rem] !h-10 !px-4 !justify-center gap-1.5 whitespace-nowrap"
              >
                {isImportingPanorama ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Package size={16} />
                )}
                从材质包导入
              </OreButton>
            </div>
            {panoramaImportError && (
              <p className="text-sm text-red-400 font-minecraft leading-relaxed">
                {panoramaImportError}
              </p>
            )}
            {panoramaSetOptions.length === 0 && !isImportingPanorama && (
              <p className="text-xs text-ore-text-muted font-minecraft">
                暂无已导入的全景图。选择包含全景图的 MC 材质包 (.zip) 即可自动提取。
              </p>
            )}
          </div>
        }
      />

      <FormRow
        label={t('settings.appearance.panoramaSpeed')}
        description={t('settings.appearance.panoramaSpeedDesc')}
        vertical={true}
        control={
          <div className="w-full">
            <OreSlider
              focusKey="settings-appearance-panorama-speed"
              onArrowPress={onArrowPress}
              value={appearance.panoramaRotationSpeed}
              min={0}
              max={0.12}
              step={0.002}
              valueFormatter={(value) => `${value.toFixed(3)} rad/s`}
              onChange={(value) =>
                updateAppearanceSetting('panoramaRotationSpeed', Number(value.toFixed(3)))
              }
              disabled={!appearance.panoramaEnabled}
            />
          </div>
        }
      />

      <FormRow
        label={t('settings.appearance.panoramaDirection')}
        description={t('settings.appearance.panoramaDirectionDesc', {
          dir: appearance.panoramaRotationDirection === 'clockwise'
            ? t('settings.appearance.clockwise')
            : t('settings.appearance.counterclockwise'),
        })}
        control={
          <OreSwitch
            focusKey="settings-appearance-panorama-direction"
            onArrowPress={onArrowPress}
            checked={appearance.panoramaRotationDirection === 'clockwise'}
            onChange={(value) =>
              updateAppearanceSetting(
                'panoramaRotationDirection',
                value ? 'clockwise' : 'counterclockwise',
              )
            }
            disabled={!appearance.panoramaEnabled}
          />
        }
      />
    </SettingsSection>
  );
};
