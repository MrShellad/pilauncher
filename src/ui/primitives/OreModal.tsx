// /src/ui/primitives/OreModal.tsx
import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { X } from 'lucide-react';
import { OreMotionTokens } from '../../style/tokens/motion';

// ✅ 引入焦点控制模块
import { FocusBoundary } from '../focus/FocusBoundary';
import { FocusItem } from '../focus/FocusItem';
import { focusManager } from '../focus/FocusManager';

interface OreModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  hideTitleBar?: boolean;
  className?: string;
  children: React.ReactNode;
  closeOnOverlayClick?: boolean;
}

export const OreModal: React.FC<OreModalProps> = ({
  isOpen, 
  onClose, 
  title, 
  hideTitleBar = false, 
  className = '', 
  children,
  closeOnOverlayClick = true 
}) => {
  // 动态生成唯一的焦点容器 ID
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
      
      // ✅ 焦点导航：弹窗打开时，给 100ms 渲染延迟，然后强行将光环锁定在右上角的“关闭”按钮上
      setTimeout(() => focusManager.focus(`modal-close-${boundaryId}`), 100);
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => { 
      document.body.style.overflow = 'unset'; 
      window.removeEventListener('keydown', handleEsc, { capture: true });
    };
  }, [isOpen, onClose, boundaryId]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          
          <motion.div
            variants={OreMotionTokens.modalBackdrop as Variants}
            initial="initial" animate="animate" exit="exit"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeOnOverlayClick ? onClose : undefined} 
          />

          <motion.div
            variants={OreMotionTokens.modalContent as Variants}
            initial="initial" animate="animate" exit="exit"
            // ✅ 问题修复2：强制使用 tween 代替 spring，动画精准落位，避免亚像素震荡导致的文字发糊！
            transition={{ type: 'tween', duration: 0.15, ease: 'easeOut' }}
            className={`ore-modal-panel z-10 flex flex-col ${className}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ✅ 问题修复3：包裹 FocusBoundary 并开启 trapFocus，手柄光环再也飞不出弹窗外了 */}
            <FocusBoundary id={boundaryId} trapFocus={isOpen} onEscape={onClose} className="flex flex-col w-full max-h-full">
              {title && !hideTitleBar && (
                <div className="ore-modal-header flex-shrink-0">
                  <h2 className="text-white font-minecraft text-lg drop-shadow-sm">{title}</h2>
                  
                  {/* 关闭按钮接入焦点导航 */}
                  <FocusItem focusKey={`modal-close-${boundaryId}`} onEnter={onClose}>
                    {({ ref, focused }) => (
                      <button 
                        ref={ref as any} 
                        onClick={onClose} 
                        className={`text-gray-400 hover:text-white transition-colors outline-none rounded p-1 ${focused ? 'bg-white/20 text-white ring-2 ring-white scale-110' : ''}`}
                      >
                        <X size={26} strokeWidth={1.5} />
                      </button>
                    )}
                  </FocusItem>
                </div>
              )}

              <div className="ore-modal-body custom-scrollbar p-0 overflow-y-auto flex-1">
                {children}
              </div>
            </FocusBoundary>
          </motion.div>

        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};