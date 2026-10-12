# PiLauncher 代码结构与命名统一计划

> 状态：进行中
> 建立日期：2026-10-09
> 适用范围：`src/`、`src-tauri/src/` 以及与源码组织直接相关的配置文件
> 用途：作为后续 Agent 和开发者执行目录重构时的统一上下文与检查清单

## 1. 计划目标

本计划用于解决以下问题：

- 前端目录同时混用全小写、PascalCase、camelCase 和缩写命名。
- `pages`、`hooks/pages`、`features`、`store`、`stores` 之间职责重叠。
- Feature 之间直接引用内部文件，已经出现双向依赖。
- `InstanceDetail` 等模块目录过深，部分源码文件体积过大。
- Rust 服务模块虽然遵循 `snake_case`，但 `_service`、`_cmd` 后缀使用不一致。
- 当前 ESLint 没有检查目录命名、模块边界或跨 Feature 深层引用。

改造的最终目标不是追求目录形式上的绝对一致，而是保证：

1. 同一类对象使用同一种命名规则。
2. 一个业务能力只有一个明确归属。
3. Feature 对外只暴露公共接口，内部结构可以独立演进。
4. 页面只负责组合，业务逻辑不继续堆积在页面文件中。
5. 每个迁移阶段均可独立编译、检查和回滚。

## 2. 已确定的决策

以下决策视为本次重构的默认基线。后续 Agent 不应自行切换成另一套风格；如果确实需要修改，应先更新本节并说明原因。

### 2.1 前端命名

| 对象 | 统一规则 | 示例 |
| --- | --- | --- |
| 目录 | `kebab-case` | `instance-detail`、`game-log` |
| React 组件 | `PascalCase.tsx` | `InstanceHeader.tsx` |
| 页面 | `PascalCasePage.tsx` | `SettingsPage.tsx` |
| Hook | `useCamelCase.ts` | `useInstanceDetail.ts` |
| 普通 TypeScript 模块 | `camelCase.ts` | `resourceService.ts` |
| Zustand Store | `useXxxStore.ts` | `useLibraryStore.ts` |
| 类型文件 | 优先随业务文件共置；公共类型使用 `types.ts` | `types.ts` |
| CSS | 组件样式与组件同名；共享样式使用 `kebab-case` | `InstanceHeader.css` |
| 静态资源 | `kebab-case` | `minecraft-title.webp` |
| Feature 公共入口 | Feature 根目录的 `index.ts` | `features/library/index.ts` |
| 重型路由 Controller 入口 | Feature 根目录的 `page.ts`，仅供 `pages/` 使用；同一 Feature 有多个重型路由时增加语义化 `*Page.ts` 次入口 | `features/instances/page.ts`、`features/instances/creationPage.ts` |

说明：

- 不使用无明确含义的目录缩写，例如 `AS`。
- 不要求所有业务名强制单数或复数；使用产品领域中稳定的名称，例如 `instances`、`settings`。
- 避免以大量 `index.tsx` 作为组件实现文件；`index.ts` 主要用于模块公共出口。
- 根级 `index.ts` 不导出重型路由 Controller，避免普通领域消费者被卷入整页依赖图；单一路由 Controller 通过根级 `page.ts` 次入口导出，同一 Feature 的多个重型路由使用语义化 `*Page.ts` 次入口保持懒加载边界。

### 2.2 Rust 命名

- Rust 文件、目录和模块继续统一使用 `snake_case`。
- `commands/` 和 `services/` 父目录已经表达模块角色，长期目标是移除重复的 `_cmd`、`_service` 后缀。
- 后端后缀整理优先级低于前端 Feature 边界治理，不能与大规模前端移动混在同一提交中。
- Tauri command 的外部命令名、序列化字段和事件名不因文件重命名而随意变化。

### 2.3 架构边界

前端采用“应用层 + 页面层 + 业务 Feature + 共享层”结构：

```text
src/
├─ app/                       # 应用启动、全局 Provider、应用壳、全局状态
│  ├─ App.tsx
│  ├─ providers/
│  └─ stores/
├─ pages/                     # 页面组合层，不承载底层业务实现
├─ features/                  # 垂直业务切片
├─ shared/                    # 无业务归属的共享能力
│  ├─ api/
│  ├─ hooks/
│  ├─ lib/
│  ├─ types/
│  └─ ui/
├─ assets/
├─ styles/
└─ main.tsx
```

Feature 内部按需创建目录，不为了形式完整而建立空目录：

```text
features/library/
├─ index.ts                   # 唯一推荐的外部导入入口
├─ components/
├─ hooks/
├─ stores/
├─ services/
├─ types.ts
└─ utils.ts
```

依赖方向：

```text
app/pages -> features -> shared
```

- `shared` 不得反向依赖 `features` 或 `pages`。
- 一个 Feature 不应深层导入另一个 Feature 的 `components`、`hooks`、`logic` 或 `stores`。
- 确有跨 Feature 复用需求时，优先判断该能力是否应提升到 `shared` 或独立领域 Feature。
- Feature 对外依赖应通过根目录 `index.ts` 显式导出。

## 3. 当前结构基线

2026-10-09 初始只读盘点结果与当前状态：

- 初始存在 21 个含大写字母的目录；Phase 1 后目录命名违规已降为 0。
- `src/features/` 约有 336 个文件。
- `src/features/instance-detail/` 单独约有 120 个文件。
- 最深前端文件路径达到 10 层。
- 初始根级状态目录同时存在 `src/store/` 和 `src/stores/`；Phase 2 后已迁移并禁止重新创建。
- 初始页面 Hook 同时存在于 `src/hooks/pages/` 和 `src/features/*/hooks/`；Phase 2 后已全部归入 Feature。
- `src/style/app.css` 重复导入 `src/index.css`。
- `src/App.css`、`src/assets/react.svg` 已在确认无静态或动态引用后于 Phase 2 删除。
- `src/assets/legal/` 和 `src-tauri/src/utils/` 当前为空。
- `src-tauri/dispatch2-0.3.1/` 是由 Cargo patch 使用的已跟踪 vendored crate，不可直接删除。

当前重点结构问题：

### 3.1 Feature 双向依赖

`Download` 当前引用 `InstanceDetail` 内部的 Modrinth API 和 Mod 服务；`InstanceDetail` 又反向引用 `Download` 的 CurseForge API 与下载逻辑。

代表性路径：

- `src/features/download/hooks/useResourceDownload.ts`
- `src/features/instance-detail/hooks/mod-manager/modManagerShared.ts`
- `src/features/instance-detail/hooks/mod-manager/useModOperations.ts`

处理方向：提取独立的资源目录/平台访问领域。暂定候选名称为 `resource-catalog`，最终名称应在 Phase 3 开始前确认。

### 3.2 状态目录重复

- `src/store/` 存放大部分全局 Store。
- `src/stores/useLibraryStore.ts` 单独使用复数目录。
- 部分 Feature 又拥有自己的 `stores/`。

处理方向：

- 真正的应用级状态移入 `src/app/stores/`。
- 只服务单个业务域的状态移入对应 Feature 的 `stores/`。
- 删除根级 `src/stores/`，最终也不保留含义模糊的根级 `src/store/`。

### 3.3 页面逻辑归属重复

`src/hooks/pages/` 下的 Hook 与对应 Feature 分离，例如：

- `hooks/pages/home/useHome.ts`
- `hooks/pages/instances/useInstances.ts`
- `hooks/pages/instance-detail/useInstanceDetail.ts`

处理方向：移动到对应 Feature；页面层仅导入 Feature 的公共 API。

### 3.4 重复实现候选

目前存在两个不同版本的 `useResourceManager`：

- `src/hooks/pages/instance-detail/useResourceManager.ts`
- `src/features/instance-detail/hooks/useResourceManager.ts`

当前组件引用的是 Feature 内版本。旧版本在删除前需要再次执行全仓库引用检查。

### 3.5 超深与超大模块

初始重点治理路径：

```text
src/features/instance-detail/components/tabs/mods/components/dialogs/components/
```

Phase 4 首批处理中已将其扁平化为 `src/features/instance-detail/components/tabs/mods/dialogs/`。

重点拆分文件包括但不限于：

- `src/features/instance-detail/components/tabs/KeymapSection.tsx`
- `src/pages/LibraryPage.tsx`
- `src/features/instance-detail/components/tabs/mods/download/InstanceModDownloadView.tsx`
- `src/features/home/components/MicrosoftAccountSidebar.tsx`
- `src/features/multiplayer/styles/online-servers.css`

源码层级建议控制在 `src/` 以下 5～6 层。超过该深度时，应优先拆出子域，而不是继续增加 `components/` 嵌套。

## 4. 目标业务域

初步建议的 Feature 划分如下：

```text
features/
├─ account/
├─ download/
├─ game-log/
├─ home/
├─ instances/
│  ├─ list/
│  ├─ creation/
│  ├─ detail/
│  ├─ mods/
│  └─ saves/
├─ library/
├─ multiplayer/
├─ resource-catalog/          # 名称待 Phase 3 确认
├─ runtime/
├─ settings/
├─ setup/
└─ wardrobe/
```

拟合并关系：

- `Instances` 与 `InstanceDetail` 最终归入 `instances` 领域的不同子模块。
- `lan` 只有少量界面代码，应根据实际职责并入 `multiplayer` 或 `home`，不继续作为单文件 Feature。
- Microsoft/Authlib/Offline 登录逻辑应归入 `account`，不应由 `home` 反向依赖 `settings`。
- Modrinth、CurseForge、资源搜索和版本元数据应从 `InstanceDetail` 中移出。
- `runtime` 是多个业务使用的领域能力，可继续作为独立 Feature，但不能引用实例详情的 UI 内部工具。

## 5. 分阶段实施计划

### Phase 0：建立约束与基线

状态：`DONE`

任务：

- [x] 在开始移动文件前记录 `pnpm lint`、`pnpm build`、`cargo check` 和相关测试结果。
- [x] 为 TypeScript 配置 `@/` 路径别名，并同步配置 Vite。
- [x] 增加 `structure:check` 脚本，检查目录命名和已禁止的结构。
- [x] 在 CI 中执行结构检查。
- [x] 明确 Feature 公共出口约定。
- [x] 将本计划作为 `docs/` 中唯一明确解除忽略的文档纳入 Git。

基线结果（2026-10-09）：

- `pnpm build`：通过。
- `cargo check --manifest-path src-tauri/Cargo.toml`：通过；存在 1 个既有的未使用参数警告。
- `pnpm lint`：未通过；存在 421 个既有错误和 48 个既有警告。该债务不在结构 Phase 0 中批量修复，也暂不作为新增 CI 的阻断步骤。
- 结构债务基线：21 个非 `kebab-case` 目录、8 个未使用 `Page.tsx` 后缀的页面、28 个超深源码路径、99 个跨 Feature 深层导入。
- `scripts/structure-policy.json` 使用棘轮基线：结构改善时必须同步降低数值或删除遗留例外，结构恶化会直接失败。

验收条件：

- 结构规则已有自动化入口。
- 规则加入后不要求立即清零全部历史问题，但新增违规必须被阻止。
- 有一份可重复执行的改造前检查结果。

### Phase 1：纯命名统一

状态：`DONE`

任务：

- [x] 将 `src/features` 下目录统一为 `kebab-case`。
- [x] 将子目录中的 PascalCase/camelCase 统一为 `kebab-case`。
- [x] 将页面统一为 `*Page.tsx`。
- [x] 将 `AS` 改为有业务含义的 `account`。
- [x] 更新所有静态 import、动态 import 和源码路径注释。
- [x] 检查 `import.meta.glob`、JSON 配置和 Rust 端字符串路径，没有发现需要同步修改的动态目录引用。

本阶段已通过临时路径完成 Windows 大小写重命名，后续同类操作仍须遵循：

```powershell
git mv src/features/Download src/features/_download_tmp
git mv src/features/_download_tmp src/features/download
```

完成结果（2026-10-09）：

- 非 `kebab-case` 目录基线由 21 降为 0。
- 未使用 `Page.tsx` 后缀的页面基线由 8 降为 0。
- `pnpm structure:check` 通过。
- `pnpm build` 通过。
- 本阶段只修改目录名、页面文件名及其引用，没有迁移业务职责。

约束：

- 本阶段只做机械命名，不同时移动业务职责或重写实现。
- 每批改名后运行前端类型检查与构建。
- 在大小写敏感环境中验证，不以 Windows 本机可运行作为唯一依据。

### Phase 2：消除重复根目录

状态：`DONE`

任务：

- [x] 将 `src/stores/useLibraryStore.ts` 移入 `features/library/stores/`。
- [x] 盘点 `src/store/` 下每个 Store 的真正归属。
- [x] 应用级 Store 移入 `src/app/stores/`。
- [x] Feature 级 Store 移入相应 Feature。
- [x] 将 `src/hooks/pages/*` 移入相应 Feature。
- [x] 复核并删除未使用的旧 `useResourceManager`。
- [x] 清理确认无用的空目录和脚手架资源。

完成结果（2026-10-09）：

- `useLauncherStore`、`useSettingsStore` 迁入 `src/app/stores/`，Toast Store 迁入 `src/shared/stores/`。
- 其余领域 Store 与 6 个有效页面 Hook 已迁入所属 Feature。
- 为 9 个相关 Feature 建立最小根级公共出口；Feature 外部通过公共出口引用，Feature 内部直接引用本域文件。
- 删除未被引用的旧 `useResourceManager`、`src/App.css` 与 `src/assets/react.svg`。
- 删除空的 `src/store/`、`src/stores/`、`src/hooks/pages/`，结构检查禁止这些目录重新出现。
- 跨 Feature 深层导入基线保持 99，没有因归属迁移新增内部耦合。
- `pnpm structure:check` 与 `pnpm build` 通过。

验收条件：

- 不再存在根级 `store/` 与 `stores/` 并存。
- 不再存在 `hooks/pages/`。
- 页面代码通过 Feature 公共接口使用业务能力。

### Phase 3：解除跨 Feature 循环依赖

状态：`DONE`

任务：

- [x] 确认 `resource-catalog` 的最终名称和职责边界。
- [x] 移出 `instance-detail/logic/modrinthApi.ts`。
- [x] 移出 `download/logic/curseforgeApi.ts` 中的平台访问能力。
- [x] 区分“远程项目目录”“本地已安装资源”“下载任务”三个概念。
- [x] 为 `download`、实例资源和 `library` 建立单向依赖关系。
- [x] 给参与跨域协作的 Feature 增加受控的根级 `index.ts`。
- [x] 禁止跨 Feature 深层导入。

期望依赖关系：

```text
resource-catalog  -> shared / platform API
instance-resources -> resource-catalog
download          -> resource-catalog + instance-resources + shared
instance-detail   -> resource-catalog + instance-resources + download + runtime
library           -> resource-catalog + instance-resources + download
authentication    -> account
home / settings   -> authentication + account
```

完成结果（2026-10-09）：

- 新建 `resource-catalog`，集中 Modrinth、CurseForge、远程分类、平台缓存和公共目录类型。
- 新建 `instance-resources`，集中本地已安装资源、模组清单、快照与资源图标能力。
- 下载任务仍归 `download`；收藏及模组集弹窗移入 `library`，消除 `download -> library -> download` 环。
- 账号认证流程独立为 `authentication`，`account` 只保留账号状态；避免公共 Barrel 将账号状态与认证 UI 打包在一起。
- 新闻数据移入 `shared/data`，皮肤引擎和 Viewer Hook 移入 `wardrobe`。
- 运行时校验类型与展示辅助函数移入 `runtime`，消除 `runtime` 对实例详情页面内部实现的依赖。
- 所有跨 Feature 调用改走根级公共入口，深层导入结构基线从 99 降为 0。
- `pnpm structure:check` 与 `pnpm build` 通过。

后续约束：`resource-catalog` 不得依赖 `download`、`library` 或页面 Feature；Feature 公共入口新增导出时必须复核循环依赖与产物分包。

### Phase 4：拆分大模块和深层目录

状态：`IN PROGRESS`

任务：

- [x] 将独立的 `InstanceDetail` 合并到 `instances/detail` 领域，并移除 `components/tabs` 包装层。
- [x] 完成 `keymap` 子域拆分，主编排组件控制在 500 行以内。
- [x] 拆分 `InstanceModDownloadView` 的前置依赖弹窗、下载队列与依赖编排职责。
- [x] 拆分 `MicrosoftAccountSidebar` 的局域网投送状态、设备列表、传输面板与接收弹窗职责。
- [x] 拆分 `SkinEngine` 的公共类型、场景几何工具与点击反馈状态机，保留模型和 AnimationMixer 生命周期主干。
- [x] 拆分 `WebDavManageModal` 的收藏、按键配置、存档列表与下载目标视图，保留 WebDAV 状态和命令编排主干。
- [x] 拆分实例模组下载 `ResourceGrid` 的资源卡片与加载反馈视图，保留虚拟列表、响应式列数和焦点/触底加载编排主干。
- [x] 拆分 `AppearanceSettings` 的静态背景、动态全景、赞助者 Logo、排版与导航设置视图，保留账户判定、资源导入和统一焦点编排主干。
- [x] 拆分 `JavaFriendsAndLanPanel` 的联系人卡片与 Java/LAN 合并模型，保留好友轮询、设备详情轮询和在线状态编排主干。
- [x] 拆分 `WardrobePageController` 的皮肤备注/卡片模型、在线皮肤操作、横幅状态与页面焦点控制，保留会话资源和页面组合主干。
- [x] 拆分 `useModPanelController` 的资源刷新/依赖健康与升级快照职责，保留列表选择、元数据操作、模组管理器和面板契约组合主干。
- [x] 拆分 `modService` 的领域类型、纯身份/依赖匹配算法与 Tauri 服务网关，同时保持 `instance-resources` 公共入口契约不变。
- [x] 拆分 `ResourceDownloadPageController` 的资源选择/焦点状态与单项/批量下载执行职责，保留筛选、历史导航和页面组合主干。
- [x] 拆分 `SaveRestoreModal` 的恢复校验/交互状态与详情展示职责，保留弹窗动作和焦点导航组合主干。
- [x] 拆分 `LibraryPageController` 的模组集追踪派生/同步与覆盖层弹窗组合职责，保留集合筛选、主内容和页面焦点编排。
- [x] 拆分 `InstancesPageController` 的响应式筛选/操作栏与导入/标签覆盖层职责，保留视图模式、自动聚焦和实例列表编排。
- [x] 拆分 `ScreenshotPanel` 的截图卡片/图库状态视图与展示格式化工具，保留数据控制、焦点导航、头部工具栏和覆盖层编排。
- [x] 拆分 `ExportConfirmStep` 的导出摘要/路径视图、执行状态视图与共享契约，保留默认目录、进度监听、命令调用和状态切换编排。
- [x] 拆分 `OnlineServerCard` 的图片缓存、展示模型、封面/详情抽屉与底部操作区，保留展开状态、复制反馈和卡片焦点编排。
- [x] 拆分 `useResourceDownload` 的实例环境/已安装模组同步与筛选元数据加载职责，保留搜索、分页、缓存恢复和返回契约组合。
- [x] 拆分 `GameLogSidebar` 的崩溃诊断报告、诊断/分享动作与浮动入口职责，保留侧栏布局、焦点边界和日志视图编排。
- [x] 拆分 `DirectoryBrowserModal` 的文件分类/面包屑模型与目录内容视图，保留导航历史、目录创建、输入焦点和选择契约编排。
- [x] 拆分 `CollectionSidebar` 的标签展示模型与标签增删改管理弹窗，保留集合筛选导航和选择契约。
- [x] 拆分 `ProjectDescriptionModal` 的翻译控制、双语 Markdown 内容与截图轮播职责，保留弹窗滚动和焦点编排。
- [x] 拆分 `InstanceSelectModal` 的兼容实例加载、已安装扫描、前置依赖检查与选择视图，保留确认和焦点编排。
- [x] 按按钮、进度、输入、选择器和反馈分类拆分 `OreUiShowcaseModal`，保留分类导航和交互测试状态。
- [x] 拆分 `FavoritePlaceholderModal` 的收藏数据模型、模组集追踪/保存编排与项目选择视图，保留原弹窗和 Store 契约。
- [x] 拆分 `JavaSelector` 的 Java 探测/删除编排、选择列表与删除确认视图，保留手动目录选择和焦点恢复契约。
- [x] 拆分 `FilterBar` 的响应式样式 token、资源页签、来源选择与筛选字段视图，保留本地化选项和焦点编排。
- [x] 拆分 Download `ResourceGrid` 的加载反馈、响应式列布局与分页锁，保留虚拟行和卡片焦点导航。
- [x] 拆分 `VersionChangelogModal` 的翻译状态、单双语内容与滚动展示职责，保留弹窗动作和下载契约。
- [x] 继续按 `mods`、`saves`、`screenshots` 等子域拆分实例详情大文件。
- [x] 将 `LibraryPage` 的状态编排迁入 Feature Controller，路由页面只保留 Feature 组合。
- [x] 将 Library 的实例选择、资源关联、资源编辑和新增资源弹窗状态提取为独立 Hook。
- [x] 将 `WardrobePage` 的业务编排迁入 Wardrobe Feature Controller，路由页面只保留公共入口组合。
- [x] 将 `ResourceDownloadPage` 的业务编排迁入 Download Feature Controller；Library 收藏弹窗由路由页通过组件契约注入，避免恢复双向依赖。
- [x] 将 `InstancesPage` 的业务编排迁入 Instances Feature Controller，路由页面只保留公共入口组合。
- [x] 将 Library、Wardrobe、Download、Instances 的重型路由 Controller 从通用 `index.ts` 分离到 `page.ts` 次入口，避免公共 Barrel 扩大产物依赖图。
- [x] 将 `NewsPage` 的筛选、分页、焦点与更新日志编排迁入 Home Feature Controller，路由页面改走 `page.ts` 次入口。
- [x] 将 `NewInstancePage` 的创建视图切换、赞助数据与返回焦点编排迁入 Instances Feature Controller，并以独立 `creationPage.ts` 次入口保持路由懒加载边界。
- [x] 将 `InstanceDetailPage` 的详情数据、页签焦点与面板组合迁入 Instances Detail Controller，并以独立 `detailPage.ts` 次入口保持路由懒加载边界。
- [x] 将 `SettingsPage` 的页签、字体预热与焦点编排迁入 Settings Feature Controller，路由页面改走 `page.ts` 次入口。
- [x] 将 `HomePage` 的实例选择、启动与页面导航编排迁入 Home Feature Controller，并以独立 `homePage.ts` 次入口避免与 News 路由耦合。
- [x] 将 `InstanceModDownloadPage` 的实例上下文、返回导航与下载视图组合迁入 Instances Detail Controller，并以独立 `modDownloadPage.ts` 次入口保持路由边界。
- [x] 将 `MultiplayerPage` 的分区、输入动作与在线服务器编排迁入 Multiplayer Feature Controller，路由页面改走 `page.ts` 次入口。
- [x] 继续检查其余页面，将明显的业务状态编排提取到 Feature Hook 或 Controller。
- [x] 将超过约 500 行且承担多种职责的文件列入拆分清单。
- [x] 将 `dialogs/components` 之类的重复层级扁平化。
- [x] 将 `src/style/pages/Multiplayer.css` 整体归位到 Multiplayer Feature，并保持全局加载时机不变。
- [x] 按 Multiplayer 页面外壳、联机流程与在线服务器子组件职责拆分 Feature 内样式。
- [ ] 样式与其所有者共置，保留真正全局的 token、reset 和主题样式。
- [x] 消除 `src/style/app.css` 中两个 `index.css` 导入的命名歧义。

首批完成结果（2026-10-09）：

- `mods/components/{dialogs,download,list,panel}` 已扁平为 `mods/{dialogs,download,list,panel}`。
- `dialogs/components`、`dialogs/hooks`、`dialogs/utils` 已按局部私有职责合并到 `dialogs/`。
- 超过 7 段的源码路径结构基线从 28 降为 0。
- `src/style/index.css` 重命名为 `src/style/utilities.css`；根级 `src/index.css` 的主题入口保持不变。
- `pnpm structure:check` 与 `pnpm build` 通过。

第二批完成结果（2026-10-10）：

- 将原 `src/features/instance-detail` 全部归并到 `src/features/instances/detail`，删除重复的顶级实例领域。
- 移除实例详情中的 `components/tabs` 目录包装，保留 `mods`、`saves`、`screenshots`、`achievements` 等实际子域。
- 实例详情页面通过 `features/instances` 公共入口使用业务能力；公共入口使用显式导出，避免类型重名和无意扩大打包边界。
- 将 `src/pages/LibraryPage.tsx` 缩减为路由级 Feature 组合，原有状态与交互编排迁入 `features/library/components/LibraryPageController.tsx`。
- 修复迁移后键盘布局 SVG 的脆弱相对路径，改用 `@/assets` 根别名。
- 完成 `instances/detail/keymap` 子域拆分：主编排、视觉键盘、键位列表、单键编辑、配置档案、静态布局解析、按键映射和公共类型均有独立职责文件。
- `KeymapSection.tsx` 从约 1600 行降至约 327 行；拆出的最大文件约 315 行，均低于大文件复核阈值。
- `LibraryPageController.tsx` 已提取上下文菜单、手柄焦点导航、集合管理与资源弹窗状态 Hook，从约 1182 行降至约 655 行；弹窗调用不再向右键菜单暴露 React setter。
- 将 `WardrobePage.tsx` 从约 775 行缩减为 5 行路由组合，原实现迁入 `features/wardrobe/components/WardrobePageController.tsx`；页面不再深层导入 Wardrobe 内部模块。
- Wardrobe 等价迁移后 `pnpm structure:check` 与 `pnpm build` 通过；专项 ESLint 暴露原实现既有的 7 个错误和 3 个警告，留待独立代码质量批次处理，避免与架构迁移混合。
- 将 `ResourceDownloadPage.tsx` 从约 676 行缩减为 10 行路由组合，原实现迁入 `features/download/components/ResourceDownloadPageController.tsx`；Library 收藏弹窗由页面注入，未恢复 `download -> library` 依赖。
- ResourceDownload 等价迁移后 `pnpm structure:check` 与 `pnpm build` 通过；专项 ESLint 仅保留原实现既有的 2 个错误，未引入新的规则错误。
- 将 `InstancesPage.tsx` 从约 568 行缩减为 5 行路由组合，原实现迁入 `features/instances/components/InstancesPageController.tsx`；Feature 内部不经自身公共 Barrel 回引。
- Library、Wardrobe、Download、Instances 的重型路由 Controller 改由 Feature 根级 `page.ts` 导出；修复通用 Barrel 导出导致的打包边界扩大，`useGameLaunch` 产物块从约 640 kB 恢复为约 538 kB。
- Instances 等价迁移后 `pnpm structure:check` 与 `pnpm build` 通过；专项 ESLint 仅保留原实现既有的 3 个显式 `any` 错误。
- 修复 `instances/detail/basic-panel` 经自身 Feature 公共入口回引 `environmentSelection` 导致的 `LOADER_TYPES` 运行时暂时性死区；Feature 内部统一改为直接模块依赖。
- 完成 `InstanceModDownloadView` 职责拆分：视图编排从约 1160 行降至约 479 行，前置依赖弹窗、依赖解析、依赖/批量下载编排和单任务入队分别迁入独立组件、工具与 Hook；拆出文件均低于 500 行复核阈值。
- 上述拆分保持下载行为不变；两个下载 Hook、依赖解析工具和弹窗组件专项 ESLint 通过，主视图只保留 4 个既有的 Effect/显式 `any` 规则问题。
- 完成 `MicrosoftAccountSidebar` 职责拆分：确认其主体是 LAN 信任与投送而非 Microsoft 登录，将 1148 行主组件降至 245 行，并拆出 LAN Controller Hook、可信设备列表、传输会话、接收/信任弹窗和展示工具；最大拆出文件为 441 行。
- 上述拆分未改动账户或投送行为；`pnpm build` 通过，专项 ESLint 从原文件既有的 9 个错误和 2 个警告降为 Controller Hook 中 4 个 Effect 错误和 2 个依赖警告，其余新增文件无规则问题。
- 完成 `SkinEngine` 算法边界复核与拆分：公共契约、Three.js 场景/相机几何工具、点击冲量与受击闪烁状态机已独立，主引擎从 967 行降至 794 行；模型加载、AnimationMixer、渲染循环和资源销毁保留在同一生命周期主干中，不再为满足行数机械拆分。
- SkinEngine 拆分后 `pnpm build` 通过；新增模块专项 ESLint 无问题，主引擎仍仅有拆分前已存在的 2 个 `_backEquipment` 未使用参数错误。
- 完成 `WebDavManageModal` 视图职责拆分：主编排从约 940 行降至 492 行，收藏同步、按键配置、远端存档列表、下载目标面板以及共享展示类型/格式化工具均已独立；WebDAV 加载、同步、删除、下载与恢复命令仍保留在同一编排主干中。
- WebDAV 管理弹窗拆分后 `pnpm build` 通过；新增组件和工具专项 ESLint 无问题，主文件从原有 6 个错误和 1 个警告降至 4 个既有错误和 1 个既有警告，未新增规则问题。
- 完成实例模组下载 `ResourceGrid` 职责拆分：主网格从 898 行降至 453 行，353 行资源卡片与 106 行加载骨架/分页反馈视图已独立；虚拟行计算、响应式单双列、焦点恢复与触底加载继续保留在同一网格编排主干中。
- ResourceGrid 拆分后 `pnpm build` 通过；三个相关文件专项 ESLint 为 0 个错误和 1 个既有 `useVirtualizer` 兼容性警告，未新增规则问题。
- 深层源码路径和跨 Feature 深层导入继续保持为 0，`pnpm structure:check` 与 `pnpm build` 通过。

第三批完成结果（2026-10-11）：

- 完成 `AppearanceSettings` 视图职责拆分：主编排从 807 行降至 306 行，静态背景、动态全景、赞助者 Logo、排版与导航设置已形成独立 Section；最大拆出文件为 274 行。
- 账户与赞助者判定、背景/Logo/全景资源导入、系统字体和新闻封面加载、统一焦点顺序仍由主文件编排；设置字段和交互顺序保持不变。
- AppearanceSettings 拆分后 `pnpm build` 通过；相关文件专项 ESLint 从原有 12 个错误降至 1 个既有全景列表 Effect 规则错误，新增 Section 无规则问题。
- 完成 `JavaFriendsAndLanPanel` 职责拆分：主面板从 777 行降至 334 行，332 行联系人卡片、119 行 Java/LAN 合并排序模型和共享契约已独立；好友轮询、设备详情轮询、展开状态清理仍保留在主编排中。
- JavaFriendsAndLanPanel 拆分后 `pnpm build` 通过；专项 ESLint 从原有 5 个错误和 1 个警告降至 3 个既有 Effect 错误和 1 个既有依赖警告，纯模型及类型文件无规则问题。
- 完成 `WardrobePageController` 职责拆分：主控制器从 775 行降至 495 行，皮肤备注持久化、皮肤卡片模型、在线皮肤保存/应用、横幅计时状态与页面焦点/输入动作分别迁入独立 Hook；会话资源、Viewer 同步和页面组合仍保留在主编排中。
- Wardrobe 控制器拆分后 `pnpm build` 与 `pnpm structure:check -- --details` 通过；专项 ESLint 从原有 7 个错误和 3 个警告降至 1 个既有备注加载 Effect 错误和 2 个既有依赖警告，同时移除了披风预览参数的显式 `any`。
- 完成 `useModPanelController` 职责拆分：主 Hook 从 766 行降至 486 行，130 行资源刷新/依赖健康 Hook 与 244 行升级快照 Hook 已独立；列表选择、文件名清理、元数据重识别和最终面板契约仍保留在主编排中。
- 模组面板控制器拆分后 `pnpm build` 与 `pnpm structure:check -- --details` 通过；专项 ESLint 从原有 4 个错误和 1 个警告降至 3 个既有 Effect 错误和 1 个既有依赖警告，同时移除了增量元数据合并处的显式 `any`。
- 完成 `instance-resources` 模组服务拆分：原 731 行 `modService.ts` 缩减为 236 行 Tauri 服务网关，217 行领域契约迁入 `modTypes.ts`，319 行实例版本解析及模组身份/依赖匹配算法迁入 `modIdentity.ts`；原有 37 个公共导出均由 Feature 根入口继续提供。
- 模组服务拆分后 `pnpm build` 与 `pnpm structure:check -- --details` 通过，服务、类型、身份算法和公共入口专项 ESLint 从原有 5 个显式 `any` 错误降为 0；仅被动更新类型导入的 `modIconService` 保留 1 个既有依赖警告。实例详情返回值与文件清理结果改用明确契约，不改变命令名、参数或缓存失效行为。
- 完成 `ResourceDownloadPageController` 职责拆分：主控制器从 693 行降至 331 行，284 行资源选择/焦点 Hook 与 245 行单项/批量下载执行 Hook 已独立；筛选、作者历史导航和页面组合仍保留在主编排中。
- 资源下载控制器拆分后 `pnpm build` 与 `pnpm structure:check -- --details` 通过，三个相关文件专项 ESLint 从原有 2 个错误降为 0；移除资源 ID 读取处的显式 `any`，并将详情退出过渡状态收口到打开/关闭动作，保留原有 350ms 退出动画。
- 完成 `SaveRestoreModal` 职责拆分：主弹窗从 672 行降至 196 行，336 行备份详情视图、126 行恢复校验/手柄滚动控制 Hook 和 100 行告警/错误本地化工具已独立；弹窗动作与线性焦点导航仍保留在主组合中。
- 存档恢复弹窗拆分后 `pnpm build` 与 `pnpm structure:check -- --details` 通过，四个相关文件专项 ESLint 从原有 1 个 Effect 错误降为 0；内部控制器按实例与备份 ID 建立生命周期边界，切换或重开备份时自然重置校验和配置恢复状态。
- 完成 `LibraryPageController` 后续职责拆分：主控制器从 654 行降至 440 行，124 行模组集追踪派生/同步 Hook 与 237 行页面覆盖层组合组件已独立；集合筛选、排序、主内容和页面焦点编排仍保留在主控制器中。
- Library 控制器拆分后 `pnpm build` 与 `pnpm structure:check -- --details` 通过，三个相关文件专项 ESLint 均为 0；追踪面板、集合元数据弹窗和其余覆盖层的 DOM 先后顺序保持不变。
- 完成 `InstancesPageController` 后续职责拆分：主控制器从 567 行降至 211 行，335 行响应式筛选/操作栏与 215 行目录导入、第三方导入、标签筛选覆盖层组合已独立；视图模式持久化、首次自动聚焦、第三方来源面板和实例列表仍保留在页面控制器中。
- Instances 控制器拆分后 `pnpm build` 与 `pnpm structure:check -- --details` 通过，三个相关文件专项 ESLint 从原有 3 个显式 `any` 错误降为 0；焦点键、覆盖层顺序及目录选择后的 150ms 检查延迟保持不变。
- 完成 `ScreenshotPanel` 视图职责拆分：主面板从 540 行降至 333 行，305 行截图卡片/加载错误空状态/选择操作栏组合迁入 `screenshots/ScreenshotGallery.tsx`，字节与日期格式化迁入 19 行纯展示工具；数据控制、二维焦点导航、头部工具栏、预览与删除确认仍保留在主编排中。
- ScreenshotPanel 拆分后 `pnpm build` 与 `pnpm structure:check -- --details` 通过，三个相关文件专项 ESLint 均为 0；卡片 DOM、焦点键、右键多选、预览和永久删除交互保持不变。
- 完成 `ExportConfirmStep` 职责拆分：主编排从 567 行降至 295 行，205 行导出摘要/路径确认视图、208 行导出中/成功/失败状态视图和 19 行共享契约已独立；默认目录创建、进度事件监听、导出/取消命令和焦点切换仍保留在主组件中。
- 导出确认步骤拆分后 `pnpm build` 与 `pnpm structure:check -- --details` 通过，四个相关文件专项 ESLint 从原有 1 个显式 `any` 错误降为 0；Tauri 命令名、参数、任务 ID 过滤和状态 DOM 顺序保持不变。实例详情目录最大源码文件现为 486 行，本轮大文件复核完成。
- 完成 `OnlineServerCard` 职责拆分：主卡片从 662 行降至 155 行，299 行封面/实时状态/详情抽屉视图、171 行特色与复制/加入操作区、195 行纯展示模型和 71 行图片缓存组件已独立；展开状态、复制反馈计时、输入模式与卡片级焦点编排仍保留在主组件中。
- 在线服务器卡片拆分后 `pnpm build` 与 `pnpm structure:check -- --details` 通过，五个相关文件专项 ESLint 从原有 1 个缓存图片 Effect 错误降为 0；图片回退、焦点键、Y 键切换、复制 IP、外链打开和加入回调保持不变。
- 完成 `useResourceDownload` 职责拆分：主 Hook 从 635 行降至 404 行，206 行实例环境/已安装模组同步与 109 行筛选元数据加载分别迁入独立 Hook；远程搜索、分页重试、筛选状态、缓存恢复和原返回契约仍由主 Hook 编排。
- 下载资源 Hook 拆分后 `pnpm build` 与 `pnpm structure:check -- --details` 通过，三个相关文件专项 ESLint 从原有 4 个 Effect 错误和 1 个回调依赖警告降为 0；实例环境解析导出、700ms 下载完成刷新、2 秒事件去重、180ms 元数据延迟和 40ms 搜索延迟保持不变。
- 完成 `GameLogSidebar` 职责拆分：主侧栏从 605 行降至 451 行，126 行诊断复制/日志分享/诊断包导出/进程终止动作 Hook、76 行崩溃诊断报告与 82 行浮动入口组件已独立；侧栏动画、焦点边界、遥测、日志视图和覆盖层顺序仍由主组件编排。
- 游戏日志侧栏拆分后 `pnpm build` 与 `pnpm structure:check -- --details` 通过，四个相关文件专项 ESLint 均为 0；诊断复制反馈 2 秒计时、焦点恢复 80ms 延迟、分享参数、浮动入口层级和焦点键保持不变。
- 完成 `DirectoryBrowserModal` 职责拆分：主弹窗从 646 行降至 354 行，299 行动作菜单/新建目录/节点列表内容视图与 91 行文件分类、面包屑、排序和焦点键纯模型已独立；目录历史、Tauri 数据 Hook、全局输入动作、页头/页脚和选择契约仍由主弹窗编排。
- 目录浏览弹窗拆分后 `pnpm build` 与 `pnpm structure:check -- --details` 通过，三个相关文件专项 ESLint 从原有 1 个 Effect 错误和 7 个显式 `any` 错误降为 0；文件扩展名过滤、文件夹优先排序、焦点键、50ms 创建/菜单聚焦延迟和双击打开行为保持不变。
- 完成 `CollectionSidebar` 职责拆分：主侧栏从 595 行降至 151 行，455 行标签增删改管理弹窗与 65 行颜色、图标、时间戳和集合创建模型已独立；主组件仅保留标签筛选导航、管理入口和原回调契约。
- 集合侧栏拆分后 `pnpm build` 与 `pnpm structure:check -- --details` 通过，三个相关文件专项 ESLint 从原有 1 个渲染纯度错误降为 0；标签资源计数、重复名称校验、二次删除确认、80ms 输入聚焦和焦点键保持不变。
- 完成 `ProjectDescriptionModal` 职责拆分：主弹窗从 594 行降至 274 行，136 行翻译控制 Hook、135 行单双语 Markdown 内容和 112 行截图轮播已独立；滚动折叠、外链处理、翻译状态提示和弹窗焦点仍由主组件编排。
- 项目描述弹窗拆分后 `pnpm build` 与 `pnpm structure:check -- --details` 通过，四个相关文件专项 ESLint 均为 0；TMT 命令参数、图片/iframe 占位保护、LT/RT 模式切换、轮播焦点键和滚动阈值保持不变。
- 完成 `InstanceSelectModal` 职责拆分：主弹窗从 578 行降至 295 行，225 行兼容实例/已安装模组/前置依赖数据 Hook、136 行实例选择列表、79 行依赖状态视图和 16 行共享模型已独立；确认、关闭后焦点恢复和线性导航仍由主弹窗编排。
- 实例选择弹窗拆分后 `pnpm build` 与 `pnpm structure:check -- --details` 通过，五个相关文件专项 ESLint 从原有 4 个 Effect 同步状态错误和 1 个显式 `any` 错误降为 0；弹窗按打开版本建立状态生命周期，兼容实例命令参数、缓存扫描逐项让出事件循环、依赖匹配来源、60ms 焦点恢复和焦点键保持不变。
- 完成 `OreUiShowcaseModal` 展示职责拆分：主弹窗从 672 行降至 148 行，按钮、进度、输入、选择器与反馈五个独立 Section 分别为 170、93、135、102、83 行，9 行分类模型集中维护页签契约；主弹窗继续持有全部实时交互状态和分类导航。
- OreUI 展示弹窗拆分后 `pnpm build` 与 `pnpm structure:check -- --details` 通过，七个相关文件专项 ESLint 均为 0；页签顺序、FocusBoundary、关闭焦点键和跨分类保留的输入/滑块/开关测试值保持不变。
- 完成 `FavoritePlaceholderModal` 职责拆分：主弹窗从 553 行降至 89 行，261 行收藏/模组集追踪保存 Hook、181 行表单视图、139 行纯数据模型与 63 行项目选择列表已独立；主弹窗仅保留 Modal 组合和动作区。
- 收藏占位弹窗拆分后 `pnpm build` 与 `pnpm structure:check -- --details` 通过；专项 ESLint 保留原有的 2 个 Effect 同步状态错误和 1 个依赖警告，未新增规则问题。收藏记录、集合关系、追踪器参数、焦点键、DOM 区域顺序和公共组件契约保持不变。
- 完成 `JavaSelector` 职责拆分：主选择器从 544 行降至 80 行，298 行 Java 探测/删除与焦点 Controller Hook、215 行选择列表弹窗和 103 行删除确认弹窗已独立；主组件仅保留输入入口与三个覆盖层组合。
- Java 选择器拆分后 `pnpm build` 与 `pnpm structure:check -- --details` 通过，四个相关文件专项 ESLint 从原有 2 个显式 `any` 错误降为 0；Tauri 命令名、手动路径推导、焦点键、80/100ms 焦点延迟、弹窗顺序和公共组件契约保持不变。
- 完成 `FilterBar` 视图职责拆分：主编排从 527 行降至 205 行，212 行筛选字段、103 行响应式样式 token、93 行资源页签、48 行来源选择器和 35 行公共契约已独立；本地化选项、PageUp/PageDown 切换和二维焦点导航仍保留在主组件中。
- 下载筛选栏拆分后 `pnpm build` 与 `pnpm structure:check -- --details` 通过，六个相关文件专项 ESLint 均为 0；受控筛选属性、LT/RT 页签提示、紧凑/Deck 布局、焦点键、资源网格下移规则和公共导出保持不变。
- 完成 Download `ResourceGrid` 职责拆分：主网格从 514 行降至 327 行，140 行加载骨架/分页反馈视图、60 行响应式列布局 Hook 与 66 行分页锁 Hook 已独立；虚拟行、滚动恢复和卡片焦点导航仍保留在主组件中。
- Download 资源网格拆分后 `pnpm build` 与 `pnpm structure:check -- --details` 通过，四个相关文件专项 ESLint 为 0 个错误和 1 个既有 `useVirtualizer` 兼容性警告；`ResourceCardSkeleton` 公共导出、单双列阈值、800ms 重排反馈、触底加载锁和焦点恢复契约保持不变。
- 完成 `VersionChangelogModal` 职责拆分：主弹窗从 510 行降至 129 行，157 行翻译状态 Hook、166 行单双语更新日志视图与 166 行元数据/翻译控制/滚动内容视图已独立；主弹窗仅保留动作按钮、默认焦点和下载回调组合。
- 版本更新日志弹窗拆分后 `pnpm build` 与 `pnpm structure:check -- --details` 通过，四个相关文件专项 ESLint 均为 0；TMT 命令参数、图片占位保护、按版本缓存、LT/RT 模式切换、40px 手柄滚动、焦点键和下载契约保持不变。
- 将 `NewsPage.tsx` 从 484 行缩减为 5 行路由组合，原筛选、增量分页、初始焦点、新闻刷新、已读同步与版本更新日志切换编排等价迁入 482 行 `features/home/components/NewsPageController.tsx`，并由 Home 的 `page.ts` 次入口单独导出。
- News 页面迁移后 `pnpm build` 与 `pnpm structure:check -- --details` 通过；页面、次入口与 Controller 专项 ESLint 仅保留原文件第 147 行已有的 1 个 Effect 同步状态错误，未新增规则问题。焦点键、70/80ms 首项聚焦重试、IntersectionObserver 阈值、每次 6 项加载和实例创建跳转保持不变。
- 将 `NewInstancePage.tsx` 从 317 行缩减为 5 行路由组合，原创建方式切换、新闻版本承接、赞助数据过滤/排序、Escape/B 键返回和菜单焦点恢复编排等价迁入 316 行 `features/instances/components/NewInstancePageController.tsx`。
- NewInstance 页面迁移后 `pnpm build` 与 `pnpm structure:check -- --details` 通过，页面、语义化次入口与 Controller 专项 ESLint 均为 0；首次构建发现共用 `instances/page.ts` 会把 Instances/NewInstance 合并为约 122 kB 共享块，改用独立 `creationPage.ts` 后恢复为约 74/48 kB 两个路由块，未扩大既有懒加载边界。
- 将 `InstanceDetailPage.tsx` 从 334 行缩减为 5 行路由组合，原实例详情数据装配、九个面板组合、页签切换/焦点恢复和 Escape 退出编排等价迁入 329 行 `features/instances/detail/InstanceDetailPageController.tsx`。
- InstanceDetail 页面迁移后 `pnpm build` 与 `pnpm structure:check -- --details` 通过，页面、`detailPage.ts` 次入口与 Controller 专项 ESLint 均为 0；Controller 全部改用 Instances Feature 内直接依赖，未重新引入自身 Barrel 回引，约 8.75 kB 路由入口块保持独立。
- 将 `SettingsPage.tsx` 从 187 行缩减为 5 行路由组合，原八个设置页签、系统字体预热、LT/RT 切换反馈、焦点恢复和面板组合等价迁入 184 行 `features/settings/components/SettingsPageController.tsx`，并由 Settings 的 `page.ts` 次入口单独导出。
- Settings 页面迁移后 `pnpm build` 与 `pnpm structure:check -- --details` 通过，页面、次入口与 Controller 专项 ESLint 均为 0；约 9.04 kB Settings 路由入口与八个设置面板继续独立分包，Feature 内未通过自身公共入口回引。
- 将 `HomePage.tsx` 从 134 行缩减为 5 行路由组合，原当前实例派生、实例选择、游戏启动、详情/衣柜导航和响应式首页组合等价迁入 131 行 `features/home/components/HomePageController.tsx`，并由独立 `homePage.ts` 次入口导出。
- Home 页面迁移后 `pnpm build` 与 `pnpm structure:check -- --details` 通过，页面、次入口与 Controller 专项 ESLint 均为 0；首页继续由应用壳同步组合，约 39.87 kB News 路由块与 Home 公共块保持独立。
- 将 `InstanceModDownloadPage.tsx` 从 64 行缩减为 5 行路由组合，原实例上下文、空实例回退、Escape 返回和下载视图组合等价迁入 62 行 `instances/detail/mods/download/InstanceModDownloadPageController.tsx`，并由独立 `modDownloadPage.ts` 次入口导出。
- InstanceModDownload 页面迁移后 `pnpm build` 与 `pnpm structure:check -- --details` 通过；专项 ESLint 仅保留迁移前已有的 1 个 Effect 依赖警告。约 1.50 kB 页面入口与 46.56 kB 下载视图形成独立块，`useGameLaunch` 共享块从约 542.26 kB 降至 496.66 kB。
- 将 `MultiplayerPage.tsx` 从 47 行缩减为 5 行路由组合，原分区状态、四个输入动作、在线服务器加载/刷新和两种视图组合等价迁入 45 行 `features/multiplayer/components/MultiplayerPageController.tsx`，并由 `page.ts` 次入口导出。
- Multiplayer 页面迁移后 `pnpm build` 与 `pnpm structure:check -- --details` 通过，页面、次入口与 Controller 专项 ESLint 均为 0；约 63.37 kB 路由块与迁移前约 63.35 kB 基本一致，1917 行样式文件未混入本批处理。
- 将 1917 行 `src/style/pages/Multiplayer.css` 整体迁入 `features/multiplayer/multiplayer.css`；该文件无资源 URL、全局根选择器或跨业务域类名，样式所有者明确。
- Multiplayer 样式归位后 `pnpm build` 与 `pnpm structure:check -- --details` 通过；`style/app.css` 仅更新导入路径且顺序不变，主 CSS 产物继续为约 444.23 kB，本批未改变加载时机或选择器优先级。
- 将 1917 行 `features/multiplayer/multiplayer.css` 拆为 3 行聚合入口，以及 `styles/page-shell.css`（页面外壳与共享反馈）、`styles/terracotta-flow.css`（Terracotta 选择、状态和日志流程）、`styles/online-servers.css`（服务器目录、浮动刷新与兼容卡片样式）三个职责文件；各断点规则随其所有者归位。
- 本批保留当前 JSX 已不再引用的旧服务器卡片选择器，不把死样式删除混入结构拆分；后续应在独立清理批次核实后移除。
- Multiplayer 样式拆分后以 PostCSS AST 对比确认拆分前后的 281 条“媒体条件 + 选择器 + 声明”规则一致；`pnpm build`、`pnpm structure:check -- --details` 与 diff 空白检查通过，主 CSS 产物约 444.31 kB，Multiplayer 路由块仍约 63.37 kB。

遗漏复核（更新至 2026-10-12）：

- 旧 `instance-detail`、根级 `store/stores` 和 `hooks/pages` 均已删除，未发现迁移残留引用。
- 全部 11 个 `*Page.tsx` 已完成复核：10 个页面为 5 行 Feature 组合，`ResourceDownloadPage.tsx` 为 10 行跨 Feature 弹窗契约注入；页面层已无 `useState`、Effect、输入动作或跨 Feature 深层导入。
- 样式共置已从 Multiplayer 开始：原页面样式已整体归位到 Feature，但 `src/style/pages`、`src/style/features` 与 `src/style/ui` 仍集中保存大量组件样式，且 Multiplayer 内部样式尚待按现有子组件职责拆分，因此总括任务保持未完成。
- 超过 500 行只作为复核信号；纯数据、设计 token 或单一算法实现不因行数自动拆分。
- ScreenshotPanel 拆分后发现并补做 `export/ExportConfirmStep.tsx`；再次扫描确认实例详情目录已无超过 500 行的源码文件。
- GameLogSidebar 拆分后重新扫描前端大文件；`SkinEngine`、设计 token 和平台 API 等单一生命周期/数据/网关文件继续按职责而非行数判断，其余多职责 UI 纳入下一轮复核。
- DirectoryBrowserModal 拆分后通用目录选择器的三个文件均低于 500 行；五处既有调用继续复用原组件契约，无需修改 Feature 消费方。
- CollectionSidebar 拆分后 Library 标签导航、管理弹窗和共享展示模型均低于 500 行；标签持久化回调仍由上层 Library Feature 注入，无需修改 Store 或数据库结构。
- ProjectDescriptionModal 与 InstanceSelectModal 拆分后，下载详情的描述翻译、图库、兼容实例加载、已安装扫描和前置依赖检查均已有独立职责边界。
- InstanceSelectModal 拆分后下载详情的两个既定大弹窗及其拆出文件均低于 500 行；重新扫描确认下一轮需要复核设置展示弹窗、Library 收藏占位弹窗、Java 选择器和下载列表视图。
- `SkinEngine`、`designToken.ts`、`curseforgeApi.ts` 与 `InputDriver.ts` 分别属于稳定生命周期引擎、设计数据、平台网关和统一输入驱动，继续按职责保留，不因超过 500 行机械拆分。
- OreUiShowcaseModal 拆分后设置 UI 工坊的主弹窗、五个分类 Section 与分类模型均低于 500 行，实时演示状态仍集中在主弹窗，避免分类切换导致测试值重置。
- FavoritePlaceholderModal 拆分后收藏数据转换、保存/追踪编排、表单和项目列表均低于 500 行；Library 公共入口与 Download 页面注入契约无需修改。
- JavaSelector 拆分后探测/删除编排、选择列表和删除确认均低于 500 行；Java 下载仍由 Settings/Setup 原有流程负责，本批未迁移或改变其职责。
- FilterBar 拆分后响应式 token、资源页签、来源选择和字段视图均低于 500 行；筛选状态继续由 ResourceDownloadPageController 持有。
- Download ResourceGrid 拆分后加载反馈、响应式列状态和分页锁均形成独立边界，主网格及三个拆出文件均低于 500 行；虚拟列表与焦点导航保持同一编排边界，未发现遗漏的资源网格职责迁移。
- VersionChangelogModal 拆分后翻译编排、单双语格式化和滚动内容视图均低于 500 行；重新扫描 `src` 后，超过 500 行的 TypeScript 文件仅剩已明确按稳定生命周期、设计数据、平台网关和统一输入驱动保留的四个职责单一模块。
- News 页面迁入 Home Feature 后，`src/pages/NewsPage.tsx` 不再深层引用 Home 内部组件；重型 Controller 通过 `features/home/page.ts` 暴露，未扩大 Home 通用公共入口。
- NewInstance 页面迁入 Instances Feature 后，`src/pages/NewInstancePage.tsx` 不再深层引用创建视图；Instances 列表与创建页分别使用 `page.ts`、`creationPage.ts`，构建产物继续维持独立路由块。
- InstanceDetail 页面迁入 Instances Detail 后，路由层不再直接组合九个详情面板；`detailPage.ts` 与 Feature 内直接导入共同避免列表、创建、详情三个路由互相卷入依赖图。
- Settings 页面迁入 Settings Feature 后，路由层不再持有页签和焦点状态；面板级 `lazy()` 仍留在 Controller，保持原有按页签加载边界。
- Home 页面迁入 Home Feature 后，路由层不再深层组合首页内部组件；首页使用 `homePage.ts`，避免与 News 的 `page.ts` 共用重型入口。
- InstanceModDownload 页面迁入 Instances Detail 后，路由层不再经 Instances 公共 Barrel 获取重型下载视图；直接子域依赖恢复了下载视图的独立懒加载块。
- Multiplayer 页面迁入 Multiplayer Feature 后，路由层不再深层导入类型、Hook 和内部视图；页面业务编排复核总括项完成。

当前剩余大文件拆分优先级：

当前未发现新的超过 500 行且承担多种职责的 UI 模块；后续大文件处理以页面业务编排复核结果为准，不再按行数机械拆分。

`features/multiplayer/multiplayer.css` 约 1917 行，已完成所有权归位；后续应按页面外壳、联机流程与在线服务器组件边界拆分，避免只按行数机械切割。

建议限制：

- 页面组件尽量只负责布局、路由参数和 Feature 组合。
- 一个源码文件应有单一主要职责；行数不是硬性标准，但超过 500 行必须复核。
- 目录层级不是 UI DOM 层级的映射。

### Phase 5：Rust 模块整理

状态：`TODO`

任务：

- [ ] 统一 `services` 下模块是否使用 `_service` 后缀。
- [ ] 统一 `commands` 下模块是否使用 `_cmd` 后缀。
- [ ] 优先采用父目录表达角色，例如 `services/config.rs`、`commands/auth.rs`。
- [ ] 将 `dispatch2-0.3.1` 移入明确的 `vendor/dispatch2` 路径并更新 Cargo patch。
- [ ] 为 vendored crate 添加来源、版本、补丁原因和升级方式说明。
- [ ] 删除确认无用的空 `src-tauri/src/utils/`，或在实际需要时再建立。

约束：

- 不修改已发布数据库迁移文件的名称、顺序或内容。
- 不在纯目录整理中改变 Tauri command、事件名、配置键和持久化格式。
- vendored crate 只能在确认 Cargo patch 指向新位置后移动。

## 6. 自动化约束建议

`lint:structure` 至少检查：

- `src/` 下目录是否符合 `kebab-case`，明确允许列表除外。
- React 页面是否以 `Page.tsx` 结尾。
- 是否重新出现根级 `src/store/`、`src/stores/` 或 `src/hooks/pages/`。
- 是否存在超过约定深度的新增路径。
- Feature 外部是否深层导入另一个 Feature 的内部目录。
- Feature 内部是否通过自身根级 `index.ts` 回引，避免 Barrel 循环依赖和运行时暂时性死区。
- 大小写不一致的 import 是否能在 Linux 环境解析。

ESLint 至少增加：

- 使用 `no-restricted-imports` 限制 `pages`、`features` 和 `shared` 的依赖方向。
- 禁止从 `shared` 导入 `features` 或 `pages`。
- 禁止跨 Feature 的内部路径导入；外部只能使用公共入口。

路径别名建议：

```ts
import { OreButton } from '@/shared/ui';
import { useLibrary } from '@/features/library';
```

不要用路径别名掩盖错误边界；别名用于消除脆弱的多层 `../../..`，不代表任意模块都可以互相引用。

## 7. 每个阶段的验证清单

每个实施阶段结束时至少执行：

```powershell
pnpm lint
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
```

涉及 Rust 行为调整时增加相关 `cargo test`。涉及页面和交互重构时，至少手动验证：

- 应用启动及首屏。
- 首页、实例列表、实例详情。
- 资源搜索与下载。
- Library 收藏与模组集。
- Settings 和账号登录。
- 游戏启动与日志侧栏。

提交前检查：

- [ ] `git status` 中没有意外生成物。
- [ ] 没有仅在 Windows 上有效的大小写引用。
- [ ] 没有改动历史数据库迁移。
- [ ] 没有把业务实现重新放回页面层。
- [ ] 没有新增跨 Feature 深层导入。
- [ ] 本文档中的阶段状态和完成项已同步更新。

## 8. Agent 接手规则

后续 Agent 在处理结构重构任务时应遵守：

1. 开始前完整阅读本文档。
2. 查看当前 Git 状态，保留用户已有改动。
3. 一次只推进一个 Phase 或一个明确子任务。
4. 不把机械改名、架构迁移和功能修改混在同一批变更中。
5. 移动文件后使用全仓库搜索检查静态引用、动态路径和注释中的旧路径。
6. 完成后运行与风险相称的检查，并记录未执行项目及原因。
7. 更新本文档中对应任务的复选框和阶段状态。
8. 如果实际代码表明本计划假设不成立，先修改“已确定的决策”或相关阶段说明，再实施不同方案。

## 9. 明确不在本计划中处理的事项

- 不借目录重构改变产品功能或 UI 设计。
- 不顺带重写网络、下载、登录或实例管理逻辑。
- 不修改用户数据目录结构。
- 不修改已发布数据库迁移。
- 不删除 `dispatch2` vendored crate，除非 Cargo 已不再需要该 patch。
- 不要求一次性完成全部改造；优先保持主分支可构建。

## 10. 当前进度

| 阶段 | 状态 | 备注 |
| --- | --- | --- |
| Phase 0：约束与基线 | DONE | 已建立结构棘轮、路径别名和 CI 门禁 |
| Phase 1：纯命名统一 | DONE | 目录和页面命名已统一，构建通过 |
| Phase 2：重复目录治理 | DONE | Store 与页面 Hook 已归位，旧根目录已禁止 |
| Phase 3：Feature 解耦 | DONE | 远程目录、本地资源和下载任务已分层，跨 Feature 深层导入降为 0 |
| Phase 4：大模块拆分 | IN PROGRESS | 全部 11 个路由页面与多职责 UI 大文件清单已完成复核和编排迁移；Multiplayer 样式已归位并按页面外壳、Terracotta 流程、在线服务器目录拆分，其他组件拆分成果保持不变；下一步继续推进其余集中样式共置 |
| Phase 5：Rust 整理 | TODO | 尚未执行 |

最近更新：2026-10-12，Phase 0 至 Phase 3 完成；Phase 4 已完成深层目录扁平化、实例领域合并、Keymap 子域拆分、全部 11 个路由页面编排迁移和语义化 `*Page.ts` 打包边界隔离，并完成实例详情与多职责 UI 大文件复核，以及 Library、资源下载与 Instances 控制器、Library 收藏占位弹窗、Java 选择器、Download 筛选栏/资源网格/版本更新日志、项目描述/实例选择下载详情弹窗、设置 UI 展示弹窗、通用目录浏览弹窗、游戏日志侧栏、在线服务器卡片、截图面板、导出确认步骤、存档恢复弹窗、实例模组下载视图/资源网格/面板控制器、实例资源模组服务、账户 LAN 侧栏与好友设备面板、皮肤引擎稳定算法边界、WebDAV 管理弹窗、外观设置和更衣室控制器的职责拆分；Multiplayer 样式已整体归位并按页面外壳、Terracotta 流程和在线服务器目录拆分，下一步继续推进其余集中样式共置。
