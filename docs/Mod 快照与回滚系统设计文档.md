# PiLauncher: Mod 快照与回滚系统设计文档 (纯 Rust 架构版)

## 1. 系统概述

本系统旨在为 Minecraft 游戏实例提供类似 Git 的 Mod 版本控制能力。采用**“胖后端，瘦前端”**的架构设计：所有的文件 I/O、哈希计算、状态持久化与差异比对（Diff）完全由 Rust 侧（Tauri 后端）接管处理；前端（React / OreUI）仅作为只读视图与指令下发器，不参与任何底层逻辑操作。

### 1.1 核心设计原则
* **CAS 内容寻址存储：** 全局缓存池依据 SHA-256 存储 Mod 实体，实现跨实例的文件级去重。
* **零拷贝机制：** 游戏实例目录仅存放指向全局缓存的硬链接（Hard Links），创建和回滚快照均无实质性的大文件拷贝，实现秒级响应。
* **Rust 绝对主导：** 前端不引入文件系统权限，杜绝因 UI 线程阻塞或异常导致的文件损坏。
* **原子化操作：** 状态回滚采用临时目录构建后原子替换（Rename）的策略，确保极端情况（断电、进程崩溃）下实例目录的完整性。

## 2. 存储与目录架构

数据存储严格隔离为“全局缓存”与“实例沙盒”。

```text
PiLauncher_Data/
├── shared_mods/
│   └── mods/                   <-- 全局 CAS 缓存池 (仅 Rust 可读写)
│       ├── [SHA256_A].jar      (实体文件)
│       └── [SHA256_B].jar
└── instances/
    └── my_instance/            <-- 游戏实例
        ├── piconfig/           <-- PiLauncher 实例配置文件目录
        │   └── snapshots/      <-- 快照元数据目录
        │       └── 1710000000.json (纯 JSON 状态记录)
        └── mods/               <-- 实际映射目录 (供游戏引擎读取)
            ├── fabric-api.jar  ==> [Hard Link] -> shared_mods/mods/[SHA256_A].jar
            └── sodium.jar      ==> [Hard Link] -> shared_mods/mods/[SHA256_B].jar
```

## 3. 核心数据结构

前后端交互的核心契约，由 Rust 定义并在前端生成对应的 TypeScript 接口。

### 3.1 实体模型 (Rust / Serde)

```rust
use serde::{Deserialize, Serialize};

/// 单个 Mod 文件的状态记录
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub struct ModEntry {
    pub hash: String,           // SHA-256 (也是缓存池文件名)
    pub file_name: String,      // 在 mods/ 目录下的显示名称
    pub mod_id: Option<String>, // 平台关联 ID (如 Modrinth ID)
    pub version: Option<String>,// Mod 版本号
}

/// 快照元数据主体
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstanceSnapshot {
    pub id: String,             // 快照唯一标识 (如时间戳)
    pub timestamp: i64,         // Unix 毫秒时间戳
    pub trigger: String,        // 触发器枚举 ("USER_MANUAL", "PRE_UPDATE", "EXTERNAL_CHANGE")
    pub message: String,        // 变更说明
    pub mods: Vec<ModEntry>,    // 完整状态列表
}

/// 差异比对结果 (供前端直接渲染)
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotDiff {
    pub added: Vec<ModEntry>,
    pub removed: Vec<ModEntry>,
    pub updated: Vec<ModUpdatePair>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModUpdatePair {
    pub old: ModEntry,
    pub new: ModEntry,
}
```

## 4. 核心工作流逻辑 (Rust 侧实现)

所有核心工作流在 Rust 侧使用 `tokio` 异步执行。

### 4.1 创建快照 (Take Snapshot)
1. **指令接收：** 接收来自前端的实例 ID 和变更备注。
2. **状态扫描：** 扫描目标实例的 `mods/` 目录。
3. **哈希与缓存：** - 过滤出未存在于全局 `shared_mods/mods/` 的新文件。
   - 分块计算 SHA-256 哈希值，计算期间通过 Tauri Events 发送进度以供前端渲染进度条。
   - 将新文件移动到全局缓存池，并在原位置创建硬链接。
4. **状态固化：** 组装 `InstanceSnapshot` 结构体，序列化为 JSON 并写入实例的 `.snapshots/` 目录。

### 4.2 计算差异 (Calculate Diff)
1. **内存加载：** 根据前端传入的 `old_snapshot_id` 和 `new_snapshot_id` 读取 JSON 文件。
2. **集合比对：** - 利用 `HashSet` 基于 `hash` 字段进行 O(N) 复杂度的差集运算。
   - 处理更新逻辑：若 `hash` 改变但 `mod_id` 相同，则归入 `updated` 队列。
3. **结果下发：** 将计算完毕的 `SnapshotDiff` 结构返回给前端，前端直接进行视图映射（红、绿、黄高亮）。

### 4.3 实例回滚 (Rollback Transaction)
**严格遵循原子事务机制：**
1. **预检：** 确认该实例的 Java 进程未在运行。
2. **构建沙盒：** 在实例目录下创建隐藏临时目录 `.mods_temp/`。
3. **状态重建：** 解析目标快照 JSON，根据记录的哈希值，从全局缓存向 `.mods_temp/` 创建所有必须的硬链接。
4. **原子替换：** - 尝试删除旧的 `mods/` 目录。
   - 立即将 `.mods_temp/` 重命名（`fs::rename`）为 `mods/`。
   - *(注：若在此过程中断电，下次启动时检测到 `.mods_temp` 存在而 `mods` 缺失，可通过恢复机制自愈。)*

## 5. Tauri API 接口设计

前端仅需调用以下 Command 即可驱动整个系统。

| Command (Rust) | 参数说明 | 返回值 / 作用 |
| :--- | :--- | :--- |
| `get_snapshot_history` | `instance_id: String` | `Result<Vec<InstanceSnapshot>, Error>` 获取时间轴 |
| `take_snapshot` | `instance_id: String`, `trigger: String`, `message: String` | `Result<InstanceSnapshot, Error>` 触发快照创建 |
| `calculate_snapshot_diff` | `instance_id: String`, `old_id: String`, `new_id: String` | `Result<SnapshotDiff, Error>` 获取两个快照的变更差异 |
| `rollback_instance` | `instance_id: String`, `snapshot_id: String` | `Result<(), Error>` 触发实例目录硬链接重建 |

**后端主动推送事件 (Events):**
* `snapshot-progress`: 在执行 `take_snapshot` 时，推送当前处理进度 `{ current: usize, total: usize, file: String }`。

## 6. 安全防御与清理机制

### 6.1 外部修改防御 (Pre-launch Guard)
**场景：** 用户通过 Windows 资源管理器直接删改了 `mods` 文件夹的内容。
**机制：**
Rust 后端在执行启动游戏指令（Launch Event）拦截点，强制执行快速比对。如果发现当前 `mods/` 目录的内容与最新一份 `.json` 快照不符，系统自动静默执行一次 `take_snapshot`（Trigger 标记为 `EXTERNAL_CHANGE`），建立“收容快照”，然后再允许游戏启动。这确保了玩家胡乱修改后，永远有一份“修改前”的安全快照可以回滚。

### 6.2 垃圾回收 (Garbage Collection)
全局 CAS 缓存池缺乏自动清理会导致无用文件堆积。
**机制：**
实现一个后台/手动的 GC 指令。
1. **标记阶段：** 遍历所有实例的所有 `snapshot.json`，将其中引用的 `hash` 存入一个全局 `HashSet`。
2. **清除阶段：** 扫描 `shared_mods/mods/`，对不在 `HashSet` 中的 `.jar` 文件执行 `fs::remove_file` 物理删除。

## 7. 性能优化：并行哈希与流式处理

当玩家拥有数百个 Mod（如大型整合包）时，单线程哈希会造成明显的 UI 阻塞感。

* **并行计算 (Parallel Hashing):** 使用 Rust 的 `rayon` 库或 `tokio` 的线程池。在 `take_snapshot` 阶段，利用多核 CPU 并行计算多个 Mod 的 SHA-256。
* **增量哈希检查:** 在 `shared_mods/mods` 目录中维护一个小型数据库（如 `Sled` 或简单的 `hashes.json`），记录 `(文件路径, 修改时间, 文件大小) -> Hash` 的映射。如果文件元数据未变，直接跳过哈希计算。
* **内存映射 (Mmap):**
    对于较大的 Mod 文件，在 Rust 侧使用 `memmap2` 库进行哈希扫描，以减少内存拷贝开销。

## 8. 容错与自愈机制 (Data Integrity)

由于系统强依赖于硬链接和 CAS 缓存，一旦缓存池文件损坏，所有实例都会受影响。

### 8.1 缓存一致性校验 (Scrubbing)
* **设计：** 提供一个“深度校验”功能。Rust 遍历 `shared_mods/mods/` 下的所有文件，重新计算哈希并与文件名对比。
* **处理：** 若哈希不匹配，标记该 Mod 为 `Corrupted`，并提示玩家重新从远程（Modrinth/CurseForge）下载，或提示手动修复。

### 8.2 快照链损坏恢复
* 若某个 `.json` 快照文件丢失或损坏，系统应能通过扫描 `mods/` 目录现存的硬链接，逆向推导出一个“紧急恢复快照”。

## 9. 扩展功能：快照导出与分发 (.pisnap)

既然已经有了完整的快照元数据，可以进一步将其转化为“实例备份”功能。

* **便携式导出：** 允许用户选择一个快照，Rust 后端将 `snapshot.json` 及其引用的所有 `.jar` 实体打包成一个 `.zip` 或自定义后缀 `.pisnap` 的文件。
* **一键克隆：** 其他 PiLauncher 用户可以直接导入该文件，启动器解析 JSON 后自动填充本地 CAS 缓存，实现“环境一键复现”。

## 10. 前端 OreUI 状态机设计

为了配合纯 Rust 后端的异步特性，前端需要维护一套严谨的 UI 状态，防止用户在执行 I/O 操作时进行冲突操作。

| 状态 (State) | 禁止的操作 | OreUI 视觉表现 |
| :--- | :--- | :--- |
| **Idle** | 无 | 正常显示列表，回滚按钮可用。 |
| **Snapshotting** | 禁止删除 Mod、禁止启动游戏 | 侧边栏出现 Loading 进度条，显示“正在计算哈希...”。 |
| **Rolling Back** | 禁止所有文件操作、屏蔽 UI 交互 | 全屏半透明遮罩，显示“正在重构链接，请稍候...”。 |
| **Verifying** | 禁止启动游戏 | Mod 列表项出现校验中的动画图标。 |

---

### 11. 总结：系统安全性考量 (Security)

1.  **路径过滤：** Rust 后端在处理 `instance_id` 时，必须进行路径合法性检查，防止通过 `../` 注入攻击访问到系统关键目录。
2.  **符号链接与硬链接选择：** * **硬链接 (Hard Link):** 优点是删除原始文件不影响链接，安全性更高。缺点是不能跨磁盘分区。
    * **符号链接 (Symlink):** 优点是灵活，但如果全局缓存被移动，链接会失效。
    * **建议：** 默认使用硬链接，若检测到实例与缓存不在同一分区，则降级为符号链接或提醒用户。

