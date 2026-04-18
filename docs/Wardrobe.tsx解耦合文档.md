

以下是具体的解耦方案：

### 第一步：剥离纯函数与常量 (提取到 `wardrobe.utils.ts`)

代码顶部包含大量不依赖于 React 生命周期和状态的工具函数。这些函数完全可以抽离成独立的纯函数文件，这不仅能减轻组件体积，还能方便编写单元测试。

**需要抽离的内容：**
* `isMicrosoftAccount`
* `resolveSkinModel`
* `findActiveSkin` / `findActiveCape`
* `isSessionExpiredError`
* `modelLabel`
* `toAccountData`
* `validateSkinImage` (包含 DOM Image 相关的异步逻辑，完全可以独立)
* `accountSkinPreviewUrl`
* `toStoredAssetUrl`

### 第二步：拆分 UI 组件 (水平解耦视图)

当前的 `Wardrobe` 组件包含了多个复杂的视图区域（侧边栏预览、皮肤面板、披风面板、弹窗面板）。应该将 `renderSkinPanel` 和 `renderCapePanel` 等内部渲染函数转化为独立的 React 组件。

**建议拆分出的组件结构：**
```text
features/wardrobe/
├── components/
│   ├── WardrobeViewer.tsx        # 负责左侧 3D 预览和返回按钮
│   ├── WardrobeSkinPanel.tsx     # 提取原 renderSkinPanel，负责皮肤列表渲染
│   ├── WardrobeCapePanel.tsx     # 提取原 renderCapePanel，负责披风渲染与骨架屏
│   └── WardrobeSkinMenuModal.tsx # 提取底部的 <OreModal>，负责单件皮肤的操作弹窗
└── pages/
    └── Wardrobe.tsx              # 作为父级容器，拼装上述组件，管理顶层状态
```
通过这种方式，父组件只需要将必要的数据（如 `skinCards`, `isMicrosoft`, `activeCape`）和回调函数（如 `onChooseSkin`, `onToggleCape`）作为 Props 传递给子组件即可。

### 第三步：抽离核心业务逻辑 (垂直解耦逻辑为 Custom Hooks)

这是最关键的一步。当前的 `useEffect` 和状态管理交织在一起，我们需要根据功能模块将它们抽离成自定义 Hook。

**1. `useWardrobeSession.ts` (API 与 会话管理)**
将所有与后端交互、微软 Token 刷新相关的逻辑集中在一起。
* **状态**：`profile`, `skinLibrary`, `isLoadingProfile`, `error`
* **方法**：`refreshAccountSession`, `runWithSessionRefresh`, `hydrateWardrobe`

**2. `useWardrobeViewerControl.ts` (3D 视图与手柄交互)**
专门处理模型渲染同步和外部输入。
* **输入**：当前激活的皮肤 URL、披风 URL 和模型类型 (Slim/Classic)。
* **逻辑**：封装 `useSkinViewer` 的调用、`loadViewerState`、`syncViewerToCurrentState`，以及底部的 `pollRightStick` (手柄轮询逻辑)。

**3. `useSkinAssetsManager.ts` (资产操作)**
负责具体的皮肤/披风文件的增删改查业务逻辑。
* **状态**：`isApplying`, `notice`, `skinMenuAsset`, `skinMenuModel`
* **方法**：`handleChooseSkin`, `handleApplySkinAsset`, `handleDeleteSkinAsset`, `handleToggleCape`

