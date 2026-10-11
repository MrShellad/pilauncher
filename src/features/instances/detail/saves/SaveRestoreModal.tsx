import React from 'react';
import { CheckCircle2, Loader2, RotateCcw, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ControlHint } from '../../../../ui/components/ControlHint';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { useInputMode } from '../../../../ui/focus/FocusProvider';
import { useLinearNavigation } from '../../../../ui/focus/useLinearNavigation';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import type { SaveBackupMetadata } from '../logic/saveService';
import { SaveRestoreDetails } from './SaveRestoreDetails';
import {
  localizeRestoreError,
  localizeRestoreWarning,
} from './saveRestorePresentation';
import { useSaveRestoreController } from './useSaveRestoreController';

interface SaveRestoreModalProps {
  instanceId: string;
  backupMeta: SaveBackupMetadata | null;
  isRestoring: boolean;
  formatDate: (timestamp: number) => string;
  formatSize: (bytes: number) => string;
  onClose: () => void;
  onConfirmRestore: (payload: { backupId: string; restoreConfigs: boolean }) => Promise<void>;
}

type ActiveSaveRestoreModalProps = Omit<SaveRestoreModalProps, 'backupMeta'> & {
  backupMeta: SaveBackupMetadata;
};

const ActiveSaveRestoreModal: React.FC<ActiveSaveRestoreModalProps> = ({
  instanceId,
  backupMeta,
  isRestoring,
  formatDate,
  formatSize,
  onClose,
  onConfirmRestore,
}) => {
  const { t } = useTranslation();
  const inputMode = useInputMode();
  const {
    scrollRef,
    isVerifying,
    verifyResult,
    restoreConfigs,
    errorMessage,
    focusOrder,
    toggleRestoreConfigs,
    handleRestore,
  } = useSaveRestoreController({ instanceId, backupMeta, onConfirmRestore });
  const { handleLinearArrow } = useLinearNavigation(
    focusOrder,
    focusOrder[0],
    false,
    !isVerifying
  );

  const warnings = verifyResult?.warnings ?? [];
  const localizedWarnings = warnings.map((warning) => localizeRestoreWarning(t, warning));
  const localizedError = errorMessage ? localizeRestoreError(t, errorMessage) : null;
  const isSafe = warnings.length === 0 && !localizedError;
  const canConfirmRestore = !isVerifying && !isRestoring && !!verifyResult && !localizedError;

  const actions = (
    <div className="ore-save-restore-modal__footer">
      {verifyResult?.canRestoreConfigs && !isVerifying && (
        <div className="ore-save-restore-modal__option ore-save-restore-modal__footer-option">
          <FocusItem
            focusKey="save-restore-toggle-configs"
            onEnter={toggleRestoreConfigs}
            onArrowPress={handleLinearArrow}
          >
            {({ ref, focused }) => (
              <button
                ref={ref as React.RefObject<HTMLButtonElement>}
                type="button"
                onClick={toggleRestoreConfigs}
                className={`ore-save-restore-modal__toggle ${focused ? 'is-focused' : ''}`}
              >
                <span
                  className={`ore-save-restore-modal__checkbox ${
                    restoreConfigs ? 'is-checked' : ''
                  }`}
                >
                  <CheckCircle2 size={14} />
                </span>

                <span className="min-w-0">
                  <span className="ore-save-restore-modal__option-title font-minecraft">
                    {t('saves.restoreModal.toggle.title', {
                      defaultValue: 'Restore Config Files Too',
                    })}
                  </span>
                  <span className="ore-save-restore-modal__option-text">
                    {t('saves.restoreModal.toggle.description', {
                      defaultValue:
                        'This replaces the current `config` and `defaultconfigs`. Enable it when you want a full rollback of both the world and configs.',
                    })}
                  </span>
                </span>
              </button>
            )}
          </FocusItem>
        </div>
      )}

      {inputMode === 'controller' && (
        <div className="ore-save-restore-modal__footer-meta">
          <div className="ore-save-restore-modal__scroll-hint">
            <ControlHint label="RS" variant="keyboard" tone="dark" />
            <span>
              {t('saves.restoreModal.hints.scrollInfo', {
                defaultValue: 'Right stick scrolls the details',
              })}
            </span>
          </div>
        </div>
      )}

      <div className="ore-save-restore-modal__actions">
        <OreButton
          focusKey="btn-cancel-restore"
          variant="secondary"
          size="full"
          onArrowPress={handleLinearArrow}
          onClick={onClose}
          className="ore-save-restore-modal__action-button"
        >
          <XCircle size={18} className="mr-2" />
          {t('saves.restoreModal.actions.cancel', { defaultValue: 'Cancel' })}
        </OreButton>

        <OreButton
          focusKey="btn-confirm-restore"
          variant={isSafe ? 'primary' : 'danger'}
          size="full"
          onArrowPress={handleLinearArrow}
          onClick={handleRestore}
          disabled={!canConfirmRestore}
          className="ore-save-restore-modal__action-button"
        >
          {isVerifying || isRestoring ? (
            <Loader2 size={18} className="mr-2 animate-spin" />
          ) : (
            <RotateCcw size={18} className="mr-2" />
          )}
          {isSafe
            ? t('saves.restoreModal.actions.confirm', {
                defaultValue: 'Confirm Restore',
              })
            : t('saves.restoreModal.actions.proceed', {
                defaultValue: 'Continue Restore',
              })}
        </OreButton>
      </div>
    </div>
  );

  return (
    <OreModal
      isOpen
      onClose={onClose}
      title={t('saves.restoreModal.title', { defaultValue: 'Restore Save Backup' })}
      className="ore-save-restore-modal"
      contentClassName="ore-save-restore-modal__content"
      defaultFocusKey={focusOrder[0]}
      actions={actions}
    >
      <SaveRestoreDetails
        backupMeta={backupMeta}
        verifyResult={verifyResult}
        isVerifying={isVerifying}
        localizedWarnings={localizedWarnings}
        localizedError={localizedError}
        formatDate={formatDate}
        formatSize={formatSize}
        scrollRef={scrollRef}
      />
    </OreModal>
  );
};

export const SaveRestoreModal: React.FC<SaveRestoreModalProps> = (props) => {
  if (!props.backupMeta) return null;

  return (
    <ActiveSaveRestoreModal
      key={`${props.instanceId}:${props.backupMeta.backupId}`}
      {...props}
      backupMeta={props.backupMeta}
    />
  );
};
