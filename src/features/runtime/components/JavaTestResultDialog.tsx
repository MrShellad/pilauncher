import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Wrench } from 'lucide-react';

import { OreConfirmDialog } from '../../../ui/primitives/OreConfirmDialog';
import type { JavaTestDialogState } from '../hooks/useJavaRuntimeTestDialog';

export const JavaTestResultDialog: React.FC<{
  state: JavaTestDialogState;
  onClose: () => void;
  focusKeyPrefix?: string;
}> = ({ state, onClose, focusKeyPrefix = 'java-test-dialog' }) => {
  const { t } = useTranslation();
  const tone = state.tone === 'danger' ? 'danger' : state.tone === 'warning' ? 'warning' : 'info';
  const dialogIcon =
    state.tone === 'danger' ? (
      <AlertTriangle size={28} className="text-red-500" />
    ) : state.tone === 'warning' ? (
      <Wrench size={28} className="text-yellow-400" />
    ) : (
      <CheckCircle2 size={28} className="text-ore-green" />
    );

  return (
    <OreConfirmDialog
      isOpen={state.isOpen}
      onClose={onClose}
      onConfirm={onClose}
      title={state.title}
      headline={state.headline}
      description={state.description}
      confirmationNote={state.detail}
      confirmationNoteTone={tone}
      tone={tone}
      confirmLabel={t('settings.java.testDialog.confirm')}
      cancelLabel={t('settings.java.testDialog.cancel')}
      confirmVariant={state.tone === 'danger' ? 'danger' : 'primary'}
      confirmFocusKey={`${focusKeyPrefix}-confirm`}
      cancelFocusKey={`${focusKeyPrefix}-cancel`}
      dialogIcon={dialogIcon}
    />
  );
};
