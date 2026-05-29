import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudCog, HardDrive } from 'lucide-react';

import { FormRow } from '../../../../../../ui/layout/FormRow';
import { SettingsSection } from '../../../../../../ui/layout/SettingsSection';
import { OreButton } from '../../../../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../../../../ui/primitives/OreDropdown';
import type { ArrowPressHandler } from '../types';

interface WebDavSectionProps {
  configured: boolean;
  onOpen: () => void;
  onOpenManage: () => void;
  autoSyncInterval: '3h' | '12h' | '1d' | '3d' | '5d' | '7d' | 'off';
  onChangeAutoSyncInterval: (value: '3h' | '12h' | '1d' | '3d' | '5d' | '7d' | 'off') => void;
  onArrowPress: ArrowPressHandler;
}

export const WebDavSection: React.FC<WebDavSectionProps> = ({
  configured,
  onOpen,
  onOpenManage,
  autoSyncInterval,
  onChangeAutoSyncInterval,
  onArrowPress,
}) => {
  const { t } = useTranslation();

  const autoSyncIntervalOptions = useMemo(
    () => [
      { label: t('settings.data.webdav.intervals.3h'), value: '3h' },
      { label: t('settings.data.webdav.intervals.12h'), value: '12h' },
      { label: t('settings.data.webdav.intervals.1d'), value: '1d' },
      { label: t('settings.data.webdav.intervals.3d'), value: '3d' },
      { label: t('settings.data.webdav.intervals.5d'), value: '5d' },
      { label: t('settings.data.webdav.intervals.7d'), value: '7d' },
      { label: t('settings.data.webdav.intervals.off'), value: 'off' },
    ],
    [t]
  );

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
            className="w-[240px] justify-center whitespace-nowrap"
          >
            <CloudCog size={16} className="mr-1.5" />
            {configured ? t('settings.data.webdav.manage') : t('settings.data.webdav.configure')}
          </OreButton>
        }
      />

      <FormRow
        label={t('settings.data.webdav.manageBackups')}
        description={t('settings.data.webdav.manageBackupsDesc')}
        vertical={false}
        control={
          <OreButton
            variant="secondary"
            onClick={onOpenManage}
            focusKey="settings-data-webdav-manage"
            onArrowPress={onArrowPress}
            className="w-[240px] justify-center whitespace-nowrap"
          >
            <HardDrive size={16} className="mr-1.5" />
            {t('settings.data.webdav.manageBackups')}
          </OreButton>
        }
      />

      <FormRow
        label={t('settings.data.webdav.autoSyncInterval')}
        description={t('settings.data.webdav.autoSyncIntervalDesc')}
        vertical={false}
        control={
          <div className="w-[240px]">
            <OreDropdown
              options={autoSyncIntervalOptions}
              value={autoSyncInterval}
              onChange={(value) => onChangeAutoSyncInterval(value as '3h' | '12h' | '1d' | '3d' | '5d' | '7d' | 'off')}
              className="w-full"
              focusKey="settings-data-webdav-auto-sync"
              onArrowPress={onArrowPress}
            />
          </div>
        }
      />
    </SettingsSection>
  );
};
