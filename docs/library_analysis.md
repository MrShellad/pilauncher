# 资源库 (Library) 功能当前短板与漏洞分析清单

经过对现有代码库（涵盖前端 Zustand Store、React UI 组件、Tauri 后端 API 及 SQLite 数据库交互）的分析，发现当前的收藏/资源库功能在性能、数据一致性以及核心体验上存在以下明显的短板和需要补齐的缺口。

## 1. 性能与底层架构隐患 (Performance)

*   **初始化时的 N+1 查询风暴**
    *   **位置**：`useLibraryStore.ts` -> `initializeLibrary`
    *   **问题**：当前初始化时，先获取所有 `collections`，然后使用 `for...of` 循环为每个 collection 单独调用 `invoke('get_collection_items')`。
    *   **影响**：如果用户创建了大量标签或模组集（例如 50 个），每次启动应用或重载资源库时，都会阻塞并产生 50 次串行的 IPC 通信和数据库查询，导致极其明显的加载延迟。
    *   **改进方案**：后端新增一个 `get_all_collection_items` 接口，一次性返回所有映射关系，交由前端在内存中进行归类。
*   **长列表渲染无虚拟化 (Lack of Virtualization)**
    *   **位置**：`LibraryPage.tsx`
    *   **问题**：在使用 CSS Grid 渲染 `visibleResources.map(...)` 时，没有任何分页或虚拟滚动（Virtual Scrolling）策略。
    *   **影响**：由于 Minecraft 玩家经常会导入成百上千个 Mod（在“全部收藏”视图下尤为明显），渲染数以千计的复杂卡片 DOM 会导致 React 严重掉帧、内存飙升甚至页面卡死。
*   **后端缺乏批量更新接口**
    *   **位置**：`library_service.rs`
    *   **问题**：对于 `collection_items` 的新增和排序，目前只有单条的 `save_collection_item` 接口。未来若加入拖拽排序或批量移动功能，100 个元素的变更将产生 100 次连续的数据库 IO 操作。

## 2. 核心功能缺失 (Missing Core Features)

*   **无法修改模组集 (Mod Set) 与整合包的元数据**
    *   **位置**：`CollectionSidebar.tsx`
    *   **问题**：目前的“管理标签”弹窗仅针对 `type === 'group'`（普通标签）设计，允许修改名称、颜色和图标。但是如果用户创建了一个 `mod_set`（模组集），没有任何 UI 入口可以重命名该模组集、修改描述或更新它的封面图。
*   **完全缺失的自定义排序 (Drag & Drop Reordering)**
    *   **位置**：`LibraryPage.tsx` / `library_service.rs`
    *   **问题**：数据结构中明确设计了 `position` 字段，且 `buildCollectionItem` 也会获取当前最大位置并 `+1` 存入。然而 UI 层没有任何拖拽手柄或重新排序的功能，导致一旦加入模组就无法再调整在集合中的展示顺序。
*   **缺乏多选与批量操作能力**
    *   **位置**：`LibraryPage.tsx`
    *   **问题**：目前用户只能右键单击单一资源，在上下文菜单中选择“添加标签”或“移除”。对于规模稍大的管理需求（例如一次性选中 20 个 Mod 移入新的模组集），当前的交互效率极低，是核心体验的重大短板。
*   **缺乏本地配置的导入与导出机制**
    *   **位置**：整体 Store / Backend
    *   **问题**：资源库结构完全锁定在本地 SQLite 数据库中。缺乏生成标准分享配置（如 JSON / Zip）以供跨设备同步、或分享给好友的功能。

## 3. 数据一致性与状态漏洞 (State Integrity Bugs)

*   **状态与 Tracker 的孤儿级联断裂**
    *   **位置**：`LibraryPage.tsx` -> `handleDeleteModSet` 与 `useLibraryStore.ts`
    *   **问题**：目前只有在 UI 点击删除模组集时，才会手动调用 `removeTrackersForCollection` 清理跨版本追踪器记录。而后端 `remove_collection` 接口在数据库层面只清理了 `collection_items`，不管 tracker。如果有外部因素或后台逻辑删除了 Collection，Tracker 记录将变成永远无法关联的“孤儿数据”。
*   **UI 竞态条件 (Race Condition)**
    *   **位置**：`LibraryPage.tsx` -> `handleToggleItemTag`
    *   **问题**：在“添加标签”的模态框中，点击标签直接执行异步请求，按钮没有锁定（Loading 或 Disabled 状态防抖）。如果用户连续快速点击，虽然 SQLite 的 `ON CONFLICT` 可以防止后端报错，但前端 Zustand store 会收到多次插入或删除的指令，引发数据竞态或 UI 闪烁。

## 4. UI/UX 逻辑冲突

*   **资源过滤与容器分类逻辑交叉**
    *   **问题**：顶部的 `OreToggleButton`（全部收藏、模组、模组集、整合包、外部资源）存在逻辑上的歧义。“模组/外部资源”属于 **具体资源类型**，“模组集/整合包”属于 **集合容器类型**。当切换到“模组集”时，左侧侧边栏跳转，而右侧展示该类别下的卡片。这会使得用户在浏览特定模组集内部时，对顶部的过滤状态产生困惑。
*   **封面图片功能未落地**
    *   **问题**：数据库表 `collections` 有 `cover_image` 字段，但在侧边栏标签中只被当作纯色 `tagColor` 使用（`normalizeTagColor`）。对于整合包和模组集，由于没有封面选择器，该字段无法承载其原本图片展示的意义。
