import React from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

import { OreButton } from '../../../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../../../ui/primitives/OreModal';
import type { CleanLogsPhase } from '../types';

interface CleanLogsDialogProps {
  phase: CleanLogsPhase;
  count: number;
  error: string;
  basePath: string;
  onClose: () => void;
  onClean: () => Promise<void>;
}

export const CleanLogsDialog: React.FC<CleanLogsDialogProps> = ({
  phase,
  count,
  error,
  basePath,
  onClose,
  onClean
}) => {
  const { t } = useTranslation();

  return (
    <OreModal
      isOpen={phase !== 'idle'}
      onClose={onClose}
      title={t('settings.data.cleanLogsTitle')}
      hideCloseButton={phase === 'cleaning'}
      closeOnOutsideClick={phase !== 'cleaning'}
      className="w-[440px]"
      actions={
        <div className="flex flex-row gap-3 justify-end">
          {phase === 'confirm' && (
            <>
              <OreButton
                variant="secondary"
                onClick={onClose}
                focusKey="clean-logs-cancel"
                className="min-w-[110px] justify-center whitespace-nowrap"
              >
                {t('settings.data.btnCancel')}
              </OreButton>
              <OreButton
                variant="danger"
                onClick={() => void onClean()}
                focusKey="clean-logs-confirm"
                className="min-w-[110px] justify-center whitespace-nowrap"
              >
                {t('settings.data.btnConfirmClean')}
              </OreButton>
            </>
          )}
          {phase !== 'confirm' && phase !== 'cleaning' && (
            <OreButton
              variant="primary"
              onClick={onClose}
              focusKey="clean-logs-done"
              className="min-w-[110px] justify-center whitespace-nowrap"
            >
              {t('settings.data.btnDone')}
            </OreButton>
          )}
        </div>
      }
    >
      <div className="relative h-[140px] overflow-hidden">
        <AnimatePresence mode="wait">
          {phase === 'confirm' && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 flex flex-col justify-center gap-3"
            >
              <p className="text-ore-text">{t('settings.data.cleanLogsConfirmTitle')}</p>
              <p className="text-ore-text-muted text-xs">
                {t('settings.data.cleanLogsConfirmDesc', {
                  path: basePath ? basePath + '/logs' : t('settings.java.selector.placeholder')
                })}
              </p>
            </motion.div>
          )}

          {phase === 'cleaning' && (
            <motion.div
              key="cleaning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4"
            >
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                <Loader2 size={36} className="text-ore-green" />
              </motion.div>
              <p className="text-ore-text-muted text-sm">{t('settings.data.cleaning')}</p>
            </motion.div>
          )}

          {phase === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.93 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            >
              <CheckCircle2 size={36} className="text-ore-green" />
              <p className="text-ore-text font-bold">{t('settings.data.cleanSuccess')}</p>
              <p className="text-ore-text-muted text-sm">{t('settings.data.cleanSuccessDesc', { count })}</p>
            </motion.div>
          )}

          {phase === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.93 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            >
              <AlertCircle size={36} className="text-red-400" />
              <p className="text-ore-text font-bold">{t('settings.data.cleanFailed')}</p>
              <p className="text-ore-text-muted text-xs break-all text-center">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </OreModal>
  );
};
