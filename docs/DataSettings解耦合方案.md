# DataSettings 组件解耦合方案设计文档

## 1. 背景与现状
`DataSettings.tsx` 目前是一个典型的“巨型组件”（Fat Component），承载了过多的职责：
- **状态过多**：管理了包括路径修改、重命名、日志清理、远端日志管理在内的 10 多个独立 UI 状态。
- **业务逻辑耦合**：大量的 `invoke` 调用直接写在组件内，逻辑与渲染混合。
- **渲染负担重**：多个复杂的 `OreModal` 和 `OreConfirmDialog` 内联在主组件中，导致代码行数接近 600 行，难以维护。

## 2. 解耦合目标
- **逻辑抽离**：将复杂的业务流程抽离为自定义 Hooks。
- **组件拆分**：将独立的功能弹窗抽离为受控子组件。
- **职责清晰**：主组件仅负责布局、焦点调度和子组件的装配。

## 3. 具体方案

### 3.1 逻辑层抽离 (Custom Hooks)
创建以下 Hooks 来封装状态和业务逻辑：

1. **`useCoreDirectoryManagement`**:
   - 处理 `migrate_base_directory` 和 `rename_base_directory`。
   - 管理重命名状态、浏览器打开状态。
   
2. **`useLogCleaner`**:
   - 管理 `clean_logs` 的各个阶段（confirm, cleaning, done, error）。
   - 封装 `handleCleanLogs` 逻辑。

3. **`useRemoteLogs`**:
   - 封装 `get_logshare_history` 和 `delete_logshare_history`。
   - 管理加载状态、错误状态和删除确认逻辑。

### 3.2 UI 层拆分 (Sub-components)
将内联的弹窗和区域拆分为独立组件：

1. **`RemoteLogsModal`**:
   - 接收 `isOpen` 和 `onClose`。
   - 内部使用 `useRemoteLogs` 逻辑。
   
2. **`CleanLogsDialog`**:
   - 接收 `isOpen` 和 `onClose`。
   - 内部封装清理逻辑的 UI 展示。

3. **`BaseDirectorySection`**:
   - 包含路径修改和重命名的入口。

4. **`ThirdPartyDirsSection`**:
   - 独立管理第三方目录的遍历和删除确认。

### 3.3 目录结构建议
```text
src/features/Settings/components/tabs/DataSettings/
├── index.tsx                # 主入口，负责布局
├── hooks/
│   ├── useCoreDirectory.ts   # 核心路径逻辑
│   ├── useLogCleaner.ts      # 日志清理逻辑
│   └── useRemoteLogs.ts      # 远端日志逻辑
├── components/
│   ├── RemoteLogsModal.tsx
│   ├── CleanLogsDialog.tsx
│   ├── RenameDirModal.tsx
│   └── ThirdPartySection.tsx
└── types.ts                 # 共享接口定义 (如 LogShareHistoryRecord)
```

## 4. 重构收益
1. **可测试性**：业务逻辑在 Hooks 中，可以进行独立单元测试。
2. **可读性**：主组件代码量预计减少 60% 以上。
3. **复用性**：远端日志管理等逻辑未来可以在其他页面（如控制台）复用。
4. **性能优化**：弹窗状态变更仅触发子组件重绘，减少主页面的无效渲染。

## 5. 实施计划
1. [ ] 定义 `types.ts`，统一数据结构。
2. [ ] 依次实现 `useLogCleaner` 和 `CleanLogsDialog`。
3. [ ] 抽离 `RemoteLogsModal` 及其 Hook。
4. [ ] 抽离第三方目录管理逻辑。
5. [ ] 重构主入口，整合上述组件。
