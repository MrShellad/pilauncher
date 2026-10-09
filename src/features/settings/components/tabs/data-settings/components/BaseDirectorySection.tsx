import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Database, Edit2, FileX, LogOut, Trash2, FolderKanban, Layers, Loader2 } from 'lucide-react';

import { FormRow } from '../../../../../../ui/layout/FormRow';
import { SettingsSection } from '../../../../../../ui/layout/SettingsSection';
import { OreButton } from '../../../../../../ui/primitives/OreButton';
import type { ArrowPressHandler } from '../types';

interface BaseDirectorySectionProps {
  basePath: string;
  isMigrating: boolean;
  migrationWarning: string | null;
  onOpenBrowser: () => void;
  onOpenRename: () => void;
  onOpenCleanLogs: () => void;
  onOpenRemoteLogs: () => void;
  onOpenManageInstances: () => void;
  onOpenManageVersions: () => void;
  onArrowPress: ArrowPressHandler;
}

export const BaseDirectorySection: React.FC<BaseDirectorySectionProps> = ({
  basePath,
  isMigrating,
  migrationWarning,
  onOpenBrowser,
  onOpenRename,
  onOpenCleanLogs,
  onOpenRemoteLogs,
  onOpenManageInstances,
  onOpenManageVersions,
  onArrowPress
}) => {
  const { t } = useTranslation();

  return (
    <SettingsSection title={t('settings.data.sections.core')} icon={<Database size={18} />}>
      <FormRow
        label={t('settings.data.coreLocation')}
        description={
          <div className="space-y-2">
            <div>{t('settings.data.currentLoc', { path: basePath || t('settings.java.selector.placeholder') })}</div>
            {migrationWarning && (
              <div className="flex items-start gap-2 text-amber-300">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>{migrationWarning}</span>
              </div>
            )}
          </div>
        }
        vertical={false}
        control={
          <OreButton
            variant="secondary"
            onClick={onOpenBrowser}
            focusKey="settings-data-modify-dir"
            onArrowPress={onArrowPress}
            disabled={isMigrating}
            className="w-[240px] justify-center whitespace-nowrap"
          >
            {isMigrating ? <Loader2 size={16} className="mr-1.5 animate-spin" /> : <LogOut size={16} className="mr-1.5" />}
            {isMigrating ? t('settings.data.migrating') : t('settings.data.btnModify')}
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
            disabled={isMigrating}
            className="w-[240px] justify-center whitespace-nowrap"
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
            className="w-[240px] justify-center whitespace-nowrap"
          >
            <FileX size={16} className="mr-1.5" /> {t('settings.data.btnCleanLogs')}
          </OreButton>
        }
      />

      <FormRow
        label={t('settings.data.remoteLogs.title')}
        description={t('settings.data.remoteLogs.description')}
        vertical={false}
        control={
          <OreButton
            variant="secondary"
            onClick={onOpenRemoteLogs}
            focusKey="settings-data-remote-logs"
            onArrowPress={onArrowPress}
            className="w-[240px] justify-center whitespace-nowrap"
          >
            <Trash2 size={16} className="mr-1.5" /> {t('settings.data.remoteLogs.manage')}
          </OreButton>
        }
      />

      <FormRow
        label={t('settings.data.manageInstances.label', '本地实例管理')}
        description={t('settings.data.manageInstances.description', '统一查看并快速删除本地的实例。')}
        vertical={false}
        control={
          <OreButton
            variant="secondary"
            onClick={onOpenManageInstances}
            focusKey="settings-data-manage-instances"
            onArrowPress={onArrowPress}
            className="w-[240px] justify-center whitespace-nowrap"
          >
            <FolderKanban size={16} className="mr-1.5" /> {t('settings.data.manageInstances.btn', '管理本地实例')}
          </OreButton>
        }
      />

      <FormRow
        label={t('settings.data.manageVersions.label', '本地版本核心管理')}
        description={t('settings.data.manageVersions.description', '查看并清理本地已下载的 Minecraft 游戏核心和加载器核心文件。')}
        vertical={false}
        control={
          <OreButton
            variant="secondary"
            onClick={onOpenManageVersions}
            focusKey="settings-data-manage-versions"
            onArrowPress={onArrowPress}
            className="w-[240px] justify-center whitespace-nowrap"
          >
            <Layers size={16} className="mr-1.5" /> {t('settings.data.manageVersions.btn', '管理版本核心')}
          </OreButton>
        }
      />
    </SettingsSection>
  );
};
