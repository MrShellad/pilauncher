# 前端架构解耦与重构建议书

通过对 PiLauncher 前端代码库的审计，发现系统在快速迭代过程中积累了一定程度的模块耦合。为了提升代码的可测试性、可维护性及跨平台潜力，建议针对以下五个维度进行重构。

## 1. 基础设施解耦 (Tauri API 抽象)

### 问题现状
目前 `invoke` 和 `listen` 直接出现在 Hooks（如 `useGameLaunch.ts`）甚至 UI 组件（如 `DownloadManager.tsx`）中。这导致逻辑层深度绑定了 Tauri 环境，难以进行单元测试。

### 重构建议
- **建立 Service 层**：在 `src/services` 下创建专门的 API 服务类（如 `InstanceService.ts`, `UpdateService.ts`）。
- **封装调用**：
  ```typescript
  // 建议模式
  export const InstanceService = {
    getDetail: (id: string) => invoke<InstanceDetail>('get_instance_detail', { id }),
    // ...
  };
  ```
- **收益**：未来如果迁移到 Web 或其他环境，只需更换 Service 层的实现。

## 2. “上帝钩子” (God Hook) 拆分

### 问题现状
`useGameLaunch.ts` 长度超过 350 行，包含了账号校验、Token 刷新、手柄 Mod 检测、Mod 下载安装、日志记录、启动指令下发等极其复杂的逻辑。

### 重构建议
- **职责提取**：
  - `useAccountAuth`: 处理 Token 刷新与校验。
  - `useGamepadSetup`: 处理手柄相关的 Mod 检测与安装。
  - `useLaunchExecution`: 纯粹负责最后的 `launch_game` 调用。
- **流程编排**：`useGameLaunch` 仅作为“编排者”，调用上述子 Hook。

## 3. 跨特性依赖规范化 (Feature Coupling)

### 问题现状
存在 `src/services/gamepadModService.ts` 跨层引用 `src/features/Download/logic/curseforgeApi` 的情况。Feature 目录应当是自包含的。

### 重构建议
- **提取 Core/Shared 层**：将公共的 API 逻辑（Modrinth, CurseForge, 基础文件操作）移动到 `src/core` 或 `src/shared`。
- **遵循单向依赖**：Feature 可以依赖 Core/Shared，但不应跨 Feature 相互依赖。

## 4. UI 与全局状态的解耦

### 问题现状
页面组件（如 `Home.tsx`）直接从中解构多个 Store (`useLauncherStore`, `useAccountStore`, `useDownloadStore`)，导致组件感知了过多的全局状态细节。

### 重构建议
- **采用 Container/Presenter 模式**：
  - 定义 Page-level Hooks (如 `useHomePageData`)，该 Hook 负责整合所有 Store 数据。
  - 组件只接收处理后的 Props。
- **选择性订阅**：确保 `useStore(state => state.xxx)` 只订阅必要的字段，减少不必要的重渲染。

## 5. 事件总线与管理器模式

### 问题现状
`DownloadManager` 注册了大量全局事件监听器 (`instance-deployment-progress`, `resource-download-progress` 等)。

### 重构建议
- **全局事件管理器**：在 `App.tsx` 或专门的 `AppInitializer` 中统一注册系统级监听器。
- **解耦分发**：监听器接收到数据后直接更新对应的 Store，UI 组件只负责监听 Store 的变化，不再直接处理原生事件 payload。

---

## 3. 优先级建议

1.  **高**：拆分 `useGameLaunch`。这是目前最复杂的逻辑块，极易引入 Bug。
2.  **中**：抽象 API Service 层。这能显著提升单元测试覆盖率。
3.  **中**：规范化跨模块引用。
4.  **低**：UI 组件层面的 Presenter 拆分。
