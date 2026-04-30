# 下载页性能优化执行计划

本文档根据 [performance_analysis_download.md](performance_analysis_download.md) 拆分执行任务，用于按步骤推进“打开下载页 CPU 占用高”的优化。每次只执行一个阶段；阶段完成后更新本文件状态，再确认是否继续下一阶段。

## 状态说明

- `待处理`：尚未开始。
- `进行中`：当前正在处理。
- `已完成`：代码已修改并完成基础验证。
- `暂缓`：需要额外信息、依赖或人工验证后再继续。

## 执行原则

- 优先处理会在打开页面和滚动列表时放大 CPU 消耗的路径。
- 每一步保持可独立验证，避免一次性改动过大导致回归难以定位。
- 优化完成后至少运行 TypeScript/Vite 构建；如构建受环境限制，需要在记录中说明。
- 涉及 UI 渲染的步骤，保留现有键盘/手柄焦点语义，不牺牲下载页基本可用性。

## 阶段计划

| 阶段 | 状态 | 目标 | 主要文件 | 验证方式 |
| --- | --- | --- | --- | --- |
| 1. 渲染循环削峰 | 已完成 | 将已安装状态匹配和项目视图模型计算移出卡片渲染路径，避免每次父组件重绘都重复执行昂贵逻辑。 | `src/features/Download/components/ResourceGrid.tsx`、`src/features/Download/components/ResourceCard.tsx`、`src/features/Download/logic/projectViewModel.ts`、`src/features/InstanceDetail/components/tabs/mods/ResourceGrid.tsx` | `npm run build` |
| 2. 主下载页虚拟滚动 | 已完成 | 使用已有 `react-virtuoso` 依赖改造主下载页资源网格，只渲染可见卡片和少量缓冲项。 | `src/features/Download/components/ResourceGrid.tsx` | `npm run build`，检查加载更多和焦点移动 |
| 3. 实例下载页虚拟滚动 | 已完成 | 将实例详情下载资源网格同步虚拟化，避免实例内下载入口在长列表下继续全量挂载。 | `src/features/InstanceDetail/components/tabs/mods/ResourceGrid.tsx` | `npm run build`，检查返回顶部、加载更多和空状态 |
| 4. 初始化任务分片 | 已完成 | 调整 `useResourceDownload` 初始化顺序，将环境拉取、已安装扫描、元数据加载和初始搜索错峰，降低进入页面瞬时 CPU 峰值。 | `src/features/Download/hooks/useResourceDownload.ts` | `npm run build`，检查首次进入和缓存返回 |
| 5. CSS 与动画开销收敛 | 已完成 | 减少列表卡片上的 `drop-shadow`、复杂 `inset` 阴影和非必要 `animate-spin`，降低大量卡片场景下的重绘成本。 | `src/features/Download/components/ResourceCard.tsx`、`src/features/InstanceDetail/components/tabs/mods/ResourceGrid.tsx` | `npm run build`，人工检查卡片聚焦态 |
| 6. 下载进度订阅收敛 | 已完成 | 调整 `resource-download-progress` 监听和刷新节流，确保卸载清理严格，完成事件不会短时间触发多次实例扫描。 | `src/features/Download/hooks/useResourceDownload.ts`、相关实例详情 hook | `npm run build`，检查下载完成后的已安装状态刷新 |

## 当前记录

- 2026-05-01：创建执行计划文档，尚未开始代码优化。
- 2026-05-01：阶段 1 开始，处理下载卡片渲染路径中的重复计算。
- 2026-05-01：阶段 1 已完成。主下载页与实例详情下载页均改为在网格层预计算项目视图模型和已安装状态；卡片组件不再在渲染时重复执行 `buildProjectViewModel` 或已安装匹配。`npm run build` 已通过。
- 2026-05-01：阶段 2 开始，改造主下载页资源网格为虚拟滚动。
- 2026-05-01：阶段 2 已完成。主下载页资源网格已改为 `VirtuosoGrid`，只渲染可见范围和缓冲项；底部加载更多改由 `endReached` 与原加载锁触发，焦点接近底部时仍可主动触发加载。`npm run build` 已通过。
- 2026-05-01：阶段 3 开始，改造实例详情下载页资源网格为虚拟滚动。
- 2026-05-01：阶段 3 已完成。实例详情下载页资源网格已接入 `VirtuosoGrid`，复用外层滚动容器作为 `customScrollParent`，空状态与加载状态保持原布局；加载更多改由 `endReached` 与原加载锁触发。`npm run build` 已通过。
- 2026-05-01：阶段 4 开始，调整下载页初始化任务调度。
- 2026-05-01：阶段 4 已完成。`useResourceDownload` 初始化改为优先加载实例环境并放行首屏，已安装资源扫描延迟执行；平台元数据延迟到环境加载后启动，首次自动搜索也改为短延迟调度。`npm run build` 已通过。
- 2026-05-01：阶段 5 开始，收敛下载卡片 CSS 与动画开销。
- 2026-05-01：阶段 5 已完成。主下载页与实例详情下载页资源卡片移除聚焦态 `drop-shadow`，卡片外框阴影从多层 `inset` 收敛为一层底边内阴影加一层普通轻阴影；底部加载提示仅在加载更多时旋转。`npm run build` 已通过。
- 2026-05-01：阶段 6 开始，收敛下载完成进度监听与实例资源刷新。
- 2026-05-01：阶段 6 已完成。`useResourceDownload` 与实例详情 Mod 面板的 `resource-download-progress` 监听均加入完成事件去重、刷新合并、卸载清理和 `java_download` 事件过滤，避免同一批完成事件触发多次实例资源扫描。`npm run build` 已通过。
