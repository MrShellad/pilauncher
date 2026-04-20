# Downloader 服务改进方案 (Downloader Improvement Plan)

本文档基于对 `src-tauri/src/services/downloader` 及其相关组件的分析，旨在解决 Mod 下载频繁失败、效率低下的问题。

## 现状分析 (Problem Analysis)

### 1. 核心技术缺陷
*   **无断点续传 (No Resume Support)**：每次下载失败后都会删除已下载文件，下次重试从 0 开始。在不稳定网络下，大文件（如整合包中的大型 Mod）几乎无法完成。
*   **停顿超时过短 (Aggressive Stall Timeout)**：默认 15 秒的 `stall_timeout` 在跨境网络或高负载 CDN 下极易触发。
*   **哈希校核过于刚性**：哈希校核失败后立即删除重试，若元数据（manifest）中的哈希值有误，将导致死循环重试。

### 2. 策略管理问题
*   **并发冲突 (Concurrency Issues)**：前端 UI 将并发限制在 8，但后端默认值为 16。这种不一致导致默认状态下极易触发服务端的速率限制。
*   **功能配置脱节**：前端提供了"自动测速（Auto Latency）"开关，但后端配置结构体中缺失该字段，导致该功能目前处于失效状态（Placeholder）。
*   **全量失败机制 (All-or-Nothing)**：单文件重试耗尽后会导致整个阶段报错。且 `orchestrator.rs` 硬编码了 `verify_hash = true`，忽略了用户在设置界面中关闭校验的意愿。
*   **超时定义模糊**：单一的"连接超时"设置被同时用于连接建立和数据读写。在弱网环境下，读写停顿（Stall）比连接超时更常见。

---

## 已实施的改进 (Implemented)

### 1. ✅ 断点续传 (HTTP Range Resume)

**文件**: `transfer.rs` — `download_single_stream`

*   下载前检测 `.download` 临时文件是否存在，读取已有字节数。
*   发送 `Range: bytes=<existing_len>-` 请求头。
*   处理 `206 Partial Content`（追加写入）、`200`（重新开始）、`416 Range Not Satisfiable`（重试不带 Range）。
*   **网络错误和停顿超时不再删除临时文件**，保留已下载进度供下次重试使用。
*   `download_file` 中候选 URL 切换时也保留临时文件。

### 2. ✅ 前后端配置对齐

**文件**: `config_service.rs`

*   后端默认并发从 **16 降至 8**，与前端 UI 滑块最大值一致。
*   新增 `auto_check_latency: bool` 字段（`#[serde(default)]`），与前端 `autoCheckLatency` 对齐。
*   新增 `ConfigService::stall_timeout()` 辅助方法：数据传输停顿超时 = 用户设置超时 × 2（最低 30s）。

### 3. ✅ 分级超时 (Decoupled Timeouts)

**文件**: `libraries.rs`, `assets.rs`, `core_installer.rs`, `orchestrator.rs`

*   **连接超时 (Connect Timeout)**：保持用户设置值（默认 15s），用于 `reqwest::Client::connect_timeout`。
*   **读写停顿超时 (Stall Timeout)**：使用 `ConfigService::stall_timeout()`（默认 30s），用于 `tokio::time::timeout` 等待数据块。
*   所有调用 `run_downloads` 的地方统一使用新的分级超时。

### 4. ✅ 指数退避重试 (Exponential Backoff)

**文件**: `scheduler.rs`, `core_installer.rs`

*   重试延迟公式：`RETRY_BASE_DELAY_MS × 2^attempt`（上限 `attempt.min(5)` 即最大 ~38s）。
*   替换了原先所有固定 1.2s 的等待。

### 5. ✅ 尊重用户校验设置

**文件**: `orchestrator.rs` — `download_pipack_mods`

*   `verify_hash = true` 硬编码改为 `verify_hash = dl_settings.verify_after_download`。
*   `download_modrinth_mods` 和 `download_curseforge_mods` 本身已正确读取用户设置，保持不变。

### 6. ✅ 默认并发回退值统一

**文件**: `libraries.rs`, `assets.rs`, `orchestrator.rs`（pipack / modrinth / curseforge）

*   所有 `else { 16 }` fallback 改为 `else { 8 }`。

---

## 后续可优化的方向 (Future Work)

### 自动测速后端逻辑 (Smart Mirror Selection)
*   `auto_check_latency` 字段已添加到后端，但实际测速+选源逻辑尚未实现。
*   建议在 `download_file` 调用前对 `candidate_urls` 执行并发 HEAD 请求采样。

### 容错式整合包导入 (Graceful Import)
*   当前仍为"一个 Mod 失败 → 整个阶段失败"模式。
*   建议引入 `failed_tasks: Vec<String>` 收集器，允许非核心文件跳过，并在完成后向用户展示失败列表。

### API 响应缓存
*   CurseForge / Modrinth API 调用目前没有缓存，重复导入相同整合包会重复请求。
*   建议引入短期内存缓存（TTL 5min）或磁盘缓存。
