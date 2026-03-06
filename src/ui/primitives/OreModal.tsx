// /src/ui/primitives/OreModal.tsx
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
        // ✅ 核心修复 1：将点击事件挂载到最外层 flex 容器。
        // 使用 onMouseDown 体验更好：防止用户在弹窗内按下鼠标，拖拽到外部松开时发生误触关闭。
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && closeOnOutsideClick) {
              onClose();
            }
          }}
        >
          
          {/* ✅ 核心修复 2：背景现在只作为纯视觉层，加入 pointer-events-none 让出鼠标事件 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm pointer-events-none"
          />

          {/* ✅ 核心修复 3：移除了冗余的 w-full flex justify-center，让它缩紧贴合 Modal */}
          <FocusBoundary id={boundaryId} trapFocus={isOpen} onEscape={onClose} className="relative z-10 outline-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }} 
              className={`
                relative flex flex-col overflow-hidden rounded-sm
                bg-[var(--ore-modal-bg)] border-[3px] border-[var(--ore-border-color)]
                shadow-[var(--ore-modal-shadow)]
                ${className}
              `}
              style={{ maxHeight: '85vh' }}
              // ✅ 核心修复 4：全面阻断点击穿透，保护弹窗内部区域不触发外层关闭
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              
              {/* ======================= 1. Header ======================= */}
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

              {/* ======================= 2. Body ======================= */}
              <div 
                className="flex-1 overflow-y-auto p-6 font-minecraft text-[var(--ore-modal-content-text)] custom-scrollbar z-10"
                style={{ boxShadow: 'var(--ore-modal-content-shadow)' }}
              >
                {children}
              </div>

              {/* ======================= 3. Footer ======================= */}
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