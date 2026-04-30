# 下载页性能分析与优化建议 (Performance Analysis & Optimization Plan)

针对反馈的“打开下载页 CPU 占用高”的问题，经过对代码逻辑（`ResourceDownloadPage`, `useResourceDownload`, `ResourceCard` 等）的分析，确定了几个主要的性能瓶颈及相应的修复建议。

## 1. 核心问题分析 (Problem Analysis)

### A. 缺少列表虚拟化 (Lack of List Virtualization)
- **现象**：`ResourceGrid` 使用简单的 `.map()` 渲染所有搜索结果。
- **原因**：随着用户滚动加载更多内容（Load More），DOM 中的 `ResourceCard` 数量会持续增加。每个卡片都包含复杂的布局、多个图标和阴影效果。当列表达到上百项时，任何微小的重绘都会导致 CPU 飙升。

### B. 渲染循环中的重复计算 (Expensive Calculations in Render Loop)
- **现象**：`ResourceCard` 在每次渲染时都会执行 `buildProjectViewModel(project)` 和 `checkIsInstalled(...)`。
- **原因**：虽然 `ResourceCard` 使用了 `React.memo`，但其父组件 `ResourceGrid` 在 `isLoadingMore` 或 `results` 更新时会整体重绘。此时，传递给 `checkIsInstalled` 的参数如果发生引用变化，会导致所有卡片强制重绘并重新执行复杂的逻辑匹配。
- **风险点**：`isProjectInstalled` 函数中存在一个 `instanceof InstalledModIndex` 的判断。如果由于打包环境导致类定义不一致，它会退化为“为每个卡片、每次渲染都创建一个全新的索引对象”，这是典型的 $O(N \times M)$ 复杂度陷阱。

### C. 初始加载时的并发压力 (Concurrent Task Pressure on Mount)
- **现象**：进入页面时，CPU 出现明显的峰值。
- **原因**：`useResourceDownload` 钩子在 `useEffect` 中同时启动了：
    1. 实例环境拉取 (`get_instance_detail`)
    2. 已安装插件扫描 (`refreshInstalledMods`)
    3. 平台元数据加载（CurseForge/Modrinth 的版本和分类列表）
    4. 初始搜索请求。
    这些并发任务不仅消耗网络带宽，更是在短时间内触发了多次状态更新和大规模组件树调和（Reconciliation）。

### D. CSS 渲染开销 (CSS Rendering Overhead)
- **原因**：卡片使用了大量的 `inset` 阴影、`drop-shadow` 滤镜以及 `animate-spin` 动画。在没有硬件加速或层隔离不彻底的情况下，大量元素的滤镜计算会由 CPU 承担。

---

## 2. 修复建议 (Repair Suggestions)

### 方案一：引入虚拟滚动 (Virtual Scrolling) — **最高优先级**
- **建议**：使用 `react-window` 或 `react-virtuoso` 替换 `ResourceGrid` 中的原生滚动。
- **效果**：无论搜索结果有多少条，DOM 中始终只保留可见的 6-10 个卡片，将渲染开销从 $O(N)$ 降低到 $O(1)$。

### 方案二：优化已安装状态的匹配逻辑 (Optimize Indexing)
- **建议**：
    1. 在 `ResourceGrid` 层提前计算好一个 `Set` 或 `Map` 类型的已安装 ID 集合，而不是在 `map` 内部进行判断。
    2. 确保 `InstalledModIndex` 的创建极其轻量，或将其逻辑完全移出组件渲染流。
- **代码示例**：
  ```tsx
  // 在 ResourceGrid 中提前处理
  const installedSet = useMemo(() => new Set(installedMods.map(m => m.modId)), [installedMods]);
  // 传给 Card 的只是一个布尔值
  <ResourceCard isInstalled={installedSet.has(project.id)} />
  ```

### 方案三：任务分片与优先级调度 (Task Chunking)
- **建议**：将非必要的元数据加载（如分类列表、版本列表）延迟到“加载环境”完成之后。
- **效果**：平摊 CPU 峰值，确保首屏动画（Spinner）不卡顿。

### 方案四：精简组件逻辑与样式 (Component Slimming)
- **建议**：
    1. 将 `ResourceCard` 内部的 `buildProjectViewModel` 移至搜索结果返回后的数据预处理阶段，只计算一次。
    2. 检查 `animate-spin` 动画。在列表静止时，确保不可见的 Loading 动画被销毁或停止。
    3. 减少 `drop-shadow` 的使用，改用标准的 `box-shadow` 以利用浏览器的层级优化。

### 方案五：状态订阅优化 (State Subscription)
- **建议**：在 `useResourceDownload` 中，对 `resource-download-progress` 的监听应更加保守。目前的 150ms 节流可能仍嫌太快，且应在页面销毁时更严格地清理定时器。
