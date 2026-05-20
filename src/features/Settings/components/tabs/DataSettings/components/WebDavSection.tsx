import React from 'react';
import { useTranslation } from 'react-i18next';
import { CloudCog } from 'lucide-react';

import { FormRow } from '../../../../../../ui/layout/FormRow';
import { SettingsSection } from '../../../../../../ui/layout/SettingsSection';
import { OreButton } from '../../../../../../ui/primitives/OreButton';
import type { ArrowPressHandler } from '../types';

interface WebDavSectionProps {
  configured: boolean;
  onOpen: () => void;
  onArrowPress: ArrowPressHandler;
}

export const WebDavSection: React.FC<WebDavSectionProps> = ({
  configured,
  onOpen,
  onArrowPress,
}) => {
  const { t } = useTranslation();

  return (
    <SettingsSection title={t('settings.data.webdav.title')} icon={<CloudCog size={18} />}>
      <FormRow
        label="WebDAV"
        description={
          configured
            ? t('settings.data.webdav.configuredDesc')
            : t('settings.data.webdav.unconfiguredDesc')
        }
        vertical={false}
        control={
          <OreButton
            variant="secondary"
            onClick={onOpen}
            focusKey="settings-data-webdav"
            onArrowPress={onArrowPress}
            className="w-[200px] justify-center whitespace-nowrap"
          >
            <CloudCog size={16} className="mr-1.5" />
            {configured ? t('settings.data.webdav.manage') : t('settings.data.webdav.configure')}
          </OreButton>
        }
      />
    </SettingsSection>
  );
};
