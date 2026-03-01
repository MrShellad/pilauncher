// /src/ui/primitives/OreModal.tsx
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { OreMotionTokens } from '../../style/tokens/motion';

interface OreModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  hideTitleBar?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const OreModal: React.FC<OreModalProps> = ({
  isOpen, onClose, title, hideTitleBar = false, className = '', children
}) => {
  useEffect(() => {
    // ✅ 新增：ESC 键关闭弹窗逻辑
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.stopPropagation(); // 核心：立刻阻止冒泡，防止底层的 InstanceDetail 触发回退！
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // 使用 capture: true 确保弹窗在捕获阶段最先拿到键盘事件
      window.addEventListener('keydown', handleEsc, { capture: true });
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => { 
      document.body.style.overflow = 'unset'; 
      window.removeEventListener('keydown', handleEsc, { capture: true });
    };
  }, [isOpen, onClose]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          
          <motion.div
            variants={OreMotionTokens.modalBackdrop}
            initial="initial" animate="animate" exit="exit"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            variants={OreMotionTokens.modalContent}
            initial="initial" animate="animate" exit="exit"
            className={`ore-modal-panel z-10 ${className}`}
            onClick={(e) => e.stopPropagation()}
          >
            {title && !hideTitleBar && (
              <div className="ore-modal-header">
                <h2 className="text-white font-minecraft text-lg drop-shadow-sm">{title}</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors outline-none focus:ring-2 focus:ring-white rounded">
                  <X size={26} strokeWidth={1.5} />
                </button>
              </div>
            )}

            <div className="ore-modal-body custom-scrollbar p-0">
              {children}
            </div>
          </motion.div>

        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};