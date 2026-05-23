# PiLauncher 新闻与资讯页面 (News) UI/UX 深度审计报告

本报告对 PiLauncher 新闻与资讯页主模块 [News.tsx](file:///H:/VSCodeWork/pilauncher/src/pages/News.tsx) 及其核心列表卡片组件 [NewsCard.tsx](file:///H:/VSCodeWork/pilauncher/src/features/home/components/NewsCard.tsx) 进行多维度的 UI/UX 体验审计，涵盖一致性、视觉层级、即时反馈、空间导航、像素对齐及微交互六大体验支柱。

---

## 1. 一致性与可预测性 (Consistency & Predictability)

### 现有设计亮点
* **国际化适配统一**：页面文案使用 `NEWS_PAGE_COPY` 常量，根据系统当前语言（`i18n.language`）动态映射，保证了多语言环境下页面内容的一致性。
* **组件化重用**：卡片内部的动作按钮完全基于系统预设的基础按钮 [OreButton.tsx](file:///H:/VSCodeWork/pilauncher/src/ui/primitives/OreButton.tsx)，使视觉风格（边框、字体、圆角）与主界面高度契合。
* **回退动作可预测**：支持全局的 `CANCEL` 动作监听，按下手柄 B 键或键盘 Esc 键可以立即安全返回 `home` 主界面，交互路径简单直接。

### 优化空间与建议
1. **硬编码中文字符串**：
   * **问题**：[NewsCard.tsx](file:///H:/VSCodeWork/pilauncher/src/features/home/components/NewsCard.tsx) 的第 45 行将“创建对应实例”按钮的文本写死为默认值 `createInstanceLabel = '创建对应实例'`。这在非中文环境下会导致该重要按钮显示为中文，破坏了国际化设计的一致性。
   * **优化建议**：将默认文本提取为 `i18n` 语言包词条，或者从父页面 [News.tsx](file:///H:/VSCodeWork/pilauncher/src/pages/News.tsx) 中动态传入翻译后的文本。
2. **快捷键文本硬编码**：
   * **问题**：刷新和返回按钮右侧的按键提示符（`X` 和 `B`）被包裹在普通 span 中硬编码显示。如果用户在设置中自定义了手柄或键盘的动作绑定，这里的静态文本将与实际绑定的物理按键不符，造成误导。
   * **优化建议**：从输入映射系统（`InputDriver`）中动态获取 `'ACTION_X'` 和 `'CANCEL'` 的实际物理按键字符进行渲染。

---

## 2. 清晰的视觉层级 (Clear Visual Hierarchy)

### 现有设计亮点
* **经典的 3D 拟真质感**：资讯卡片标题使用了 `.ore-text-shadow`，配合暗色背景和渐变遮罩，使文本浮现于图片之上，具备强烈的 Minecraft 像素复古风格。
* **信息分组明晰**：卡片顶部的悬浮徽章清晰地区分了新闻的发布时间（左侧）和文章的标签类型（右侧），视觉对齐工整。
* **标题截断机制**：通过 CSS 的 `-webkit-line-clamp: 2` 确保标题最长只占据两行高度，避免超长标题将卡片下方内容挤出边界，保证了多卡片并排时的底部水平线对齐。

### 优化空间与建议
1. **封面背景兜底色不调和**：
   * **问题**：在图片加载失败或没有图片资源时，[NewsCard.tsx](file:///H:/VSCodeWork/pilauncher/src/features/home/components/NewsCard.tsx) 第 79 行使用的兜底渐变色是 `#0f4c81` (经典蓝) 到 `#3fa34d` (绿色)。这组高饱和度的蓝绿渐变色与 PiLauncher 全局沉稳的暗灰/荧光绿（OreUI）主题色调不匹配，显得有些突兀。
   * **优化建议**：替换为暗灰色调到 OreUI 品牌绿色的渐变，例如 `linear-gradient(135deg, #1E1E1F 0%, #313233 50%, #5B8731 100%)`。

---

## 3. 即时且明确的反馈 (Immediate & Clear Feedback)

### 现有设计亮点
* **无延迟旋转指示**：点击刷新按钮时，`isRefreshing` 状态会立刻让 `RefreshCw` 矢量图标旋转，提供了直观的“正在加载中”反馈。
* **高水准的骨架屏设计**：在初始数据未加载完成时，会渲染两个完全还原卡片边框与布局结构的骨架卡片（Skeleton Cards），并配合 `animate-pulse` 闪烁效果，避免白屏尴尬。
* **动态流式加载提示**：在滚动加载更多时，页面底部会有 `isRefreshing ? pageCopy.refreshing : pageCopy.loadingMore` 提示语，给用户清晰的加载阶段反馈。

### 优化空间与建议
1. **异常状态操作受限**：
   * **问题**：当新闻加载出错（`resolvedError` 存在）时，页面会在顶部展示大面积红色警告条。但该警告条内缺少手柄/键盘可以直接聚焦并触发的“重试（Retry）”按钮。玩家必须将焦点向上移动至右上角的刷新按钮才能重新获取，操作链过长。
   * **优化建议**：在错误信息警告条的右侧，放置一个可以直接聚焦的 “重新尝试” 动作按钮，简化异常恢复路径。
2. **骨架屏硬编码背景色**：
   * **问题**：骨架卡片使用了硬编码的十六进制颜色（如 `bg-[#313233]`、`bg-[#242526]`），而不是使用 CSS 变量。如果未来界面更换配色方案或进行主题切换，骨架屏的颜色不会跟着变化。
   * **优化建议**：将其背景色改用全局 CSS 变量，如 `var(--ore-modal-bg)` 或 `var(--ore-card-bg)`。

---

## 4. 焦点管理与空间导航 (Focus Management & Spatial Navigation)

### 现有设计亮点
* **自适应滚动流控制**：[News.tsx](file:///H:/VSCodeWork/pilauncher/src/pages/News.tsx) 第 151-156 行实现了 `handleNearEndFocus(index)`。当用户使用 D-pad 物理按键聚焦到接近列表底部的卡片时，会自动异步增加 `visibleCount` 以提前加载并渲染后面的新闻卡片，提供了类似无限滚动的丝滑操作感。
* **防焦点逃逸保护**：最外层使用 `<FocusBoundary id="news-page" trapFocus>`，限制了资讯页面内的 D-pad 焦点范围，防止焦点逃出面板。
* **精准的线性导航规划**：由于卡片在不同屏幕分辨率下可能呈现一列或两列，组件手动接管了 D-pad 方向键，通过 `moveLinearFocus` 实现了前后链接式的线性导航，保证了按键流向的可预测性。

### 优化空间与建议
1. **核心导航功能按钮不可聚焦 (A11y/A级缺陷)**：
   * **问题**：在 [News.tsx](file:///H:/VSCodeWork/pilauncher/src/pages/News.tsx) 第 221-246 行中，右上角的“刷新”按钮和“返回”按钮上都被设置了 `focusable={false}`！这意味着，**键盘与手柄用户完全无法通过物理按键将焦点移动到这两个核心操作上**。虽然提供了 X 键和 B 键全局热键作为平替，但对于初次使用不知道热键的玩家，或者需要使用屏幕键盘、辅助无障碍软设备的玩家来说，这两个按钮成了无法被触达的“孤岛”。
   * **优化建议**：移去 `focusable={false}`，或者使用 `FocusItem` 将其包裹，并赋予合理的 `focusKey`（如 `btn-news-refresh` 和 `btn-news-back`），使用户可以通过方向键或左/右导航触达这些功能。
2. **异步焦点重定向隐患**：
   * **问题**：在加载更多时，[News.tsx](file:///H:/VSCodeWork/pilauncher/src/pages/News.tsx) 的第 125-149 行使用 `setTimeout` 盲目轮询检测 `doesFocusableExist`，直到新卡片渲染出来后强制劫持焦点。这种异步操作缺少取消保护机制，如果在轮询期间用户快速返回了上一页或切换了标签，`setTimeout` 仍可能在后台尝试触发 `focusManager.focus()`，从而导致未定义页面的焦点错乱。
   * **优化建议**：在 `tryFocus` 轮询里应增加对页面是否已被销毁或 `scrollRef` 是否依然存在的判断，在卸载时彻底清除定时器。

---

## 5. 像素级对齐 (Pixel-level Alignment)

### 现有设计亮点
* **高精度的拟真像素边框**：卡片外边框不使用标准的 border 实线，而是利用 React Style 手动对上下左右赋予不同的 3D 立体偏色，精准实现了复古方块像素雕刻的拟真光影效果：
  ```typescript
  borderTopColor: '#5A5B5C',   // 亮部高光
  borderLeftColor: '#5A5B5C',  // 亮部高光
  borderRightColor: '#1E1E1F', // 暗部阴影
  borderBottomColor: '#1E1E1F' // 暗部阴影
  ```
* **响应式栅格布局**：使用 Tailwind 的 `grid-cols-1 min-[1000px]:grid-cols-2 gap-5` 响应式栏位划分，确保在窄屏下呈现单列宽卡片、在宽屏下呈现标准双列卡片，空间分布合理。

### 优化空间与建议
1. **视口高度依赖下的按钮高度抖动**：
   * **问题**：资讯卡片操作按钮的高度和字体被绑定在 `vh` 视口高度上（`--home-news-action-h: clamp(2.75rem, 4.8vh, 4.5rem)`）。这种基于 `vh` 的缩放在扁平的矮屏幕（如宽屏笔记本、横置小窗）上，会导致操作按钮被过度压缩甚至出现内容垂直截断或文字图标重叠的尴尬现象。
   * **优化建议**：按钮高度和字号应使用基于容器尺寸或根元素字体（`rem` / `em`）的设计，利用 padding 自适应撑起高度，避免依赖视口绝对高度导致在极矮分辨率下的对齐变形。
2. **页面内边距不对称**：
   * **问题**：最外层滚动容器在不同分辨率下的内边距定义为：`px-5 pt-4 pb-6 sm:px-7 sm:pt-5 lg:px-8 lg:pt-5`。顶部内边距为 `pt-4` / `pt-5`，而底部却有 `pb-6` 的冗余空间，且左右水平边距与上下垂直边距并不对称，导致列表拉到最下方时，底部边缘与内容间空隙过大。
   * **优化建议**：统一边缘边距，改用全局规范定义的 `py-6 sm:py-8 px-5 sm:px-7 lg:px-8` 以实现对称而平衡的像素排版。

---

## 6. 微交互与动画曲线 (Micro-interactions & Animation Curves)

### 现有设计亮点
* **多层次的封面动态感知**：当鼠标 Hover 悬停在资讯卡片上时，底层的封面背景图会触发 `.group-hover:scale-[1.06]` 的平滑放大效果。配合长达 500ms 的缓动周期，视觉反馈温和且高级。
* **分级入场微动效**：卡片在加载后应用了 Framer Motion 的弹性滑入效果。通过 `y: 22` 与 `delay`，令前几个元素以阶梯式时序（Staggered）向上浮现，极富动感。

### 优化空间与建议
1. **追加渲染时的重复触发抖动**：
   * **问题**：在触发加载更多时，`visibleItems` 的列表数组会增长。由于卡片上的 entrance 动画配置是基于 `displayIndex` 进行延时播放的，每一次重新渲染整个 grid 都会导致已经被加载过的老卡片也一并重新运行一遍 `initial` 到 `animate` 的位移和透明度渐变。这在长列表中会引发明显的卡顿和频繁的“全屏抖动”现象。
   * **优化建议**：可以将 `initial` 的触发限制在首次挂载时，或利用 `AnimatePresence` 的 `initial={false}` 属性屏蔽二次重新计算，使老卡片在列表中保持静态，只有新增卡片拥有滑入动画。
2. **按钮动作反馈生硬**：
   * **问题**：卡片上的“创建对应实例”、“官方文章”和“百科详情”三个按钮，在被物理聚焦或 Hover 时仅触发了 instant 边框切换，缺乏细腻的微动效反馈。
   * **优化建议**：在聚焦或 Hover 时，可以让内部的加号图标、外链图标和书本图标执行 10% 左右的缩放或微小偏移动作（Micro-translation），使静态按钮在获得操作指令时“活”起来。

---

## 总结优化优先级

| 优化点名称 | 涉及文件 | 体验维度 | 优先级 | 推荐改动方式 |
| :--- | :--- | :--- | :---: | :--- |
| **顶部刷新/返回按钮无障碍聚焦** | [News.tsx](file:///H:/VSCodeWork/pilauncher/src/pages/News.tsx) | 焦点管理与空间导航 | **High (P0)** | 移除 `focusable={false}`，使手柄用户可以通过 D-pad 触发刷新和返回。 |
| **创建实例按钮硬编码国际化** | [NewsCard.tsx](file:///H:/VSCodeWork/pilauncher/src/features/home/components/NewsCard.tsx) | 一致性与可预测性 | **High (P0)** | 将 `createInstanceLabel` 默认值对接翻译资源词条。 |
| **加载更多异步焦点轮询安全性** | [News.tsx](file:///H:/VSCodeWork/pilauncher/src/pages/News.tsx) | 焦点管理与空间导航 | **Medium (P1)** | 销毁或切页时清除 `setTimeout` 以防内存泄露和焦点紊乱。 |
| **按钮视口高度依赖改造** | [NewsCard.tsx](file:///H:/VSCodeWork/pilauncher/src/features/home/components/NewsCard.tsx) | 像素级对齐 | **Medium (P1)** | 将高度改用固定的像素或基于字体大小自适应。 |
| **渐变背景兜底主题化** | [NewsCard.tsx](file:///H:/VSCodeWork/pilauncher/src/features/home/components/NewsCard.tsx) | 清晰的视觉层级 | **Low (P2)** | 将兜底蓝绿渐变改用符合 PiLauncher 灰绿像素色系。 |
| **卡片加载动画全列表重跑优化** | [NewsCard.tsx](file:///H:/VSCodeWork/pilauncher/src/features/home/components/NewsCard.tsx) | 微交互与动画曲线 | **Low (P2)** | 限制动画仅在 mount 时跑一次，不跟随父级渲染重播。 |
