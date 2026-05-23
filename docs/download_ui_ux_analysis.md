# PiLauncher 下载功能组件 UI/UX 与空间导航深度评估与优化建议报告

本报告针对 `src/features/Download/components/` 及其子目录中的所有 TSX 组件文件进行了全方位的代码走查与用户体验（UI/UX）审计。评估维度基于以下六个关键设计原则：
1. **一致性与可预测性 (Consistency & Predictability)**
2. **清晰的视觉层级 (Clear Visual Hierarchy)**
3. **即时且明确的反馈 (Immediate & Clear Feedback)**
4. **焦点管理与空间导航 (Focus Management & Spatial Navigation)**
5. **像素级对齐 (Pixel-level Alignment)**
6. **微交互与动画曲线 (Micro-interactions & Animation Curves)**

## 待分析组件文件链接
- [BottomNav.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/BottomNav.tsx) - 底部导航栏
- [ContextualActionBar.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/ContextualActionBar.tsx) - 上下文操作栏
- [DownloadDetailModal.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DownloadDetailModal.tsx) - 下载详情模态框
- [FavoritePlaceholderModal.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/FavoritePlaceholderModal.tsx) - 收藏夹占位模态框
- [FilterBar.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/FilterBar.tsx) - 过滤器侧栏
- [ResourceCard.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/ResourceCard.tsx) - 资源卡片
- [ResourceGrid.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/ResourceGrid.tsx) - 资源展示网格
- [InstanceSelectModal.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DetailModal/InstanceSelectModal.tsx) - 实例选择模态框
- [ModpackCreateModal.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DetailModal/ModpackCreateModal.tsx) - 整合包创建模态框
- [ProjectGallery.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DetailModal/ProjectGallery.tsx) - 项目画廊展示
- [ProjectHeader.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DetailModal/ProjectHeader.tsx) - 项目头部详情
- [VersionFilters.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DetailModal/VersionFilters.tsx) - 版本过滤器
- [VersionList.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DetailModal/VersionList.tsx) - 版本列表
- [FloatingButton.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DownloadManager/FloatingButton.tsx) - 下载管理器悬浮按钮
- [TaskItem.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DownloadManager/TaskItem.tsx) - 下载任务卡片项
- [TaskPanel.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DownloadManager/TaskPanel.tsx) - 下载任务管理器面板

---

## 一、 核心高危缺陷摘要

在审计过程中，共发现 **2 项致命的空间导航 Bug**、**多项跨设备输入模式不一致** 和 **多处影响无障碍体验的焦点缺失问题**。以下是亟待修复的严重缺陷：

1. ⚠️ **整合包实例创建模态框导航完全失效 (Focus Management - 严重)**:
   - 在 [ModpackCreateModal.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DetailModal/ModpackCreateModal.tsx) 中处理方向按键（`onArrowPress`）时，代码中错误地将方向字符串比对为大写（如 `DOWN`、`UP`、`RIGHT`），而底层的 `norigin-spatial-navigation` 传递的实际方向全为小写（`down`、`up`、`right`）。这导致键盘与手柄用户在输入实例名称后，**完全无法将焦点下移至“确认”和“取消”按钮**，造成键盘导航死锁。
2. ⚠️ **全局动作按键冲突 Bug (Focus Management - 严重)**:
   - 每个下载任务组件 [TaskItem.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DownloadManager/TaskItem.tsx) 均独立注册了 `useInputAction('ACTION_Y', ...)` 监听。这意味着当用户打开下载管理器面板时，若存在多个下载任务，按下手柄 Y 键或键盘对应键时，**所有任务的日志面板将同时被展开或收起**。此外，当该组件未获得焦点时，该快捷键依然会全局触发，造成非预期的状态改变。
3. ⚠️ **过滤器分类标签无法通过空间导航聚焦 (Focus Management - 严重)**:
   - 顶部的重要分类页签（模组/资源包/光影/整合包）在 [FilterBar.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/FilterBar.tsx) 中被设为了 `tabIndex={-1}` 且未包裹任何 `FocusItem`。这导致键盘/手柄空间导航用户**根本无法聚焦并切换分类**，限制了该功能的可访问性。

---

## 二、 逐组件分析与优化方案

### 1. [BottomNav.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/BottomNav.tsx) (底部导航栏)
- **发现的问题**:
  - **事件重复处理与按键冲突**: 在 `FocusItem` 中自定义了 `onArrowPress` 处理左右方向键。然而在底层的 `button` 元素上，又在 `onKeyDown` 中监听了 `ArrowLeft` / `ArrowRight` 触发 `switchTabBy`。这种双重监听极易引起焦点竞争、重复触发 Tab 切换或空间导航系统紊乱。
  - **非受控焦点绑定**: 元素焦点的反向映射（`onFocus={() => setFocus(getFocusKey(tab.id))}`）容易引起循环触发和系统死锁。
  - **微交互偏弱**: 页签切换动画缺失，过渡方式偏生硬。
- **改进建议**:
  - 移除 `button` 原生的 `onKeyDown` 左右方向键监听，交由 `FocusItem` 的 `onArrowPress` 统一托管。
  - 删去 `onFocus` 中的主动 `setFocus` 动作，让系统自动处理焦点流向。
  - 使用 Framer Motion 的 `layoutId` 为激活状态指示线添加横向滑动的平滑平移过渡效果。

### 2. [ContextualActionBar.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/ContextualActionBar.tsx) (上下文操作栏)
- **发现的问题**:
  - **焦点无法自动滑入 (孤岛缺陷)**: 作为一个绝对定位悬浮在底部的操作栏，当用户右键/长按卡片进入选择模式并激活操作栏时，焦点依然停留在原有的 `ResourceCard` 上。手柄或方向键用户难以在此时将焦点自然移动到悬浮的操作条上。
  - **视觉层级遮挡**: 悬浮在内容之上有可能遮挡最底部的资源卡片，使得列表末尾的项无法完全可见和点击。
  - **微交互缺失**: 操作栏显示/隐藏非常突兀，缺乏动画缓冲。
- **改进建议**:
  - 当选中个数从 0 变为 1 时，主动调用 `setFocus` 将焦点移至操作栏的首个按钮上（如“批量下载”）。
  - 给操作栏容器加上 Framer Motion 的 `AnimatePresence` 实现淡入淡出与向上下滑入的过渡。

### 3. [DownloadDetailModal.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DownloadDetailModal.tsx) (下载详情模态框)
- **发现的问题**:
  - **脆弱的延时自动聚焦**: 代码中使用 `setTimeout` 重试 5 次来寻找首个版本行进行聚焦。这类竞态条件代码极易在系统卡顿或动画卡住时实效，导致键盘焦点丢失。
  - **反馈不够即时**: 当用户在弹窗中选择某版本进行下载并点击下载后，列表行没有显示实时的“添加中/已在队列”的加载及状态反馈。
- **改进建议**:
  - 弃用基于 `setTimeout` 的自动聚焦逻辑，改为在 `useEffect` 中监听 `displayVersions.length` 或 `isLoadingVersions` 状态，并配合 `requestAnimationFrame` 在 DOM 树挂载后进行聚焦。

### 4. [FavoritePlaceholderModal.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/FavoritePlaceholderModal.tsx) (收藏夹占位模态框)
- **发现的问题**:
  - **按钮缺少显式 `focusKey`**: 重要的“取消”和“确认”按钮缺少稳定焦点键声明，可能在输入框回车或焦点跳转时失焦。
  - **Portal 列表空间导航断层**: 通过 `createPortal` 渲染的已有模组集列表项按钮没有包裹在 `FocusItem` 中，物理按键用户在输入框输入名称后，焦点完全无法移动到列表项上进行点击选择，该列表成为了交互盲区。
- **改进建议**:
  - 为控制按钮补充显式 `focusKey`。
  - 对下拉 Portal 中的每一个列表选项使用 `FocusItem` 包裹，并添加 `FocusBoundary`。

### 5. [FilterBar.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/FilterBar.tsx) (过滤器侧栏)
- **发现的问题**:
  - **页签按钮焦点盲区**: 顶部遍历渲染的页签按钮被设置了 `tabIndex={-1}`，且缺失 `FocusItem`。它们完全无法获得空间焦点，使用方向键向上时，焦点被禁锢在次级输入框和数据源选择上，限制了物理按键用户切换分类。
  - **缺乏重置状态反馈**: 点击“重置”按钮清空搜索后，若结果列表无变动，用户无法确定重置动作是否已触发。
- **改进建议**:
  - 将页签按钮修改为支持 `FocusItem` 的节点，分配相应的 `focusKey`。
  - 重置或加载数据时引入骨架屏或局部 Loading 进度条，增强即时视觉反馈。

### 6. [ResourceCard.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/ResourceCard.tsx) (资源卡片)
- **发现的问题**:
  - **多选卡片对物理按键不响应**: 卡片选中状态切换仅支持鼠标右键或多选模式下的左键单击。手柄和键盘用户在通过空间导航聚焦卡片时，无法通过 Enter / Space / 手柄按键选中卡片。
  - **翻译词条不合理**: 卡片在多选状态下显示的角标文本为 `"命中"`。这在中文语境下含义不准确，易造成迷惑。
- **改进建议**:
  - 在卡片 `FocusItem` 的 `onKeyDown` 处理器中增加对 Space/Enter 的捕获以触发 `onToggleSelection`。
  - 将 `"命中"` 文案统一替换为国际化词条 `t('download.status.selected', { defaultValue: '已选择' })`。

### 7. [ResourceGrid.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/ResourceGrid.tsx) (资源展示网格)
- **发现的问题**:
  - **内边距不对称导致微小的视觉抖动**: 网格的 Padding 在默认尺寸（`px-[0.875rem] pb-[1.5rem] pt-[1.375rem]`）和 `sm` 尺寸下（`sm:px-[1rem] sm:pt-[1.5rem]`）不一致，屏幕缩放时会导致顶部元素微抖动。
  - **数据滚动刷新截断焦点**: 触发 `onLoadMore` 重新加载列表数据时，Virtuoso 滚动重置可能由于索引变化把当前焦点移出视口。
- **改进建议**:
  - 规范像素级对齐，修改 Padding 使各屏幕尺寸下保持对称对齐。
  - 对加载更多过程提供稳定的占位 Loading 卡片，防止列表长度跳变导致失焦。

### 8. [InstanceSelectModal.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DetailModal/InstanceSelectModal.tsx) (实例选择模态框)
- **发现的问题**:
  - **大量 Hardcoded Unicode 编码**: 文件内如 `\u6b63\u5728\u5206\u6790...` 等汉字编码硬编码非常多，不易维护，且脱离了全局多语言翻译机制。
  - **缺乏防连击（防 race condition）处理**: 在分析依赖或扫描缓存的异步耗时期间，没有禁用或置灰确认部署按钮，重复连续点按可能触发多次部署行为。
- **改进建议**:
  - 将所有 Unicode 硬编码字符串提取并重构为 `useTranslation` 多语言配置文件。
  - 在异步加载期间置灰按钮，以给出明确的忙碌反馈。

### 9. [ModpackCreateModal.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DetailModal/ModpackCreateModal.tsx) (整合包创建模态框)
- **发现的问题**:
  - **⚠️ 致命焦点锁死缺陷**: `onArrowPress` 将按键比对为全大写 `'DOWN'` / `'UP'` / `'LEFT'` / `'RIGHT'`，导致条件分支从未执行，手柄和键盘用户在输入框按 Down 时完全被卡在框内，焦点无法向下移动到控制按钮。
  - **UI 风格错乱 (主题不一致)**: 区别于全局 modal 使用的深灰 `#313233` 与像素粗边框的 OreUI 设计规范，该文件使用了现代 Tailwind 的 `bg-[#18181B]` 及细线 `border-white/5` 边框，造成视觉割裂。
- **改进建议**:
  - 方向条件比对改回小写判断（`direction === 'down'` 等）。
  - 对齐全局 OreUI modal 规范，使用扁平灰色背景和重投影粗像素方块风格。

### 10. [ProjectGallery.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DetailModal/ProjectGallery.tsx) (项目画廊展示)
- **发现的问题**:
  - **图片画廊为物理导航盲区**: 预览图横向排列区域内的所有 `<img>` 无法获得空间焦点。键盘手柄用户无法横向切换选中单张图进行放大或滚动。
- **改进建议**:
  - 对画廊里的每张图片使用 `FocusItem` 包裹以支持键盘/手柄物理导航，并在焦点改变时自动执行横向 `scrollIntoView`。

### 11. [ProjectHeader.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DetailModal/ProjectHeader.tsx) (项目头部详情)
- **发现的问题**:
  - **链接无法聚焦**: “在浏览器中打开”的跳转 `button` 缺少 `FocusItem`，手柄/物理按键用户无法触发此外部跳转动作。
- **改进建议**:
  - 使用 `FocusItem` 包裹按钮，或将其替换为 `OreButton` 并设置 `focusKey`。

### 12. [VersionFilters.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DetailModal/VersionFilters.tsx) (版本过滤器)
- **发现的问题**:
  - **Loader 单选页签无法导航**: `OreToggleButton` 设置了 `focusable={false}`，这强制用户通过 LB/RB 隐式切换，切断了 D-pad 上移至 Loader 选项卡直接选择的无障碍导航路径。
- **改进建议**:
  - 恢复 `focusable={true}` 并允许常规键盘和方向键流转。

### 13. [VersionList.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DetailModal/VersionList.tsx) (版本列表)
- **发现的问题**:
  - **跨设备交互摩擦阻力极度不一致**:
    - **鼠标用户**: 可以直接单点右侧“下载版本”直接执行下载部署。
    - **键盘/手柄用户**: 卡片内的“下载”按钮不可聚焦，按 Enter 键触发外层卡片的 `onEnter`，强制弹出一个 Changelog 模态弹窗，逼迫按键用户在弹窗中重新定位并按 Enter 才能触发部署，多出了一倍的操作阻力。
  - **方向跳转突变**: 见 `handleVersionArrow` (第 44-60 行)，任何版本行按左/右均会被直接强行重定向跳转到顶部的 dropdown 过滤器上，造成很强的跳跃感和错乱感。
- **改进建议**:
  - 允许物理按键直接聚焦列表卡片内的下载图标执行部署，或者为卡片设置特定的操作快捷键（例如按 Y 键直接触发下载，无需多弹窗看日志）。
  - 移除非第一行版本卡片按左/右侧键的直接跳顶逻辑。

### 14. [FloatingButton.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DownloadManager/FloatingButton.tsx) (下载管理器悬浮按钮)
- **发现的问题**:
  - **视觉不一致**: 使用了现代的正圆形 `rounded-full` 造型，与全局 Minecraft 扁平硬边缘设计有偏差。
  - **快捷键缺少键盘指示**: 渲染了 Gamepad 的 View 键图样提示，但缺少 PC 键盘用户的提示图样（如 Tab 或其他键位）。
- **改进建议**:
  - 改为硬切角的方形立体像素风格。
  - 动态侦测当前输入设备，非手柄状态下提供键盘的快捷键提示。

### 15. [TaskItem.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DownloadManager/TaskItem.tsx) (下载任务项)
- **发现的问题**:
  - **⚠️ 动作按键全局冲突**: `useInputAction('ACTION_Y', () => { setShowLogs((prev) => !prev); });` 属于全局绑定，由于没有进行 focused 校验，在下载面板存在多个任务卡片时，一旦按下 Y 键，所有任务的日志折叠状态都会无差别同时翻转。
- **改进建议**:
  - 仅在当前卡片的日志展示按钮处于 focused 状态下才执行回调响应。

### 16. [TaskPanel.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DownloadManager/TaskPanel.tsx) (下载任务管理器面板)
- **发现的问题**:
  - **视口内容阶段（无 autoScroll）**: 卡片按钮（Changelog/Cancel/Retry等）上全写了 `autoScroll={false}`，当任务量巨大溢出 `75vh` 视口时，物理按键用户在向下聚焦到隐藏项时，容器完全不会自动向下滚动，导致盲区操作。
- **改进建议**:
  - 移除按钮上的 `autoScroll={false}`，或者使用空间导航感知区域受控自适应滚动。

---

## 三、 关键设计准则评估总览

| 评估维度 | 核心现状评估 | 优化目标 |
| :--- | :--- | :--- |
| **1. 一致性与可预测性** | 良好。但整合包创建模态框使用了和全局风格割裂的现代 Tailwind 深黑色背景与细线条边框；手柄与鼠标用户在触发下载版本时的阻力和流程差异巨大。 | 统一模态框的 OreUI 主题背景与像素粗边框规范；平滑化按键用户直接触发下载版本的交互通道。 |
| **2. 清晰的视觉层级** | 详情和卡片视觉层级合理。但底部 ContextualActionBar 悬浮时会遮挡下方最后一个元素，层级遮挡较严重。 | 为 ResourceGrid 底部增加适当的 padding 缓冲区，防止悬浮菜单遮挡内容。 |
| **3. 即时且明确的反馈** | 收藏、下载状态基本清晰。但点击过滤器重置或加载时数据源响应迟缓，界面缺少局部 loading 缓冲。 | 增加清空重置与请求过滤数据期间的 Skeleton Loading 骨架屏或局部 Loading 反馈。 |
| **4. 焦点管理与空间导航** | **存在严重Bug**。包含小写事件在内的大写按键判断死锁；全局动作键 Y 冲突导致全部下载任务日志同时反转；顶部页签无法被空间导航聚焦。 | 修复大小写判定条件；为分类标签包裹 `FocusItem`；对 Y 快捷键进行 Focus 限制防护，避免多重反转。 |
| **5. Pixel-level Alignment** | 整体较对称。但网格间距在默认状态和 `sm:` 状态存在微小差值，屏幕拉伸会产生顶部垂直跳变。 | 统一网格的 padding 设置，确保响应式断点过渡平滑无跳变。 |
| **6. Micro-interactions** | 切换略生硬。FloatingButton 造型设计偏向现代圆角，脱离像素主题；BottomNav 页签切换动效较生硬。 | 修改浮动按钮为硬方角立体造型；为页签切换指示线添加滑动平移过渡。 |
