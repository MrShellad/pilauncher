# 资源库 (Library) UI/UX 深度分析与优化建议报告

本报告针对资源库（Library）页面及其关联子组件（如卡片、侧边栏、工具栏、上下文菜单等）在 UI（用户界面）和 UX（用户体验）方面的设计与实现进行深度剖析。分析维度涵盖：**一致性与可预测性、清晰的视觉层级、即时且明确的反馈、焦点管理与空间导航、像素级对齐、微交互与动画曲线**。

---

## 一、 一致性与可预测性 (Consistency & Predictability)

一致性是建立用户信任和降低认知负荷的基石。资源库在整体风格上遵循了像素风设计，但在部分组件行为和界面元素上存在一致性缺失。

### 1.1 分段页签 (Tab Nav) 样式不统一
* **现状分析**：
  * 在顶部导航栏中，[LibraryHeader.tsx](file:///h:/VSCodeWork/pilauncher/src/features/Library/components/LibraryHeader.tsx#L73-L81) 渲染页签使用的是 `OreToggleButton`，其参数为 `size="lg" uiScale="adaptive"`，并应用了额外的 `.ore-tab-nav-toggle` 样式类。
  * 该页签与设置页面（Settings）以及实例详情（InstanceDetail）中的 `OreToggleButton` 在高度缩放、文字粗细和安全边距上存在差异，特别是在窗口缩放时，由于“暴力缩放”宽度而没有等比例缩放高度，导致视觉比例失衡。
* **优化建议**：
  * 统一定义全局页签类，高度与宽度按固定比例（如 `16:9` 或 `Bedrock UI` 的适配比例）同步缩放，严格对齐设置菜单中的样式标准，防止文字在窄屏下被压扁或换行。

### 1.2 资源卡片与集合卡片的操作不一致
* **现状分析**：
  * 资源项卡片 `LibraryItemCard` 拥有完整的上下文菜单 `LibraryContextMenu`（通过右键或手柄 X 键触发），但卡片上**没有**编辑按钮。
  * 集合卡片 `CollectionCard` 拥有一个绝对定位的“编辑”铅笔按钮 [CollectionCard.tsx:L225-L239]（悬停时显示），但**不支持**右键触发上下文菜单。
  * 这种操作逻辑的分裂会导致用户产生认知困惑：为什么有的卡片用右键管理，有的卡片却需要去找悬浮的微小按钮？
* **优化建议**：
  * 为 `CollectionCard` 也接入统一的 `LibraryContextMenu`（包含重命名、修改封面、删除集合等动作），使所有卡片的操作入口对齐，保证交互的可预测性。

### 1.3 空白状态 (Empty State) 的跳转行为偏离预期
* **现状分析**：
  * 当资源库为空或过滤结果为空时，渲染 `LibraryEmptyState` [LibraryPage.tsx:L787-L792]。
  * 传入的动作配置 `LIBRARY_EMPTY_ACTIONS` 包含了“浏览”和“下载”等按钮，但在 [LibraryPage.tsx:L443-L447] 中，它们的点击行为全部硬编码重定向至 `setActiveTab('downloads')`：
    ```typescript
    const handleEntryAction = (id: string) => {
      if (id === 'browse' || id === 'download') {
        setActiveTab('downloads');
      }
    };
    ```
  * 用户期望“浏览”和“下载”分别对应不同的功能（如前往外部模组站 vs 前往下载管理器页面），执行完全相同的跳转会让用户感觉按钮设计多余且不合逻辑。
* **优化建议**：
  * 精细化空白状态动作。例如，“浏览”引导至应用内集成的模组商城或发现页，“下载”引导至当前下载任务列表或导入本地文件引导。

---

## 二、 清晰的视觉层级 (Clear Visual Hierarchy)

优秀的层级关系能够引导用户的视线，确保关键信息被优先读取。当前卡片的布局密度和长文本截断策略破坏了这种层级感。

### 2.1 紧凑模式 (Compact Density) 的视觉拥挤
* **现状分析**：
  * `LibraryItemCard` 支持舒适（Comfortable）与紧凑（Compact）两种密度。但在样式上，紧凑模式高度为 `min-h-[7.75rem]`，舒适模式为 `min-h-[8.5rem]`，两者仅相差 `0.75rem`（12px）。
  * 尽管高度差极小，紧凑模式却试图容纳与舒适模式几乎相同的信息量（标题、作者、描述、标签、版本、加载器等），这使得紧凑模式的内边距极度萎缩，文字贴边，视觉层级彻底混乱。
* **优化建议**：
  * 在紧凑模式下主动**精简信息维度**。例如，隐藏详细的描述文本（Description/Summary）和部分的次要分类标签，只保留标题、版本号和核心加载器（Loader）图标，并适当降低标题字号。

### 2.2 舒适模式下的文本截断与空间浪费
* **现状分析**：
  * 在舒适模式下，卡片高度充裕，但描述文本 `summary` 却使用了 `truncate` 单行截断类 [LibraryItemCard.tsx:L201-L203]：
    ```html
    <p className="my-auto truncate text-[length:var(--ore-typography-size-bodySm)] ...">
      {summary}
    </p>
    ```
  * 这导致卡片中央有一大片垂直空白区域未被利用，而描述文本却在第一行就被生硬截断，使用户无法直观地浏览模组概要，信息展示效率低下。
* **优化建议**：
  * 将 `truncate` 修改为 `line-clamp-2`（两行截断），配合适当的行高 `leading-[var(--ore-typography-lineHeight-bodyCompact)]`，填补垂直空间，使卡片内容更丰满且易读。

### 2.3 集合卡片 (CollectionCard) 底栏层级竞争
* **现状分析**：
  * `CollectionCard` 底栏包含集合名称和追踪器元数据（如版本和加载器类型）。
  * 追踪器元数据被包裹在一个深色背景、带描边和立体投影的胶囊盒中 [CollectionCard.tsx:L297-L310]。这种强视觉冲击的设计在狭窄的底栏中反客为主，视觉吸引力甚至超过了上方的集合名称本身。
* **优化建议**：
  * 简化追踪器元数据的样式，去除其深色背景和立体阴影，改为平直、低调的文本配微型图标组合（如使用柔和的灰色文字 `var(--ore-color-text-secondary-default)`），突出集合名称。

---

## 三、 即时且明确的反馈 (Immediate & Clear Feedback)

及时的交互反馈（视觉、动效）能让用户明确知晓操作结果，避免因“零反馈”导致的重复点击或心理疑虑。

### 3.1 拖拽排序缺乏视觉占位引导
* **现状分析**：
  * 资源库支持自定义手动排序模式（Zustand Store 提供 `position` 字段，UI 层通过 `Virtuoso` 渲染长列表并支持 HTML5 Drag & Drop 拖拽）。
  * 在进行拖拽排序时 [LibraryResourceList.tsx:L57-L76]，列表并没有渲染任何 **落点占位符 (Drop Placeholder/Indicator)**。
  * 用户在拖动某项卡片时，不知道松开鼠标后该卡片会精确插入到哪个位置，拖拽过程犹如“盲操”，体验极不稳定。
* **优化建议**：
  * 在 `onDragOver` 阶段，通过当前悬停项的索引和鼠标纵坐标计算落点，在列表中动态插入一条带虚线的像素风边框或高亮条，作为落点指示器（Drop Indicator），给用户明确的物理落点预期。

### 3.2 静默式的云端同步反馈
* **现状分析**：
  * 当用户执行 WebDav 云端备份或同步时，虽然界面按钮变为不可点击 [LibraryToolbar.tsx:L146]，但一旦关闭 `LibraryCloudSyncModal` 弹窗，整个主界面便**没有任何**后台同步指示器。
  * 用户无法确认同步是否成功、是否遇到冲突，或者是否还在后台传输，这种“静默式”操作缺乏安全感。
* **优化建议**：
  * 在工具栏（Toolbar）的云按钮旁，或者底部状态栏（StatusBar）中，添加一个微小的同步中旋转动画（如像素风旋转的刷新图标）以及进度文字提示，并在同步完成/失败时弹出低干扰的轻量 Toast 通知。

---

## 四、 焦点管理与空间导航 (Focus Management & Spatial Navigation)

作为一个支持手柄与全键盘操作的现代 Launcher，资源库实现了空间导航，但在状态流转时存在关键的焦点迷失与不可达漏洞。

### 4.1 窗口重置导致的焦点丢失 (关键 UX 漏洞)
* **现状分析**：
  * 在 [LibraryPage.tsx:L646-L687] 中，设计了一个响应 `hasBlockingOverlay` 的副作用，用于在模窗（如上下文菜单、标签编辑、确认删除等）关闭时重新将焦点放回页面。
  * 然而其重置逻辑是硬编码计算的：
    ```typescript
    const preferredTarget = isCategoryView
      ? `${LIBRARY_COLLECTION_FOCUS_PREFIX}0`
      : visibleResources.length > 0
        ? `${LIBRARY_RESOURCE_FOCUS_PREFIX}0`
        : 'library-search';
    ```
  * 这意味着，如果用户使用键盘/手柄滚动到列表的**第 50 项**资源，右键打开上下文菜单并关闭后，焦点会被**强行重置回第 0 项**卡片或搜索栏！
  * 这将迫使滚动条瞬间跳转回顶部，用户先前辛苦寻找的位置完全丢失，对于拥有大容量资源库的玩家而言是灾难性的体验。
* **优化建议**：
  * 在打开任何模窗/右键菜单前，用一个 `Ref`（如 `lastTriggeredFocusKeyRef`）暂存当前获取焦点的 Key。
  * 当模窗关闭时，优先将焦点恢复至暂存的 Key，仅在其失效时才退化重置到 `preferredTarget`。

### 4.2 左右分区 (Active Section) 缺乏明确界线
* **现状分析**：
  * 资源库使用双列布局（左侧 `CollectionSidebar`，右侧主内容区 `main`），通过手柄 Y 键（或键盘映射）在两个分区之间切换焦点 [LibraryPage.tsx:L580-L595]。
  * 当焦点从侧边栏切入主内容区时，页面上除了具体的卡片或按钮产生高亮描边外，**分区容器本身没有任何状态变化**。
  * 当焦点停留在右侧某些微小元素上时，用户很难一眼判定当前是处于“侧边栏活动状态”还是“内容区活动状态”。
* **优化建议**：
  * 为非活动分区（Inactive Section）增加微弱的暗化阴影（如 `opacity-80` 或 `brightness-90`），或者在活动分区（Active Section）的容器边缘绘制一条 Minecraft UI 标志性的绿白渐变内投影线（Inner Border），提供强烈的分区暗示。

### 4.3 悬停专有控件的键盘可达性缺失
* **现状分析**：
  * `CollectionCard` 上的“编辑”铅笔按钮 [CollectionCard.tsx:L225-L239] 使用了 `group-hover:opacity-100` 样式。
  * 该按钮并没有注册到空间导航组件中，仅在鼠标悬停时可见。
  * 键盘和手柄用户无法通过移动焦点选中并按下这个编辑按钮，导致该功能在“纯手柄/纯键盘”工作流下成了无法触及的“功能孤岛”。
* **优化建议**：
  * 移除 hover 专有的编辑按钮，改为在上下文菜单 `LibraryContextMenu` 中提供“编辑集合信息”选项。

---

## 五、 像素级对齐 (Pixel-level Alignment)

作为 Minecraft 主题的 Launcher，像素级的完美对齐和整数缩放至关重要。当前代码中大量存在亚像素（Sub-pixel）和非规范尺寸设计。

### 5.1 违背设计系统的亚像素类名 (Sub-pixel Values)
* **现状分析**：
  * 在 `LibraryItemCard.tsx` 中，存在大量未遵循 [designToken.ts](file:///h:/VSCodeWork/pilauncher/src/style/tokens/designToken.ts) 的硬编码奇数/小数高度与间距：
    * `h-[1.625rem]` -> 26px
    * `gap-[0.875rem]` -> 14px
    * `h-[1.375rem]` -> 22px
    * `w-[4.25rem]` -> 68px
    * `w-[4.75rem]` -> 76px
  * 在非视网膜屏幕（DPI 为 1.0 或 1.25 的显示器）上，渲染这些亚像素高度会产生严重的像素级插值舍入错误，造成卡片边框模糊、线条发虚。
* **优化建议**：
  * 废除所有带小数的 rem 间距，强制采用 `designToken.ts` 中的 spacing 系统（如 `spacing.base` = 8px, `spacing.md` = 10px, `spacing.lg` = 16px），使用偶数像素确保渲染锐利度。

### 5.2 卡片网格的拉伸变形 (Grid Stretch)
* **现状分析**：
  * 集合视图网格使用了 `repeat(auto-fill, minmax(200px, 1fr))` [LibraryPage.tsx:L801] 的弹性列宽。
  * 这导致卡片宽度会随着显示器宽度的变化在 200px 到 250px 之间剧烈伸缩。而卡片头部的封面图使用的是固定 `aspect-square`（比例 1:1），卡片底栏使用的是 `min-h-[72px]` 的固定内容高度。
  * 在不同宽度的屏幕下，整张卡片的长宽比会频繁失衡，且封面图片在大宽度下会被强制拉伸模糊，破坏了像素级插画的完美质感。
* **优化建议**：
  * 建议使用固定列宽（如卡片宽度固定为 `216px`），将网格的自适应策略由“卡片宽度自适应”改为“列数自适应”，保持卡片完美的像素长宽比。

---

## 六、 微交互与动画曲线 (Micro-interactions & Animation Curves)

微交互是高级感的核心来源。目前资源库的动画较为平淡或缺失，缺乏契合 Minecraft 品牌调性的动感设计。

### 6.1 绕过设计系统的硬编码动效
* **现状分析**：
  * 在 `LibraryPage.tsx` 的集合卡片切入过渡中，使用了硬编码的动画参数 [LibraryPage.tsx:L798-L800]：
    ```typescript
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    ```
  * 这不仅绕过了设计系统 [motion.ts](file:///h:/VSCodeWork/pilauncher/src/style/tokens/motion.ts) 中定义的 `pageAnimate` 等标准过渡变量，也使得多页面间的动效速度、缓动曲线割裂，缺乏全局连贯性。
* **优化建议**：
  * 移除页面中的内联 Framer Motion 动效参数，统一导入并使用 `OreMotionTokens`。

### 6.2 缺乏“基岩版”弹簧按压质感
* **现状分析**：
  * 目前资源卡片与集合卡片在 Hover/Focus 时仅有边框变白或阴影稍微加深的效果，没有任何物理层面的悬浮或按压位移动画，使得卡片列表看起来像是一块“死板”。
  * 设计系统 `motion.ts` 中明明已经配置了极其高级的物理弹簧悬停变量 `bedrockCardHover` 与图标微微摇晃变量 `bedrockIconHover`，但在资源库中均被束之高阁。
* **优化建议**：
  * 给 `CollectionCard` 绑定 `bedrockCardHover` 动画（Hover 时向上浮动 8px 并轻微放大 `1.05` 倍，松开时带有弹力衰减），给卡片内图片绑定像素插值过渡动画，赋予界面现代、灵动的高级品质感。

### 6.3 页面删除动作的“瞬移式”转场
* **现状分析**：
  * 当用户执行“从集合中移出模组”或“删除模组”动作时，卡片直接从列表 DOM 中瞬间消失，Virtuoso 列表发生生硬的硬跳转，没有任何淡出或高度折叠的缩放过渡，视觉上极为突兀。
* **优化建议**：
  * 为移除卡片引入 Framer Motion 的 `AnimatePresence` 和 `layout` 属性，使被删除项先平滑淡出，随后下方卡片以自然过渡的方式缓缓上移填补空缺。

---

## 优化优先级与路线图建议 (Roadmap & Priority)

基于上述分析，我们梳理出了以下优化优先级清单：

| 优先级 | 优化方向 | 对应维度 | 预期提升效果 |
| :--- | :--- | :--- | :--- |
| **P0 (致命)** | **重构模窗关闭后的焦点恢复机制** | 焦点管理与空间导航 | 修复手柄/键盘用户在操作模窗后焦点丢失、滚动条被强制置顶的重大 UX Bug。 |
| **P1 (高)** | **使用 `designToken` Spacing 重构亚像素 CSS 类** | 像素级对齐 | 彻底消除低分辨率/标准显示器上因亚像素计算导致的边框模糊和文字虚化，恢复锐利质感。 |
| **P1 (高)** | **统筹卡片 Hover 态，引入 `bedrockCardHover` 弹簧动效** | 微交互与动画曲线 | 显著提升资源库首屏卡片的视觉活力，营造灵动、充满弹性的像素交互质感。 |
| **P2 (中)** | **统一 Collections 编辑入口至 `LibraryContextMenu`** | 一致性与可预测性 | 解决键盘手柄无法操作 hover-pencil 按钮的硬伤，实现全平台操作对齐。 |
| **P2 (中)** | **将 `summary` 文字改用 `line-clamp-2` 渲染** | 清晰的视觉层级 | 填补舒适模式卡片中部的过度空白，使用户更容易获取模组核心说明。 |
| **P2 (中)** | **卡片网格从宽度自适应改为列数自适应** | 像素级对齐 | 保证所有卡片和像素风封面图的长宽比例不随窗口宽度拉伸，实现像素对齐。 |
| **P3 (低)** | **加入拖动排序 (SortMode) 的落点虚线指示器** | 即时且明确的反馈 | 提升手动排序模式下的可预测性，告别“盲盒拖拽”的负面体验。 |
