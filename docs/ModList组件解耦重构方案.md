# ModList 组件解耦与重构方案

## 1. 当前问题分析
目前的 `ModList.tsx` 承担了过多的职责，导致代码量激增（超过 700 行），维护难度大。主要耦合点包括：
- **UI 组件混杂**：Header、GroupHeader、EmptyPane 等多个子组件全部硬编码在主文件中。
- **逻辑膨胀**：`useModListController` 承担了搜索、过滤、分组、虚拟化计算、焦点管理等所有逻辑。
- **样式硬编码**：大量的 Tailwind 类名常量和内联样式分散在各处。
- **状态同步复杂**：搜索、排序、批量选择的状态在多个组件和 Hook 之间传递。

---

## 2. 解耦目标
- **单一职责**：每个文件只负责一个核心功能。
- **模块化 UI**：将大的 UI 块拆分为独立的可复用组件。
- **逻辑分层**：将数据处理、焦点控制和视图状态分离。

---

## 3. 重构方案

### 3.1 目录结构优化
建议将 `mods` 目录细化，建立 `components` 子目录：
```text
mods/
├── components/           # 拆分出的子组件
│   ├── ModListHeader.tsx
│   ├── ModListGroupHeader.tsx
│   ├── ModListEmptyState.tsx
│   ├── ModListGridHeader.tsx
│   └── ModListOverlay.tsx
├── hooks/                # 拆分出的逻辑 Hook
│   ├── useModListData.ts     # 处理搜索、过滤、分组
│   ├── useModListActions.ts  # 处理批量操作、状态切换
│   ├── useModListFocus.ts    # 焦点管理 (已存在，需优化)
│   └── useModListController.ts # 逻辑总协调器
├── ModList.tsx           # 主容器组件
├── ModRowItem.tsx        # 行组件
└── modListShared.ts      # 类型定义与常量
```

### 3.2 UI 组件拆分
| 组件名称 | 职责 |
| :--- | :--- |
| `ModListHeader` | 处理搜索输入、排序切换、视图模式切换、批量操作入口。 |
| `ModListGroupHeader` | 渲染可折叠的分组标题。 |
| `ModListEmptyState` | 处理空搜索结果、空列表等多种空状态显示。 |
| `ModListGridHeader` | 在“数据视图”模式下显示的表头。 |

### 3.3 逻辑 Hook 拆分
1. **`useModListData`**:
   - 接收原始 `mods` 和 `searchQuery`。
   - 返回 `filteredMods`、`groupedEntries` (用于 Virtuoso)。
   - 内部封装 `filterModsByQuery` 和 `buildModGroups`。
2. **`useModListActions`**:
   - 处理批量选择 (Select All, Clear)。
   - 封装批量操作 API 调用 (Enable, Disable, Delete)。
3. **`useModListController` (重构后)**:
   - 作为“大脑”调用上述所有子 Hook。
   - 组合出 `state`、`controls` 和 `getRowProps` 供 UI 使用。

---

## 4. 实施细节

### 4.1 样式常量化
将重复的 Tailwind 类名移动到 `modListShared.ts` 或使用 CSS Modules。
```typescript
// modListShared.ts
export const HEADER_CLASSES = {
  button: 'h-9 min-h-9 px-3 ...',
  iconButton: 'w-9 min-w-9 ...',
  segmentGroup: 'relative z-10 flex ...'
};
```

### 4.2 Context 注入 (可选)
如果 Prop Drilling 过于严重，可以引入 `ModListContext` 提供全局操作（如 `onToggleMod`），使 `ModRowItem` 不再依赖深层传递的 Props。

---

## 5. 后续步骤
1. **第一阶段**：将 `ModList.tsx` 内的子组件移动到 `components/` 目录。
2. **第二阶段**：重构 `useModListController`，将数据过滤逻辑抽离。
3. **第三阶段**：在 `ModList.tsx` 中引入视图模式切换的完整状态管理。
4. **第四阶段**：优化焦点导航，减少 `FocusItem` 守卫代码的重复。
