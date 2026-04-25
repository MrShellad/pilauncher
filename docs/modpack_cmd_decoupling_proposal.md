# modpack_cmd.rs 解耦合建议方案

## 1. 现状分析

`src-tauri\src\commands\modpack_cmd.rs` 目前是一个超过 2000 行的巨大文件，承担了过多的职责，属于典型的 "Fat Controller/Command" 模式。

### 1.1 职责过重 (Over-responsibility)
该文件混合了以下多种性质的代码：
- **API 层**：Tauri Command 定义（负责接收前端请求并返回结果）。
- **业务逻辑层**：Minecraft 版本解析、Loader 识别、库文件规则评估、资源文件收集等。
- **IO 操作层**：文件夹递归复制、文件哈希校验 (SHA1)、磁盘扫描。
- **第三方集成**：识别并导入 PCL/HMCL 等第三方启动器的实例逻辑。
- **事件发送**：大量直接调用 `app.emit` 发送进度事件。

### 1.2 存在的问题
- **难以维护**：文件过长，定位逻辑困难。
- **复用性差**：如 `parse_third_party_json` 或 `evaluate_library_rules` 等通用逻辑被私有化在命令文件中，其他 Service 无法复用。
- **不可测试**：许多业务逻辑直接依赖 `AppHandle<R>`，导致难以进行纯逻辑的单元测试。
- **稳定性风险**：复杂的业务逻辑（如第三方导入）如果出现 Bug，直接影响 Command 层的稳定性。

---

## 2. 建议方案：分层解耦合

建议将该文件拆分为多个专门的 Service 和 Domain 模块。

### 2.1 提取 Minecraft 核心逻辑 (Runtime Service)
将 Minecraft 相关的元数据解析逻辑提取到专门的 Service 中。

- **目标路径**：`src-tauri\src\services\minecraft_service.rs`
- **搬迁内容**：
    - `get_mc_os`, `get_mc_arch` (系统环境识别)
    - `evaluate_library_rules` (库规则过滤)
    - `resolve_loader_folder` (Loader 目录识别)
    - `parse_third_party_json` (版本配置深度解析)
    - `collect_manifest_library_targets`, `collect_asset_targets` (清单收集)

### 2.2 提取运行时校验逻辑 (Verify Service)
`verify_instance_runtime` 命令极其庞大且逻辑复杂，应独立。

- **目标路径**：`src-tauri\src\services\instance\verify_service.rs`
- **搬迁内容**：
    - `verify_instance_runtime` 的核心逻辑（哈希校验、缺失检查）。
    - `push_verify_issue`, `push_sample_issue` 等辅助函数。
- **优势**：Service 可以接收一个回调函数或 Trait 来处理进度上报，从而脱离对 `AppHandle` 的强依赖。

### 2.3 提取第三方导入系统 (Third-Party Import Service)
文件后半部分（约 1600 行开始）全是对第三方启动器的支持，这是独立的业务模块。

- **目标路径**：`src-tauri\src\services\import\third_party_service.rs`
- **搬迁内容**：
    - `resolve_third_party_source`, `scan_third_party_source` (识别与扫描)
    - `import_one_third_party_instance` (注册与配置生成)
    - 相关的结构体定义：`ThirdPartyImportSource`, `ThirdPartyImportInstance` 等。

### 2.4 瘦身 Tauri Commands
重构后的 `modpack_cmd.rs` 应仅作为路由层。

- **重构原则**：
    - Command 只负责参数合法性校验。
    - Command 调用对应的 Service 执行业务。
    - Command 负责将 Service 返回的数据格式化为前端需要的 Result。

**示例（重构后）：**
```rust
#[tauri::command]
pub async fn verify_instance_runtime<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
) -> Result<VerifyInstanceRuntimeResult, String> {
    // 调用专门的 Service
    VerifyService::new(&app).verify(instance_id).await
}
```

---

## 3. 实施步骤建议

1.  **第一步：定义数据模型**：将文件中定义的结构体（如 `MissingRuntime`, `ImportResult`）移动到 `src-tauri\src\domain` 下的对应模块。
2.  **第二步：工具函数外迁**：将 OS 识别、哈希校验等纯工具函数移动到 `crate::utils` 或 `crate::services::runtime_service`。
3.  **第三步：模块化拆分**：
    - 创建 `modpack_service\import.rs` 处理第三方导入。
    - 创建 `modpack_service\verify.rs` 处理环境校验。
4.  **第四步：重构 Command 层**：最后清理 `modpack_cmd.rs`，将其变为单纯的调用转发层。

## 4. 预期收益

- **代码量减少**：`modpack_cmd.rs` 预计可从 2000+ 行减少到 300 行以内。
- **可维护性**：逻辑按领域划分，开发者可以快速定位到相关业务。
- **可测试性**：业务 Service 可以脱离 Tauri 容器运行，方便编写 Unit Tests。
- **健壮性**：解耦后，各模块之间的边界清晰，减少副作用。

---
*建议文档生成于: 2026-04-24*
