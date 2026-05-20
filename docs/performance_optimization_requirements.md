# PiLauncher 性能优化需求文档

更新时间：2026-05-20

## 1. 背景

PiLauncher 当前是 Tauri 2 + React 19 + Vite 7 的桌面启动器，核心场景包括实例管理、模组下载与扫描、资源下载、Minecraft 启动日志、3D 皮肤预览、WebDAV 收藏同步、LAN 联机和手柄输入。

本次分析基于当前代码结构、前端构建结果和关键运行链路。项目已经具备一些基础性能设计，例如页面懒加载、实例详情和下载页保活、模组列表虚拟滚动、下载分片、下载限速、SQLite WAL、延后启动非关键后台服务。后续优化应优先补齐可观测性、首屏资源、后台任务调度、大文件/大列表场景和渲染稳定性。

## 2. 当前性能信号

前端构建命令 `npm.cmd run build` 通过。构建产物中较大的资源如下：

| 类型 | 产物/资源 | 体积信号 |
| --- | --- | --- |
| JS | `assets/three-core-*.js` | 约 937.73 KB，gzip 约 239.10 KB |
| JS | `assets/index-*.js` | 约 407.10 KB，gzip 约 136.31 KB |
| JS | `assets/InstanceDetail-*.js` | 约 244.09 KB，gzip 约 68.04 KB |
| JS | `assets/vendor-*.js` | 约 201.10 KB，gzip 约 69.25 KB |
| CSS | `assets/index-*.css` | 约 326.58 KB，gzip 约 47.82 KB |
| 图片 | `src/assets/steamgrid/library_600x900.png` | 约 2.30 MB |
| 图片 | `src/assets/instances/default-3.png` | 约 1.38 MB |

关键代码观察：

- `src/App.tsx` 首屏同步挂载 `Home`、`OreBackground`、`DownloadManager`、`GameLogService`、`StartupNewsModal`、`GamepadModPrompt`、`JavaGuard`、`SetupWizard`、`StartupUpdateChecker` 等全局组件。
- `src/ui/layout/OreBackground.tsx` 支持图片背景和 panorama/Three.js 背景，并存在 `requestAnimationFrame` 渲染路径。
- `src/features/home/engine/SkinEngine.ts` 使用 `skinview3d`，默认目标帧率 60 FPS，通过 `setInterval` 手动驱动渲染。
- `src/features/GameLog/hooks/useLogService.ts` 每 50 ms 批量刷入日志，`useGameLogStore` 最多保留 1000 行。
- `src/features/InstanceDetail/components/tabs/mods` 已使用 `Virtuoso` 虚拟列表，但模组扫描、图标订阅、分组、搜索和焦点逻辑仍是高频大数据路径。
- `src-tauri/src/services/instance/mod_manager.rs` 模组扫描存在 fast path，但 slow path 会为每个待解析 jar 创建任务，并做 ZIP 解析、图标提取、CurseForge fingerprint 计算和 DB 缓存更新。
- `src-tauri/src/services/downloader/transfer.rs` 分片下载共享同一个 `tokio::fs::File` + `Mutex`，每个 chunk 写入时加锁 seek/write。
- `src-tauri/src/services/webdav_sync_service` 收藏同步对 operation 文件逐个上传/下载/读取，已有快照压缩阈值，但网络和磁盘批处理仍可优化。

## 3. 性能目标

### 3.1 用户体验目标

- 冷启动到首个可交互界面在常规设备上稳定低于 2 秒。
- 进入实例详情、下载页、模组列表、衣柜页时不出现超过 100 ms 的主线程卡顿。
- 大型实例场景支持 500 到 1500 个 mod 文件，模组页首批内容在 1 秒内可见，完整扫描逐步回填。
- 下载大量 assets/libraries 时进度稳定刷新，不因事件过密导致前端掉帧。
- 3D 背景和皮肤预览不应在窗口失焦、页面不可见、低电量或性能模式下持续高帧率渲染。

### 3.2 工程目标

- 建立性能基线和回归门禁，避免只靠主观感受判断。
- 每个高风险链路都应有可观测指标、可配置降级策略和验收阈值。
- 性能优化不改变下载完整性、实例数据一致性和同步冲突处理语义。

## 4. 优先级需求

### P0：建立性能观测与基线

#### PR-001 前端性能埋点与本地诊断面板

问题：
当前没有统一记录首屏、页面切换、长任务、JS chunk 加载耗时、虚拟列表渲染耗时和内存占用，性能问题难以复现和验证。

需求：

- 在前端加入轻量性能采样模块，记录启动阶段、页面切换、懒加载 chunk、长任务、日志刷入、列表渲染窗口变化等指标。
- 指标默认仅本地保存，可在设置或 About 页导出诊断 JSON。
- 对 `Home`、`Instances`、`InstanceDetail`、`ResourceDownloadPage`、`LibraryPage`、`Wardrobe` 建立页面级耗时点。
- 捕获 `PerformanceObserver` 的 long task，记录持续时间、当前页面、活跃弹窗和最近用户操作。

验收标准：

- 能导出最近一次启动和最近 10 次页面切换的性能样本。
- 任意页面出现超过 100 ms 的 long task 时，本地诊断中可定位发生时间和页面。
- 埋点自身对首屏 JS 增量小于 5 KB gzip。

#### PR-002 Rust 后端耗时追踪

问题：
模组扫描、实例列表、WebDAV 同步、下载校验、Java 自动检测等后端调用缺少统一耗时日志。

需求：

- 为 Tauri command 增加统一耗时包装，记录 command 名称、耗时、成功/失败、关键输入规模。
- 为 `get_mods`、`get_all_instances`、`download_dependencies`、`sync_webdav_favorites`、`detect_java_installations`、`launch_game` 增加结构化耗时字段。
- 慢调用阈值默认 300 ms，超过阈值写入本地性能日志。

验收标准：

- 开发模式下可以看到慢 command 摘要。
- 诊断导出中包含最近 100 条后端慢调用。
- 不记录用户 token、路径中敏感账户信息和服务端密码。

### P0：首屏体积与启动路径优化

#### PR-003 首屏 chunk 拆分和全局组件延迟挂载

问题：
构建产物 `index-*.js` 约 407 KB，首屏还同步挂载多个全局服务组件。虽然页面本身做了懒加载，但全局组件和部分业务 store 仍会进入启动路径。

需求：

- 审计 `src/App.tsx` 的同步 import，把非首屏必须组件延后到首帧之后或用户首次需要时加载。
- `StartupNewsModal`、`GamepadModPrompt`、`StartupUpdateChecker`、部分 dialog 组件改为条件加载或 idle 后加载。
- 对启动路径中的 Tauri `invoke` 做分级：首屏必须、首帧后、空闲时、用户进入页面时。
- 保留已存在的 `start_deferred_services` 思路，并扩展为统一 deferred startup 调度器。

验收标准：

- `index-*.js` gzip 体积降低 20% 以上，或明确证明当前拆分边界无法继续降低。
- 冷启动首屏期间 Tauri invoke 数量有可视化统计。
- 首屏首个可交互时间较当前基线降低 15% 以上。

#### PR-004 Three.js 和 skinview3d 按需加载

问题：
`three-core-*.js` 约 937 KB。当前 Home/背景/衣柜/皮肤预览相关路径可能较早引入 3D 依赖，影响冷启动和内存。

需求：

- 确认 `three`、`skinview3d`、`skinview3d-blockbench` 只在需要 3D 皮肤或 panorama 时动态加载。
- 首页若默认只显示静态占位，应避免提前加载 `three-core`。
- 为低性能模式、窗口失焦、不可见页面提供自动暂停渲染策略。

验收标准：

- 不打开 3D 皮肤/全景背景时，`three-core` 不进入首屏关键加载路径。
- 首次进入衣柜或 3D 预览时再加载 3D chunk，并展示可接受的加载状态。
- 关闭 3D 页面后 WebGL 上下文和纹理资源可释放或复用，无持续增长。

#### PR-005 静态图片资源压缩与格式治理

问题：
资源中存在 2.30 MB 的 `library_600x900.png` 和 1.38 MB 的 `default-3.png`。这些资源若进入常用界面，会影响安装包、加载和内存。

需求：

- 建立图片资源预算：普通 UI 图片单文件建议小于 300 KB，封面/大图例外需说明。
- 将大 PNG 优先转换为 WebP/AVIF，并保留必要兼容回退。
- 对 Steam Grid、实例默认封面、背景图分别制定尺寸和压缩规格。
- 在构建或脚本中输出大于阈值的资源列表。

验收标准：

- 大于 1 MB 的前端静态图片减少到 0 个，除非有明确白名单。
- 安装包和 `build/assets` 图片总体积下降。
- 图片压缩后首屏和封面视觉无明显损伤。

### P1：渲染与交互流畅度

#### PR-006 背景渲染性能模式

问题：
`OreBackground` 支持 blur、mask、panorama 和 rAF 动画。持续背景动画、模糊滤镜和透明窗口组合在低端 GPU、Linux WebKit 或电池场景下可能造成掉帧。

需求：

- 增加背景性能策略：高质量、平衡、省电。
- 窗口失焦、最小化、页面不可见时暂停 panorama rAF。
- `backgroundBlur` 在省电模式下强制为 0，已有 battery saver 逻辑应纳入统一策略。
- 对透明窗口 + backdrop/filter 高负载组合给出降级规则。

验收标准：

- 背景动画暂停后 CPU/GPU 占用明显下降。
- 恢复窗口后动画状态正确恢复。
- 设置项可控制并持久化性能模式。

#### PR-007 SkinEngine 渲染循环治理

问题：
`SkinEngine` 默认 60 FPS，通过 `setInterval` 驱动渲染。当前需要更细的可见性、交互态和低功耗控制。

需求：

- 将默认目标帧率改为按场景配置：静态预览 24/30 FPS，用户拖拽时 60 FPS。
- 页面不可见、组件卸载、窗口失焦或模型未变化时暂停或降帧。
- 加入渲染帧耗时采样和 WebGL 资源释放校验。
- 避免重复注册 `beforeunload` 监听。

验收标准：

- 衣柜页静置时 CPU 占用低于当前基线 30%。
- 快速进入/退出衣柜 10 次后，WebGL context、canvas 和 timer 数量不持续增长。
- 拖拽交互仍保持流畅。

#### PR-008 日志渲染与高亮增量优化

问题：
日志服务每 50 ms flush，最多保留 1000 行，渲染层每行调用高亮逻辑。高频日志期间可能造成 store 更新和 React 渲染压力。

需求：

- 根据日志速率自适应 flush 间隔，空闲 50 ms，高速日志 100 到 250 ms。
- 高亮结果按日志行内容缓存，避免虚拟列表重复渲染时反复解析。
- 增加日志暂停跟随、搜索过滤时的独立索引，避免搜索时全量高亮重算。
- 崩溃分析保留最近 N 行之外，支持后端落盘完整日志路径。

验收标准：

- 每秒 500 行日志输入时，侧边栏可滚动且主线程无连续 long task。
- 搜索和复制单行不触发全列表重算。
- 保留现有崩溃原因识别行为。

### P1：大实例和模组扫描优化

#### PR-009 模组扫描并发上限与分阶段返回

问题：
`get_mods` slow path 会为每个待解析 jar 创建任务。虽然使用 `spawn_blocking`，但缺少明确并发上限，遇到大量新增/变更 mod 时可能造成 CPU、磁盘和线程池压力。

需求：

- 为 jar 解析、图标提取、fingerprint 计算设置独立并发上限，默认按 CPU 核心和磁盘类型计算。
- fast path 结果立即返回，slow path 以批次增量事件回填。
- 前端对扫描状态区分“可交互列表”和“后台补全元数据”，不阻塞基础操作。
- fingerprint 计算避免二次完整读文件，或将文件状态缓存后按需计算。

验收标准：

- 1000 个 mod 中 10% 变更时，首批列表内容在 1 秒内出现。
- 1000 个 mod 全量冷扫时 UI 不阻塞，扫描进度持续更新。
- 慢扫描期间 CPU 占用可控，不因无限任务导致系统卡顿。

#### PR-010 模组图标缓存与加载预算

问题：
图标提取已有 shared cache，但前端图标订阅和后端图标生成仍可能在滚动和扫描期间形成突发负载。

需求：

- 后端图标提取以可见优先、后台补齐方式调度。
- 图标缓存增加尺寸、mtime、hash 元信息，避免重复检查和重复解压。
- 前端只订阅可见区加小范围预取，离开页面取消订阅。
- 网络图标和本地图标统一接入内存/磁盘缓存策略。

验收标准：

- 大列表快速滚动时不出现图标加载导致的明显卡顿。
- 同一实例重复进入模组页，已缓存图标不再触发 jar 解压。

#### PR-011 模组列表派生数据增量化

问题：
当前 `useModListData` 会对 `mods` 做搜索、quick filter、分组、flatMap 和统计。虚拟滚动已降低 DOM 压力，但大数组派生仍可能成为主线程成本。

需求：

- 为搜索关键字添加 debounce 或 transition，避免每个输入字符同步重算全量数组。
- 对分组、统计、renderEntries 建立基于版本号的缓存。
- 将高成本搜索移到 Web Worker 或后端索引，至少为 1000+ mod 场景提供异步搜索。
- 对焦点恢复、rangeChanged、图标订阅避免产生无意义状态更新。

验收标准：

- 1000 个 mod 搜索输入无明显卡顿。
- 切换 quick filter 和折叠分组时 long task 小于 50 ms。

### P1：下载、校验和事件节流

#### PR-012 分片下载写入模型优化

问题：
`download_chunked_stream` 多分片共享同一个文件锁，每个 chunk 都 `seek + write_all`，高并发时写锁竞争会抵消分片收益。

需求：

- 评估每个分片独立临时文件，完成后顺序合并，或使用平台适配的随机写策略。
- 按文件大小、磁盘类型和源站 Range 支持情况动态选择单流/分片。
- 下载 benchmark 应输出单流、分片、写入等待和校验耗时。

验收标准：

- 大文件下载在高速网络下分片模式吞吐高于单流，且不会因锁竞争下降。
- 分片失败、取消、重试仍保留当前断点续传语义或有明确替代方案。

#### PR-013 下载进度事件节流与聚合

问题：
下载器已有 100 ms 进度间隔，单文件 Java 下载为 250 ms，但多任务和速度事件仍可能对前端造成压力。

需求：

- 将后端进度事件统一聚合为阶段级和任务级两类。
- 高频字节更新只更新原子计数，UI 事件按 150 到 250 ms 发出。
- 前端 DownloadManager 对进度事件做 requestAnimationFrame 合并。
- 对后台下载面板关闭时降低事件频率。

验收标准：

- 并发 64 个小文件下载时前端不出现进度事件风暴。
- 进度条视觉仍保持连续，不影响取消、失败和完成状态。

#### PR-014 校验和补全策略优化

问题：
assets/libraries 的 SHA-1 校验会读取完整文件。强校验保证正确性，但大量文件场景中冷校验成本明显。

需求：

- 区分安装前缺失检查、下载后校验、用户手动完整校验三种模式。
- 对已有文件优先使用 size + manifest mtime/etag 缓存，必要时再 hash。
- 提供“快速校验”和“完整校验”设置说明。

验收标准：

- 默认安装流程不降低完整性要求，下载后仍校验关键文件。
- 重复启动同一实例时不反复全量 hash 未变化文件。

### P2：数据同步和数据库优化

#### PR-015 WebDAV 收藏同步批处理

问题：
WebDAV 同步逐个 operation 上传/下载，operation 多时网络 RTT 成本高。已有 snapshot compaction，但阈值前仍可能慢。

需求：

- 支持远端 operation 列表分页/批量解析和并发下载，设置小并发上限。
- 本地 operation 读取改为批量读取和一次性解析。
- 上传多个本地 operation 时并发上限默认 3 到 5，并保留失败重试。
- snapshot 阈值根据 operation 数量和同步耗时动态触发。

验收标准：

- 100 个 operation 的同步耗时较当前串行方式下降 50% 以上。
- 冲突解析结果与当前逻辑一致。

#### PR-016 SQLite 连接池和查询索引审计

问题：
数据库已启用 WAL 和 `synchronous=NORMAL`，但连接池大小、busy timeout、热点查询索引和批量写事务仍需要明确策略。

需求：

- 配置 SQLite pool 最大连接数、busy timeout、statement cache。
- 审计实例列表、tags、library collections、mod_set_trackers、global_mod_cache 的查询计划。
- 高频批量写入使用事务，避免逐条 execute。
- 为数据库慢查询记录耗时和 SQL 名称。

验收标准：

- 热点查询有 `EXPLAIN QUERY PLAN` 记录和索引说明。
- 批量写入收藏、集合、模组缓存时 DB 写入耗时下降。

### P2：构建和样式体积治理

#### PR-017 CSS 体积拆分与样式预算

问题：
主 CSS 约 326 KB。`src/style/app.css` 统一 import 多个页面和组件样式，包括 Multiplayer、Wardrobe、Settings 等非首屏页面。

需求：

- 将页面级 CSS 拆到对应懒加载页面中，避免全部进入首屏 CSS。
- 保留设计 token 和基础 primitive 样式在核心包，其余按页面加载。
- 建立 CSS 体积预算和重复样式审计。

验收标准：

- 首屏 CSS 体积降低 30% 以上。
- 懒加载页面样式不会造成明显闪烁。

#### PR-018 依赖体积审计

问题：
项目使用 `framer-motion`、`lucide-react`、`react-virtuoso`、`three`、`skinview3d` 等较重依赖。lucide 已做直引，但仍需要持续防回退。

需求：

- 引入 bundle analyzer 或构建后 stats 输出。
- 对新增依赖设定体积审查流程。
- 确认 `framer-motion` 是否可按场景替换为 CSS transition 或局部导入。
- 保持 lucide direct import 插件的测试，避免升级后失效。

验收标准：

- 每次 release 可生成 bundle 体积报告。
- 任意单个新 chunk 超过 100 KB gzip 时需要说明。

## 5. 建议实施顺序

1. 先做 PR-001 和 PR-002，建立基线，否则后续优化难以证明收益。
2. 同步推进 PR-003、PR-004、PR-005、PR-017，解决冷启动和资源体积。
3. 针对真实大实例数据推进 PR-009、PR-010、PR-011，优先保障模组页体验。
4. 下载链路先做 PR-013，再评估 PR-012，避免过早改动正确性敏感的写入模型。
5. WebDAV 和 SQLite 优化放在 P2，但应在收藏同步用户量上升前完成。

## 6. 性能测试场景

### 启动场景

- 冷启动：无缓存、默认设置、首次打开。
- 热启动：已有设置、已有实例、已有新闻缓存。
- 低性能模式：背景 blur 关闭、3D 背景关闭、透明窗口保留。

### 实例场景

- 10 个实例、每个少量 mod。
- 100 个实例、带封面、tags、收藏状态。
- 单实例 1000 个 mod，包含 10% 新增或变更 jar。
- 单实例 1000 个 mod，全部冷扫。

### 下载场景

- 新建 vanilla 实例下载 assets/libraries。
- 大文件 Java 下载。
- 高并发小文件下载。
- 不稳定网络下断点续传和镜像切换。

### 日志场景

- 正常启动日志。
- 每秒 500 行日志压力输入。
- 崩溃日志尾部识别。
- 日志侧边栏打开、关闭、搜索和复制。

### 3D 和背景场景

- 首页静态背景。
- panorama 背景。
- 衣柜页打开、拖拽、切换皮肤、离开页面。
- 窗口失焦、最小化、恢复。

## 7. 交付物

- 性能基线报告：启动、页面切换、大实例、下载、日志、3D。
- 本地诊断导出功能。
- Bundle 和资源体积报告。
- Rust 慢调用日志。
- 每个优化 PR 的前后对比数据。

## 8. 风险与约束

- 下载和校验优化必须优先保证文件完整性，不能为了吞吐牺牲正确性。
- 模组扫描并发上限需要兼顾 HDD、SSD 和低端 CPU，不能只按开发机调优。
- 页面 CSS 拆分可能引入样式闪烁，需要配合懒加载 fallback 验证。
- 3D 依赖延迟加载会带来首次进入等待，需要用明确 loading 状态消化。
- WebDAV 并发上传/下载可能触发服务端限流，必须可配置和可回退。

