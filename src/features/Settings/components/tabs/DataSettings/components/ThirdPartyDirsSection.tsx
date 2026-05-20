import React from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, FolderOpen, Trash2 } from 'lucide-react';

import { FormRow } from '../../../../../../ui/layout/FormRow';
import { SettingsSection } from '../../../../../../ui/layout/SettingsSection';
import { OreButton } from '../../../../../../ui/primitives/OreButton';
import type { ArrowPressHandler } from '../types';

interface ThirdPartyDirsSectionProps {
  thirdPartyDirs: string[];
  onRemoveDir: (dir: string) => void;
  onArrowPress: ArrowPressHandler;
}

export const ThirdPartyDirsSection: React.FC<ThirdPartyDirsSectionProps> = ({
  thirdPartyDirs,
  onRemoveDir,
  onArrowPress
}) => {
  const { t } = useTranslation();

  return (
    <SettingsSection title={t('settings.data.sections.thirdParty')} icon={<Archive size={18} />}>
      {thirdPartyDirs.length === 0 ? (
        <FormRow
          label={t('settings.data.thirdPartyList')}
          description={t('settings.data.thirdPartyListDesc1')}
          vertical={false}
          control={
            <div className="text-[length:var(--ore-typography-size-sm)] font-minecraft text-[color:var(--ore-color-text-muted-default)] px-[var(--ore-spacing-base)] py-[var(--ore-spacing-sm)] border-2 border-dashed border-[color:var(--ore-color-border-neutral-default)]">
              {t('settings.data.noThirdParty')}
            </div>
          }
        />
      ) : (
        thirdPartyDirs.map((dir, idx) => (
          <FormRow
            key={dir}
            label={
              <div className="flex items-center space-x-2 overflow-hidden max-w-sm lg:max-w-md xl:max-w-xl">
                <FolderOpen size={18} className="text-ore-orange flex-shrink-0" />
                <span className="text-white font-minecraft text-base truncate flex-1" title={dir}>
                  {dir}
                </span>
              </div>
            }
            description={idx === 0 ? t('settings.data.thirdPartyListDesc2') : undefined}
            vertical={false}
            control={
              <OreButton
                variant="danger"
                size="auto"
                onClick={() => onRemoveDir(dir)}
                focusKey={`settings-data-remove-dir-${idx}`}
                onArrowPress={onArrowPress}
                className="w-[200px] justify-center whitespace-nowrap"
              >
                <Trash2 size={14} className="mr-1.5" />
                {t('settings.data.btnRemove')}
              </OreButton>
            }
          />
        ))
      )}
    </SettingsSection>
  );
};
