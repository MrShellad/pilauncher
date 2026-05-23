# PiLauncher UI/UX 基础组件深度分析报告 (Primitives Analysis Report)

本报告对 PiLauncher 项目中 `src/ui/primitives/` 目录下的 21 个核心 UI 基础组件（Primitive Components）及其样式文件（位于 `src/style/ui/primitives/` 及 Tailwind 类）进行了多维度的 UI/UX 分析。分析基于以下 6 个核心交互与视觉维度：

1. **一致性与可预测性 (Consistency & Predictability)**：组件状态表现、色彩应用、设计令牌（Design Tokens）是否一致。
2. **清晰的视觉层级 (Clear Visual Hierarchy)**：主次关系、文本可读性、色彩对比度、层深表现。
3. **即时且明确的反馈 (Immediate & Clear Feedback)**：Hover（悬停）、Active（点击）、Focused（聚焦）、Disabled（禁用）和 Loading（加载）状态的视觉转换。
4. **焦点管理与空间导航 (Focus Management & Spatial Navigation)**：是否良好适配 Norigin Spatial Navigation (TV/SteamDeck/手柄导航)，键盘聚焦环效果是否一致，是否存在焦点死锁或遗漏。
5. **像素级对齐 (Pixel-level Alignment)**：组件间盒模型对齐、Padding/Margin 包装合理性、响应式边界溢出。
6. **微交互与动画曲线 (Micro-interactions & Animation Curves)**：动画过渡是否自然流畅，物理下压反馈是否连贯，是否存在布局突变（Layout Snapping）。

---

## 一、 优化建议汇总表 (Summary Table)

| 组件名称 | 核心问题分类 | 问题描述 | 优化建议 |
| :--- | :--- | :--- | :--- |
| **[OreAccordion](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreAccordion.tsx)** | 微交互与动画曲线 | 头部面板具有 `transition-none`，导致 hover/active 状态颜色突变。 | 移去 `transition-none`，使用 `transition-colors duration-150` 实现平滑渐变。 |
| **[OreAssetRow](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreAssetRow.tsx)** | 焦点管理 / 视觉反馈 | 1. 选中时使用 `brightness-[0.88]` 变暗，反常规。<br>2. 内部有 interactive 子元素（如 trailing 按钮），但全行作为一个 FocusItem 拦截了所有焦点，导致子按钮手柄无法聚焦。 | 1. 选中时提升亮度或增加白色阴影。<br>2. 将行的 `focusable` 设为 false，将焦点完全委托给行内的交互按钮。 |
| **[OreButton](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreButton.tsx)** | 微交互与动画曲线 | 虽然物理下压（4px 偏移）体验极佳，但颜色切换使用 `transition-none` 显得略微生硬。 | 在保留物理位移动画即时性的同时，为 hover 和 focus 状态的背景色和发光滤镜设置 `duration-75` 渐变。 |
| **[OreCard](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreCard.tsx)** | 焦点管理与空间导航 | **重大缺陷**：完全没有 Norigin Spatial Navigation 支持（无 `FocusItem` 或聚焦样式）。 | 使用 `FocusItem` 包裹卡片，并应用设计令牌中的 `.is-focused` 聚焦环。 |
| **[OreConfirmDialog](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreConfirmDialog.tsx)** | 焦点管理 / 响应式布局 | 1. 覆写 `onArrowPress` 锁死焦点，过于繁重。<br>2. 容器宽度固定为 `w-[450px]`，在小屏/掌机上可能溢出。 | 1. 允许空间导航原生进行水平对齐按键切换。<br>2. 改为响应式宽度 `w-full max-w-[450px]` 并设置合适的侧边距。 |
| **[OreDropdown](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreDropdown.tsx)** | 焦点管理 / 像素级对齐 | 1. 焦点环使用硬编码的 Tailwind 类，与设计令牌不一致。<br>2. 触发器 `padding: 10px 10px 16px 10px` 在固定 40px 高度下导致内容高度仅剩 10px，文字面临裁剪或布局溢出。 | 1. 替换聚焦样式为统一的 `.is-focused` 变量样式。<br>2. 移去触发器的大量上下 padding，改用 Flex 垂直居中。 |
| **[OreHeroButton](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreHeroButton.tsx)** | 即时且明确的反馈 | 禁用状态下，外层 `group` 的 hover/focus 环境光晕（Glow）依然会被激活放大。 | 根据 `disabled` 状态条件性渲染或禁止光晕的 hover 缩放效果。 |
| **[OreIconPicker](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreIconPicker.tsx)** | 焦点管理 / 交互动画 | 1. **重大缺陷**：没有 `FocusItem` 封装，手柄无法选中。<br>2. 弹出面板使用绝对定位易被父级 overflow 截断。<br>3. 展开收起无动画。 | 1. 封装 `FocusItem`。<br>2. 改用 `createPortal` 挂载。<br>3. 使用 Framer Motion 实现展开渐变动画。 |
| **[OreInput](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreInput.tsx)** | 视觉反馈 / 像素级对齐 | 1. 错误状态下重写 shadow 导致丢失 3D 凹陷感。<br>2. 前缀图标（如搜索镜）未使用垂直居中，改变高度时会偏上。 | 1. 错误状态下使用 red border，但保留 inset shadow 深度。<br>2. 居中前缀图标（`top-1/2 -translate-y-1/2`）。 |
| **[OreInstanceCard](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreInstanceCard.tsx)** | 焦点管理与空间导航 | **重大缺陷**：没有 Norigin Spatial Navigation 支持（无 `FocusItem`），无法手柄聚焦。 | 使用 `FocusItem` 包裹卡片，并应用设计令牌中的 `.is-focused` 聚焦环。 |
| **[OreList](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreList.tsx)** | 清晰的视觉层级 (Bug) | **重大视觉 Bug**：当处于 inactive（非激活）状态时，标题文本颜色为 `#48494A`，而背景色也是 `#48494A`，导致文本完全隐形。 | 调整非激活状态的文字颜色（如 `#8C8D90`），增加其与背景色的对比度。 |
| **[OreModal](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreModal.tsx)** | 焦点管理 / 辅助功能 | 1. 采用 `setTimeout` 循环检测焦点，非响应式。<br>2. 焦点恢复时间（120ms）短于弹窗关闭动画时间（150ms）。<br>3. 缺乏 `role="dialog"` 等无障碍属性。 | 1. 在组件生命周期内绑定挂载焦点。<br>2. 延长焦点恢复延时至 160ms。<br>3. 补全 aria 属性。 |
| **[OreOverlayScrollArea](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreOverlayScrollArea.tsx)**| 像素级对齐 | 滑块（Thumb）宽度（16px）超出轨道（6px）过多，若无足够 padding 会遮挡右侧内容。 | 对齐滑块与轨道的宽度，或增大视口右侧的 Padding Inset。 |
| **[OrePinInput](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OrePinInput.tsx)** | 焦点管理 / 微交互 | 1. 未整合 `FocusItem`，手柄无法定位该输入组。<br>2. 插槽机动画运行时，原输入文字与动画浮层文字双重渲染重叠，画面模糊。 | 1. 将 6 位输入框作为一个 FocusItem 整体定位。<br>2. 动画运行中将输入框文字设为 `text-transparent`。 |
| **[OreProgressBar](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreProgressBar.tsx)** | 清晰的视觉层级 | 进度条和下方标签之间使用 `space-y-4` (16px)，显得割裂，没有形成视觉分组。 | 将间距调整为 `space-y-2` (8px) 或 `space-y-1.5`，提高信息紧凑度。 |
| **[OreSegmentedControl](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreSegmentedControl.tsx)**| 焦点管理 / 样式问题 | 1. **重大缺陷**：`tabIndex={-1}` 且无 `FocusItem`，手柄无法切换页签。<br>2. CSS 中 `transition: colors 0.15s` 是无效属性。 | 1. 集成 `FocusItem` 并支持左右方向键切换。<br>2. 修正为 `transition: color 0.15s, background-color 0.15s;`。 |
| **[OreSlider](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreSlider.tsx)** | 像素级对齐 / 健壮性 | 1. 若 `max === min` 导致 NaN 崩溃。<br>2. 滑块中心对齐轨道两端，在 0% 和 100% 时会向外溢出 14px 导致被截断。 | 1. 增加除数零值保护。<br>2. 在最外层 wrapper 上增加左右 `px-[14px]` (或 `px-4`) 的安全边距。 |
| **[OreSwitch](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreSwitch.tsx)** | 一致性与可预测性 | 开关聚焦时文字标签变绿发光，但开关打开（Checked）时文本不发生改变，容易产生“只要移过去就代表打开了”的错误暗示。 | 聚焦时保持白色，开启（Checked）时让标签变绿或增加指示，使状态指示与焦点独立。 |
| **[OreTag](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreTag.tsx)** | 一致性与可预测性 | 缺少 3D 像素描边（而 Button、Card 等组件均有 2px 描边），这使其显得扁平，破坏了视觉语言一致性。 | 增加 `border` 描边，并在深色主题下提供像素化高亮。 |
| **[OreToast](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreToast.tsx)** | 微交互与动画曲线 | 无 layout 动画。当有多个 toast 时，中间的 Toast 消失会导致下面的 Toast 向上突变“闪现”。 | 使用 Framer Motion 的 `<motion.div layout>` 平滑过渡位置。 |
| **[OreToggleButton](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreToggleButton.tsx)** | 清晰的视觉层级 | 激活（Active）和非激活（Inactive）状态的 3D 阴影 and padding 完全一致，这使得激活项看起来仍是“突起”的而非“按下”的。 | 在 `is-active` 状态下，改变 padding 为 `padding-top: 4px; padding-bottom: 2px;`，并调整阴影，展现物理凹陷效果。 |

---

## 二、 21 个 Primitive 组件深度 UI/UX 分析及优化建议

### 1. [OreAccordion](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreAccordion.tsx) (手风琴组件)
* **UI/UX 分析**：
  * **视觉与层级**：标题栏采用 Minecraft 像素风格（`font-minecraft`、`ore-text-shadow`）。内容展开区域具有 `.ore-accordion-content-wrapper`，通过内部阴影（`inset 0 4px 6px`）营造从标题栏下方“穿出”的凹陷深度感，视觉层级清晰。
  * **焦点与导航**：设计优秀。为解决 Norigin 空间导航默认计算全宽按钮中心点导致 ↓ 键导航偏移的问题，将 ref 绑定到紧贴文字的左侧 `div`。手柄 Enter 键正常触发 `isExpanded`。
  * **微交互**：内容动画过渡时间为 `0.25s`，采用了缓入缓出的贝塞尔曲线 `[0.4, 0, 0.2, 1]`；箭头旋转 `180°` 动画平滑。
  * **发现的问题**：`.ore-accordion-header` 样式中设置了 `transition-none`。这导致了当鼠标悬浮或手柄聚焦时，背景色和阴影的切换过于突兀，与下方展开的平滑高度动画形成了强烈的反差。
  * **优化建议**：移去 `transition-none`，对 hover 和 active 状态的 background-color 和 box-shadow 使用 `transition: background-color 0.15s ease, box-shadow 0.15s ease`。

### 2. [OreAssetRow](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreAssetRow.tsx) (资源项行组件)
* **UI/UX 分析**：
  * **视觉与层级**：标题、描述和徽章的展示结构紧凑。
  * **发现的问题 (1) - 焦点死锁与交互缺失**：
    * 当行中 `trailing` 区域包含可交互按钮时，由于全行被 `FocusItem` 接管，用户无法通过手柄选中 trailing 内的按钮，按下手柄 Enter 只能触发整行的点击事件，无法对右侧操作区进行精细控制。
  * **发现的问题 (2) - 亮度反馈异常**：
    * 在选中/聚焦状态下（`isRowActive` 为真），组件使用 `brightness-[0.88]` 让背景变暗。这与主流的“激活时变亮/发光”的交互心智相反，容易让用户产生“该行被禁用”的错觉。
  * **发现的问题 (3) - 像素对齐缺陷**：
    * 左侧色条为 `absolute inset-y-0 left-0 w-2`，由于整行具有 `rounded-sm` 的边角，未作圆角裁切的色条可能会溢出边角，在 4K 电视等高分屏下能看到明显的像素齿轮凸出。
  * **优化建议**：
    1. 当行内存在 interactive 元素时，需将行的 `focusable` 设为 `false`，由行内各个部分自行管理 Focus 关系。
    2. 将聚焦时的亮度变化修改为 `brightness-[1.06]`（增加亮度），配合白色描边。
    3. 给左侧色条增加 `rounded-l-[2px]`，或外层包裹容器使用 `overflow-hidden`。

### 3. [OreButton](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreButton.tsx) (通用按钮组件)
* **UI/UX 分析**：
  * **视觉与设计**：纯正的 3D 像素风格按钮。底部设计了 4px 的立体阴影。
  * **即时反馈**：物理按压设计得极为巧妙。在 `:active` 状态下，通过 `transform: translateY(4px)` 使按钮下沉，同时清空底部 4px 留白并将 padding 设为 0。这种做法不仅实现了真实的“下按”效果，而且不会导致盒模型高度改变，从而完全避免了布局塌陷和抖动。
  * **空间导航**：集成 `FocusItem`，聚焦环外发光效果（HDR Ready drop-shadow）精美，在暗色和亮色背景下都有清晰的可视度。
  * **发现的问题**：`.ore-btn` 使用了 `transition-none`。为了追求即时的物理按压手感而禁用了所有过渡是可以理解的，但 Hover 状态下的颜色切换（如灰色到深灰）瞬间发生，会略显僵硬。
  * **优化建议**：保留 active 下沉的瞬间转换，但对 hover 状态下的背景色过渡施加轻微动画，如 `@apply transition-colors duration-75;`。

### 4. [OreCard](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreCard.tsx) (通用卡片组件)
* **UI/UX 分析**：
  * **视觉与层级**：卡片包含了媒体区（160px 高度、内阴影）、信息区和操作区（页脚），布局得当，信息层级优秀。
  * **发现的问题 - 空间导航缺失**：
    * **重大 UX 缺陷**：`OreCard` 容器绑定了 `onClick` 且有 hover 变亮效果，但组件中完全没有 `FocusItem` 包裹，也没有定义任何 `:focus` / `is-focused` 聚焦环。使用键盘或手柄导航时，该卡片会被空间导航引擎完全跳过，根本无法聚焦和点击。
  * **优化建议**：
    在 `OreCard.tsx` 中集成 `FocusItem`，并将外层容器的类名和 ref 与 FocusItem 的回调参数绑定。当 `focused` 为真时，为卡片加上与 Button、Dropdown 一致的亮色聚焦描边。

### 5. [OreConfirmDialog](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreConfirmDialog.tsx) (确认弹窗组件)
* **UI/UX 分析**：
  * **视觉与层级**：大图标位于中央，结合了淡入淡出的危险/警告背景（`toneClasses`），危险动作提示极其醒目。
  * **即时反馈**：当处于 `isConfirming` 状态时，确认按钮会自动渲染 `Loader2` 旋转动画，并锁定自身禁止重复点击，防止用户二次触发。
  * **发现的问题 (1) - 繁琐的焦点管理**：
    * 组件内部在 `onArrowPress` 中自定义了左右方向键的切换逻辑（通过手动执行 `setFocus` 并返回 `false`）。由于弹窗内的操作按钮是标准的水平 Flex 排列，Norigin 引擎本身就能极其灵敏地自动识别水平聚焦，手动覆写会导致代码过于繁重，增加维护成本。
  * **发现的问题 (2) - 宽度硬编码**：
    * 组件外层宽度硬编码为 `w-[450px]`。在诸如小屏幕掌机（如 Steam Deck 在 800p 分辨率）或者更小尺寸设备下，可能会横向超出安全区域。
  * **优化建议**：
    1. 移除 `handleActionArrow` 中多余 of `left` / `right` 拦截逻辑，让 Norigin 引擎自动寻找下一个水平按钮。
    2. 将宽度类替换为 `w-full max-w-[450px]` 以适配响应式边界。

### 6. [OreDropdown](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreDropdown.tsx) (下拉选择组件)
* **UI/UX 分析**：
  * **交互与导航**：在菜单展开时会主动暂停全局空间导航（`pause()`），并用键盘侦听器（`ArrowUp` / `ArrowDown` / `Enter` / `Escape`）来聚焦选项，选中后恢复（`resume()`）。这完美避免了下拉框展开后由于焦点溢出导致下层页面发生意外滚动的严重问题。
  * **文本截断**：提供了 `renderMiddleTruncate`（中间省略号），使形如 “我的生存实例 (Fabric 1.20.1)” 的超长名称能够保留右侧的版本和加载器，只在中间进行折叠截断，极其切合启动器的业务场景。
  * **发现的问题 (1) - 像素对齐（高宽错乱）**：
    * 下拉按钮外层 `.ore-dropdown-root` 被限定为固定高度 `h-[40px]`。然而，子元素 `.ore-dropdown-trigger` 的 CSS 样式却具有 `padding: 10px 10px 16px 10px`（垂直 Padding 达 26px）。扣除 4px 的边框高度后，留给文本的实际内容高度仅剩 `10px`！由于 Minecraft 字体通常有 `20px` 左右的行高，这直接导致文字在很多情况下偏上、被边缘裁剪，甚至使整个盒模型高度被强行撑高导致像素错位。
  * **发现的问题 (2) - 聚焦环不一致**：
    * 聚焦时使用了硬编码的 Tailwind 类：`scale-[1.02] ring-2 ring-white shadow-lg brightness-110`，与项目中全局的 `is-focused`（具有偏移量的亮色边框和 HDR drop-shadow Glow）不符。
  * **优化建议**：
    1. 调整触发器 padding：移除大尺寸上下 padding，高度设为 `h-full`，使用 Flexbox 的 `items-center` 来实现文字的绝对垂直居中。
    2. 统一聚焦环风格：将 `focused` 状态下的类名和样式替换为设计令牌定义的 focus ring 标准。

### 7. [OreHeroButton](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreHeroButton.tsx) (英雄/主行动按钮组件)
* **UI/UX 分析**：
  * **视觉与层级**：专为主交互界面设计（例如“启动游戏”按钮）。底层带有环境漫反射光晕（Glow），并通过 `clamp()` 响应式实现从大屏幕到 4K 电视的自适应字号。
  * **微交互**：支持 `isPulse`，会在闲置时慢速闪烁，非常具有视觉吸引力。
  * **发现的问题**：
    * 当组件传入 `disabled` 属性时，虽然底层的 `OreButton` 变为了禁用状态，但包裹它的父级 `group` 的 `group-hover:bg-ore-green/50` 依然会被鼠标触发，从而导致禁用的按钮在悬浮时依然会散发出亮绿色的发光特效。这种视觉暗示是不正确的。
  * **优化建议**：
    根据 `disabled` 属性条件性地将 Glow 背景遮罩的 hover 和 focus 状态类剥离。例如：`${!disabled ? 'group-hover:bg-ore-green/50 group-focus-within:bg-ore-green/60' : ''}`。

### 8. [OreIconPicker](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreIconPicker.tsx) (图标选择组件)
* **UI/UX 分析**：
  * **视觉设计**：3D 凸起风格按钮，内部为网格排布的 34 个像素化图标。
  * **发现的问题 (1) - 空间导航缺失**：
    * **重大 UX 缺陷**：组件完全没有集成 `FocusItem`！它只使用了原生的 `focus-visible:outline-white`。在用手柄或键盘的方向键导航时，这个图标选择器会被完全无视。
  * **发现的问题 (2) - 定位与截断风险**：
    * 下拉面板使用 `absolute left-0 top-[calc(100%+0.5rem)]` 绝对定位，且宽度固定为 `w-[24rem]` (384px)。如果此 Picker 位于弹窗的最底部或屏幕最右侧，它的面板会被上层 `overflow-hidden` 容器强行截断。
  * **发现的问题 (3) - 缺乏过渡**：
    * 面板展开/折叠使用了 `{isOpen && ...}`，没有任何淡入或缩放动画，弹出非常生硬。
  * **优化建议**：
    1. 使用 `FocusItem` 包裹按钮，允许手柄聚焦。
    2. 下拉面板使用 `createPortal` 挂载到 body 上，并引入类似于 `OreDropdown` 的几何定位计算（Placement 计算）。
    3. 使用 Framer Motion 的 `AnimatePresence` 对面板赋予缩放展开过渡动画。

### 9. [OreInput](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreInput.tsx) (输入框组件)
* **UI/UX 分析**：
  * **交互设计**：当手柄或键盘聚焦于外层并按下 Enter 时，会主动触发内部 Input 的 focus (`internalRef.current?.focus()`)。在输入完成后，按下 Enter 或 Escape 会主动调用 `blur()` 将焦点退还给空间导航。这一焦点“逃生舱”设计非常优秀。
  * **发现的问题 (1) - 错误状态下的 3D 感丢失**：
    * 正常状态下的输入框采用 `bg-[#1E1E1F]` 和 `inset 0 2px 4px rgba(0,0,0,0.4)` 内阴影呈现出深邃的内凹效果。然而，当触发错误状态时，Tailwind 的外发光阴影类 `shadow-[0_0_0_1px_red]` 会直接覆盖掉原生的 `box-shadow` 内阴影，使得输入框在发生错误时瞬间变为了“扁平”的块，丢失了层级深度。
  * **发现的问题 (2) - 前缀图标对齐问题**：
    * 左侧前缀图标（例如搜索放大镜）直接被设为 `absolute left-3`，没有配置任何垂直居中的样式。如果外部传入不同的 `height`（如 `h-[48px]`），图标会固死在顶部左侧，无法做到垂直居中。
  * **优化建议**：
    1. 在错误状态下，避免直接用 shadow 覆盖原有的阴影。可以在 CSS 中为错误状态定义专门的 `.ore-input.has-error` 样式，保持内阴影的同时应用红边。
    2. 为前缀图标容器增加 `top-1/2 -translate-y-1/2` 保证任何高度下的完美居中。

### 10. [OreInstanceCard](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreInstanceCard.tsx) (实例列表卡片组件)
* **UI/UX 分析**：
  * **视觉与层级**：卡片分为封面图（16:9比例）、信息描述和底部 Last Played 时间，版面非常适合作为启动器的主选择栏。选中状态使用 `border-ore-green` 描边，并在右上角叠有播放图标，反馈即时。
  * **发现的问题 - 空间导航缺失**：
    * **重大 UX 缺陷**：作为一个至关重要的实例卡片组件，它居然只设置了原生的 `focus-visible:ring-2`，没有接入 Norigin Spatial Navigation。这意味着使用手柄在主界面上下左右移动时，根本无法聚焦和切换实例！
  * **优化建议**：
    引入 `FocusItem` 包裹卡片，将 focused 状态与样式中的 active/focused 连动，提供统一的外发光聚焦效果。

### 11. [OreList](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreList.tsx) (通用列表项组件)
* **UI/UX 分析**：
  * **视觉与层级**：左侧图标、中间大字重标题、小字号副标题和描述，结构紧凑。
  * **发现的问题 (1) - 隐形文本 Bug (重大缺陷)**：
    * **这是一个致命的视觉缺陷**：组件在 inactive（非激活）状态下的文本颜色判定逻辑为：
      `${disabled || isInactive ? 'text-[#48494A]' : 'text-[#FFFFFF]'}`
      这意味着当 `isInactive` 为真时，标题文本颜色为 `#48494A`。然而，列表项本身的背景色恰恰也是 `#48494A`！
      这直接导致非激活项的标题文字与背景完全融为一体，**文字在屏幕上彻底隐形**！
  * **发现的问题 (2) - 外层 Padding 破坏边缘对齐**：
    * 组件最外层被硬编码了 `p-1.5`。这会导致当多个列表项垂直排列时，它们之间会叠加产生双倍的 padding，并且无法与页面其他边界元素做到完美像素对齐。
  * **优化建议**：
    1. 将 `isInactive` 的文字颜色更改为例如较浅的灰色 `#8C8D90` 或者是 `#B1B2B5`，确保即便处于灰暗的非激活状态也至少有足够的对比度可读。
    2. 将外层 `p-1.5` 移除，将间距的控制权交给列表父容器（如在父容器中使用 `gap-2`）。

### 12. [OreModal](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreModal.tsx) (弹窗基类组件)
* **UI/UX 分析**：
  * **焦点安全锁**：弹窗打开时会自动记录当前的焦点键，关闭时自动延迟 `120ms` 将焦点还给原来的页面位置，防止发生“焦点丢失”而导致手柄失灵。
  * **发现的问题 (1) - 焦点循环检测代码味道**：
    * 代码中采用了一个设定最大检测次数（14次）并每次间隔 `70ms` 的 `setTimeout` 定时器来循环检测 modal 内部的 FocusItem 是否挂载成功。这是一种“轮询检测”的低效做法，如果在非常卡顿的设备上，可能检测结束后 DOM 仍未完全就绪，或者多余的定时器消耗性能。
  * **发现的问题 (2) - 恢复焦点时间差错误**：
    * 恢复焦点的 `setTimeout` 被设为了 `120ms`，但 Modal 退出的 Framer Motion 动画时间为 `0.15s` (即 `150ms`)。在动画未完全淡出（120ms）时就强行尝试让底层的元素获取焦点，很可能会由于遮罩还未彻底消失而失败。
  * **发现的问题 (3) - 缺乏 Aria 无障碍属性**：
    * 弹窗外层只是普通的 div，缺少 `role="dialog"` 和 `aria-modal="true"`，对于屏幕阅读器极度不友好。
  * **优化建议**：
    1. 可以使用 Norigin 空间导航的 FocusBoundary 特性进行自动聚焦定位，替代手动轮询。
    2. 将焦点恢复的延时从 `120ms` 修改为 `160ms` 以上，确保 Modal 动画完全走完。
    3. 为外层容器补全 `role="dialog"`、`aria-modal="true"`。

### 13. [OreOverlayScrollArea](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreOverlayScrollArea.tsx) (自定义滚动区域组件)
* **UI/UX 分析**：
  * **视觉与层级**：滚动条被设计为 Minecraft 风格的灰色滑块，并带有一圈高光 and 阴影。鼠标悬停或按住拖拽时会有极高亮度的物理高光与光环。
  * **微交互**：滚动条会在闲置 900ms 后平滑淡出，一旦发生滚动或鼠标移入就立刻展现，符合现代交互直觉。
  * **发现的问题**：
    * 在 CSS 中，滑块（Thumb）具有 `left: -5px; right: -5px` 样式，这意味着滑块的总宽度达到了 `16px` (轨道宽 6px + 左右溢出 10px)。在很多紧凑的布局中，若视口右侧没有预留超过 `18px` 的 padding，滑块在滚动时会硬生生地压在右侧内容的文字上方，破坏界面整洁。
  * **优化建议**：
    如果希望保留宽滑块以增大鼠标触控面，请务必保证在滚动视口右侧留足 `contentSafePaddingRight`（建议至少 20px）。

### 14. [OrePinInput](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OrePinInput.tsx) (PIN码/双重认证输入组件)
* **UI/UX 分析**：
  * **极具创意的交互**：包含极为出彩的“老虎机”滚轮式加载动画（Rapid cycle digits）和闲置低频字符跳动动画（Idle glitch pulse），使得输入过程极其炫酷且富有科技感。
  * **发现的问题 (1) - 空间导航缺失**：
    * **重大 UX 缺陷**：PinInput 虽然在内部对按键进行了捕获，并允许通过左右方向键切换输入框焦点：
      `inputsRef.current[index - 1]?.focus();`
      但这完全是原生 DOM 行为！因为整个组件外部没有包裹任何 `FocusItem`，所以在手柄进行空间导航时，会直接跳过整排输入框，导致用户彻底无法进入 PIN 码输入流程。
  * **发现的问题 (2) - 文字重叠重影**：
    * 在 slot 动画运行时，`<input>` 标签依然会显示随机字符的文本，同时 `<motion.div>` 又会在上方渲染一层缩放跳跃的字符。因为两个元素重叠在同一个位置渲染同一个字母，会引发严重的文字重影和锯齿抖动，UX 显得粗糙。
  * **优化建议**：
    1. 用 `FocusItem` 将这组 PIN 输入框作为一个整体的焦点包裹起来。当聚焦时，自动把原生 Focus 定位到当前需要输入的那个 Input 格子上。
    2. 当老虎机动画激活时，将 `<input>` 标签的文字颜色设定为 `text-transparent`（透明），仅展示上方动画浮层的文字，解决重叠锯齿问题。

### 15. [OreProgressBar](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreProgressBar.tsx) (进度条组件)
* **UI/UX 分析**：
  * **视觉与层级**：绿色进度填充，配以高对比度的明暗条纹，很有像素游戏进度装载的感觉。
  * **发现的问题 (1) - 元素割裂**：
    * 外层使用了 `space-y-4`。这使得上方的进度条与下方的下载进度描述文本（例如 “正在解压...” 和 “82%”）之间隔开了足足 16px 的巨大缝隙。这违违了邻近原则，文字和进度条看起来像是两个独立的块。
  * **发现的问题 (2) - 缺乏无障碍标记**：
    * 缺乏 `role="progressbar"`、`aria-valuenow` 属性。
  * **优化建议**：
    1. 将外层 `space-y-4` 缩减为 `space-y-2` (8px) 或 `space-y-1.5`。
    2. 补充标准无障碍语义属性。

### 16. [OreSegmentedControl](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreSegmentedControl.tsx) (分段控制器/标签切换组件)
* **UI/UX 分析**：
  * **响应式支持**：通过 `:root` CSS 变量和四个媒体查询级别，组件的高度和内边距能在 SteamDeck（矮屏）、PC（标准）和 TV（巨幕）之间平滑自适应，确保了无论在哪种视域距离下都有极高的可读性。
  * **发现的问题 (1) - 空间导航缺失**：
    * **重大 UX 缺陷**：每个分段标签按钮被写死了 `tabIndex={-1}`，且完全没有任何 `FocusItem` 接管。这使得整套控制器在手柄/键盘导航下沦为摆设，用户根本无法通过左右键切换标签页（比如设置面板中的“通用/账号/高级”切换）。
  * **发现的问题 (2) - 无效的 CSS Transition**：
    * 样式文件中存在一行无效代码：`transition: colors 0.15s;`。由于 CSS 中并不存在 `colors` 这个属性（Tailwind 中的 colors 是其自定义编译类），该过渡效果会被浏览器视作语法错误而直接丢弃，导致悬浮和激活状态切换没有任何渐变。
  * **优化建议**：
    1. 将每个按钮用 `FocusItem` 包裹，并支持手柄按下 A 键/Enter 键执行 onChange 切换。
    2. 将无效样式修正为：`transition: color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;`。

### 17. [OreSlider](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreSlider.tsx) (滑动条组件)
* **UI/UX 分析**：
  * **交互细节**：完美支持了空间导航。当聚焦时，拦截左右键的冒泡和默认事件，并将其转换为滑块数值的增减，是标准的电视/掌机端 Slider 最佳实践。
  * **发现的问题 (1) - 除零崩溃风险**：
    * 在计算 percentage 时直接计算了 `(value - min) / (max - min)`。如果由于外部参数传递失误导致传入的 `max` 等于 `min`，会引发除零错误导致得出 `NaN`，使 React 崩溃。
  * **发现的问题 (2) - 滑块左右溢出截断**：
    * 滑动块（Thumb）具有 28px 宽度且定位在 `left: percentage%`（搭配 `-50%` X轴位移）。这意味着当进度为 0% 时，滑块会向左探出 14px；为 100% 时，向右探出 14px。因为滑动条外壳 `.ore-slider-wrapper` 具有 `px-0`，这会导致滑块两端溢出容器边界，极易被父级截断，或者覆盖在周围元素上。
  * **优化建议**：
    1. 增加百分比除数守护：`const range = max - min; const percentage = range > 0 ? ((value - min) / range) * 100 : 0;`。
    2. 在滑动条容器 `.ore-slider-wrapper` 上增加 `px-[14px]` (或者 `px-4`) 的水平内边距，为滑块左右平移预留出充足的安全缓冲带。

### 18. [OreSwitch](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreSwitch.tsx) (开关组件)
* **UI/UX 分析**：
  * **物理回弹微交互**：开关的滑块在切换状态时使用 cubic-bezier 缓动：
    `transition: left 125ms cubic-bezier(0.34, 1.56, 0.64, 1);`
    这是一个经典的 `easeOutBack` 回弹曲线，滑块在滑行到重点时会有一个微弱的弹跳效果，手感极为生动。
  * **发现的问题 (1) - 误导性的标签颜色**：
    * 当组件处于 `focused`（聚焦）状态时，文本标签颜色会变为 `text-[var(--ore-btn-primary-bg)]`（即亮绿色）并产生绿色光环。然而，开关开启（Checked）时文本反而是白色的。这会导致用户产生混淆：看到文字亮绿，就误以为开关是“打开”的。
  * **发现的问题 (2) - 禁用文本无区分**：
    * 禁用状态下，文字依然保持 `text-white`（普通状态色），未能向用户传达“该项已被锁定”的视觉反馈。
  * **优化建议**：
    1. 让聚焦态仅在开关轨（Track）外部展示聚焦边框，保持文本颜色依然为白色或柔和的浅色。
    2. 当处于禁用状态时，将文本变更为 `text-[#5A5A5A]` 灰色。

### 19. [OreTag](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreTag.tsx) (标签组件)
* **UI/UX 分析**：
  * **视觉与层级**：提供 neutral、primary、informative、warning 等多种背景色，在信息归类上非常明确。
  * **发现的问题 - 扁平感破坏整体风格**：
    * 在一个处处强调 3D 物理描边和凸凹感（Button、InstanceCard、Dropdown 均为 2px 黑边和内阴影）的像素风格界面里，`OreTag` 却是完全“扁平”的块（无任何边框或阴影）。这打破了界面视觉的一致性，使得标签看起来像是别处塞进来的扁平素材。
  * **优化建议**：
    为标签追加一圈 `border` 或微弱的立体边界，让其融入整体的 voxel 视觉基调。

### 20. [OreToast](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreToast.tsx) (全局气泡提示组件)
* **UI/UX 分析**：
  * **提示层级**：右侧带有快捷关闭的 `X` 按钮，气泡有 2px 的深色立体边缘，提示度极高。
  * **发现的问题 - 移除瞬间布局突变**：
    * 组件没有引入动画库来管理卡片队列的重新排列。当存在多个 Toast 气泡且用户点击关闭了其中一个中间的气泡时，下方的气泡会因为 CSS Flexbox 排布原因**在一瞬间“瞬移闪现”**到上个格子上，交互显得粗糙。
  * **优化建议**：
    使用 Framer Motion 的 `<motion.div layout>` 包裹气泡卡片。这样不仅气泡淡出是平滑的，下方的气泡在向上移动时也会自动绘制平滑的滑动过渡。

### 21. [OreToggleButton](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreToggleButton.tsx) (切换按钮组组件)
* **UI/UX 分析**：
  * **视觉设计**：按钮组外部具有统一黑边，内部按钮横向排列，自适应 uiScale 尺度。
  * **发现的问题 - “双凸起”立体视觉悖论**：
    * 样式中未激活项具有：
      - `padding-bottom: 6px; padding-top: 0;` 和 3D 凸起阴影。
    * 而激活态（`is-active`）按钮也使用了：
      - `padding-bottom: 6px; padding-top: 0;` 和 3D 凸起阴影。
    * 这产生了一个视觉悖论：即便按钮被选中了，它在视觉上仍然是“高高凸起”的。这违背了物理直觉——选中的项应该看起来是“按下去凹陷”的。
  * **优化建议**：
    修改 `.ore-toggle-btn-item.is-active` 的 padding，使其在激活时下沉：`padding-top: 4px; padding-bottom: 2px;`，并将阴影改为向内凹陷阴影（类似于 `:active` 状态），以此增强“按压锁定”的视觉可预测性。

---

## 三、 总结行动指南 (Next Steps)

针对上述分析，建议按照以下优先级推进重构开发：

1. **P0 (必须立即修复 - 阻断性 bug / 严重不一致)**：
   * 修复 **OreList** 在 inactive 状态下的隐形标题文本 bug。
   * 为 **OreCard**、**OreInstanceCard**、**OreIconPicker**、**OreSegmentedControl** 和 **OrePinInput** 接入 Norigin Spatial Navigation (`FocusItem`)。这些组件目前在键盘/手柄操作下处于失联状态，严重损害了多终端适配体验。
   * 修复 **OreDropdown** 触发器的 Padding 与盒模型高度冲突，解决文字裁剪问题。
2. **P1 (强烈建议修复 - 破坏交互心智 / 细节缺陷)**：
   * 调整 **OreAssetRow** 聚焦时变暗的反馈方式；重新梳理当行内包含独立按钮时的焦点代理逻辑。
   * 调整 **OreToggleButton** 激活态按钮的阴影与 Padding，建立真实的物理下凹深度感。
   * 修正 **OreSwitch** 聚焦文字变绿而 Checked 时文字不变色的逻辑漏洞，并补齐 disabled 文字样式。
   * 去除 **OreSegmentedControl** 中的无效 CSS Transition 语法，恢复渐变过渡。
3. **P2 (体验加分项 - 视觉 polish)**：
   * 为 **OreToast** 增加 Framer Motion 的 `layout` 动画，消除提示框消失导致的布局跳动。
   * 优化 **OreSlider** 边缘 14px 溢出剪裁缺陷，添加零值安全保护。
   * 为 **OreTag** 增加像素描边，统一整体视觉语言。
