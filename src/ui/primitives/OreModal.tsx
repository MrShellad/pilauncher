// src/ui/primitives/OreModal.tsx
import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { doesFocusableExist, getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';
import { X } from 'lucide-react';

import { FocusBoundary } from '../focus/FocusBoundary';
import { FocusItem } from '../focus/FocusItem';
import { focusManager } from '../focus/FocusManager';
import '../../style/tokens/designToken';

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
  closeOnOutsideClick?: boolean;
  wrapperClassName?: string;
}

export const OreModal: React.FC<OreModalProps> = ({
  isOpen,
  onClose,
  title,
  hideTitleBar = false,
  hideCloseButton = false,
  defaultFocusKey,
  className = 'w-[480px]',
  contentClassName,
  children,
  actions,
  closeOnOutsideClick = true,
  wrapperClassName = 'z-[100]',
}) => {
  const modalId = useId();
  const boundaryId = `modal-boundary-${modalId.replace(/:/g, '')}`;
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
          className={`fixed inset-0 flex items-center justify-center p-4 sm:p-6 ${wrapperClassName}`}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && closeOnOutsideClick) {
              onClose();
            }
          }}
        >
          <motion.div
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
            className="relative z-10 outline-none"
          >
            <FocusItem focusKey={modalEntryFocusKey} autoScroll={false}>
              {({ ref }) => (
                <span
                  ref={ref as any}
                  tabIndex={-1}
                  aria-hidden="true"
                  className="absolute h-px w-px overflow-hidden opacity-0 pointer-events-none"
                />
              )}
            </FocusItem>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className={`
                relative flex flex-col overflow-hidden rounded-[2px]
                bg-[var(--ore-modal-bg)] border-[3px] border-[var(--ore-border-color)]
                shadow-[var(--ore-modal-shadow)]
                ${className}
              `}
              style={{ maxHeight: '85vh' }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {hasTitleBar && (
                <div
                  className="flex-shrink-0 flex items-center justify-center h-12 px-4 relative bg-[var(--ore-modal-header-bg)] border-b-[3px] border-[var(--ore-border-color)] z-20"
                  style={{ boxShadow: 'var(--ore-modal-header-shadow)' }}
                >
                  <h2 className="flex-1 text-center font-minecraft font-bold text-xl text-[var(--ore-modal-header-text)] ore-text-shadow tracking-wider uppercase truncate px-8">
                    {title}
                  </h2>

                  {!hideCloseButton && (
                    <div className="absolute right-0 top-0 bottom-0 flex items-center justify-center p-1.5 z-50">
                      <FocusItem focusKey={closeFocusKey} onEnter={onClose}>
                        {({ ref, focused }) => (
                          <button
                            type="button"
                            ref={ref as any}
                            onClick={(e) => {
                              e.stopPropagation();
                              onClose();
                            }}
                            tabIndex={-1}
                            className={`
                              relative flex items-center justify-center p-1.5 rounded-sm transition-none outline-none cursor-pointer
                              ${focused
                                ? 'bg-[var(--ore-btn-secondary-hover)] outline outline-[2px] outline-[var(--ore-focus-ringFallback)] outline-offset-1 z-10 drop-shadow-[0_0_6px_var(--ore-focus-glow)] brightness-110'
                                : 'text-gray-300 hover:text-white hover:bg-white/10'
                              }
                            `}
                          >
                            <X size={22} strokeWidth={2} className="pointer-events-none" />
                          </button>
                        )}
                      </FocusItem>
                    </div>
                  )}
                </div>
              )}

              <div
                className={`flex-1 font-minecraft text-[var(--ore-modal-content-text)] z-10 ${contentClassName || 'p-6 overflow-y-auto custom-scrollbar'}`}
                style={{ boxShadow: 'var(--ore-modal-content-shadow)' }}
              >
                {children}
              </div>

              {actions && (
                <div
                  className="flex-shrink-0 flex flex-wrap items-center justify-end gap-3 px-6 py-4 bg-[var(--ore-modal-footer-bg)] border-t-[3px] border-[var(--ore-border-color)] relative z-20"
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
