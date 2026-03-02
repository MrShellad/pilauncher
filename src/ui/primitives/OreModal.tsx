// /src/ui/primitives/OreModal.tsx
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, type Variants } from 'framer-motion'; // ✅ 引入 Variants 类型
import { X } from 'lucide-react';
import { OreMotionTokens } from '../../style/tokens/motion';

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
  closeOnOverlayClick = true // ✅ 默认允许点击遮罩关闭
}) => {
  useEffect(() => {
    // ESC 键关闭弹窗逻辑
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.stopPropagation(); 
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
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
            variants={OreMotionTokens.modalBackdrop as Variants} // ✅ 加上类型断言
            initial="initial" animate="animate" exit="exit"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            // ✅ 正确应用 closeOnOverlayClick 逻辑
            onClick={closeOnOverlayClick ? onClose : undefined} 
          />

          <motion.div
            variants={OreMotionTokens.modalContent as Variants} // ✅ 加上类型断言
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