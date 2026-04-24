# 游戏核心下载进度与速度显示异常修复方案

本文档针对 PiLauncher 在下载游戏核心（`VANILLA_CORE` 阶段）时，UI 不显示进度和速度，但在下载完成后瞬间跳转至 100% 的问题进行深入分析并提出修复建议。

## 1. 核心原因分析

### 1.1 进度计算的“严格依赖”逻辑
在 `src/store/useDownloadStore.ts` 的 `addOrUpdateTask` 方法中，进度更新依赖于 `update` 对象中同时存在 `current` 和 `total` 字段：
- **现状**：后端通常将 `instance-deployment-speed`（速度事件）与 `instance-deployment-progress`（进度事件）分开。
- **瓶颈**：速度事件往往只携带 `speedCurrent`（当前字节），不携带 `total`。目前的逻辑在缺失 `total` 时会回退到 `existingTask?.progress`，导致下载过程中的进度条处于静止状态。

### 1.2 速度计算的语义偏差
- **现状**：前端 `useDownloadStore` 默认所有速度计算均基于“增量/时间”推算。
- **风险**：如果后端发送的是瞬时速度值（Mbps/MBps），前端却将其作为累计字节数进行差值计算，会导致计算结果错误或持续显示“计算中...”。

### 1.3 阶段定义缺失
- `VANILLA_CORE` 阶段未包含在 `FILE_COUNT_PROGRESS_STAGES` 中，前端默认尝试进行字节级速度推算。如果后端在该阶段发送的是文件计数（0/1），则会导致计算结果无意义。

---

## 2. 修复方案建议

### 2.1 增强进度计算的健壮性 (前端)
修改 `addOrUpdateTask` 的计算逻辑，允许从现有任务状态中补全缺失的 `total` 或 `current`：

```typescript
// 建议逻辑
const currentVal = update.current ?? update.speedCurrent ?? existingTask?.current ?? 0;
const totalVal = update.total ?? existingTask?.total ?? 0;

const nextProgress = isDone 
  ? 100 
  : (totalVal > 0 ? Math.round((currentVal / totalVal) * 100) : (existingTask?.progress || 0));
```

### 2.2 兼容瞬时速度值 (前端)
在处理 `speedCurrent` 时，增加逻辑判断。如果该值由后端作为“额定速度”发送，则直接赋值给 `speedStr`，跳过差值计算逻辑。

### 2.3 确保后端事件载荷完整性 (后端/协议)
- 确保 `instance-deployment-progress` 事件在 `VANILLA_CORE` 阶段不仅在起止点发送，在下载过程中也应保持一定频率的发送（携带 `total` 字节数）。
- 或者在发送 `instance-deployment-speed` 时，同时附带 `instance_id` 的 `total` 属性。

### 2.4 阶段类型校准
- 如果 `VANILLA_CORE` 本质上是单一的大文件下载，应确保其 `current` 和 `total` 以**字节**为单位。
- 如果其被视为原子操作，建议在 UI 上显示“正在获取资源清单...”等模糊进度，或者将其加入文件计数阶段列表中。

---

## 3. 预期效果
- **平滑进度**：下载过程中进度条将根据字节流实时移动。
- **实时速度**：速度显示将准确反映当前的网络带宽占用情况。
- **消除跳变**：从 0% 到 100% 将是一个连续的动画过程，而非瞬间跳转。
