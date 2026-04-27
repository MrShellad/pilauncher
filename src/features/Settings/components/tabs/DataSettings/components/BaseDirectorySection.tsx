import React from 'react';
import { useTranslation } from 'react-i18next';
import { Database, Edit2, FileX, LogOut, Trash2 } from 'lucide-react';

import { FormRow } from '../../../../../../ui/layout/FormRow';
import { SettingsSection } from '../../../../../../ui/layout/SettingsSection';
import { OreButton } from '../../../../../../ui/primitives/OreButton';
import type { ArrowPressHandler } from '../types';

interface BaseDirectorySectionProps {
  basePath: string;
  onOpenBrowser: () => void;
  onOpenRename: () => void;
  onOpenCleanLogs: () => void;
  onOpenRemoteLogs: () => void;
  onArrowPress: ArrowPressHandler;
}

export const BaseDirectorySection: React.FC<BaseDirectorySectionProps> = ({
  basePath,
  onOpenBrowser,
  onOpenRename,
  onOpenCleanLogs,
  onOpenRemoteLogs,
  onArrowPress
}) => {
  const { t } = useTranslation();

  return (
    <SettingsSection title={t('settings.data.sections.core')} icon={<Database size={18} />}>
      <FormRow
        label={t('settings.data.coreLocation')}
        description={t('settings.data.currentLoc', { path: basePath || t('settings.java.selector.placeholder') })}
        vertical={false}
        control={
          <OreButton
            variant="secondary"
            onClick={onOpenBrowser}
            focusKey="settings-data-modify-dir"
            onArrowPress={onArrowPress}
            className="w-[200px] justify-center whitespace-nowrap"
          >
            <LogOut size={16} className="mr-1.5" /> {t('settings.data.btnModify')}
          </OreButton>
        }
      />

      <FormRow
        label={t('settings.data.renameDir')}
        description={t('settings.data.renameDirDesc')}
        vertical={false}
        control={
          <OreButton
            variant="secondary"
            onClick={onOpenRename}
            focusKey="settings-data-rename-dir"
            onArrowPress={onArrowPress}
            className="w-[200px] justify-center whitespace-nowrap"
          >
            <Edit2 size={16} className="mr-1.5" /> {t('settings.data.btnRename')}
          </OreButton>
        }
      />

      <FormRow
        label={t('settings.data.cleanLogs')}
        description={t('settings.data.cleanLogsDesc', { path: basePath ? basePath + '/logs' : '' })}
        vertical={false}
        control={
          <OreButton
            variant="danger"
            onClick={onOpenCleanLogs}
            focusKey="settings-data-clean-logs"
            onArrowPress={onArrowPress}
            className="w-[200px] justify-center whitespace-nowrap"
          >
            <FileX size={16} className="mr-1.5" /> {t('settings.data.btnCleanLogs')}
          </OreButton>
        }
      />

      <FormRow
        label="远端日志历史"
        description="查看已上传到 LogShare.CN 的日志，并使用保存的删除 token 移除远端日志。"
        vertical={false}
        control={
          <OreButton
            variant="secondary"
            onClick={onOpenRemoteLogs}
            focusKey="settings-data-remote-logs"
            onArrowPress={onArrowPress}
            className="w-[200px] justify-center whitespace-nowrap"
          >
            <Trash2 size={16} className="mr-1.5" /> 管理远端日志
          </OreButton>
        }
      />
    </SettingsSection>
  );
};
