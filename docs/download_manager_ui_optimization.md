# DownloadManager UI Optimization Plan (Steam Deck / Handheld)

本文档针对 `DownloadManager` 组件在 Steam Deck 等小屏幕设备（通常为 7-8 英寸，800p 分辨率）上的阅读与操作体验提出优化建议。

## 现状分析 (Current State)

目前 `DownloadManager` 采用的是标准的桌面端 UI 设计方案：
*   **面板宽度**：固定在 `50vw` 左右，在小屏幕上显得过于窄长。
*   **字体大小**：大量使用 `0.625rem` (10px) 和 `0.5625rem` (9px) 的字体，在 800p 屏幕上阅读体验极差。
*   **交互尺寸**：按钮高度在 `1.75rem` - `2.25rem` 之间，触控操作精度要求较高。
*   **信息密度**：进度详情和日志信息非常密集，缺乏视觉重心。

---

## 优化建议 (Optimization Recommendations)

### 1. 响应式布局调整 (Responsive Layout)
*   **面板宽度优化**：
    *   在屏幕宽度小于 `1000px` 时，将面板宽度从 `50vw` 提升至 `85vw` 或 `90vw`。
    *   这样可以利用小屏幕横向空间，减少长文件名的截断（Truncate）。
*   **位置锚点**：
    *   在 Steam Deck 模式下，考虑将面板居中弹出或占据右侧大部分区域，而非仅仅是一个右下角的悬浮面板。

### 2. 增强阅读体验 (Typography & Readability)
*   **提升基准字号**：
    *   最小字号应不低于 `0.75rem` (12px)。
    *   状态标签（Status Badge）从 `0.5625rem` 提升至 `0.75rem`。
    *   进度百分比和速度信息应加粗显示。

### 3. 交互体验优化 (Interaction & Touch Targets)
*   **增大触控区域**：
    *   所有操作按钮（重试、取消、日志切换）的高度最小应为 `2.5rem` (40px)。
    *   增大任务项之间的间距（Gap），避免误触。
*   **增强焦点反馈**：
    *    spatial-navigation 焦点框应增加 `outline-offset`，确保在深色背景下清晰可见。
    *   在 Steam Deck 控制器模式下，增加更明显的 `hover` 或 `focus` 缩放动画。

### 4. 进度表现力强化 (Visual Progress)
*   **进度条加粗**：
    *   引入src\ui\primitives\OreProgressBar.tsx作为进度条。
    *   增加进度条的扫光动画（Shimmer effect），让用户感知到任务正在活跃运行。
*   **状态图标颜色**：
    *   在小屏幕上颜色比文字更易感知。增强 "正在下载"、"错误"、"完成" 状态的颜色对比度。

### 5. 信息密度管理 (Information Management)
*   **日志展示模式**：
    *   默认隐藏详细日志，点击 "Y" 键或按钮后，以全屏或半全屏 Modal 形式展示日志，而非在狭小的列表项内展开。
*   **进度摘要**：
    *   多任务并行时，聚合进度条应显示在更显眼的位置。

---

## 预期的技术实现建议 (Technical Implementation)

1.  **使用 CSS 变量控制基准倍数**：
    ```css
    :root {
      --dm-scale: 1;
    }
    @media (max-width: 1280px) and (max-height: 800px) {
      :root {
        --dm-scale: 1.2; /* 针对 Steam Deck 整体放大 20% */
      }
    }
    ```
2.  **引入 `useIsHandheld` Hook**：
    通过检测分辨率或 UserAgent，动态切换 `TaskPanel` 的 Class，实现不同的布局策略。

3.  **标准化 OreButton 的尺寸规格**：
    确保在 `DownloadManager` 中使用的按钮遵循 `OreTokens` 的 `unit.controlHeight` (40px)。

---

## 下一步计划 (Next Steps)
1.  [ ] 在 `DownloadManager` 中实现响应式宽度 logic。
2.  [ ] 统一 `TaskItem` 的内部字号标准。
3.  [ ] 优化 `PipelineIndicator` 的视觉尺寸。
