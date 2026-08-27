// src/ui/primitives/OreModal.tsx
import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { doesFocusableExist, getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';
import { X } from 'lucide-react';

import { FocusBoundary } from '../focus/FocusBoundary';
import { FocusItem } from '../focus/FocusItem';
import { focusManager } from '../focus/FocusManager';
import { OreOverlayScrollArea } from './OreOverlayScrollArea';
import '../../style/tokens/designToken';
import { useScreenDensity } from '../../hooks/ui/useScreenDensity';

interface OreModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  hideTitleBar?: boolean;
  hideCloseButton?: boolean;
  defaultFocusKey?: string;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  actionsClassName?: string;
  closeOnOutsideClick?: boolean;
  wrapperClassName?: string;
  role?: 'dialog' | 'alertdialog';
  'aria-describedby'?: string;
  disableScrollArea?: boolean;
}

export const OreModal: React.FC<OreModalProps> = ({
  isOpen,
  onClose,
  title,
  hideTitleBar = false,
  hideCloseButton = false,
  defaultFocusKey,
  className = 'w-[540px] max-w-[92vw]',
  contentClassName,
  children,
  actions,
  actionsClassName = '',
  closeOnOutsideClick = true,
  wrapperClassName = 'z-[100]',
  role = 'dialog',
  'aria-describedby': ariaDescribedby,
  disableScrollArea = false,
}) => {
  const density = useScreenDensity();
  const modalId = useId();
  const boundaryId = `modal-boundary-${modalId.replace(/:/g, '')}`;
  const titleId = `modal-title-${boundaryId}`;
  const hasTitleBar = !hideTitleBar && !!title;
  const closeFocusKey = `modal-close-${boundaryId}`;
  const modalEntryFocusKey = `modal-entry-${boundaryId}`;
  const boundaryDefaultFocusKey = defaultFocusKey || (hasTitleBar ? closeFocusKey : modalEntryFocusKey);

  const previousFocusKeyRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusKeyRef.current = getCurrentFocusKey();
    }

    return () => {
      // 闭包中 isOpen 为 true 说明这是由于开启状态变为关闭状态，或者是被强制卸载引发的清理
      if (isOpen && previousFocusKeyRef.current) {
        const keyToRestore = previousFocusKeyRef.current;
        setTimeout(() => {
          if (doesFocusableExist(keyToRestore)) {
            focusManager.focus(keyToRestore);
          }
        }, 120); // 预留时间等待弹窗动画淡出，避免焦点无法落根
      }
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !isOpen) return;

      // If an inner dropdown is open, let that layer consume Escape first.
      if (document.querySelector('.ore-dropdown-panel')) return;

      e.stopPropagation();
      onClose();
    };

    let timer: ReturnType<typeof setTimeout> | null = null;

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEsc, { capture: true });

      let attempts = 0;
      const maxAttempts = 14;
      const focusCandidates = [defaultFocusKey, hasTitleBar ? closeFocusKey : undefined, modalEntryFocusKey].filter(Boolean) as string[];

      const tryFocusInsideModal = () => {
        const target = focusCandidates.find((key) => doesFocusableExist(key));
        if (target) {
          focusManager.focus(target);
          return;
        }

        attempts += 1;
        if (attempts < maxAttempts) {
          timer = setTimeout(tryFocusInsideModal, 70);
        }
      };

      timer = setTimeout(tryFocusInsideModal, 80);
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      if (timer) clearTimeout(timer);
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleEsc, { capture: true });
    };
  }, [isOpen, onClose, defaultFocusKey, hasTitleBar, closeFocusKey, modalEntryFocusKey]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className={`fixed inset-0 flex items-center justify-center ${density === 'compact' ? 'p-0' : 'p-4 sm:p-6'} ${wrapperClassName}`}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && closeOnOutsideClick) {
              onClose();
            }
          }}
        >
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm pointer-events-none"
          />

          <FocusBoundary
            id={boundaryId}
            trapFocus={isOpen}
            onEscape={onClose}
            defaultFocusKey={boundaryDefaultFocusKey}
            className="relative z-10 outline-none w-full h-full flex items-center justify-center pointer-events-none [&>*]:pointer-events-auto"
          >
            <FocusItem focusKey={modalEntryFocusKey} autoScroll={false}>
              {({ ref, tabIndex }) => (
                <span
                  ref={ref as any}
                  tabIndex={tabIndex}
                  aria-hidden="true"
                  className="absolute h-px w-px overflow-hidden opacity-0 pointer-events-none"
                />
              )}
            </FocusItem>

            <motion.div
              role={role}
              aria-modal="true"
              aria-labelledby={hasTitleBar ? titleId : undefined}
              aria-label={!hasTitleBar ? title : undefined}
              aria-describedby={ariaDescribedby}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className={`
                relative flex flex-col overflow-hidden rounded-[2px]
                bg-[var(--ore-modal-bg)] border-[var(--ore-border-color)]
                shadow-[var(--ore-modal-shadow)]
                ${density === 'compact' ? 'w-full h-full border-0' : `border-[3px] ${className}`}
              `}
              style={{ maxHeight: 'var(--ore-modal-max-h, 85vh)' }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {hasTitleBar && (
                <div
                  className="flex-shrink-0 flex items-center justify-center h-12 px-4 relative bg-[var(--ore-modal-header-bg)] border-b-[3px] border-[var(--ore-border-color)] z-20"
                  style={{ boxShadow: 'var(--ore-modal-header-shadow)' }}
                >
                  <h2 id={titleId} className="flex-1 text-center font-minecraft font-bold text-xl text-[var(--ore-modal-header-text)] ore-text-shadow tracking-wider uppercase truncate px-8">
                    {title}
                  </h2>

                  {!hideCloseButton && (
                    <div className="absolute right-2 top-0 bottom-0 flex items-center justify-center z-50">
                      <FocusItem focusKey={closeFocusKey} onEnter={onClose}>
                        {({ ref, focused, tabIndex }) => (
                          <button
                            type="button"
                            ref={ref as any}
                            onClick={(e) => {
                              e.stopPropagation();
                              onClose();
                            }}
                            tabIndex={tabIndex}
                            aria-label="关闭对话框"
                            className={`
                              relative flex items-center justify-center w-8 h-8 rounded-[2px] border-[2px] border-[#1E1E1F] bg-[#48494A] text-white transition-none outline-none cursor-pointer shadow-[inset_0_-2px_#333334,inset_1px_1px_rgba(255,255,255,0.2)] hover:bg-[#58585A] active:bg-[#38383A]
                              ${focused
                                ? 'outline outline-2 outline-white outline-offset-1 z-10'
                                : ''
                              }
                            `}
                          >
                            <X size={18} strokeWidth={2.5} className="pointer-events-none text-white" />
                          </button>
                        )}
                      </FocusItem>
                    </div>
                  )}
                </div>
              )}

              {disableScrollArea ? (
                <div
                  className={`flex-1 min-h-0 z-10 flex flex-col font-minecraft text-[var(--ore-modal-content-text)] ${contentClassName || 'p-6'}`}
                  style={{ boxShadow: 'var(--ore-modal-content-shadow)' }}
                >
                  {children}
                </div>
              ) : (
                <OreOverlayScrollArea
                  className="flex-1 min-h-0 z-10"
                  contentClassName={`font-minecraft text-[var(--ore-modal-content-text)] ${contentClassName || 'p-6'}`}
                  style={{ boxShadow: 'var(--ore-modal-content-shadow)' }}
                >
                  {children}
                </OreOverlayScrollArea>
              )}

              {actions && (
                <div
                  className={`flex-shrink-0 flex flex-wrap items-center justify-end gap-3 px-6 py-4 bg-[var(--ore-modal-footer-bg)] border-t-[3px] border-[var(--ore-border-color)] relative z-20 ${actionsClassName} ${density === 'compact' ? '[&>*]:flex-1 w-full gap-2 px-3 py-2.5' : ''}`}
                  style={{ boxShadow: 'var(--ore-modal-footer-shadow)' }}
                >
                  {actions}
                </div>
              )}
            </motion.div>
          </FocusBoundary>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
