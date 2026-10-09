# PiLauncher 代码结构与命名统一计划

> 状态：待实施
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

说明：

- 不使用无明确含义的目录缩写，例如 `AS`。
- 不要求所有业务名强制单数或复数；使用产品领域中稳定的名称，例如 `instances`、`settings`。
- 避免以大量 `index.tsx` 作为组件实现文件；`index.ts` 主要用于模块公共出口。

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
- `src/style/pages/Multiplayer.css`

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
- [ ] 继续按 `mods`、`saves`、`screenshots` 等子域拆分实例详情大文件。
- [x] 将 `LibraryPage` 的状态编排迁入 Feature Controller，路由页面只保留 Feature 组合。
- [ ] 继续检查其余页面，将明显的业务状态编排提取到 Feature Hook 或 Controller。
- [x] 将超过约 500 行且承担多种职责的文件列入拆分清单。
- [x] 将 `dialogs/components` 之类的重复层级扁平化。
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
- `LibraryPageController.tsx` 已先提取上下文菜单与手柄焦点导航 Hook，从约 1182 行降至约 777 行；后续继续拆集合管理和弹窗编排。
- 修复 `instances/detail/basic-panel` 经自身 Feature 公共入口回引 `environmentSelection` 导致的 `LOADER_TYPES` 运行时暂时性死区；Feature 内部统一改为直接模块依赖。
- 深层源码路径和跨 Feature 深层导入继续保持为 0，`pnpm structure:check` 与 `pnpm build` 通过。

当前大文件拆分优先级：

1. `src/features/library/components/LibraryPageController.tsx`（约 777 行；上下文菜单和焦点导航已提取，待继续拆集合管理和弹窗编排）。
2. `src/features/home/components/MicrosoftAccountSidebar.tsx`（约 1052 行）。
3. `src/features/instances/detail/mods/download/InstanceModDownloadView.tsx`（约 1050 行）。
4. `src/features/settings/components/tabs/data-settings/components/WebDavManageModal.tsx`（约 884 行）。
5. `src/features/instances/detail/mods/download/ResourceGrid.tsx`（约 818 行）。
6. `src/features/wardrobe/engine/SkinEngine.ts`（约 817 行）。
7. `src/features/settings/components/tabs/AppearanceSettings.tsx`（约 753 行）。

样式文件中 `src/style/pages/Multiplayer.css` 约 1669 行，应与 Multiplayer 子组件拆分同步处理，避免只按行数机械切割。

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
| Phase 4：大模块拆分 | IN PROGRESS | 实例领域已合并、Library 路由页已瘦身；下一步拆分 Keymap 与 Library Controller |
| Phase 5：Rust 整理 | TODO | 尚未执行 |

最近更新：2026-10-10，Phase 0 至 Phase 3 完成；Phase 4 已完成深层目录扁平化、实例领域合并和 Library 路由页编排迁移，下一步拆分 Keymap 与 Library Controller。
