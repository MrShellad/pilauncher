# Library 优化指南

本文基于 `docs/library_analysis.md`，并结合当前代码实现状态整理。目标是把资源库从“可用的收藏视图”推进到“可长期维护的大规模资源管理系统”。

## 当前状态

已落地能力：

- 顶部入口已统一为“收藏”，主筛选包含“全部收藏 / 模组 / 模组集 / 整合包 / 外部资源”。
- 侧边栏已收敛为标签系统，标签支持创建、编辑、删除、颜色和图标。
- 资源列表已接入右键菜单，并按上下文隐藏不可用菜单项。
- 右键菜单支持查看详情、单独添加标签、从当前标签或模组集移除。
- 模组集卡片显示追踪目标 MC 版本、Loader、就绪状态和缓存图标。
- 从模组集移除资源时会同步清理 tracker，历史残留也会被自动校准。
- 下载页的资源包收藏已接入 Library，资源包保存为 `resourcepack` 类型。
- 光影页已禁用多选和批量菜单，避免出现未闭环的收藏路径。

仍需重点优化的问题集中在：初始化性能、列表规模、批量数据接口、集合元数据管理、Library 内批量操作、导入导出，以及 tracker 的持久化边界。

## 优先级路线

### P0：数据与性能地基

#### 1. 合并 CollectionItem 初始化查询

状态：已完成。

落地内容：

- 后端新增 `get_all_collection_items` Tauri 命令。
- `LibraryService` 新增一次性读取全部 `collection_items` 的查询。
- `initializeLibrary` 已改为通过 `Promise.all` 并行读取收藏、集合和全部集合关系。

原始问题：

- [useLibraryStore.ts](../src/stores/useLibraryStore.ts) 的 `initializeLibrary` 先取 `collections`，再对每个 collection 串行调用 `get_collection_items`。
- 后端目前只有单集合查询接口，入口在 [library_cmd.rs](../src-tauri/src/commands/library_cmd.rs)，实现位于 [library_service.rs](../src-tauri/src/services/library_service.rs)。

风险：

- 标签、模组集、整合包数量越多，启动时 IPC 与 SQL 查询越多。
- 50 个集合会产生 50 次串行 `invoke`，加载体验会明显退化。

建议实现：

- 后端新增 `get_all_collection_items`。
- SQL 一次性读取 `collection_items`，按 `collection_id, position` 排序。
- 前端 `initializeLibrary` 改为并行读取：

```ts
const [items, collections, collectionItems] = await Promise.all([
  invoke<StarredItem[]>('get_starred_items'),
  invoke<Collection[]>('get_collections'),
  invoke<CollectionItem[]>('get_all_collection_items'),
]);
```

验收标准：

- `initializeLibrary` 不再对 `collections` 做 `for...of invoke`。
- 100 个集合、2000 条关系时，收藏页初始化 IPC 次数保持常量。
- 空库、旧数据库、有大量标签三种场景均可正常加载。

#### 2. Library 资源列表虚拟化

状态：已完成。

落地内容：

- 新增 `LibraryResourceList` 组件，使用 `react-virtuoso` 渲染资源列表。
- `LibraryPage` 的资源分支已从全量 `visibleResources.map(...)` 改为虚拟列表。
- 空状态和集合卡片视图仍保留普通滚动容器，避免对数量较少的集合卡片过度复杂化。
- 右键菜单、当前选中态、模组集 tracker 状态映射均保留。

原始问题：

- [LibraryPage.tsx](../src/pages/LibraryPage.tsx) 使用 `visibleResources.map(...)` 直接渲染完整列表。
- 下载页已有 `react-virtuoso` 使用经验，可复用思路。

风险：

- 大型整合包或长期收藏用户可能有数百到数千条资源。
- 全量 DOM 卡片会造成掉帧、内存上升和滚动卡顿。

建议实现：

- 抽出 `LibraryResourceList` 组件。
- 使用 `Virtuoso` 或 `VirtuosoGrid` 渲染 `LibraryItemCard`。
- 保留右键菜单、选中状态、tracker 状态映射。
- 分类卡片视图 `CollectionCard` 可以先保留普通 grid，因为集合数量通常远少于资源数量。

验收标准：

- 2000 条收藏资源下首屏渲染不卡死。
- 滚动过程中右键菜单定位和选中态正常。
- 搜索、排序、进入标签、进入模组集后列表可正确刷新。

#### 3. 批量写入与批量关系更新接口

状态：已完成。

落地内容：

- 后端新增 `save_collection_items`、`remove_collection_items`、`reorder_collection_items`，均使用事务执行。
- Tauri 命令已注册到 command handler。
- 前端 `useLibraryStore` 新增 `addItemsToCollection`、`removeItemsFromCollection`、`reorderCollectionItems`。
- 下载页收藏弹窗已从循环调用 `addItemToCollection` 改为收集 `CollectionItem[]` 后批量写入。

原始问题：

- `save_collection_item`、`remove_collection_item` 都是单条操作。
- 下载页批量收藏、Library 批量标签、未来拖拽排序都会触发多次 IO。

建议实现：

- 后端新增：
  - `save_collection_items(items: Vec<CollectionItem>)`
  - `remove_collection_items(collection_id, item_ids)`
  - `reorder_collection_items(collection_id, ordered_item_ids)`
- 所有批量接口使用事务。
- 前端 store 增加对应批量 action，避免循环调用单条 `invoke`。

验收标准：

- 批量收藏 50 个资源只产生一次关系写入事务。
- 排序失败时不产生半更新状态。
- Zustand 本地状态与后端返回状态一致。

### P1：Library 管理体验

#### 4. 模组集与整合包元数据管理

状态：已完成。

落地内容：

- 新增 `CollectionMetadataModal`，支持编辑模组集和整合包的名称、描述、封面地址与排序值。
- 模组集/整合包卡片增加元数据编辑入口，工具栏在进入具体集合后也提供编辑入口。
- `CollectionCard` 对非标签集合按图片语义读取 `coverImage`，不会影响标签系统继续使用 `coverImage` 存储颜色。
- 模组集名称变更后会同步更新本地 tracker 的 `collectionName`，避免一键部署继续使用旧名称。

现状：

- 侧边栏只管理 `type === 'group'` 的标签。
- 模组集能删除、能改追踪目标，但缺少重命名、描述、封面入口。
- `collections.coverImage` 目前主要被标签系统借作颜色/图标元信息，图片封面语义没有完整落地。

建议实现：

- 为 `mod_set` 和 `modpack` 单独提供“编辑集合”入口。
- 字段至少包含：
  - 名称
  - 描述
  - 封面来源：自动使用成员图标 / 自定义图片 / 清除封面
  - 排序权重
- 标签系统继续只管理普通标签，不混入模组集与整合包。

验收标准：

- 模组集卡片和详情工具栏都能进入编辑。
- 修改名称后 tracker 的 `collectionName` 同步更新，部署新实例名称使用新名称。
- 删除或替换封面后卡片展示立即更新。

#### 5. 集合内排序

状态：已完成。

落地内容：

- 进入具体标签、模组集或整合包后，工具栏提供“排序模式”入口。
- 排序模式下支持拖拽资源到目标资源位置，也支持上移/下移按钮。
- 搜索、过滤或非“集合顺序”排序状态会禁用排序模式，避免在过滤视图中误改全集顺序。
- 保存排序时调用 `reorderCollectionItems`，最终落到后端 `reorder_collection_items` 批量接口。
- 模组集排序只调整 `CollectionItem.position`，不改 tracker 项目匹配数据。

现状：

- `CollectionItem.position` 已存在，但 UI 没有排序能力。

建议实现：

- 在标签、模组集、整合包内部提供“排序模式”。
- 支持拖拽排序和键盘上移/下移。
- 保存时调用 `reorder_collection_items` 批量接口。

验收标准：

- 排序后刷新页面仍保持顺序。
- 搜索状态下禁止拖拽排序，避免用户误以为过滤视图顺序就是全集顺序。
- 模组集排序不影响 tracker 匹配结果，只影响展示顺序。

### P2：数据一致性与持久化

#### 6. Tracker 持久化迁移

状态：已完成。

落地内容：

- SQLite schema 新增 `mod_set_trackers` 表，并将 schema version 提升到 3。
- 后端新增 `ModSetTracker` domain、`get_mod_set_trackers` 和 `replace_mod_set_trackers` 命令。
- 前端 `useModSetTrackerStore` 改为从 SQLite 加载和持久化 tracker。
- 首次加载时如果 SQLite 没有 tracker，会从旧 `localStorage` 读取并写入 SQLite，随后清理旧缓存。
- 下载页创建模组集 tracker 前会先加载 SQLite 数据，避免在未进入 Library 页时覆盖已有 tracker。

现状：

- 模组集 tracker 保存在前端 `localStorage`，store 位于 [useModSetTrackerStore.ts](../src/features/Library/stores/useModSetTrackerStore.ts)。
- UI 已做 collection 关系反向同步，能修复多数残留。
- 但 tracker 不属于 SQLite 数据库事务，跨设备、清缓存、后端删除 collection 时仍有一致性边界。

建议实现：

- 新增 SQLite 表 `mod_set_trackers` 和 `mod_set_tracker_items`。
- 后端提供 tracker CRUD、检查结果写入、按 collection 删除。
- 前端首次启动时迁移 `ore-mod-set-trackers-v1` 到 SQLite，成功后标记迁移完成。
- 后续删除 collection 时后端统一级联删除 tracker。

验收标准：

- 清除浏览器 localStorage 不会丢失 tracker。
- 删除模组集后数据库不存在孤儿 tracker。
- 旧用户已有 tracker 能迁移并保留检查结果。

#### 7. 异步操作防抖与状态锁

状态：已完成。

落地内容：

- Library 页新增 `pendingRelationKeys`，以 `collectionId:itemId` 维度锁住正在写入的集合关系。
- 单独添加/移除标签时，同一资源与同一标签的重复点击会被禁用，并显示“处理中”状态。
- 从当前集合移除资源时，若同一关系正在处理，右键危险操作会直接隐藏，避免重复提交。
- 集合排序保存期间继续复用排序锁，失败时在列表上方显示错误信息。
- 集合关系 store action 在失败时会继续抛出异常，页面可以结束 pending 状态并展示错误；未成功前不做乐观状态修改。

现状：

- 标签切换、单项添加/移除等操作多为直接触发 async action。
- 快速连点可能造成 UI 闪烁或状态竞争。

建议实现：

- Library 页面维护 `pendingRelationKeys`。
- 正在处理的 `collectionId:itemId` 禁止重复点击。
- 批量操作显示明确进度和错误回滚提示。

验收标准：

- 连点同一标签不会出现重复插入、重复删除或视觉来回跳。
- 失败时能恢复到操作前状态或重新拉取后端状态。

### P3：分享、导入与备份

#### 8. Library 导入导出

状态：已完成。

落地内容：
- 后端新增 Library JSON 导出文件结构，覆盖收藏资源、集合、集合关系和模组集 tracker。
- 后端新增 `export_library_data`、`preview_library_import`、`import_library_data` Tauri 命令，并统一注册到 command handler。
- 导入前会预览新增/合并数量、跳过的重复关系和潜在提示，失败时不会写入半成品数据。
- 导入按资源 `source:projectId` 去重，缺少项目 ID 时回退到原始 item id 映射。
- 普通标签支持按同名合并，导入弹窗可切换“同名标签合并”策略。
- 模组集 tracker 会随导入导出一起迁移，并在导入时重写 tracker 内部的资源引用。
- Library 工具栏新增导入/导出入口，导入成功后会刷新 Library 状态和 tracker 状态。

现状：

- Library 数据锁定在本地 SQLite。
- 之前“导入本地资源”等占位文案已移除，避免未闭环入口。

建议实现：

- 导出 JSON：
  - starred items
  - collections
  - collection items
  - mod set tracker targets
- 导入策略：
  - 预览差异
  - 按资源 `source:projectId` 去重
  - 同名标签可选择合并或新建
- 后续可扩展为 zip，包含自定义封面图片。

验收标准：

- 导出后重新导入到空库，资源、标签、模组集关系完整恢复。
- 导入重复数据不会生成重复收藏。
- 导入过程有预览和失败报告。

## 交互规范

### Context Menu

当前已完成基础规范：

- 右键菜单出现在鼠标位置。
- 不显示禁用项，按上下文动态生成菜单。
- 菜单项按主操作、次级操作、危险操作排序。
- 最多三组，最多两条分隔线。

后续新增菜单时必须遵守：

- 不要用灰色 disabled 项占位。
- 不同页面使用不同菜单集合。
- 对资源包、光影、模组分别判断能力，不要复用模组菜单。
- 危险操作只放在最后一组。

### 顶部筛选

当前顶部 toggle 同时包含“资源类型”和“集合容器”：

- 资源类型：全部收藏、模组、外部资源。
- 集合容器：模组集、整合包。

短期保留现状，但新增功能时应避免让用户混淆：

- 进入具体模组集后，工具栏标题应以集合名为主。
- 批量操作应根据当前集合类型生成。
- “模组集 / 整合包”视图只展示集合卡片，不应混入资源卡片。

长期建议：

- 将顶部分成“视图切换”和“资源类型过滤”两层。
- 或将模组集、整合包移到独立容器页签，资源类型只保留资源过滤。

## 建议实施顺序

1. 后端 `get_all_collection_items`，前端初始化改常量 IPC。
2. Library 资源列表虚拟化。
3. 批量关系写入接口。
4. 模组集/整合包元数据编辑。
5. 集合排序。
6. tracker 迁移到 SQLite。
7. 异步操作防抖与状态锁。
8. Library 导入导出。

这个顺序优先处理性能和数据一致性，再扩展集合管理、状态锁和备份能力。

## 回归检查清单

每次改 Library 相关逻辑后至少检查：

- 空库启动、已有收藏启动、大量标签启动。
- 全部收藏、模组、资源包、外部资源、模组集、整合包视图。
- 标签创建、编辑、删除。
- 右键菜单位置、菜单项隐藏规则、从集合移除。
- 资源包收藏不出现模组集或追踪选项。
- 光影下载页不能进入多选菜单。
- 模组集移除成员后，一键部署数量和 tracker 判断同步变化。
- `npm.cmd run build` 通过。
