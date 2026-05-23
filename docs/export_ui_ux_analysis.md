# 整合包导出组件 UI/UX 深度评估与优化建议报告

本报告对 PiLauncher 客户端中整合包导出模块的 5 个核心 TSX 组件进行了详细的 UI/UX 评估，评估维度基于以下六个关键设计原则：
1. **一致性与可预测性 (Consistency & Predictability)**
2. **清晰的视觉层级 (Clear Visual Hierarchy)**
3. **即时且明确的反馈 (Immediate & Clear Feedback)**
4. **焦点管理与空间导航 (Focus Management & Spatial Navigation)**
5. **像素级对齐 (Pixel-level Alignment)**
6. **微交互与动画曲线 (Micro-interactions & Animation Curves)**

## 待分析组件文件链接
- [ExportPanel.tsx](file:///h:/VSCodeWork/pilauncher/src/features/InstanceDetail/components/tabs/export/ExportPanel.tsx) - 导出面板主控组件
- [ExportBasicStep.tsx](file:///h:/VSCodeWork/pilauncher/src/features/InstanceDetail/components/tabs/export/ExportBasicStep.tsx) - 步骤一：基础信息配置
- [ExportContentStep.tsx](file:///h:/VSCodeWork/pilauncher/src/features/InstanceDetail/components/tabs/export/ExportContentStep.tsx) - 步骤二：导出内容选择
- [ExportOptimizationStep.tsx](file:///h:/VSCodeWork/pilauncher/src/features/InstanceDetail/components/tabs/export/ExportOptimizationStep.tsx) - 步骤三：格式与性能优化
- [ExportConfirmStep.tsx](file:///h:/VSCodeWork/pilauncher/src/features/InstanceDetail/components/tabs/export/ExportConfirmStep.tsx) - 步骤四：最终确认与执行导出

---

## 一、 组件分析与优化方案

### 1. [ExportPanel.tsx](file:///h:/VSCodeWork/pilauncher/src/features/InstanceDetail/components/tabs/export/ExportPanel.tsx) (导出面板主控)

`ExportPanel` 作为多步骤导出向导的承载容器，负责管理全局导出数据 `ExportData`、步骤切换逻辑和底部导航按钮。

#### 发现的问题
*   **焦点陷阱阻塞底部导航 (Focus Management - 严重)**: 
    在第 111-134 行中，组件为每个步骤包裹了 `<FocusBoundary id={`export-step-${step}-boundary`} isActive trapFocus>`。因为启用了 `trapFocus`，键盘用户在使用 Tab 键时，焦点将被永久限制在当前步骤的表单输入项内，**完全无法通过键盘 Tab 导航访问到底部的步骤切换按钮**。这对于仅键盘操作（无障碍）用户来说是一个致命的阻塞问题。
*   **允许任意跨步跳转 (Predictability - 中等)**:
    底部导航条的按钮被绑定了 `onClick={() => goToStep(stepNumber)}` 且在步骤 1-3 未填写完成/校验通过前依然是可点击状态。用户可能会在未选择任何导出内容的情况下直接点击第 4 步“最终确认”，虽然“立即执行打包”按钮会被禁用，但这破坏了向导式流程的线性可预测性。
*   **缺少动画回弹防刷控制 (Micro-interactions - 轻微)**:
    `AnimatePresence` 切换使用了 `mode="wait"`。如果用户极快地连续点击步骤按钮，动画可能会在未完全淡出时就重新加载，引发轻微的视觉闪烁。

#### 改进建议
1.  **解除 inline 步骤的强焦点捕获**: 
    在 `FocusBoundary` 中，对于这种非模态的嵌入式步骤页面，不应使用 `trapFocus`。或者，应当在各步骤内部添加“下一步”和“上一步”按钮，使键盘焦点可以在步骤内容流的末尾自然流转至控制按钮。
2.  **实施线性向导守卫 (Navigation Guard)**:
    限制步骤按钮的任意点击。仅允许点击“当前已完成步骤”以及“下一相邻步骤”。若前一步骤数据不合法（如未勾选任何导出内容，或名称为空），则禁用后续步骤按钮，并给出禁用的视觉样式。
3.  **增加向导导航按键监听**:
    支持全局快捷键（如 `Ctrl + PageUp / PageDown`）进行步骤切换，提升高级键盘用户的操作流畅度。

---

### 2. [ExportBasicStep.tsx](file:///h:/VSCodeWork/pilauncher/src/features/InstanceDetail/components/tabs/export/ExportBasicStep.tsx) (步骤一：基础信息配置)

用于配置整合包名称、版本号、作者、Hero Logo 图片以及文本描述。

#### 发现的问题
*   **描述输入框设计不一致 (Consistency - 中等)**:
    `整合包名称`、`版本号`和`作者`使用的是封装好的 `OreInput` 组件，而底部的`描述`（第 113-118 行）直接使用了原生的 `<textarea>` 并手动编写了边框、背景及阴影类。这导致描述框在聚焦状态（仅有 `focus:border-[#D0D1D4]`）时的视觉特征、外发光环与 `OreInput` 不一致。
*   **Tauri 交互异常无视觉反馈 (Feedback - 中等)**:
    在第 34 行捕获 Tauri 文件选择对话框异常时，仅进行了 `console.error` 控制台打印，没有对用户进行任何 UI 层面上的视觉反馈（如 Toast 提示或红字警告）。若由于系统权限或 Tauri 插件加载失败导致对话框未弹出，用户将一头雾水。
*   **Logo 预览框比例可能失真 (Pixel-level Alignment - 轻微)**:
    Logo 预览区域（第 89 行）是固定尺寸 `h-12 w-24`（2:1 比例）。然而大多数 Minecraft 整合包 Logo 推荐比例为 1:1。尽管使用了 `object-contain`，但由于容器并非正方形，在显示 1:1 图片时两边会留下大量背景空隙，整体不够协调。

#### 改进建议
1.  **统一文本域组件**:
    封装一个通用的 `OreTextarea` 组件，继承 `OreInput` 的外边框像素级阴影（如 `shadow-[inset_2px_2px_rgba(255,255,255,0.05)]`）与统一的 `focus-visible:ring` 焦点状态。
2.  **增强异常捕获反馈**:
    在 `catch (error)` 中加入全局通知组件（如 `showToast` 或 `notification.error`），告知用户“打开图片选择器失败，请检查应用权限”。
3.  **重构 Logo 预览区域**:
    将 Logo 预览区域调整为 `h-16 w-16` 的 1:1 正方形设计，使之与标准的整合包 Logo 默认比例相匹配，周围添加纤细的虚线虚焦指示，提升精致感。

---

### 3. [ExportContentStep.tsx](file:///h:/VSCodeWork/pilauncher/src/features/InstanceDetail/components/tabs/export/ExportContentStep.tsx) (步骤二：导出内容选择)

用于勾选默认文件夹（Mods、Configs 等）以及附加自定义外部文件或目录。

#### 发现的问题
*   **选项卡按钮缺乏焦点指示器 (Focus Management - 严重)**:
    核心切换按钮（第 122-153 行）具有 `focus:outline-none`，但**没有定义任何 `focus-visible` 样式**。当键盘用户使用 Tab 键选中这些卡片时，完全看不到焦点处于哪个卡片上，导致键盘导航无法正常进行。
*   **静默过滤重复路径缺乏用户反馈 (Feedback - 中等)**:
    在第 78 行和第 100 行中，当用户重复添加已经存在的文件或文件夹路径时，组件进行了静默过滤 `!data.additionalPaths.find(...)`。用户点击确认后发现文件未添加，又没有任何气泡或 Toast 提示“该文件已在附加列表中”，容易产生“功能失效”的错觉。
*   **文件/目录选择器体验撕裂 (Consistency - 中等)**:
    选择附加“目录”时，调用了自定义的 `DirectoryBrowserModal`（内置于应用的 React 弹窗）；而选择“文件”时，却调用了 Tauri 宿主系统的原生文件选择对话框。这种在同一个区块内交替出现“自定义弹窗”与“系统原生窗口”的设计，在视觉和操作习惯上会产生割裂感。
*   **元素删除动作过于突兀 (Micro-interactions - 中等)**:
    用户点击 `X` 删除已添加的文件/目录项时，节点被立即从 DOM 中移除，这会导致周围的文件项发生瞬间平移对齐，动画缺乏过渡。
*   **冗余样式定义 (Pixel-level Alignment - 轻微)**:
    按钮上（第 131 行）编写了内联样式 `style={{ fontWeight: 'normal' }}`，但其子级的 `<span>` 元素（第 139 行）却声明了 `font-bold`。这种冲突和混乱的 CSS 定义增加了维护成本。

#### 改进建议
1.  **补充 `focus-visible` 外环样式**:
    为多选卡片按钮添加与系统风格一致的键盘聚焦外环，例如：`focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/70`。
2.  **增加重复路径 Toast 告警**:
    在路径已存在时，调用 Toast 提示：“路径 [文件名] 已在附加内容列表中，请勿重复添加”。
3.  **使用 Framer Motion 实现平滑列表动画**:
    为自定义附加内容列表包裹 `<AnimatePresence>`，并使每个列表项成为 `<motion.div>`，配置 `exit={{ opacity: 0, scale: 0.95 }}` 和 `layout` 属性。这样在删除某一项时，该项会平滑地淡出缩小，同时其他项会优雅地滑动补位，消除布局突变。
4.  **优化 3D 按钮微交互**:
    Minecraft 风格的立体卡片通常有较厚重的底部投影。应当在 `:active` 或已选状态下，加入 `active:translate-y-[2px] active:shadow-[inset_0_-2px_#1D4D13]` 的按压沉降效果，模仿物理机械键盘 the 微交互。

---

### 4. [ExportOptimizationStep.tsx](file:///h:/VSCodeWork/pilauncher/src/features/InstanceDetail/components/tabs/export/ExportOptimizationStep.tsx) (步骤三：格式与性能优化)

提供导出格式的选择（PiPack、ZIP、CurseForge、Modrinth），并可以配置是否使用 Manifest 模式。

#### 发现的问题
*   **格式卡片缺失焦点样式 (Focus Management - 严重)**:
    格式选择按钮（第 96-133 行）同样设置了 `type="button"`，但除了 `transition-[background-color,box-shadow]` 外没有任何聚焦相关的样式定义，键盘焦点在该页面移动时完全不可见。
*   **状态依赖关系解释不够直观 (Feedback - 中等)**:
    根据业务逻辑，选择 `pipack` 或 `zip` 时，底部的 Manifest Mode 开关会被强制锁定（第 82-84 行）。虽然页面最下方有两行提示文本解释锁定原因，但在高分辨率屏幕下，用户的视线主要集中在卡片上，当用户点击 `zip` 后发现底部的开关突然变成灰色禁用状态时，很难在第一时间将视线移动到右下角小字去寻找答案。

#### 改进建议
1.  **为卡片增加视觉焦点状态**:
    添加 `focus-visible:ring-2 focus-visible:ring-white`，使用户在 Tab 导航时能够获得明确的视觉边框反馈。
2.  **行内锁定警示与提示增强**:
    当 Manifest 模式因格式选择被锁定时，在 `OreSwitch` 组件旁边直接显示一个小锁图标或气泡，悬停时显示 tooltip 解释：“由于您选择了 [格式名称]，Manifest 模式已自动固定为 [开启/关闭]”。这比将解释文字堆叠在左侧段落中要清晰得多。
3.  **选定卡片状态反馈强化**:
    选定卡片（第 102 行）使用了绿色的背景和白色的文字，但在 hover 态下无任何效果。建议为已选择的卡片也提供微弱的亮度反馈（如 `hover:brightness-105`），保持全场景的微交互一致性。

---

### 5. [ExportConfirmStep.tsx](file:///h:/VSCodeWork/pilauncher/src/features/InstanceDetail/components/tabs/export/ExportConfirmStep.tsx) (步骤四：最终确认与执行)

参数核对摘要、修改输出路径、展示打包进度条以及展示最终成功或失败面板。

#### 发现的问题
*   **状态切换后的焦点迷失 (Focus Management - 严重)**:
    这是本组件无障碍体验中最严重的问题。在 `status` 变为 `exporting` 以及最后的 `success` 或 `error` 后，原本处于聚焦状态的“立即执行打包”按钮从 DOM 中彻底消失了，此时焦点退回到 `<body>`，导致键盘用户“迷失”了当前聚焦位置。当打包成功展示“打开所在目录”和“返回”按钮时，用户必须重新按多次 Tab 键才能把焦点移动到新按钮上。
*   **异步解绑潜在的内存泄漏风险 (Predictability - 轻微)**:
    第 77-89 行在 `useEffect` 中注册了 Tauri 事件监听。`unlisten` 返回的是一个 `Promise<UnlistenFn>`。在组件卸载时，清理解绑代码为：
    ```typescript
    return () => {
      unlisten.then((cleanup) => cleanup());
    };
    ```
    虽然这在 Tauri 开发中是常见写法，但在极端情况下，如果在 `unlisten` Promise 尚未 resolve 时组件就被快速销毁，微任务队列的延迟执行可能导致解绑滞后或在已销毁组件上下文中执行，虽然不至于崩溃，但改为可靠的同步追踪变量或提前取消的 async wrapper 会更加健壮。
*   **进度条高度过细且对比度偏低 (Pixel-level Alignment - 轻微)**:
    在打包过程中，进度条容器的高度仅为 `h-4`（16px），且进度文字在进度条下方（第 336-343 行）使用的是非常淡的 `text-[#A1A3A5]`，字号仅为 `text-[0.625rem]`（10px），在某些亮色背景或者小屏幕上对比度过低，难以阅读。

#### 改进建议
1.  **实施焦点自动管理 (Auto-Focus Management)**:
    使用 `useRef` 获取成功页面的“打开所在目录”按钮或错误页面的“返回并重试”按钮的 DOM 引用。在 `status` 状态发生改变时（如 `status === 'success'`），在 `useEffect` 中自动执行 `.focus()`。这将使键盘用户的焦点保持在主任务流上。
2.  **优化打包进度条的对比度与视觉尺寸**:
    将进度条容器高度增加至 `h-5`（20px），或者直接将百分比数值（如 `85%`）居中放置在进度条内部（配合白字与黑色文字背景裁剪），增强信息密度，并将低对比度的小字字号调整为不低于 `12px (text-xs)`。
3.  **更优雅的 Tauri 事件监听生命周期管理**:
    建议在 `useEffect` 中使用一个局部变量 `active` 标记组件生命周期状态，并在 Promise 链回调里先校验该变量，防止卸载后的竞态触发：
    ```typescript
    useEffect(() => {
      let active = true;
      const sub = listen<ExportProgress>('export-progress', (event) => {
        if (!active) return;
        setProgress(event.payload);
        if (event.payload.stage === 'DONE') setStatus('success');
      });
      return () => {
        active = false;
        sub.then((cleanup) => cleanup());
      };
    }, []);
    ```

---

## 二、 关键设计准则评估总览

| 评估维度 | 核心现状评估 | 优化目标 |
| :--- | :--- | :--- |
| **1. 一致性与可预测性** | 基本结构良好，但存在输入组件不一致（Textarea）及弹窗类型割裂（文件为系统原生窗口，目录为应用内弹窗）的问题。步骤向导缺乏线性守卫，允许前置步骤未通过时越级跳转。 | 封装统一的表单交互样式，引入线性跳转守卫，保证流程推进状态可预测。 |
| **2. 清晰的视觉层级** | 采用了 Minecraft 扁平偏硬朗的方块化风格，卡片与表单排版清晰，主次按钮区别明确。 | 增强锁定项（如 ManifestMode 依赖）的行内关联提示，收拢冗余小字解释。 |
| **3. 即时且明确的反馈** | 进度条使用了波纹扫光动画和百分比实时更新，非常生动。但对输入重复项的过滤及 Tauri 调用异常采取了“静默处理”，无 UI 反馈。 | 对所有边缘和异常流引入轻量 Toast 提示，避免用户误判系统“无响应”。 |
| **4. 焦点管理与空间导航** | **重灾区**。多处自定义卡片按钮（内容勾选、格式卡片）完全缺失 `focus-visible` 边框，Tab 导航不可见；`trapFocus` 强行禁锢了步骤内部焦点，且在状态转换（打包中 -> 打包完成）后未进行主动焦点转移。 | 移除步骤强焦点锁定，为所有交互卡片补充高对比度聚焦环，并在状态切换后自动重置焦点到主操作按钮上。 |
| **5. Pixel-level Alignment** | 基于 Tailwind 的方格排版，在绝大部分分辨率下能够良好对齐，但部分元素（如 2:1 的 Logo 预览区与常规 1:1 图片）存在适配瑕疵，个别元素存在内联与 Class 样式冲突。 | 规范化预览区域为 1:1 正方形；清理冗余冲突样式；提升进度条和辅助文本的最小字号与对比度。 |
| **6. 微交互与动画曲线** | 步骤间采用了经典的 Cubic-Bezier 水平推拉过渡，非常顺滑。但缺乏对列表元素删除（直接 DOM 消失）和机械按键按下（没有沉降）的微交互设计。 | 引入 Framer Motion 的 `AnimatePresence` 处理列表项平滑进出；为立体按钮增加三维位移的按压微交互。 |
