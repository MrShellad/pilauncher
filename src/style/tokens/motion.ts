// /src/style/tokens/motion.ts
import type { TargetAndTransition, Variants } from "framer-motion"; // 引入 Variants 类型

export const OreMotionTokens = {
  // 按钮交互动画 (保持不变)
  buttonTap: { scale: 0.96, transition: { duration: 0.05 } } as TargetAndTransition,
  buttonHover: { scale: 1.02, transition: { duration: 0.1 } } as TargetAndTransition,
  
  // 页面切换动画 (保持不变)
  pageInitial: { opacity: 0, y: 10 } as TargetAndTransition,
  pageAnimate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } } as TargetAndTransition,
  pageExit: { opacity: 0, y: -10, transition: { duration: 0.2 } } as TargetAndTransition,

  // [新增] 微妙的悬停效果 (用于 Logo 等展示性元素)
  // 使用 scale 1.05 实现轻微放大，配合 easeOut 实现平滑过渡
  subtleHover: {
    scale: 1.05,
    // Framer Motion 直接操作 filter 比较复杂且性能开销大，
    // 对于 drop-shadow 的细微变化，通常 scale 带来的视觉变大已经足够，
    // 或者结合 Tailwind 的 transition 类来实现阴影过渡。
    // 这里我们专注于核心的 scale 动画统一管理。
    transition: { duration: 0.3, ease: "easeOut" }
  } as TargetAndTransition,
  
  // [新增] 弹窗遮罩层动画
  modalOverlayInitial: { opacity: 0 } as TargetAndTransition,
  modalOverlayAnimate: { opacity: 1, transition: { duration: 0.2 } } as TargetAndTransition,
  modalOverlayExit: { opacity: 0, transition: { duration: 0.2 } } as TargetAndTransition,

  // [新增] 弹窗面板动画 (带轻微弹簧物理效果)
  modalContentInitial: { opacity: 0, scale: 0.95, y: 20 } as TargetAndTransition,
  modalContentAnimate: { 
    opacity: 1, 
    scale: 1, 
    y: 0, 
    transition: { type: "spring", stiffness: 400, damping: 30 } 
  } as TargetAndTransition,
  modalContentExit: { 
    opacity: 0, 
    scale: 0.95, 
    y: 20, 
    transition: { duration: 0.15 } 
  } as TargetAndTransition,
};