# 文字渲染优化任务计划

来源文档：`docs/typography_optimization.md`

执行规则：
- 每次只执行一个任务。
- 任务完成后，先在本文档中把对应状态改为 `已完成`，补充完成记录。
- 标记完成后暂停，并询问是否继续下一个任务。
- 不把低风险全局补丁、组件改造、视觉微调和验证混在同一次执行中。

## 当前状态

| 编号 | 任务 | 状态 | 主要文件 |
| --- | --- | --- | --- |
| T1 | 全局文字渲染基础补丁 | 已完成 | `src/style/global.css` |
| T2 | 字体栈与权重策略梳理 | 已完成 | `src/style/global.css`, `tailwind.config.js`, `src/style/tokens/designToken.ts` |
| T3 | 移除静态文字组件上的强制 GPU 层 | 已完成 | `src/ui/primitives/OreButton.tsx` 等 |
| T4 | 小字号与 Tag 像素对齐优化 | 已完成 | `src/style/ui/primitives/OreTag.css` 及小字号组件 |
| T5 | 纯白文字与设计 token 对比度调整 | 已完成 | `tailwind.config.js`, `src/style/tokens/designToken.ts` |
| T6 | 滤镜、阴影和模糊层对文字的影响排查 | 已完成 | `src/**/*.tsx`, `src/**/*.css` |
| T7 | 跨平台验证与回归检查 | 已完成 | 构建脚本、静态检查记录 |

## 任务明细

### T1. 全局文字渲染基础补丁

目标：
- 在 `html, body` 上加入字体平滑、`text-rendering` 和 `-webkit-text-size-adjust`。
- 明确 `html` 根字号为 `16px`，减少 rem 计算造成的亚像素偏差。
- 保持现有布局行为不变。

验收：
- `src/style/global.css` 包含全局文字渲染属性。
- `npm run build` 通过。
- 记录是否出现布局尺寸变化。

完成记录：
- 已在 `src/style/global.css` 增加 `html { font-size: 16px; }`，并在 `html, body` 上加入 `-webkit-font-smoothing: antialiased`、`-moz-osx-font-smoothing: grayscale`、`text-rendering: optimizeLegibility`、`-webkit-text-size-adjust: 100%`。
- 已执行 `npm run build`，构建通过。
- 本任务只修改全局文字渲染基础属性，未调整组件尺寸、字体栈、GPU 层或颜色 token；未观察到构建层面的布局异常。

### T2. 字体栈与权重策略梳理

目标：
- 检查 Google Fonts `Noto Sans SC` 的加载权重与项目实际 `font-weight` 使用是否匹配。
- 梳理 `font-minecraft`、`--ore-global-font`、`NotoSans Bold`、`Noto Sans SC` 的回退顺序。
- 为 Linux 补充高质量中文字体回退，如 `Noto Sans CJK SC`、`WenQuanYi Micro Hei`。
- 评估是否继续远程加载字体，或改为后续单独任务做本地字体资源。

验收：
- 字体栈在 Tailwind 与 token 中保持一致。
- 常用权重不会依赖浏览器模拟粗体。
- 中文、英文、像素风标题字体的 fallback 逻辑清晰。

完成记录：
- 已在 `src/style/global.css` 增加统一字体栈变量：`--ore-font-family-sans`、`--ore-font-family-minecraft`、`--ore-font-family-heading`、`--ore-font-family-subheading`、`--ore-font-family-decorative`、`--ore-font-family-decorative-bold`。
- 字体栈保留当前可选的 Minecraft 风格字体，同时补充 `Noto Sans SC`、`Noto Sans CJK SC`、`Microsoft YaHei UI`、`Microsoft YaHei`、`PingFang SC`、`Hiragino Sans GB`、`WenQuanYi Micro Hei` 等中文与跨平台 fallback。
- 已将 `tailwind.config.js` 的 `font-minecraft` 和 `font-sans` 接入统一 CSS 变量，避免 Tailwind 与设计 token 字体栈分叉。
- 已将 `src/style/tokens/designToken.ts` 的 `typography.family` 与 `font` 字段改为引用统一 CSS 变量；只改字体 family 字段，未触碰文件中已有的按钮 token 改动。
- 已在 `html, body` 增加 `font-synthesis-weight: none`，减少浏览器模拟粗体造成的发虚风险。
- 仍保留 Google Fonts 远程加载 `Noto Sans SC` 的 `400,500,700,900` 权重，未在本任务内引入本地字体文件；本地字体部署可作为后续独立优化。
- 已执行 `npm run build`，构建通过。

### T3. 移除静态文字组件上的强制 GPU 层

目标：
- 先处理明确风险点：`src/ui/primitives/OreButton.tsx` 中的 `transform-gpu backface-hidden`。
- 搜索其他 `transform-gpu`、`backface-hidden` 使用点，按“动画/非动画”分类。
- 对纯文字按钮、静态文本容器移除强制 GPU 层；对确实需要动画的元素保留或改用局部 `will-change: transform`。

验收：
- 静态文字组件不再默认强制 GPU 栅格化。
- 交互状态、焦点态、动画没有明显回归。
- 完成后在本文档记录保留 GPU 的例外位置和理由。

完成记录：
- 已从 `src/ui/primitives/OreButton.tsx` 的默认按钮 class 中移除 `transform-gpu backface-hidden`，避免纯文字/图标按钮默认被提升为 GPU 位图层。
- 已从 `src/features/Instances/components/InstanceCardView.tsx` 的实例卡片外层移除 `transform-gpu`；该外层承载实例名、版本、加载器等文字，实际缩放动画发生在封面图子元素上，不需要整张卡片强制 GPU 栅格化。
- 已重新搜索 `transform-gpu` 与 `backface-hidden`，`src` 下无残留。
- 保留例外：`src/features/home/components/NewsCard.tsx` 中的 `translateZ(0)` 位于背景图和遮罩层，不直接承载文字；`src/App.css` 中的 `will-change: filter` 属于 Vite 示例样式的非文字层线索，本任务未处理。
- 已执行 `npm run build`，构建通过。

### T4. 小字号与 Tag 像素对齐优化

目标：
- 优先检查 tag、hint、badge、列表 meta 文本等小字号区域。
- 将追求锐度的小字号从 rem 派生值收敛到明确 px 值。
- 检查奇数 padding/margin 是否导致文字落在半像素边界。

验收：
- `OreTag` 等小字号基础组件使用稳定 px 尺寸。
- 关键列表和下载卡片的小字号文本没有明显垂直抖动或模糊。
- 不扩大改动到无关布局重构。

完成记录：
- 已将 `src/style/ui/primitives/OreTag.css` 的 `sm`、`md`、`lg` 尺寸从 Tailwind/rem 派生写法改为显式 px：`10/12/14px` 字号、`12/14/16px` 行高，以及 `2/4/6px` 垂直内边距。
- 已优化下载页资源卡片 `src/features/Download/components/ResourceCard.tsx` 的作者小字、安装/客户端/服务端 badge、功能 tag：字号、图标尺寸、内边距和行高改为明确 px，减少小字在不同 DPI 下的半像素偏移风险。
- 已同步优化实例详情下载资源网格 `src/features/InstanceDetail/components/tabs/mods/ResourceGrid.tsx` 中同类作者小字、状态 badge 和功能 tag，并将作者小面板内边距改为 `6px`。
- 已在上述目标文件中检查 `text-[0.625rem]`、`text-[0.6875rem]`、`px-[0.375rem]`、`py-[0.1875rem]`、`sm:text-[0.625rem]` 等本任务关注的 tag/badge rem 写法，无目标残留。
- 已执行 `npm run build`，构建通过。

### T5. 纯白文字与设计 token 对比度调整

目标：
- 统计 `#FFFFFF`、`text-white`、`--ore-color-text-primary-default` 的主要使用场景。
- 在深色背景上的大面积正文优先改为 `#F2F2F2` 或 `#E6E8EB`，减少光晕感。
- 保留必要的纯白用于焦点环、高亮描边、图标状态或需要强对比的控件。

验收：
- 设计 token 中主文字与强调文字分层更明确。
- 大面积深色背景正文不再全部使用纯白。
- 焦点态和可访问对比度不降低。

完成记录：
- 已将 `tailwind.config.js` 中 `ore.text.DEFAULT` 从 `#FFFFFF` 调整为 `#F2F2F2`，并新增 `ore.text.emphasis: #FFFFFF`，用于保留强强调白色通道。
- 已将 `src/style/tokens/designToken.ts` 中默认主文字语义 `color.text.primary.default` 调整为 `#F2F2F2`，同时新增 `color.text.emphasis`，保留焦点、强高亮、短文本最大对比场景。
- 已将主要深色表面上的 token 文本从纯白降到浅灰：`modal.header.text`、`modal.content.text`、`library.sidebar.tag.text`，以及主/危险/紫色按钮的 legacy 文本 token。
- 已保留 `#FFFFFF` 用于焦点环、选中边框、hover/active 状态、`actionHover` 和 `emphasis`，避免降低交互可见性。
- 项目中仍存在大量组件级 `text-white` 显式用法，本任务未批量替换；这些多为标题、图标、徽标、焦点态或局部强强调文本，后续如需继续收敛应按页面逐块人工审查。
- 已执行 `npm run build`，构建通过。

### T6. 滤镜、阴影和模糊层对文字的影响排查

目标：
- 排查 `backdrop-blur`、`blur`、多层 `opacity`、重阴影文本容器。
- 优先处理文字直接位于模糊层、透明层、过强 glow/drop-shadow 上的区域。
- 保留 Minecraft 风格所需的阴影，但降低导致发虚的叠加效果。

验收：
- 关键页面文字不再叠在不必要的模糊/透明复合层上。
- 阴影强度调整后仍保持当前 UI 风格。
- 记录被跳过的视觉特效与原因。

完成记录：
- 已移除直接承载文字的 `backdrop-blur` 容器，并用更高不透明度的背景替代，降低文字所在层被复合/滤镜处理导致的发虚风险。
- 已处理 `src/ui/primitives/OreToast.tsx`：移除 Toast 自身 `backdrop-blur-md`，将 tone 背景从 `/80` 提升到 `/95`，保证可读性。
- 已处理 `src/features/Instances/components/InstanceCardView.tsx`：启动遮罩、右上角详情提示、编辑按钮不再使用 `backdrop-blur`，改为更实的黑色背景。
- 已处理 `src/features/InstanceDetail/components/tabs/mods/InstanceModDownloadView.tsx`：回到顶部提示浮层移除 `backdrop-blur`，改为 `bg-black/85`。
- 已处理 `src/pages/NewInstance.tsx`：赞助卡片移除 `backdrop-blur-sm`，缺省背景改为 `bg-black/45`。
- 已处理 `src/features/GameLog/components/GameLogSidebar.tsx`：启动日志提示移除 `backdrop-blur-sm`，改为稳定深色背景。
- 已处理多人联机流程面板 `ClientFlow.tsx`、`HostFlow.tsx`：JOIN/ANSWER/CREATE 面板和复制提示遮罩移除 `backdrop-blur`，改用实色深背景。
- 已处理 `src/features/Settings/components/tabs/AboutSettings.tsx`：赞助者 hover 名称提示移除 `backdrop-blur-sm`。
- 保留例外：`src/ui/primitives/OreModal.tsx`、`src/ui/components/DirectoryBrowserModal.tsx`、`src/features/Setup/components/SetupWizard.tsx` 中的 `backdrop-blur` 主要用于整页背景遮罩，不是文字直接所在的浮层；本任务未改动。
- 已执行 `npm run build`，构建通过。

### T7. 跨平台验证与回归检查

目标：
- 执行项目可用的构建或类型检查命令。
- 在 Windows WebView2/Tauri 作为优先环境进行人工观察记录。
- 如后续可用，再补充 macOS/Linux 的字体回退观察项。

验收：
- 构建通过，或记录失败原因。
- 至少检查首页、实例列表、设置页、下载页、实例详情页。
- 本文档汇总已完成任务、剩余风险和后续建议。

完成记录：
- 已执行 `npm run build`，其中 `tsc -b` 与 Vite 生产构建均通过。
- 已执行静态回归排查：`src` 下已无 `transform-gpu`、`backface-hidden` 残留；`backdrop-blur` 仅保留在 `OreModal`、`DirectoryBrowserModal`、`SetupWizard` 的整页/模态背景遮罩层，不直接承载文字。
- 已确认全局文字渲染补丁仍存在：`-webkit-font-smoothing`、`-moz-osx-font-smoothing`、`font-synthesis-weight: none`、`text-rendering: optimizeLegibility`、`-webkit-text-size-adjust: 100%`。
- 已确认字体栈包含 Windows/macOS/Linux 常见中文回退：`Noto Sans SC`、`Noto Sans CJK SC`、`Microsoft YaHei UI`、`Microsoft YaHei`、`PingFang SC`、`Hiragino Sans GB`、`WenQuanYi Micro Hei`。
- 已执行 `npm run lint` 作为辅助回归检查，但当前失败：ESLint 会扫描 `src-tauri/target` 生成产物并产生解析错误，同时项目中已有大量 `any`、React Hooks/Refresh 规则问题；该失败不是本次文字渲染改动引入，建议后续单独配置 lint ignore 或清理既有 lint 债务。
- 已执行 `git diff --check`，本轮触碰文件中的尾随空格已清理；工作树中仍有 `src/features/Settings/components/tabs/AppearanceSettings.tsx` 的既有尾随空格，不属于本次任务改动范围。
- 本次环境为 Windows 工作区，可覆盖 Windows WebView2/Tauri 的构建链路；未在 macOS/Linux 实机上做截图观察，后续发布前建议补充 Retina WebKit 与 Linux 中文字体回退的目视检查。
- 页面检查项记录：从代码路径和构建产物覆盖首页、实例列表、设置页、下载页、实例详情页相关入口；未启动交互式 Tauri 窗口做人工截图，因此视觉结论以静态风险排查和构建通过为准。

## 初始代码观察

- `src/style/global.css` 已加载 `Noto Sans SC` 的 `400,500,700,900` 权重，但当前没有全局字体平滑属性。
- `tailwind.config.js` 中 `ore.text.DEFAULT` 当前为 `#FFFFFF`，大量组件通过 `text-white` 直接使用纯白。
- `src/style/tokens/designToken.ts` 中多处主文字 token 也是 `#FFFFFF`，需要分任务谨慎调整。
- `src/ui/primitives/OreButton.tsx` 默认包含 `transform-gpu backface-hidden antialiased`，符合文档中需要优先排查的 GPU 栅格化风险。
- `src/style/ui/primitives/OreTag.css` 中小尺寸 tag 使用 `text-[10px]`，但 padding 存在 `px-1.5`、`py-0.5` 这类可能生成小数像素的 Tailwind 值，需要单独检查。
