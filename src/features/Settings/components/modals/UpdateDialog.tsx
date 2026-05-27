// src/features/Settings/components/modals/UpdateDialog.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Download, Bell, Sparkles, CheckCircle2 } from 'lucide-react';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { OreButton } from '../../../../ui/primitives/OreButton';

export interface UpdateInfo {
  version: string;
  body?: string;
  date?: string;
  canInstall?: boolean;
  packageFormat?: string;
}

interface UpdateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: UpdateInfo | null;
  isInstalling: boolean;
  onConfirm: () => void;
}

const INSTALL_FOCUS_KEY = 'update-dialog-install';
const LATER_FOCUS_KEY = 'update-dialog-later';
const ACTION_ICON_SIZE = '1rem';
const VERSION_ICON_SIZE = '1.375rem';

export const UpdateDialog: React.FC<UpdateDialogProps> = ({
  isOpen,
  onClose,
  updateInfo,
  isInstalling,
  onConfirm,
}) => {
  const { t } = useTranslation();
  if (!updateInfo) return null;
  const requiresExternalUpdate = updateInfo.canInstall === false;

  const renderChangelog = (body?: string) => {
    if (!body) {
      return (
        <p className="font-minecraft text-[0.9375rem] leading-[1.5rem] text-ore-text-muted">
          {t('settings.update.noChangelog')}
        </p>
      );
    }

    const lines = body.split('\n');
    return (
      <div className="space-y-[0.25rem]">
        {lines.map((line, i) => {
          if (line.startsWith('### ')) {
            return (
              <h3
                key={i}
                className="mb-[0.25rem] mt-[0.75rem] font-minecraft text-[0.9375rem] font-bold leading-[1.375rem] text-white first:mt-0"
              >
                {line.replace('### ', '')}
              </h3>
            );
          }

          if (line.startsWith('## ')) {
            return (
              <h2
                key={i}
                className="mb-[0.25rem] mt-[0.75rem] font-minecraft text-[1rem] font-bold leading-[1.5rem] text-ore-green first:mt-0"
              >
                {line.replace('## ', '')}
              </h2>
            );
          }

          if (line.startsWith('- ') || line.startsWith('* ')) {
            return (
              <div
                key={i}
                className="flex items-start gap-[0.625rem] font-minecraft text-[0.9375rem] leading-[1.5rem] text-ore-text-muted"
              >
                <span className="mt-[0.5625rem] h-[0.375rem] w-[0.375rem] flex-shrink-0 bg-ore-green" />
                <span className="min-w-0">{line.replace(/^[-*] /, '')}</span>
              </div>
            );
          }

          if (line.trim() === '') {
            return <div key={i} className="h-[0.25rem]" />;
          }

          return (
            <p key={i} className="font-minecraft text-[0.9375rem] leading-[1.5rem] text-ore-text-muted">
              {line}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('settings.update.title')}
      className="w-[min(36rem,calc(100vw-2rem))]"
      contentClassName="overflow-y-auto p-[1.5rem] custom-scrollbar"
      defaultFocusKey={INSTALL_FOCUS_KEY}
      closeOnOutsideClick={!isInstalling}
      actionsClassName="px-[1.5rem] py-[1.125rem]"
      actions={
        <div className="flex w-full justify-center gap-3">
          <OreButton
            focusKey={LATER_FOCUS_KEY}
            variant="secondary"
            size="full"
            onClick={onClose}
            disabled={isInstalling}
            className="flex-1 gap-2"
          >
            <Bell size={ACTION_ICON_SIZE} />
            {t('settings.update.later')}
          </OreButton>

          <OreButton
            focusKey={INSTALL_FOCUS_KEY}
            variant="primary"
            size="full"
            onClick={requiresExternalUpdate ? onClose : onConfirm}
            disabled={isInstalling}
            className="flex-1 gap-2"
          >
            {requiresExternalUpdate ? (
              <>
                <CheckCircle2 size={ACTION_ICON_SIZE} />
                {t('settings.update.externalAcknowledge')}
              </>
            ) : isInstalling ? (
              <>
                <Loader2 size={ACTION_ICON_SIZE} className="animate-spin" />
                {t('settings.update.installing')}
              </>
            ) : (
              <>
                <Download size={ACTION_ICON_SIZE} />
                {t('settings.update.installNow')}
              </>
            )}
          </OreButton>
        </div>
      }
    >
      <div className="flex flex-col gap-[1.25rem]">
        <div className="flex items-center gap-[0.875rem] border-[0.125rem] border-ore-green/20 bg-ore-green/10 p-[1rem]">
          <div className="flex h-[2.75rem] w-[2.75rem] flex-shrink-0 items-center justify-center bg-ore-green/20">
            <Sparkles size={VERSION_ICON_SIZE} className="text-ore-green" />
          </div>
          <div className="min-w-0">
            <p className="mb-[0.25rem] font-minecraft text-[0.8125rem] leading-[1rem] text-ore-text-muted">
              {t('settings.update.latestVersion')}
            </p>
            <p className="font-minecraft text-[1.375rem] font-bold leading-[1.75rem] tracking-normal text-ore-green">
              v{updateInfo.version}
            </p>
          </div>
        </div>

        <div>
          <p className="mb-[0.5rem] font-minecraft text-[0.8125rem] leading-[1rem] uppercase tracking-normal text-ore-text-muted">
            {t('settings.update.changelog')}
          </p>
          <div className="max-h-[14rem] overflow-y-auto border-[0.125rem] border-white/5 bg-black/30 p-[1rem] custom-scrollbar">
            {renderChangelog(updateInfo.body)}
          </div>
        </div>

        <p className="px-[0.5rem] text-center font-minecraft text-[0.875rem] leading-[1.375rem] text-ore-text-muted">
          {requiresExternalUpdate
            ? t('settings.update.flatpakNotice')
            : t('settings.update.notice')}
        </p>
      </div>
    </OreModal>
  );
};
