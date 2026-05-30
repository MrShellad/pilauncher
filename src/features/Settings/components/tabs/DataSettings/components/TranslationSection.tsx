import React from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';

import { FormRow } from '../../../../../../ui/layout/FormRow';
import { SettingsSection } from '../../../../../../ui/layout/SettingsSection';
import { OreButton } from '../../../../../../ui/primitives/OreButton';
import type { ArrowPressHandler } from '../types';

interface TranslationSectionProps {
  onOpen: () => void;
  onArrowPress: ArrowPressHandler;
}

export const TranslationSection: React.FC<TranslationSectionProps> = ({ onOpen, onArrowPress }) => {
  const { t } = useTranslation();

  return (
    <SettingsSection title={t('settings.data.translation.title', '翻译 API')} icon={<Languages size={18} />}>
      <FormRow
        label={t('settings.data.translation.label', '第三方翻译接口')}
        description={t('settings.data.translation.desc', '配置腾讯翻译等第三方翻译服务，用于模组详情和更新日志翻译。')}
        vertical={false}
        control={
          <OreButton
            variant="secondary"
            onClick={onOpen}
            focusKey="settings-data-translation-api"
            onArrowPress={onArrowPress}
            className="w-[240px] justify-center whitespace-nowrap"
          >
            <Languages size={16} className="mr-1.5" />
            {t('settings.data.translation.button', '配置翻译')}
          </OreButton>
        }
      />
    </SettingsSection>
  );
};
