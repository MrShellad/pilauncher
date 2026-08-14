# Mod 下载机制修复计划与测试方案

本文基于当前代码静态 review 结果制定，目标是打通 Mod 资源下载的启动、进度、暂停、继续、取消、失败、重试和完成后业务收口。本文只定义修改计划、接口契约和测试要求，不包含实现代码。

## 一、Review 结论

当前链路可以完成“启动下载 -> 接收进度 -> 文件落盘”的基本流程，但还不是闭环，主要问题如下：

| 优先级 | 问题 | 当前表现 | 影响 |
| --- | --- | --- | --- |
| P0 | 暂停没有接入后端 | `useDownloadStore.pauseTask` 只修改前端状态；后端仍继续下载 | 用户看到暂停，但网络和磁盘仍在消耗；后续进度还会把状态改回下载中 |
| P0 | 资源取消调用错误命令 | 下载管理器统一调用 `cancel_instance_deployment` | Mod 资源下载无法真正取消，且可能误操作实例部署任务 |
| P0 | 重试没有完成后业务回调 | `TaskItem` 重试只重新 invoke `download_resource` | 重试成功后可能不更新 Mod manifest、缓存、已安装列表或资源库关联 |
| P0 | 失败被吞掉 | `ResourceDownloadPage.executeDownload` 捕获异常后不继续抛出 | 主文件失败后仍可能继续处理依赖，最终出现“任务失败但流程继续”的不一致状态 |
| P1 | 任务 ID 不唯一 | 多处使用 `file_name` 作为任务 ID | 相同文件名在不同实例、不同来源或并发下载时互相覆盖 |
| P1 | 错误状态不统一 | `ModDetailModal` 的 catch 只打印日志，没有更新任务为 ERROR | 用户看不到失败任务，也无法重试 |
| P1 | 后端错误事件不完整 | `resource_service` 发送开始、进度、完成事件，但失败路径没有统一 ERROR 事件 | 前端只能依赖 invoke reject，事件状态和命令状态可能分叉 |
| P1 | 下载控制对象是固定 false | `resource_service` 每次创建 `no_cancel = false`，没有外部控制入口 | 无法实现跨 command 的暂停、继续和取消 |

关键定位：

- 前端任务状态和任务合并逻辑：`src/store/useDownloadStore.ts:5`、`src/store/useDownloadStore.ts:248`
- 重试和取消按钮：`src/features/Download/components/DownloadManager/TaskItem.tsx:230`、`src/features/Download/components/DownloadManager/TaskItem.tsx:333`
- 资源下载入口和依赖流程：`src/pages/ResourceDownloadPage.tsx:432`、`src/pages/ResourceDownloadPage.tsx:488`
- 后端资源下载及固定取消标记：`src-tauri/src/services/resource_service.rs:191`、`src-tauri/src/services/resource_service.rs:344`
- 当前只注册资源下载 command：`src-tauri/src/commands/mod.rs:147`

## 二、目标状态机和链路

资源任务建议统一使用以下状态：

```text
QUEUED -> DOWNLOADING -> COMPLETED
             |    \
             |     -> ERROR -> RETRYING -> DOWNLOADING
             v
           PAUSED -> DOWNLOADING
             |
             v
          CANCELED
```

约束：

- `PAUSED`、`ERROR`、`CANCELED` 都必须由后端真实状态或明确的 command 结果驱动，不能只改前端展示状态。
- `PAUSED` 保留临时文件，继续下载必须从临时文件大小处续传。
- `CANCELED` 默认删除临时文件；如果产品需要保留用户手动取消的进度，必须单独定义“取消但保留缓存”，不能与暂停混用。
- `COMPLETED` 只在临时文件成功改名为目标文件后发送。
- 完成事件之后必须执行业务收口：更新 manifest、缓存和列表；任何一步失败都要有可见错误，不得把文件完成误报为业务完成。
- 失败重试必须复用同一个任务 ID 和完整任务上下文，不能只依赖文件名。

推荐的任务 ID：

```text
resource:{instanceId}:{subFolder}:{fileName}
```

实际实现应对路径分隔符、大小写和特殊字符做稳定编码，避免不同任务产生相同 key。任务元数据至少包括 `instanceId`、`subFolder`、`fileName`、`url`、资源类型、项目 ID、来源、版本 ID 和完成后的业务回调参数。

## 三、修改计划

### Phase 0：先建立契约和测试基础设施

目标：在改实现前固定状态、事件和 command 的边界。

修改内容：

1. 在前后端定义统一的资源任务状态和事件 payload。事件至少包含 `task_id`、`stage/status`、`current`、`total`、`message`，错误时增加稳定的错误码或错误类型。
2. 让 `download_resource` 接受稳定的 `task_id`，不再由后端用 `file_name` 猜任务身份。
3. 新增测试脚本和测试目录。当前 `package.json` 没有测试命令，建议引入 Vitest；Rust 部分使用现有 `cargo test`。
4. 先写状态机和 payload 测试，再开始实现暂停/继续，避免前后端分别定义状态。

验收：前端和 Rust 能对同一组状态名称、任务 ID 和事件字段编译；测试命令能在本地无 GUI 环境执行。

### Phase 1：打通后端资源任务控制

涉及：

- `src-tauri/src/services/resource_service.rs`
- `src-tauri/src/services/downloader/transfer.rs`
- `src-tauri/src/commands/resource_cmd.rs`
- `src-tauri/src/commands/mod.rs`

修改内容：

1. 增加资源任务注册表，以 `task_id` 管理任务控制对象、状态、临时文件路径和元数据。
2. 增加 `pause_resource_download`、`resume_resource_download`、`cancel_resource_download` 三个 command，并注册到 Tauri command handler。
3. 将下载器的固定 `AtomicBool(false)` 改为可共享的控制对象。暂停需要让读循环停止取数但保留 `.download`；继续需要唤醒任务并从已有长度继续。
4. 取消要能中断当前请求，并明确临时文件策略。建议取消删除临时文件，暂停保留临时文件。
5. 后端在成功、暂停、取消、失败时都发送一次终态事件；终态事件必须幂等，避免重复事件把任务重新改回下载中。
6. 下载成功后先完成临时文件到目标文件的 rename，再发送 `COMPLETED`。
7. 检查网络失败、超时、磁盘写入失败、rename 失败和非法参数的错误映射，确保命令 reject 与错误事件一致。

验收：不依赖前端，使用 command 或 Rust 测试即可验证暂停真正停止传输、继续可续传、取消可终止、失败可重试。

### Phase 2：修正前端 Download Store 和管理器

涉及：

- `src/store/useDownloadStore.ts`
- `src/features/Download/components/DownloadManager/index.tsx`
- `src/features/Download/components/DownloadManager/TaskItem.tsx`

修改内容：

1. 将“更新任务”和“暂停/继续/取消任务”区分为状态操作，不能让普通进度事件覆盖 `paused`、`canceled` 或已完成状态。
2. 增加 `resumeTask`，并让 `pauseTask`、`resumeTask`、`cancelTask` 先调用对应后端 command，command 成功后再更新展示状态；command 失败时保留原状态并展示错误。
3. 资源任务使用资源取消 command；实例部署任务继续使用实例取消 command，按 `taskType` 分流。
4. 资源任务显示暂停/继续按钮；暂停状态不应进入 ignored task 集合，也不应从任务列表消失。
5. 进度事件使用稳定 `task_id` 合并，忽略过期事件和终态之后的普通进度事件。
6. 重试按钮先把任务置为 `RETRYING` 或 `DOWNLOADING`，失败时统一回到 `ERROR`，并防止重复点击触发多个下载请求。

验收：模拟事件顺序 `DOWNLOADING -> PAUSED -> DOWNLOADING -> COMPLETED` 和 `DOWNLOADING -> ERROR -> RETRYING -> COMPLETED`，任务状态、进度和按钮行为都正确。

### Phase 3：统一所有资源下载入口和完成回调

涉及：

- `src/pages/ResourceDownloadPage.tsx`
- `src/features/InstanceDetail/components/tabs/mods/components/download/InstanceModDownloadView.tsx`
- `src/features/InstanceDetail/components/tabs/mods/components/dialogs/ModDetailModal.tsx`
- `src/features/Library/hooks/useLibraryResourceDetail.ts`
- `src/features/Library/logic/modSetInstaller.ts`
- `src/features/InstanceDetail/hooks/modManager/useModOperations.ts`
- `src/features/InstanceDetail/logic/modService.ts`

修改内容：

1. 抽出统一的资源下载任务服务，负责生成任务 ID、登记 retry payload、调用 command、监听结果和执行完成回调。
2. 各入口只提供资源上下文和完成回调，不再各自复制 add task、invoke、catch、更新 manifest 的逻辑。
3. 重试必须调用该统一服务，而不是在 `TaskItem` 中直接 `invoke(task.retryAction)`。这样重试成功后可以执行与首次下载完全相同的业务收口。
4. 为 Mod、Resource Pack、Shader、Modpack、Library 资源分别保留完成后的动作，但把动作挂在任务上下文中。
5. 所有入口的 catch 都必须更新任务为 ERROR，并保留 `retryAction/retryPayload`。
6. 主文件下载失败时，依赖安装流程必须停止；只有主文件和所有必需依赖都完成后才报告整组完成。可选依赖失败则按产品规则记录告警，不应伪装成成功。

验收：从每个入口分别执行首次下载、失败重试和重试成功，manifest、缓存、已安装列表和 Library 关联结果与首次成功下载一致。

### Phase 4：并发、恢复和异常处理

修改内容：

1. 同名文件在不同实例中并发下载时，任务、进度、临时文件和完成回调互不覆盖。
2. 应用退出后重新启动时，扫描未完成 `.download` 文件并决定展示为可恢复任务或清理任务；该行为要有明确产品规则。
3. 重试 URL 失效、目标目录不存在、磁盘空间不足和权限错误时，给出可识别错误并允许用户再次操作。
4. 防止重复点击下载产生相同任务的多个后端 worker；相同任务 ID 已在下载时应返回“已存在”或聚焦已有任务。

验收：并发和异常测试通过，且不会出现任务已完成但文件不存在、文件存在但任务仍下载中、任务 UI 消失但后台仍传输的情况。

## 四、测试方案

### 4.1 测试分层

| 层级 | 重点 | 建议工具 |
| --- | --- | --- |
| Rust 单元测试 | 下载控制、状态迁移、续传、临时文件和错误映射 | `cargo test` |
| 前端单元测试 | Store 状态合并、重试回调、任务 ID 和按钮分流 | Vitest；必要时 React Testing Library |
| 前后端集成测试 | Tauri command、事件 payload、业务收口 | Tauri mock + 前端测试；可增加 Rust command 测试 |
| E2E | 从真实入口操作暂停、继续、取消、失败和重试 | Playwright 或项目现有 E2E 方案 |
| 手工设备回归 | Steam Deck、手机横屏、PC、电视的大屏下载管理器交互 | 真机/模拟器 |

### 4.2 必须覆盖的测试用例

#### 后端下载控制

| ID | 场景 | 预期 |
| --- | --- | --- |
| BE-01 | 新任务启动 | 注册表创建任务，收到开始和进度事件，任务 ID 稳定 |
| BE-02 | 下载中暂停 | worker 停止继续读取，速度降为 0，`.download` 保留，状态为 PAUSED |
| BE-03 | 暂停后继续 | 从已有临时文件大小发起 Range/续传，不重新下载已完成字节，最终 rename 成目标文件 |
| BE-04 | 下载中取消 | 请求终止，发送 CANCELED，按规则清理临时文件，不能再发送 COMPLETED |
| BE-05 | 网络中断 | 发送 ERROR，保留可续传临时文件，retry 后可继续 |
| BE-06 | 磁盘写入或 rename 失败 | 发送 ERROR，不发送 COMPLETED，错误信息可见 |
| BE-07 | 同名跨实例并发 | 两个 `task_id`、进度和目标路径互不影响 |
| BE-08 | 重复 pause/resume/cancel | 操作幂等，不创建第二个 worker，不产生矛盾终态 |
| BE-09 | 过期进度事件 | 任务已完成或取消后，迟到的普通进度事件不能覆盖终态 |
| BE-10 | 非法参数 | 不创建任务、不写入越界路径，返回稳定错误 |

#### 前端 Store 和 Download Manager

| ID | 场景 | 预期 |
| --- | --- | --- |
| FE-01 | 进度事件更新任务 | 按 `task_id` 合并，不丢失 retry 上下文和业务元数据 |
| FE-02 | paused 后收到进度事件 | 不被普通进度事件自动改回 downloading |
| FE-03 | 点击暂停 | 调用 `pause_resource_download`，成功后展示暂停；失败后恢复原状态并展示错误 |
| FE-04 | 点击继续 | 调用 resume command，成功后恢复下载并更新进度 |
| FE-05 | 点击取消 | Resource 使用资源取消 command；Instance 使用实例部署取消 command |
| FE-06 | 点击重试 | 只允许一个重试请求，状态进入 RETRYING，成功后进入统一完成回调 |
| FE-07 | 重试失败 | 状态回到 ERROR，保留可再次重试的上下文 |
| FE-08 | 同名资源 | 不同实例的任务卡片、日志和进度不互相覆盖 |
| FE-09 | 终态后迟到事件 | 不回退进度、状态或按钮 |

#### 业务收口和依赖流程

| ID | 场景 | 预期 |
| --- | --- | --- |
| FLOW-01 | ResourceDownloadPage 首次成功 | 文件完成后更新 Mod manifest，并刷新当前实例列表 |
| FLOW-02 | ResourceDownloadPage 失败 | 任务为 ERROR，不继续安装必需依赖 |
| FLOW-03 | 依赖下载失败 | 主任务或依赖组明确失败，不能显示整组成功 |
| FLOW-04 | ModDetailModal 失败 | 任务卡片可见 ERROR，并可点击重试 |
| FLOW-05 | InstanceModDownloadView 重试成功 | 重试后执行与首次成功相同的缓存和 manifest 更新 |
| FLOW-06 | Library 资源成功 | Library 关联、manifest 和缓存均完成 |
| FLOW-07 | Mod Set 安装失败 | 失败任务可重试，重试成功后不会重复写入或产生重复条目 |
| FLOW-08 | 多个必需依赖 | 所有必需依赖完成后才结束；任一失败都能定位到具体依赖 |

### 4.3 E2E 主流程

至少执行以下完整链路：

1. 从 Mod 搜索结果启动下载，观察任务卡片、进度、日志和最终安装结果。
2. 下载到中途点击暂停，确认网络速度停止；点击继续，确认从断点继续而不是从零开始。
3. 下载中点击取消，确认任务停止、文件策略符合定义、不会继续弹出完成提示。
4. 使用测试代理或可控 HTTP server 返回一次网络错误，确认任务进入 ERROR；点击重试，确认最终文件和 manifest 正确。
5. 下载一个包含必需依赖的 Mod，分别验证主文件成功、主文件失败、依赖失败和全部成功四种结果。
6. 同时在两个实例下载同名文件，确认两个任务独立显示和落盘。
7. 从 ModDetailModal、InstanceModDownloadView、ResourceDownloadPage、Library 四个入口各跑一次失败重试闭环。

## 五、验收标准

发布前必须满足：

- 暂停时后端传输确实停止，继续时能断点续传。
- 资源取消不再调用实例部署取消 command。
- 所有资源下载入口的失败任务都能在 Download Manager 中看到并重试。
- 重试成功后的 manifest、缓存、列表刷新和 Library 关联与首次成功一致。
- 同名资源跨实例并发下载不会相互覆盖。
- 主下载失败不会继续安装必需依赖；依赖失败不会被误报为成功。
- 后端和前端测试通过，且至少完成一轮真实 Tauri E2E 回归。
- `pnpm.cmd build`、前端测试命令和 `cargo test --manifest-path src-tauri/Cargo.toml` 均通过。

## 六、建议实施顺序

1. Phase 0：冻结契约，补测试框架和状态机测试。
2. Phase 1：先完成后端暂停、继续、取消和终态事件。
3. Phase 2：接入前端 Store 与 Download Manager 控件。
4. Phase 3：统一四类下载入口和重试后的业务回调。
5. Phase 4：补并发、恢复、磁盘和网络异常测试。
6. 最后执行 E2E 和目标设备回归，再合并到发布分支。

不建议在 Phase 1 之前单独上线“暂停”按钮。只有前后端控制、事件、临时文件和恢复策略同时具备，暂停/继续才算真正完成。
