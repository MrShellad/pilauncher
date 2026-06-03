# src/ui/primitives 核心基础组件 Motion 动效优化设计方案

本方案旨在为项目核心基础 UI 组件（`src/ui/primitives`）引入基于新版统一 `motion`（原 Framer Motion）的微交互动效。整体动效以**清脆、极速响应、带有弹性物理质感**为核心设计原则，契合启动器的硬朗像素风格。

---

## 一、 组件动效详细设计方案

### 1. `OreToast.tsx`（全局通知弹窗）
* **现状问题**：目前通过组件内部的定时器配合手动追踪 `visible` / `exiting` 状态改变原生 CSS transition 属性，代码复杂度高，且在退出阶段可能发生闪烁。
* **动效设计**：
  - 在外层容器 `OreToastContainer` 内包裹 `<AnimatePresence>`，接管通知的挂载与卸载生命周期。
  - 将 `ToastEntry` 最外层容器升级为 `motion.div`。
* **物理参数**：
  - **初始状态 (initial)**：`{ opacity: 0, y: 30, scale: 0.95 }`
  - **进入状态 (animate)**：`{ opacity: 1, y: 0, scale: 1 }`
  - **退场状态 (exit)**：`{ opacity: 0, y: -20, scale: 0.95 }`
  - **进入曲线 (transition)**：`type: "spring", stiffness: 280, damping: 24`（极低震颤，平滑落地）。
  - **退出曲线 (transition)**：`type: "tween", ease: "easeIn", duration: 0.15`（快速淡出）。
* **收益**：缩减定时器代码，保证退出动效 100% 顺畅执行。

---

### 2. `OreSegmentedControl.tsx`（分段选项卡控制栏）
* **现状问题**：切换选项卡（Tab）时，激活高亮底色背景（Active Background）生硬瞬移，缺乏视觉引导。
* **动效设计**：
  - 利用 Framer Motion 的 **Magic Move (共享布局)** 机制。
  - 移去静态 CSS 的激活背景效果，改为在当前 `isActive === true` 的按钮中渲染 `<motion.div layoutId="segmented-active-bg" className="absolute inset-0 bg-[#48494A] z-0" />`。
* **物理参数**：
  - **平移过渡**：`transition={{ type: "spring", stiffness: 380, damping: 30 }}`（滑块跟随按键迅速平滑滑过）。
* **收益**：Tab 切换滑块手感顺滑流畅，极具高级感。

---

### 3. `OreSwitch.tsx`（开关滑块）
* **现状问题**：开关轨道的变色和滑块（Thumb）的位移完全依赖原生 CSS，过渡生硬。
* **动效设计**：
  - 将轨道与推钮 Thumb 改为 `motion.div`。
  - **滑块平移 (Thumb)**：`animate={{ x: checked ? "1.5rem" : "0rem" }}`
  - **轨道变色 (Track)**：`animate={{ backgroundColor: checked ? "var(--ore-btn-primary-bg)" : "rgba(0,0,0,0.3)" }}`
* **物理参数**：
  - **Thumb 曲线**：`type: "spring", stiffness: 500, damping: 30`（清脆快速的弹性回弹，模拟硬拉式拨档开关手感）。
  - **Track 曲线**：`type: "tween", ease: "easeInOut", duration: 0.15`
* **收益**：点击切换时具备清脆、扎实的触觉拟真感。

---

### 4. `OreCheckbox.tsx`（复选框）
* **现状问题**：对勾 SVG 采用显隐控制，无任何过渡，勾选变化突兀。
* **动效设计**：
  - 对对勾 `<svg>` 标签使用 `<AnimatePresence>` 进行条件渲染。
  - 对勾线条应用缩放与淡入淡出。
* **物理参数**：
  - **入场**：`initial={{ scale: 0.5, opacity: 0 }}` $\to$ `animate={{ scale: 1, opacity: 1 }}`（`type: "spring", stiffness: 450, damping: 20`）。
  - **退场**：`exit={{ scale: 0.8, opacity: 0, transition: { duration: 0.08 } }}`。
* **收益**：赋予每一次点击勾选明确且灵动的动效确认。

---

### 5. `OreButton.tsx` / `OreHeroButton.tsx`（按钮原语）
* **现状问题**：主要依赖 `:hover` 或 `:focus` 改变亮度和外框线，触按状态反馈不突出。
* **动效设计**：
  - 保持已有的Norign空间导航外框，对 `button` 容器添加微互动。
* **物理参数**：
  - **轻按反馈 (whileTap)**：`scale: 0.97`
  - **悬停缩放 (whileHover)**：`scale: 1.02`（`transition: { duration: 0.1 }`）。
* **收益**：无论是鼠标点击，还是手柄/键盘回车触按，都能提供下沉与回弹的物理反馈。

---

### 6. `OreProgressBar.tsx`（进度条）
* **现状问题**：数值改变时直接调用 CSS width 线性渐变，进度突变（如 0% 直接到 50%）时移动显得僵硬。
* **动效设计**：
  - 进度填充层升级为 `motion.div`。
  - 控制 `width` 的物理渐变：`animate={{ width: `${value}%` }}`。
* **物理参数**：
  - **过渡曲线**：`type: "spring", stiffness: 120, damping: 22`（带有一丝阻尼液体感的弹性流淌）。
* **收益**：进度更新顺滑自然，防止突兀的宽度跳跃。

---

### 7. `OreSlider.tsx`（音量/亮度等滑动条）
* **现状问题**：滑块（Thumb）在拖拽时尺寸无变化，缺少操作手感。
* **动效设计**：
  - 将滑块 Thumb 升级为 `motion.div`。
* **物理参数**：
  - **持握拉伸 (whileTap)**：`scale: 1.25`（拖拽或调整时滑块明显膨胀）。
  - **悬停高亮 (whileHover)**：`scale: 1.1`。
* **收益**：提供显著的“正在握持拖动”状态指示。

---

## 二、 动效物理参数全局参考 (HSL & Configs)

为保持系统动效风格一致性，各组件物理参数推荐如下配置：

| 动效类型 | 刚度 (Stiffness) | 阻尼 (Damping) | 备注 |
| :--- | :--- | :--- | :--- |
| **清脆微动效**（Switch, Button） | 500 | 30 | 极快反馈，不拖泥带水 |
| **标准弹性体**（Modal, Toast） | 280 | 24 | 平滑微弹，舒适稳重 |
| **柔和缓动**（ProgressBar） | 120 | 22 | 类似流体流动，柔和过渡 |

## 三、 重构可行性及注意事项

1. **空间导航兼容性**：
   - 现有的 `FocusItem` / Norign 空间导航仅追踪 DOM 节点的聚焦状态与 `focusKey`。我们所作的动效调整均是在包装层或内部渲染层上进行 `motion` 改动，**100% 兼容现有的焦点树和手柄遥控**。
2. **性能与虚拟化**：
   - 对于可能会在长列表中频繁渲染的组件（如 `OreButton`、`OreCheckbox`），`whileTap` / `whileHover` 的开销极小。
   - `motion` 已做了 GPU 加速优化，不会对 Tauri 桌面端的性能（尤其是在 Steam Deck 等便携终端上）造成显著负担。
3. **样式防撕裂**：
   - 所有平移和缩放动画均通过 `transform` (GPU 硬件加速) 驱动，避免改变 `top` / `left` / `margin` 等导致浏览器重排（Reflow）的属性，以防止界面的像素线条产生虚化与边缘毛刺。
