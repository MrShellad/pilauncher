# PiLauncher UI 多端适配建议

本文基于当前前端结构做静态分析，目标是为手机横屏、Steam Deck、PC 和电视等不同屏幕尺寸提供一套可落地的 UI 组件调整方向。本文只提出改造建议，不包含代码实现。

## 适配目标

| 设备类型 | 典型尺寸 | 输入方式 | UI 重点 |
| --- | --- | --- | --- |
| 手机横屏 | 约 800-960 x 360-480 CSS px | 触控为主 | 信息降噪、底部/全屏浮层、触控目标足够大 |
| Steam Deck | 1280 x 800 CSS px | 手柄 + 触控 | 保持中等信息密度、稳定焦点导航、避免顶部拥挤 |
| PC | 1440-2560+ CSS px | 鼠标 + 键盘 | 信息密度、批量操作效率、多列布局 |
| 电视 | 1920-3840 CSS px | 手柄为主 | 远距离可读性、更强焦点态、更宽安全边距 |

## 当前 UI 结构观察

### 全局壳层

`src/App.tsx` 使用 `h-screen w-screen overflow-hidden` 作为应用壳层，并在移动设备上尝试强制全屏与横屏。这符合启动器类应用的沉浸式目标，但需要补齐动态视口与安全区处理，否则在手机横屏、系统手势区、Steam Deck 虚拟键盘等场景中容易出现内容被裁切。

建议：

- 将全局高度从 `100vh` 思路升级为 `100dvh` / `100svh` 兼容策略。
- 在根节点注入安全区变量，例如 `--ore-safe-top/right/bottom/left`，页面容器统一消费。
- 保持根层 `overflow-hidden`，但确保页面主体和弹窗内部都有明确滚动容器。

### 设计 token

`src/style/tokens/designToken.ts` 已有 spacing、unit、typography、color 等 token，但当前响应式策略仍大量散落在组件中，例如 `clamp(...)`、`min-[1920px]`、固定 `w-[...]`。

建议新增响应式语义 token：

- `--ore-density`: `compact | deck | desktop | wide | tv`
- `--ore-page-pad-x`
- `--ore-page-pad-y`
- `--ore-control-h`
- `--ore-control-gap`
- `--ore-focus-ring-w`
- `--ore-content-max-w`
- `--ore-card-min-w`
- `--ore-modal-w`
- `--ore-modal-max-h`

这些变量应由全局媒体查询或运行时设备探测统一设置，页面和组件只消费语义变量。

## 断点建议

建议不要只按宽度划分，还要考虑高度和输入方式。

| 名称 | 条件建议 | 说明 |
| --- | --- | --- |
| `compact` | `max-width: 960px` 或 `max-height: 520px` | 手机横屏、小窗口 |
| `deck` | `min-width: 961px` 且 `max-width: 1366px` 且 `max-height: 900px` | Steam Deck / 掌机 |
| `desktop` | `1367px - 1919px` | 普通 PC |
| `wide` | `1920px - 2559px` | 2K / 高分辨率 PC |
| `tv` | `min-width: 2560px` 或用户启用 TV 模式 | 电视、远距离显示 |

电视模式不应只依赖分辨率。4K PC 近距离使用不等于电视使用，建议提供用户设置项或通过输入模式偏好辅助判断。

## 通用组件调整建议

### `OreButton`

当前按钮默认 `min-w` 偏桌面，例如 `md` 为 `min-w-[10rem]`。在小屏工具栏里会挤压其他控件。

建议：

- 增加 `density="compact|normal|comfortable|tv"`。
- 增加 `iconOnly` 和 `labelVisibility="always|auto|hidden"`。
- compact 下允许按钮最小宽度降到 `2.5rem - 3rem`。
- TV 下增大高度、字号、焦点 ring 和外边距。

### `OreModal`

当前默认宽度 `w-[480px]`，最大高度 `85vh`。这对 PC 合理，但小屏和电视都需要变体。

建议：

- compact：默认全屏或 bottom sheet，宽度 `100dvw`，高度 `100dvh` 或 `min(92dvh, ...)`。
- deck：宽度 `min(760px, 94vw)`，高度 `min(86dvh, ...)`。
- desktop：保持居中弹窗。
- tv：弹窗可更宽，但正文内容保持最大行宽，避免横向阅读距离过长。
- 弹窗 action 区在 compact 下改为底部固定操作条。

### `OreSegmentedControl` / `OreToggleButton`

顶部导航和设置页 tab 都依赖横向分段控件。当前完整文字标签在小屏容易拥挤。

建议：

- 支持 `iconOnlyBelow`：低于某宽度只显示图标。
- 支持 `scrollable`：tab 可横向滚动，但手柄 LB/RB 仍能循环切换。
- 支持 `compressed`：减少内边距、缩小最小宽度。
- 支持 `currentLabel`：小屏仅显示当前 tab 文本，其余用图标或弹出菜单。

### `OreOverlayScrollArea`

项目大量使用自定义滚动区。小屏触控和手柄滚动需要统一策略。

建议：

- 对触控滚动区域允许 `touch-action: pan-y`，不要被全局 `touch-action: none` 阻断。
- 右摇杆滚动应只作用于当前焦点所在滚动容器。
- 支持 `autoStickToBottom`，用于日志类区域。
- 滚动条在 TV 模式下加宽，增强可见性。

### 表单组件

`OreInput`、`OreDropdown`、`OreSwitch`、`OreSlider` 在设置页和下载筛选栏里密集使用。

建议：

- compact 下所有表单项单列排列。
- 下拉菜单在 compact 下使用全宽弹层或 bottom sheet。
- 输入框高度不低于 40px，触控目标不低于 44px。
- TV 模式下表单项行高增加，焦点态增加外发光或高对比边框。

## 页面级建议

### 顶部导航 `TitleBar`

当前顶部导航集中在 `src/ui/layout/TitleBar.tsx`，手机模式隐藏 logo 和窗口按钮，但中间仍是完整 tab 分段控件。

建议：

- compact：只保留当前页面标题 + 菜单按钮，tab 放入抽屉或弹层。
- deck：保留 LB/RB 提示和 tab，但 tab 使用图标 + 短标签。
- desktop：保持当前形态。
- tv：导航居中但限制最大宽度，tab 增高，焦点环增粗。

### 首页 `Home`

`src/pages/Home.tsx` 使用绝对定位组织 logo、皮肤展示、启动按钮和统计信息。

建议：

- compact：隐藏或大幅缩小右侧皮肤展示，启动按钮固定底部，主操作区两行布局。
- deck：保留皮肤展示，但限制高度，避免压缩启动按钮区域。
- desktop：维持当前布局。
- tv：扩大启动按钮和焦点态，但主要交互区不要贴屏幕边缘。

### 实例页 `Instances`

`src/pages/Instances.tsx` 已有部分响应式工具栏，但实例卡片尺寸仍偏固定。

建议：

- 工具栏 compact 下拆成两层：搜索一行，筛选/排序/操作一行。
- `InstanceCardView` 不应依赖固定 `min-w-[19.5rem]`，建议由父级 grid 使用 `repeat(auto-fit, minmax(...))` 控制。
- compact 下卡片减少元信息，只保留名称、版本、loader、最近游玩。
- TV 模式默认优先列表视图，行高更高、封面更大、操作按钮更清晰。

### 资源下载页

`src/features/Download/components/FilterBar.tsx` 已经对 1920/2560/3840 做了较完整的局部变量缩放，这是可以推广的方向。

建议：

- compact/deck：筛选栏改为“搜索 + 当前筛选摘要 + 高级筛选展开”。
- 资源类型 tab 小屏显示图标 + 短标签。
- `ResourceGrid` 不应通过 `window.innerWidth > 1920` 决定列数，应改为容器宽度或 CSS grid。
- `ResourceCard` compact 下改为多行结构，隐藏或折叠下载量、收藏数、更新时间等次要元信息。
- 下载详情弹窗 compact 下全屏化，介绍、版本、依赖等内容使用 tab 或分段导航。

### 设置页 `Settings`

`src/pages/Settings.tsx` 有 8 个设置分类，当前通过横向 toggle 展示。

建议：

- compact/deck：设置分类改为图标-only 横向列表，当前分类标题放在内容区顶部。
- desktop：保持横向分类。
- tv：分类 tab 高度增加，内容区避免过宽，设置项保持清晰行距。
- 设置内容统一通过 `SettingsPageLayout` 控制单列/双列/三列，而不是每个 tab 自己处理。

### 下载任务管理器

下载任务浮层当前固定在右下角，适合 PC。

建议：

- compact：改为底部抽屉，占据 `70dvh` 左右。
- deck：保留浮层但宽度降低，避免遮挡主要内容。
- desktop：维持右下浮层。
- tv：改为居中大面板或右侧面板，并强化焦点进入/退出逻辑。

### 游戏日志侧栏

日志内容在小屏和电视上的需求不同：

- compact：日志默认折叠，异常时以全屏日志页展示。
- deck：侧栏可保留，但需要可快速隐藏。
- tv：日志侧栏字体放大，滚动条和焦点态更明显。

## 输入与焦点建议

项目已有 `InputDriver` 和 `FocusManager`，这是适配 Steam Deck / TV 的基础优势。

建议：

- 所有响应式列数变化后恢复焦点位置。
- 页面切换、弹窗关闭、列表刷新后都应有稳定 fallback focus。
- 触控模式下减少 hover-only 操作，隐藏操作必须有可见入口。
- 手柄模式下所有主要动作必须能通过方向键和确认键完成。
- TV 模式下焦点 ring 至少 3px，且不能只依赖亮度变化。

## 推荐实施顺序

1. 建立全局响应式 token 和设备密度变量。
2. 改造 `OreButton`、`OreModal`、`OreSegmentedControl`、`OreOverlayScrollArea`。
3. 改造 `TitleBar`，解决小屏和 Steam Deck 顶部拥挤。
4. 改造首页、实例页、下载页三个高频页面。
5. 改造设置页、下载详情弹窗、日志/任务浮层。
6. 建立多视口验证清单。

## 验收视口建议

每次 UI 改造至少验证以下尺寸：

- 手机横屏：`896 x 414`
- Steam Deck：`1280 x 800`
- PC：`1920 x 1080`
- 2K PC：`2560 x 1440`
- 4K / TV：`3840 x 2160`

验收重点：

- 首屏内容不重叠、不被裁切。
- 所有页面都有明确滚动区域。
- 文字不溢出按钮和卡片。
- 手柄焦点可见且移动顺序合理。
- 触控目标不小于 44px。
- 弹窗在小屏可完整操作。
- 大屏内容不无限拉宽，阅读区域有最大宽度。

## 总结

当前项目已经有较强的组件化基础、设计 token 和手柄焦点系统，适配多端不建议逐页补丁式修改。优先级应放在统一响应式 token、通用组件密度变体、导航压缩策略和浮层形态切换上。完成这些基础后，页面级适配会变成调整布局规则，而不是反复修固定宽高。
