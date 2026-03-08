// src/ui/primitives/OreModal.tsx
import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

// 焦点控制模块
import { FocusBoundary } from '../focus/FocusBoundary';
import { FocusItem } from '../focus/FocusItem';
import { focusManager } from '../focus/FocusManager';
import '../../style/tokens/designToken';

interface OreModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  hideTitleBar?: boolean;
  className?: string;
  contentClassName?: string; // ✅ 新增：允许自定义内容区样式，打破内边距束缚
  children: React.ReactNode;
  actions?: React.ReactNode; 
  closeOnOutsideClick?: boolean;
}

export const OreModal: React.FC<OreModalProps> = ({
  isOpen, 
  onClose, 
  title, 
  hideTitleBar = false, 
  className = 'w-[480px]', 
  contentClassName,
  children,
  actions,
  closeOnOutsideClick = true 
}) => {
  const modalId = useId();
  const boundaryId = `modal-boundary-${modalId.replace(/:/g, '')}`;

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.stopPropagation(); 
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEsc, { capture: true });
      setTimeout(() => focusManager.focus(`modal-close-${boundaryId}`), 100);
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => { 
      document.body.style.overflow = 'unset'; 
      window.removeEventListener('keydown', handleEsc, { capture: true });
    };
  }, [isOpen, onClose, boundaryId]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
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

          <FocusBoundary id={boundaryId} trapFocus={isOpen} onEscape={onClose} className="relative z-10 outline-none">
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
              
              {!hideTitleBar && title && (
                <div 
                  className="flex-shrink-0 flex items-center justify-center h-12 px-4 relative bg-[var(--ore-modal-header-bg)] border-b-[3px] border-[var(--ore-border-color)] z-20"
                  style={{ boxShadow: 'var(--ore-modal-header-shadow)' }}
                >
                  <h2 className="flex-1 text-center font-minecraft font-bold text-xl text-[var(--ore-modal-header-text)] ore-text-shadow tracking-wider uppercase truncate px-8">
                    {title}
                  </h2>
                  
                  <div className="absolute right-0 top-0 bottom-0 flex items-center justify-center p-1.5 z-50">
                    <FocusItem focusKey={`modal-close-${boundaryId}`} onEnter={onClose}>
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
                              ? 'bg-[var(--ore-btn-secondary-hover)] outline outline-[2px] outline-[var(--ore-focus-ringFallback)] outline-[var(--ore-focus-ring)] outline-offset-1 z-10 drop-shadow-[0_0_6px_var(--ore-focus-glow)] brightness-110' 
                              : 'text-gray-300 hover:text-white hover:bg-white/10'
                            }
                          `}
                        >
                          <X size={22} strokeWidth={2} className="pointer-events-none" />
                        </button>
                      )}
                    </FocusItem>
                  </div>
                </div>
              )}

              {/* ✅ 修复：利用 contentClassName 赋予子组件彻底接管布局的权力 */}
              <div 
                className={`flex-1 font-minecraft text-[var(--ore-modal-content-text)] z-10 ${contentClassName || 'p-6 overflow-y-auto custom-scrollbar'}`}
                style={{ boxShadow: 'var(--ore-modal-content-shadow)' }}
              >
                {children}
              </div>

              {actions && (
                <div 
                  className="flex-shrink-0 flex items-center justify-end space-x-4 px-6 py-4 bg-[var(--ore-modal-footer-bg)] border-t-[3px] border-[var(--ore-border-color)] relative z-20"
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