# PiLauncher Tauri v2 规范与最佳实践审查报告

本报告对 PiLauncher 的 Tauri v2 后端代码与配置文件进行了全面审查，识别出其中不符合 Tauri 标准、安全规范以及最佳实践的设计，并给出了具体分析和改进建议。

---

## 1. 配置文件 (`tauri.conf.json`) 中的失效和废弃字段

在 [tauri.conf.json](file:///h:/VSCodeWork/pilauncher/src-tauri/tauri.conf.json) 中，存在若干 Tauri v1 的残留配置，这些配置在 Tauri v2 中均已失效或被忽略。

### 1.1 `security.assetProtocol` 的失效与配置残留
*   **文件位置**：[tauri.conf.json:L29-L34](file:///h:/VSCodeWork/pilauncher/src-tauri/tauri.conf.json#L29-L34)
*   **分析**：在 Tauri v2 中，`security.assetProtocol` 配置在 `tauri.conf.json` 中已被完全移除。在 v2 中，`asset` 协议主要通过启用 `tauri` 依赖的 `protocol-asset` feature（已在 [Cargo.toml](file:///h:/VSCodeWork/pilauncher/src-tauri/Cargo.toml) 中通过 `tauri = { version = "2.10.0", features = ["protocol-asset"] }` 启用）来运行。其路径访问权限（`scope`）在 v2 中由 **Capabilities** 权限集进行管理。
*   **影响**：此字段在 Tauri v2 中为多余字段，会被系统直接忽略，无法真正限制或启用资源协议 of scope。

### 1.2 窗口配置中的 `devtools` 属性失效
*   **文件位置**：[tauri.conf.json:L24](file:///h:/VSCodeWork/pilauncher/src-tauri/tauri.conf.json#L24)
*   **分析**：在 Tauri v2 中，窗口定义下的 `"devtools": false` 属性已被废弃。开发者工具的启用与禁用目前统一收归到 Capabilities 权限描述文件（如 `core:default`）或通过 Rust 端的 `WebviewWindowBuilder` 进行动态控制。
*   **影响**：残留此属性会与最新的 Tauri v2 schema 产生警告或冲突。

### 1.3 窗口配置缺少显式的 `label` 声明
*   **文件位置**：[tauri.conf.json:L13-L25](file:///h:/VSCodeWork/pilauncher/src-tauri/tauri.conf.json#L13-L25)
*   **分析**：单窗口列表定义中没有包含 `"label": "main"` 键。虽然 Tauri 在仅有一个窗口时会默认分配其为 `"main"`，但由于应用权限集 [default.json](file:///h:/VSCodeWork/pilauncher/src-tauri/capabilities/default.json) 中硬编码绑定了 `"windows": ["main"]`，最佳实践应在窗口配置中显式指明窗口的 label。

---

## 2. 安全规范缺陷：内容安全策略 (CSP) 未配置

*   **文件位置**：[tauri.conf.json:L28](file:///h:/VSCodeWork/pilauncher/src-tauri/tauri.conf.json#L28) (`"csp": null`)
*   **分析**：在 Tauri 的安全标准指南中，CSP (Content Security Policy) 是防止 XSS (跨站脚本) 以及不受信代码执行的重要防线。由于 PiLauncher 内嵌了大量网络接口及游戏模组下载相关的 HTML 渲染，将 CSP 设置为 `null` (即未启用内容安全策略)，在构建时会触发 Tauri 的安全警告。
*   **影响**：应用失去了网络层面的沙箱防护屏障，前端如果引入不安全的外部资源或遭遇注入攻击，容易引发安全隐患。

---

## 3. 权限系统的宽松设计风险 (Capabilities 过度授权)

*   **文件位置**：[default.json:L43-L48](file:///h:/VSCodeWork/pilauncher/src-tauri/capabilities/default.json#L43-L48)
*   **分析**：在默认的 Capabilities 配置文件中，授予了 `"fs:allow-read"` 权限，并且其 `allow` 的路径范围定义为 `["**"]`（代表允许读取系统上的所有路径）。
*   **影响**：这违反了 Tauri 倡导的**最小权限原则（Principle of Least Privilege）**。一旦前端发生代码漏洞，恶意的脚本将有权读取用户的整个磁盘。
*   **改进建议**：收窄该 Scope（例如仅限 `$APP_DATA`、`$HOME` 或者是游戏实例存放的特定工作目录）。更彻底的，由于前端并没有直接引入或使用 `@tauri-apps/plugin-fs` 的 JS API，可以考虑在 `default.json` 中直接删除该项权限，文件读写完全交由 Rust 后端处理。

---

## 4. 异步 Tauri 命令 (Async Commands) 中调用同步阻塞 I/O

在大量的异步命令（`async fn`）定义中，直接使用了 Rust 标准库 `std::fs` 或同步压缩库进行高延迟的 I/O 和 CPU 密集操作：

### 4.1 典型示例：
1.  **文件管理操作**：在 [fs_cmd.rs](file:///h:/VSCodeWork/pilauncher/src-tauri/src/commands/fs_cmd.rs) 的异步命令 [list_valid_dirs](file:///h:/VSCodeWork/pilauncher/src-tauri/src/commands/fs_cmd.rs#L111)、[list_directory_entries](file:///h:/VSCodeWork/pilauncher/src-tauri/src/commands/fs_cmd.rs#L142)、[create_valid_dir](file:///h:/VSCodeWork/pilauncher/src-tauri/src/commands/fs_cmd.rs#L199) 中，直接调用了 `std::fs::read_dir` 和 `std::fs::create_dir`。
2.  **崩溃诊断打包**：在 [launcher_cmd.rs](file:///h:/VSCodeWork/pilauncher/src-tauri/src/commands/launcher_cmd.rs) 的异步命令 [export_diagnostics](file:///h:/VSCodeWork/pilauncher/src-tauri/src/commands/launcher_cmd.rs#L56) 中，同步地对游戏日志进行读取并通过 `zip` 库进行压缩打包。
3.  **配置文件读写**：在 [keymap_cmd.rs](file:///h:/VSCodeWork/pilauncher/src-tauri/src/commands/instance/keymap_cmd.rs) 的多个异步指令中直接调用 `std::fs::read_to_string` 和 `std::fs::write` 操作。

### 4.2 影响分析：
Tauri 的命令（Command）有以下运行机制：
*   **同步命令**（非 `async fn`）：Tauri 会自动将其放入独立的工作线程池（Blocking Thread Pool）运行。
*   **异步命令**（`async fn`）：运行在 Tokio 的异步调度器上（当前线程或小规模的异步运行时线程中）。
*   在 `async fn` 命令中，如果使用了任何**同步阻塞**的文件读写或密集 CPU 计算（如 `zip`），会把 Tokio 的异步工作线程占用，导致同线程池下的其他异步 IPC 命令无法得到响应，进而表现为前端界面或组件操作短暂卡顿。

### 4.3 改进建议：
*   对不需要并发和异步调度的命令，直接去掉 `async` 关键字，使其退化为普通的同步 Command，让 Tauri 自动多线程调度。
*   如果必须是异步命令，应改用 `tokio::fs` 的异步文件操作 API；对于 CPU 密集型任务（如 `export_diagnostics` 中的打包流程），必须使用 `tauri::async_runtime::spawn_blocking` 将同步阻塞任务转移到独立的阻塞线程中。

---

## 5. 跨平台进程与文件管理器调用未采用 Tauri 官方插件

项目中有数处绕过 Tauri 插件，直接生成底层命令行进程的设计：

*   **调用文件管理器**：在 [fs_cmd.rs:L227](file:///h:/VSCodeWork/pilauncher/src-tauri/src/commands/fs_cmd.rs#L227) 中，[open_path_in_file_manager](file:///h:/VSCodeWork/pilauncher/src-tauri/src/commands/fs_cmd.rs#L227) 自行针对 Windows (`explorer`)、macOS (`open`) 和 Linux (`xdg-open`) 通过 `std::process::Command` 进行了派生。
*   **关闭游戏进程**：在 [launcher_cmd.rs:L32](file:///h:/VSCodeWork/pilauncher/src-tauri/src/commands/launcher_cmd.rs#L32) 中，[kill_current_game](file:///h:/VSCodeWork/pilauncher/src-tauri/src/commands/launcher_cmd.rs#L32) 手动拼装了命令行命令（如 Windows 的 `taskkill /F /T /PID`）来杀掉当前进程。

*   **分析**：虽然利用 Rust 底层命令可以绕过前端 Capabilities 权限的安全管控限制，但是并不符合 Tauri 的官方推荐架构。
*   **改进建议**：Tauri 提供了官方的 [tauri-plugin-shell](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/shell) 插件。对于拉起文件管理器，最标准的做法是在 Rust 后端中通过 `tauri_plugin_shell::ShellExt` 提供的跨平台 API（如 `app.shell().open(...)`）来进行调用。这可以避免拼装硬编码指令所引入的安全隐患。

---

## 6. 前后端依赖与插件注册的不一致性

Tauri 的诊断工具还显示了某些插件配置和依赖的不一致：

*   **未启用的 `tauri-plugin-fs` 依赖**：
    *   在 [Cargo.toml](file:///h:/VSCodeWork/pilauncher/src-tauri/Cargo.toml) 中配置了 `tauri-plugin-fs = "2"`。
    *   但在 [lib.rs](file:///h:/VSCodeWork/pilauncher/src-tauri/src/lib.rs) 中**没有注册**该插件，且前端 [package.json](file:///h:/VSCodeWork/pilauncher/package.json) 中也**未安装** `@tauri-apps/plugin-fs`。
    *   **影响**：不仅额外增加了编译的打包体积与编译时间，同时在 Capabilities 文件中声明 `fs:default` 和 `fs:allow-read` 权限也会失效且显得冗余。
*   **前端未同步安装 `@tauri-apps/plugin-log`**：
    *   后端 [lib.rs:L97](file:///h:/VSCodeWork/pilauncher/src-tauri/src/lib.rs#L97) 中在 Debug 状态下注册并启动了 `tauri_plugin_log` 插件。
    *   但前端并未在 [package.json](file:///h:/VSCodeWork/pilauncher/package.json) 中引入对应的 `@tauri-apps/plugin-log` npm 包。如果前端不需要使用 JS 记录或读取日志，这不影响编译，但从依赖完整度考虑应当加以清理或补齐。

---

## 总结
通过以上对 PiLauncher 的审查，可以发现目前应用在 **Tauri v2 API 适配（配置兼容）**、**安全策略（CSP & 沙箱 Scope）** 以及 **异步多线程调度性能（Command 同步阻塞）** 上有进一步提升和调优的空间。通过移除残留属性、采用异步 I/O、限制 Capabilities 范围，可以大幅提升应用的响应性能和安全性。
