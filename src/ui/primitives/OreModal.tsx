// /src/ui/primitives/OreModal.tsx
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { OreMotionTokens } from '../../style/tokens/motion';

// 引入你可能用到的基础组件 (如果后续弹窗需要默认确认/取消按钮)
// import { OreButton } from './OreButton';

export interface OreModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string; // 控制弹窗面板的宽度等额外样式
  closeOnOverlayClick?: boolean;
}

export const OreModal: React.FC<OreModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  className = 'w-full max-w-lg',
  closeOnOverlayClick = true,
}) => {

  // 按下 ESC 键关闭弹窗
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // 防止弹窗打开时底层页面滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
  }, [isOpen]);

  return (
    // AnimatePresence 必须包裹着条件渲染，这样 exit 动画才能生效
    <AnimatePresence>
      {isOpen && (
        // 外层全屏容器 (使用 fixed 和最高层级保证覆盖整个窗口)
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          
          {/* 1. 遮罩层 */}
          <motion.div
            initial={OreMotionTokens.modalOverlayInitial}
            animate={OreMotionTokens.modalOverlayAnimate}
            exit={OreMotionTokens.modalOverlayExit}
            onClick={() => closeOnOverlayClick && onClose()}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* 2. 弹窗面板 */}
          <motion.div
            initial={OreMotionTokens.modalContentInitial}
            animate={OreMotionTokens.modalContentAnimate}
            exit={OreMotionTokens.modalContentExit}
            // role="dialog" 增强可访问性
            role="dialog"
            aria-modal="true"
            className={`ore-modal-panel ${className}`}
          >
            {/* 头部 (可选) */}
            {title && (
              <div className="ore-modal-header">
                <h2 className="text-xl font-minecraft font-bold ore-text-shadow tracking-wide text-white">
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="p-1 text-ore-text-muted hover:text-white hover:bg-white/10 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <X size={20} />
                </button>
              </div>
            )}

            {/* 主体内容区 */}
            <div className="ore-modal-body">
              {children}
            </div>

            {/* 底部操作区 (可选) */}
            {footer && (
              <div className="ore-modal-footer">
                {footer}
              </div>
            )}
          </motion.div>

        </div>
      )}
    </AnimatePresence>
  );
};