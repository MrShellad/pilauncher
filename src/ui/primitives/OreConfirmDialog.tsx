import React, { useCallback } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { OreButton } from './OreButton';
import { OreModal } from './OreModal';
import { OreBanner } from './OreBanner';

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
  hideCloseButton?: boolean;
}

const toneIconColors: Record<DialogTone, string> = {
  danger: '#EF4444',
  warning: '#EAB308',
  info: '#38BDF8',
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
  className = 'w-[580px] max-w-[92vw]',
  modalContentClassName,
  bodyClassName = 'flex flex-col items-center justify-center py-2 text-center',
  closeOnOutsideClick = true,
  tertiaryAction,
  confirmationNote,
  confirmationNoteTone = 'neutral',
  hideCancelButton = false,
  hideCloseButton = false,
}) => {
  const iconColor = toneIconColors[tone];
  const resolvedDialogIcon = dialogIcon ?? <AlertTriangle size={28} style={{ color: iconColor }} />;
  const tertiaryFocusKey = tertiaryAction?.focusKey ?? 'ore-confirm-dialog-tertiary';
  const defaultFocusKey = hideCancelButton ? confirmFocusKey : cancelFocusKey;
  const actionKeys = [
    { key: confirmFocusKey, disabled: isConfirming },
    tertiaryAction ? { key: tertiaryFocusKey, disabled: !!tertiaryAction.disabled } : null,
    hideCancelButton ? null : { key: cancelFocusKey, disabled: false },
  ].filter((item): item is { key: string; disabled: boolean } => Boolean(item));
  const enabledActionKeys = actionKeys.filter((item) => !item.disabled).map((item) => item.key);

  const handleActionArrow = useCallback((currentKey: string, direction: string) => {
    if (enabledActionKeys.length === 0) return false;

    if (direction === 'up' || direction === 'down') {
      const currentIndex = enabledActionKeys.indexOf(currentKey);
      const safeIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex = direction === 'down'
        ? Math.min(enabledActionKeys.length - 1, safeIndex + 1)
        : Math.max(0, safeIndex - 1);

      setFocus(enabledActionKeys[nextIndex]);
      return false;
    }

    return false;
  }, [enabledActionKeys]);

  const descriptionId = React.useId();

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      hideCloseButton={hideCloseButton}
      className={className}
      contentClassName={modalContentClassName}
      defaultFocusKey={defaultFocusKey}
      closeOnOutsideClick={closeOnOutsideClick}
      role="alertdialog"
      aria-describedby={descriptionId}
      actionsClassName="flex flex-col gap-2.5 w-full !items-stretch !px-6 !py-4"
      actions={
        <>
          <OreButton
            focusKey={confirmFocusKey}
            variant={confirmVariant}
            size="full"
            onClick={onConfirm}
            onArrowPress={(direction) => handleActionArrow(confirmFocusKey, direction)}
            className="w-full !h-11 font-minecraft font-bold uppercase tracking-wider"
            disabled={isConfirming}
          >
            {isConfirming
              ? <Loader2 size={16} className="mr-2 animate-spin" aria-hidden="true" />
              : confirmIcon}
            {confirmLabel}
          </OreButton>

          {tertiaryAction && (
            <OreButton
              focusKey={tertiaryFocusKey}
              variant={tertiaryAction.variant ?? 'ghost'}
              size="full"
              onClick={tertiaryAction.onClick}
              onArrowPress={(direction) => handleActionArrow(tertiaryFocusKey, direction)}
              className="w-full !h-11 font-minecraft font-bold uppercase tracking-wider"
              disabled={tertiaryAction.disabled}
            >
              {tertiaryAction.icon}
              {tertiaryAction.label}
            </OreButton>
          )}

          {!hideCancelButton && (
            <OreButton
              focusKey={cancelFocusKey}
              variant="secondary"
              size="full"
              onClick={onClose}
              onArrowPress={(direction) => handleActionArrow(cancelFocusKey, direction)}
              className="w-full !h-11 font-minecraft font-bold uppercase tracking-wider"
            >
              {cancelLabel}
            </OreButton>
          )}
        </>
      }
    >
      <div className={bodyClassName} id={descriptionId}>
        {/* 方形深色像素警告图标盒体 (Square Pixel Well) */}
        <div className="mb-4 flex h-14 w-14 items-center justify-center border-[2px] border-[#1E1E1F] bg-[#18181A] shadow-[inset_1px_1px_rgba(255,255,255,0.08)] flex-shrink-0">
          {resolvedDialogIcon}
        </div>

        {headline && (
          <div className="mb-2 font-minecraft font-bold text-base md:text-lg text-white ore-text-shadow text-center text-balance break-words">
            {headline}
          </div>
        )}

        {description && (
          <div className="px-2 font-minecraft text-xs md:text-sm text-[#D0D1D4] text-center leading-relaxed text-balance break-words">
            {description}
          </div>
        )}

        {confirmationNote && (
          <div className="mt-4 w-full text-left">
            <OreBanner
              variant={confirmationNoteTone === 'danger' ? 'danger' : confirmationNoteTone === 'warning' ? 'warning' : 'important'}
              className="font-minecraft text-xs leading-relaxed text-pretty break-words"
            >
              {confirmationNote}
            </OreBanner>
          </div>
        )}

        {children}
      </div>
    </OreModal>
  );
};

