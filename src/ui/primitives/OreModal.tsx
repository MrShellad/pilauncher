// src/ui/primitives/OreModal.tsx
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { OreMotionTokens } from '../../style/tokens/motion';
import { FocusBoundary } from '../focus/FocusBoundary';
import { FocusItem } from '../focus/FocusItem';
// ✅ 1. 引入全局焦点调度器
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

export interface OreModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string; 
  closeOnOverlayClick?: boolean;
}

export const OreModal: React.FC<OreModalProps> = ({
  isOpen, onClose, title, children, footer, className = 'w-full max-w-lg', closeOnOverlayClick = true,
}) => {
  // 生成稳定的边界 ID
  const modalBoundaryId = `modal-${title || 'default'}`;

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => { document.body.style.overflow = isOpen ? 'hidden' : 'auto'; }, [isOpen]);

  // ✅ 2. 核心修复：弹窗打开时，自动将焦点强行抓取到弹窗内部！
useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        // ✅ 核心修复：在捕获阶段彻底吃掉 ESC 事件，绝不让它传到后面的页面去！
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    
    // ✅ 加入 { capture: true }，赋予弹窗最高优先级的按键拦截权
    window.addEventListener('keydown', handleEsc, { capture: true });
    return () => window.removeEventListener('keydown', handleEsc, { capture: true });
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={OreMotionTokens.modalOverlayInitial} animate={OreMotionTokens.modalOverlayAnimate} exit={OreMotionTokens.modalOverlayExit}
            onClick={() => closeOnOverlayClick && onClose()} className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={OreMotionTokens.modalContentInitial} animate={OreMotionTokens.modalContentAnimate} exit={OreMotionTokens.modalContentExit}
            role="dialog" aria-modal="true" className={`ore-modal-panel ${className}`}
          >
            <FocusBoundary id={modalBoundaryId} trapFocus={true} className="flex flex-col w-full h-full">
              {title && (
                <div className="ore-modal-header">
                  <h2 className="text-xl font-minecraft font-bold ore-text-shadow tracking-wide text-white">{title}</h2>
                  <FocusItem onEnter={onClose}>
                    {({ ref, focused }) => (
                      <button ref={ref} onClick={onClose} className={`p-1 text-ore-text-muted hover:text-white rounded outline-none transition-colors ${focused ? 'ring-2 ring-white bg-white/10' : 'hover:bg-white/10'}`}>
                        <X size={20} />
                      </button>
                    )}
                  </FocusItem>
                </div>
              )}
              <div className="ore-modal-body">{children}</div>
              {footer && <div className="ore-modal-footer">{footer}</div>}
            </FocusBoundary>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};