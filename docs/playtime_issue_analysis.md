# 游戏时长统计未生效原因分析报告

## 1. 现状概述
经过对后端代码的审计，目前 `PlaytimeService` 虽然已经实现了核心的计时、心跳、存盘及同步逻辑，但该服务处于**完全孤立**的状态，未与游戏的生命周期（启动/退出）以及启动器的初始化流程建立联系。

## 2. 核心原因分析

### 2.1 缺少游戏启动/退出钩子 (Missing Lifecycle Hooks)
在 `src-tauri/src/services/launcher/mod.rs` 中，`LauncherService::launch_instance` 负责处理游戏的整个运行周期。
- **现象**：该方法仅负责 `spawn` 进程并 `wait` 进程结束，期间没有调用 `PlaytimeService::start_session` 和 `PlaytimeService::finish_session`。
- **后果**：无论游戏运行多久，后台都不会创建统计会话，心跳定时器也无法启动。

### 2.2 背景任务未初始化 (Background Tasks Not Spawned)
`PlaytimeService` 依赖于一个后台常驻线程（`spawn_background_tasks`）来执行以下操作：
- 定期从内存冲刷数据到数据库。
- 自动执行 WebDAV 同步。
- 恢复由于崩溃而未正常结束的“残留会话”。
- **现象**：在 `src-tauri/src/lib.rs` 的 `setup` 流程中，该背景任务从未被启动。
- **后果**：心跳补偿机制和多设备同步功能在系统层面是“死”的。

### 2.3 数据库字段更新闭环缺失 (Database Sync Gap)
虽然数据库 `instances` 表中定义了 `playtime_secs` 字段，且 `PlaytimeService` 内部有 `apply_increment` 方法去更新它。
- **现象**：由于没有 Session 触发 `apply_increment`，数据库中的时长字段将永远保持初始值。
- **后果**：前端调用 `get_overview` 或 `listing` 指令时，读取到的始终是 0 或旧数据。

## 3. 结论
目前时长统计功能属于“**万事俱备，只欠东风**”。底层逻辑（Service 层）已就绪，但顶层调用（Launcher 层）和系统集成（Main/Lib 层）尚未打通。

---
*注：本报告仅用于问题分析，未对代码进行任何实际修改。*
