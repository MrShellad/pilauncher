# PiLauncher `auth_service.rs` 解耦与重构方案

## 1. 现状分析 (Problem Statement)
目前 `auth_service.rs` 是一个典型的“大胖子” Service (God Object)，承担了过多的职责，导致维护难度高、测试困难且与 Tauri 框架耦合过紧。

### 核心问题：
*   **职责不单一 (Mixed Responsibilities)**：同时处理微软 OAuth、Xbox 认证、Minecraft 协议、皮肤文件系统存储、本地皮肤库元数据维护、HTTP 错误解析等。
*   **强耦合 Tauri 运行时**：几乎所有函数都要求传入 `AppHandle<R>`，导致逻辑无法脱离 Tauri 环境进行独立单元测试。
*   **基础设施耦合**：业务逻辑中直接嵌套了 `reqwest` 的低级调用和 `std::fs` 的文件操作。
*   **全局单例风险**：`get_client()` 使用 `OnceLock` 虽然保证了性能，但使得 Mock 测试 HTTP 响应变得极其困难。
*   **硬编码严重**：API URL、客户端 ID、路径规则散落在各处。

---

## 2. 目标架构 (Target Architecture)
建议采用 **领域驱动设计 (DDD)** 的思想和 **六边形架构 (Hexagonal Architecture)**，将业务逻辑与具体的实现细节（HTTP、文件系统、Tauri）分离。

### 职责划分方案：
| 模块名称 | 职责 |
| :--- | :--- |
| `MicrosoftProvider` | 负责微软件设备码流、Token 交换与刷新。 |
| `XboxProvider` | 负责 XBL 和 XSTS 认证链路。 |
| `MinecraftClient` | 负责与 Mojang 官方 API 通信（Profile, Skin Upload, Cape）。 |
| `WardrobeManager` | 负责本地皮肤资产的增删改查、元数据 (JSON) 持久化。 |
| `AssetCache` | 负责物理文件的下载、本地缓存路径管理。 |
| `AuthService` (协调者) | 高层逻辑编排，调用上述模块完成登录或更新流程。 |

---

## 3. 具体解耦步骤

### Step 1: 定义基础设施 Trait (抽象)
首先抽象出认证和存储的接口，使得 `AuthService` 不再依赖具体的 `reqwest` 或 `fs`。

```rust
// 定义抽象接口，便于 Mock 测试
#[async_trait]
pub trait AuthConnector: Send + Sync {
    async fn request_json<T: DeserializeOwned>(&self, req: RequestBuilder) -> Result<T, String>;
    // ...
}

pub trait StorageProvider: Send + Sync {
    fn read_file(&self, path: &Path) -> Result<Vec<u8>, String>;
    fn write_file(&self, path: &Path, data: &[u8]) -> Result<(), String>;
    fn get_base_path(&self) -> PathBuf;
}
```

### Step 2: 提取 Microsoft & Xbox 协议层
将繁琐的 OAuth 流程移至专门的 Client。

```rust
pub struct MicrosoftAuthClient {
    client_id: String,
    http: Arc<dyn AuthConnector>,
}

impl MicrosoftAuthClient {
    pub async fn device_login(&self) -> Result<DeviceCodeResponse, String> { ... }
    pub async fn exchange_token(&self, code: &str) -> Result<MicrosoftTokenResponse, String> { ... }
}
```

### Step 3: 重构皮肤库逻辑 (WardrobeService)
目前的 `sync_active_runtime_skin_into_library` 和 `finalize_skin_library` 逻辑非常复杂（超过 300 行）。应将其封装为独立的元数据管理器。

*   **分离元数据与物理操作**：元数据库操作（JSON 更新）由 `SkinLibrary` 结构体处理，物理文件读写由 `Storage` 处理。
*   **引入 `PathResolver`**：专门负责计算 `runtime/accounts/{uuid}/skin.png` 这种路径逻辑，不再依赖 `ConfigService::get_base_path(app)` 直接散落在业务代码中。

### Step 4: 移除 Tauri 运行时依赖
将 `AppHandle` 的使用限制在最外层的 Tauri Command 层。

*   **现状**：`fn do_something<R: Runtime>(app: &AppHandle<R>, ...)`
*   **方案**：在初始化 Service 时，通过配置将 `base_path` 注入，而非在每个函数中通过 `AppHandle` 反查。这样 Service 就可以在没有窗口环境的情况下运行。

---

## 4. 优化后的代码结构建议

```text
src-tauri/src/services/auth/
├── mod.rs              // 统一导出 AuthService
├── microsoft.rs        // 微软/Xbox 协议实现
├── minecraft.rs        // Mojang API 客户端
├── wardrobe/
│   ├── mod.rs          // 皮肤库高层接口
│   ├── metadata.rs     // SkinMetadata 的 CRUD 逻辑
│   └── assets.rs       // 物理文件下载与缓存逻辑
└── paths.rs            // 集中式路径解析器
```

---

## 5. 解耦后的优势
1.  **可测试性 (Testability)**：可以编写单元测试，模拟微软服务器返回 401 错误，而无需真的联网。
2.  **可维护性 (Maintainability)**：如果未来 Minecraft 改变了皮肤上传的接口，只需修改 `minecraft.rs`，不会影响到认证逻辑。
3.  **逻辑清晰 (Readability)**：`auth_service.rs` 将从 1300 行缩减至约 300 行，仅保留核心协调逻辑。
4.  **性能优化**：`AssetCache` 可以更容易地引入异步并发下载或断点续传。

---

## 6. 建议 (Action Items)
*   **优先提取 `SkinMetadata` 相关逻辑**：这是目前代码中嵌套最深、逻辑最乱的部分（400行-1100行）。
*   **建立 `Domain Model`**：在 `crate::domain::auth` 中完善 `Account` 和 `SkinAsset` 的定义，减少对 `serde_json::Value` 的动态解析。
*   **引入 `thiserror` 或 `anyhow`**：目前的 `String` 错误链处理效率较低，建议改用结构化错误。
