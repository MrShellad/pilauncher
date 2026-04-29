import React, { useCallback } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { OreButton } from './OreButton';
import { OreModal } from './OreModal';

type ConfirmVariant = 'primary' | 'secondary' | 'danger' | 'purple' | 'hero' | 'ghost';
type DialogTone = 'danger' | 'warning' | 'info';
type NoteTone = DialogTone | 'neutral';

interface TertiaryAction {
  label: string;
  onClick: () => void;
  variant?: ConfirmVariant;
  focusKey?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface OreConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  headline?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ConfirmVariant;
  tone?: DialogTone;
  confirmFocusKey?: string;
  cancelFocusKey?: string;
  confirmIcon?: React.ReactNode;
  dialogIcon?: React.ReactNode;
  isConfirming?: boolean;
  className?: string;
  modalContentClassName?: string;
  bodyClassName?: string;
  closeOnOutsideClick?: boolean;
  tertiaryAction?: TertiaryAction;
  confirmationNote?: React.ReactNode;
  confirmationNoteTone?: NoteTone;
  hideCancelButton?: boolean;
}

const toneClasses: Record<DialogTone, { shell: string; icon: string }> = {
  danger: {
    shell: 'bg-red-500/10 border-red-500/20 shadow-[inset_0_0_15px_rgba(239,68,68,0.2)]',
    icon: 'text-red-500'
  },
  warning: {
    shell: 'bg-yellow-500/10 border-yellow-500/20 shadow-[inset_0_0_15px_rgba(234,179,8,0.18)]',
    icon: 'text-yellow-400'
  },
  info: {
    shell: 'bg-sky-500/10 border-sky-500/20 shadow-[inset_0_0_15px_rgba(14,165,233,0.18)]',
    icon: 'text-sky-400'
  }
};

const noteToneClasses: Record<NoteTone, string> = {
  danger: 'border-red-500/30 bg-red-500/10 text-red-300',
  warning: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200',
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  neutral: 'border-white/10 bg-white/5 text-gray-300'
};

export const OreConfirmDialog: React.FC<OreConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  headline,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  tone = 'danger',
  confirmFocusKey = 'ore-confirm-dialog-confirm',
  cancelFocusKey = 'ore-confirm-dialog-cancel',
  confirmIcon,
  dialogIcon,
  isConfirming = false,
  className = 'w-[450px]',
  modalContentClassName,
  bodyClassName = 'flex flex-col items-center justify-center py-4 text-center',
  closeOnOutsideClick = true,
  tertiaryAction,
  confirmationNote,
  confirmationNoteTone = 'neutral',
  hideCancelButton = false
}) => {
  const palette = toneClasses[tone];
  const resolvedDialogIcon = dialogIcon ?? <AlertTriangle size={32} className={palette.icon} />;
  const tertiaryFocusKey = tertiaryAction?.focusKey ?? 'ore-confirm-dialog-tertiary';
  const defaultFocusKey = hideCancelButton ? confirmFocusKey : cancelFocusKey;
  const actionKeys = [
    hideCancelButton ? null : { key: cancelFocusKey, disabled: false },
    tertiaryAction ? { key: tertiaryFocusKey, disabled: !!tertiaryAction.disabled } : null,
    { key: confirmFocusKey, disabled: isConfirming }
  ].filter((item): item is { key: string; disabled: boolean } => Boolean(item));
  const enabledActionKeys = actionKeys.filter((item) => !item.disabled).map((item) => item.key);

  const handleActionArrow = useCallback((currentKey: string, direction: string) => {
    if (enabledActionKeys.length === 0) return false;

    if (direction === 'left' || direction === 'right') {
      const currentIndex = enabledActionKeys.indexOf(currentKey);
      const safeIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex = direction === 'right'
        ? Math.min(enabledActionKeys.length - 1, safeIndex + 1)
        : Math.max(0, safeIndex - 1);

      setFocus(enabledActionKeys[nextIndex]);
      return false;
    }

    if (direction === 'up' || direction === 'down') {
      setFocus(enabledActionKeys.includes(currentKey) ? currentKey : enabledActionKeys[0]);
      return false;
    }

    return false;
  }, [enabledActionKeys]);

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      hideCloseButton={true}
      className={className}
      contentClassName={modalContentClassName}
      defaultFocusKey={defaultFocusKey}
      closeOnOutsideClick={closeOnOutsideClick}
      actions={
        <>
          {!hideCancelButton && (
            <OreButton
              focusKey={cancelFocusKey}
              variant="secondary"
              onClick={onClose}
              onArrowPress={(direction) => handleActionArrow(cancelFocusKey, direction)}
              className="min-w-[10rem] flex-1"
            >
              {cancelLabel}
            </OreButton>
          )}
          {tertiaryAction && (
            <OreButton
              focusKey={tertiaryFocusKey}
              variant={tertiaryAction.variant ?? 'ghost'}
              onClick={tertiaryAction.onClick}
              onArrowPress={(direction) => handleActionArrow(tertiaryFocusKey, direction)}
              className="min-w-[10rem] flex-1"
              disabled={tertiaryAction.disabled}
            >
              {tertiaryAction.icon}
              {tertiaryAction.label}
            </OreButton>
          )}
          <OreButton
            focusKey={confirmFocusKey}
            variant={confirmVariant}
            onClick={onConfirm}
            onArrowPress={(direction) => handleActionArrow(confirmFocusKey, direction)}
            className="min-w-[11.5rem] flex-1"
            disabled={isConfirming}
          >
            {isConfirming
              ? <Loader2 size={16} className="mr-2 animate-spin" />
              : confirmIcon}
            {confirmLabel}
          </OreButton>
        </>
      }
    >
      <div className={bodyClassName}>
        <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 ${palette.shell}`}>
          {resolvedDialogIcon}
        </div>

        {headline && (
          <div className="mb-2 font-minecraft text-lg text-white">
            {headline}
          </div>
        )}

        {description && (
          <div className="px-4 text-sm text-ore-text-muted">
            {description}
          </div>
        )}

        {confirmationNote && (
          <div className={`mt-4 w-full rounded-sm border px-4 py-3 text-sm leading-relaxed ${noteToneClasses[confirmationNoteTone]}`}>
            {confirmationNote}
          </div>
        )}

        {children}
      </div>
    </OreModal>
  );
};
