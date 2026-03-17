## Downloader 模块说明

该目录负责 **游戏核心与 Mod Loader 部署阶段的下载相关逻辑**，包括版本核心、依赖库、资源文件以及各类 Loader 的安装。

当前子模块结构如下：

- **`core_installer.rs`**  
  - 游戏核心安装入口（下载并部署原版 Minecraft 版本本体）。
  - 协调版本 JSON、依赖、资源等步骤。

- **`loader_installer.rs`**  
  - 负责 Fabric / Forge / NeoForge 等 Loader 的安装与进度上报。
  - 在需要时会复用 `dependencies` 模块下载相应 Loader 的核心依赖。

- **`dependencies/`**  
  - 负责 “依赖/资源下载器” 的解耦实现，适用于原版与各种 Loader 的共享下载逻辑。

### `dependencies` 子模块拆分

`dependencies` 目录下的模块职责划分：

- **`mod.rs`**（流程控制 & 对外入口）
  - 暴露 `download_dependencies` 统一接口。
  - 内部流程：
    1. 调用 `game_core::load_version_manifest` 加载版本清单（核心版本 JSON）。
    2. 调用 `libraries::download_libraries` 并发下载依赖库。
    3. 检查部署是否被取消。
    4. 调用 `assets::download_assets` 并发下载资源文件。

- **`game_core.rs`**（游戏核心部分）
  - 只负责读取并解析某个 `version_id` 对应的版本 JSON：
    - 按路径 `versions/<version_id>/<version_id>.json` 读取文件。
    - 解析为 `serde_json::Value`，并对解析失败给出明确错误信息。

- **`libraries.rs`**（Loader / 依赖库部分）
  - 基于版本清单里的 `libraries` 字段解析需要下载的 Jar。
  - 负责还原 / 构造库文件的下载路径与 URL。
  - 利用 `mirror::route_library_url` 统一处理官方 / 镜像源路由。
  - 将待下载的库封装为 `scheduler::DownloadTask`，交给并发调度器执行。

- **`assets.rs`**（资源文件部分）
  - 负责资源索引与具体资源对象的下载：
    - 下载 / 校验 `assetIndex` JSON（索引文件）。
    - 解析索引中的 `objects`，根据 hash 生成目标路径与大小校验。
  - 使用：
    - `mirror::route_assets_index_url` 处理资源索引地址。
    - `mirror::route_asset_object_url` 处理单个资源对象地址。
  - 最终同样将任务封装为 `DownloadTask`，交由 `scheduler::run_downloads`。

- **`mirror.rs`**（镜像路由）
  - 专门处理 **“官方地址 ↔ 镜像地址”** 的转换逻辑：
    - `route_library_url`：统一路由 Minecraft / Fabric / Forge / NeoForge 的 maven 仓库地址。
    - `route_assets_index_url`：路由资源索引地址。
    - `route_asset_object_url`：路由单个资源对象文件地址。
  - 所有下载 URL 的镜像逻辑集中于此，修改镜像规则时只需改这一处。

- **`scheduler.rs`**（并发调度）
  - 定义 `DownloadTask`（`url` / `path` / `name`）。
  - 实现 `run_downloads`：
    - 使用 `buffer_unordered(concurrency)` 做并发调度。
    - 内部执行：
      - 取消检查。
      - 自动创建目标目录。
      - 逐块读取响应并按线程限速写入本地。
    - 统计已完成数量，并通过 `progress::emit_download_progress` 统一上报进度。

- **`progress.rs`**（进度上报）
  - 定义 `DownloadStage` 枚举（`Libraries` / `Assets`）：
    - 控制事件中的 `stage` 标识。
    - 规范不同阶段的提示文案前缀和上报频率（步长）。
  - 提供 `emit_download_progress`：
    - 统一构造并发送 `DownloadProgressEvent` 事件。
    - 屏蔽具体事件名与字段细节，调用方只需关心阶段与进度数值。

### 模块依赖关系概览

简化的依赖方向（箭头方向为“使用”关系）：

```text
core_installer.rs
      │
      ├──> dependencies::download_dependencies
      │
loader_installer.rs
      └──> dependencies::download_dependencies

dependencies/mod.rs
    ├──> game_core
    ├──> libraries
    └──> assets

libraries.rs
    ├──> mirror
    ├──> scheduler
    └──> progress (通过 scheduler 间接使用)

assets.rs
    ├──> mirror
    ├──> scheduler
    └──> progress (通过 scheduler 间接使用)

scheduler.rs
    └──> progress
```

> 调整镜像源时，优先修改 `mirror.rs`；  
> 调整并发行为（如最大并发、限速、任务结构）时，优先修改 `scheduler.rs`；  
> 修改进度事件格式或文案时，优先修改 `progress.rs`；  
> 修改版本清单解析逻辑时，优先修改 `game_core.rs`；  
> 新增下载流程阶段时，建议在 `dependencies/mod.rs` 中编排，并按上述职责拆分到对应子模块。


## Update Notes (2026-03-17)
- `DownloadTask` now includes `temp_path`, `expected_sha1`, and `expected_size` for integrity-aware downloads.
- Files are downloaded into the `temp` folder under the runtime root first, then verified and atomically moved to the final path.
- Hash verification is controlled by `DownloadSettings.verifyAfterDownload`.
- Retry count uses `DownloadSettings.retryCount` (minimum 1 attempt).
- Progress emits are throttled by a dual threshold: file-count step + time interval.
- The HTTP client timeout is sourced from `DownloadSettings.timeout`.
