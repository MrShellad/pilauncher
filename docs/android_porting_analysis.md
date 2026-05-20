# PiLauncher 移植安卓平台功能与特性舍弃分析报告

本报告对 PiLauncher 项目从桌面端（Windows/Linux/macOS）移植到安卓平台所需进行的架构调整、功能舍弃及特性适配进行了详细分析。

---

## 1. 核心架构与运行环境挑战

### 1.1 Java 运行时环境 (JRE) 管理 [重大变更]
*   **当前实现**：通过 `JavaGuard` 和 `check_java_installed` 等命令检测系统路径下的 JRE，或允许用户自定义 Java 路径。
*   **安卓挑战**：安卓系统不提供标准 JRE，且无法像桌面端一样通过环境变量或文件路径直接调用 `java` 命令。
*   **建议方案**：
    *   **舍弃**：舍弃所有基于本地文件系统路径的 Java 检测与配置逻辑。
    *   **适配**：需要集成类似 PojavLauncher 的 OpenJDK 安卓移植版，或要求用户安装特定的 Runtime 包。Java 启动参数需要通过 JNI 调用而非 `std::process::Command`。

### 1.2 Sidecar 边侧程序 (Terracotta) [功能限制]
*   **当前实现**：通过 `tauri-plugin-shell` 的 `sidecar` 机制运行 `terracotta` 二进制文件，并通过本地 HTTP (localhost:port) 通信。
*   **安卓挑战**：安卓对执行任意二进制文件有严格限制，且不支持 Tauri 的桌面端 sidecar 自动打包机制。
*   **建议方案**：
    *   **舍弃**：舍弃现有的 `sidecar("terracotta")` 调用方式。
    *   **适配**：需将 Terracotta 编译为安卓共享库（.so），通过 Rust 的 FFI 直接调用，或作为一个独立的安卓服务运行。

### 1.3 外部进程启动 (`tauri-plugin-shell`) [不可用]
*   **当前实现**：使用 `Command` 启动 Minecraft 游戏进程。
*   **安卓挑战**：安卓应用无法直接 `fork/exec` 一个图形化的 Java 游戏进程。
*   **建议方案**：
    *   **舍弃**：舍弃所有通过命令行参数启动外部游戏的逻辑。
    *   **适配**：游戏运行必须在同一个进程或通过特定的 Activity 容器实现。

---

## 2. 需舍弃或大幅调整的功能模块

### 2.1 Steam 相关集成 [彻底舍弃]
*   **涉及模块**：`steam_shortcuts_util`, `steamlocate`, `check_steam_deck`, `register_steam_shortcut`。
*   **原因**：安卓平台不存在桌面版 Steam 客户端及其快捷方式体系，Steam Deck 专用优化（如检测 `gamescope`）在安卓上无意义。

### 2.2 桌面窗口自定义 (TitleBar) [视觉舍弃]
*   **涉及模块**：`src/ui/layout/TitleBar.tsx`, 最小化/最大化/关闭按钮。
*   **原因**：安卓应用采用全屏或沉浸式布局，不需要也不应该提供窗口控制按钮。

### 2.3 系统更新机制 (`tauri-plugin-updater`) [平台替换]
*   **涉及模块**：`StartupUpdateChecker.tsx` 以及 `Cargo.toml` 中的 `tauri-plugin-updater`。
*   **原因**：安卓平台更新通常通过应用商店（Google Play/华为等）或下载 APK 覆盖安装，不使用 Tauri 的内置更新协议。

### 2.4 系统字体读取 (`get_system_fonts`) [受限]
*   **涉及模块**：`src-tauri/src/commands/system_cmd.rs` 中的 `font-kit` 调用。
*   **原因**：安卓对系统字体的访问权限较严，且字体存储路径与桌面端完全不同。建议仅提供应用内置字体。

---

## 3. 需适配与优化的特性

### 3.1 文件系统访问 (`tauri-plugin-fs`)
*   **挑战**：安卓的分区存储（Scoped Storage）限制。
*   **适配**：需要从访问任意路径转变为访问 `Internal Storage / Android / data / [pkg_name]` 目录。

### 3.2 局域网发现 (mDNS & HTTP Server)
*   **挑战**：安卓的后台限制和多播权限（Multicast Lock）。
*   **适配**：在安卓端启动 mDNS 广播前，必须申请 `CHANGE_WIFI_MULTICAST_STATE` 权限并获取 `MulticastLock`。

### 3.3 手柄与空间导航 (`norigin-spatial-navigation`)
*   **现状**：当前项目针对 Steam Deck 等手柄环境做了大量空间导航适配。
*   **适配**：在安卓手机上应优先使用触屏交互；但在安卓电视（Android TV）上，这套机制应当保留。

### 3.4 3D 渲染性能 (`skinview3d`)
*   **挑战**：中低端安卓设备的 Webview (Chrome) 性能可能无法支撑复杂的 3D 实时预览。
*   **优化**：需提供关闭 3D 皮肤预览的静态图回退选项。

---

## 4. 总结

如果将 PiLauncher 移植到安卓，它将从一个**“通用的 Java 游戏启动器”**转变为一个**“移动端游戏管理与社交工具”**。

**关键路径：**
1.  **砍掉**：所有与 Steam、进程生成（Shell）、桌面窗口相关的代码。
2.  **重写**：Java 运行环境的引导方式和游戏启动核心（核心工作量）。
3.  **桥接**：将 Terracotta 逻辑从进程间通信改为应用内库调用。
4.  **UI 降级**：移除自定义标题栏，优化触屏操作。
