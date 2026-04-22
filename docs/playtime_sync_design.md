# 游戏时长统计与多设备同步设计文档

## 1. 概述
本方案旨在为 PiLauncher 实现精确的游戏时长统计功能，并支持在多个设备（如 PC、Steam Deck、联想拯救者等）之间无缝同步统计数据。

## 2. 核心架构
采用 **“本地优先 (Local-First) + WebDAV 文件同步”** 的架构。

- **本地端 (Rust Backend)**：负责实时捕捉时长并持久化至本地 SQLite 数据库及 `instance.json`。
- **存储提供商 (WebDAV)**：用户可配置自定义 WebDAV 服务（如 Nextcloud, Alist, 坚果云等），作为数据的云端中转站。
- **无中心化服务**：无需 PiLauncher 提供专用服务器，数据所有权完全归用户所有。

## 3. 数据模型设计

### 3.1 本地存储 (SQLite)
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | TEXT | 实例唯一标识 (UUID) |
| `playtime_secs` | INTEGER | 该实例总时长（秒） |
| `last_played_at` | DATETIME | 上次运行结束时间 |
| `pending_delta` | INTEGER | 尚未同步至 WebDAV 的增量时长 |

### 3.2 WebDAV 目录结构
```text
/PiLauncher/playtime/
  ├── devices.json         # 设备列表（ID、名称、最后同步时间）
  └── stats/
      ├── {device_A_id}.json  # 设备 A 的时长快照
      ├── {device_B_id}.json  # 设备 B 的时长快照
      └── ...
```

## 4. 功能逻辑流程

### 4.1 时长捕获机制 (Capture Mechanism)

为了确保在游戏崩溃、启动器异常退出等情况下时长依然准确，采用 **“起止时间校验 + 周期性心跳”** 的混合方案：

1.  **起止时间法 (Process Lifetime)**：
    - 在 `cmd.spawn()` 时记录 `start_time`。
    - 在 `child.wait()` 异步等待结束后记录 `end_time`。
    - 计算 `delta = end_time - start_time`。
2.  **心跳增量法 (Heartbeat Update)**：
    - 在游戏运行期间，启动器后台开启一个每 `60秒` 触发一次的定时器。
    - 每次心跳自增内存中的 `session_delta`。
    - 每 5 分钟（或游戏结束时）将 `session_delta` 持久化至 SQLite 的 `playtime_secs` 和 `pending_delta`。
3.  **异常处理**：
    - 若 `child.wait()` 正常结束，以“起止时间法”为准更新最终数据。
    - 若启动器意外崩溃，下次启动时根据心跳残留的持久化数据进行恢复，最大限度减少误差。

### 4.2 WebDAV 同步方案 (去中心化冲突解决)
为了避免多个设备直接修改同一个文件导致的覆盖冲突，采用 **“一机一档”** 策略：

1. **推送 (Push)**：
   - 客户端仅负责更新属于自己 `device_id` 的文件：`stats/{my_device_id}.json`。
   - 文件内容包含：该设备上所有实例的时长汇总。
2. **拉取与合并 (Pull & Merge)**：
   - 启动或刷新时，扫描 `stats/` 目录下所有其他设备的文件。
   - **计算总时长**：`Instance_Total = Sum(Instance_Playtime across ALL device files)`。
   - 该逻辑确保了在多设备非同时在线的情况下，时长依然能正确累加。

### 4.3 离线与同步触发
- **自动同步**：游戏结束、应用启动、每隔 60 分钟自动同步。
- **离线模式**：WebDAV 不可用时，数据暂存在 `pending_delta`，待联网后自动上传最新快照。

## 5. 设备管理
- **唯一标识**：客户端首次运行随机生成 `device_id`。
- **设备命名**：用户可手动命名设备（如 "Steam Deck", "Work-PC"），时长界面可展示时长来源分布。

## 6. 时长统计与聚合方案

### 6.1 聚合逻辑 (Aggregation Logic)
为了实现准确的跨设备统计，采用“全量累加”算法。

1.  **实例总时长 (Instance Total Playtime)**:
    - 定义：该实例在所有设备上游玩时长的总和。
    - 公式：`Playtime_Total(id) = Playtime_Local(id) + Σ Playtime_Remote(id, device_i)`。
    - *注：`Playtime_Local` 来自本地 SQLite，`Playtime_Remote` 来自 WebDAV 上其他设备的 JSON 快照。*

2.  **启动器总时长 (Global Total Playtime)**:
    - 定义：用户使用 PiLauncher 游玩所有游戏的总时长。
    - 公式：`Global_Total = Σ Playtime_Total(all_instances) + Offset_Manual`。
    - *注：`Offset_Manual` 用于支持从其他启动器导入的时长补偿。*

### 6.2 同步快照格式 (`stats/{device_id}.json`)
```json
{
  "device": {
    "id": "uuid-xxxx",
    "name": "Steam Deck",
    "last_sync": "2024-04-22T10:00:00Z"
  },
  "instances": {
    "{instance_uuid_1}": {
      "name": "Fabric 1.20.1",
      "playtime": 3600,
      "last_played": "2024-04-22T09:00:00Z"
    }
  },
  "device_total": 3600
}
```

### 6.3 UI 展示方案
- **实例卡片/详情**：展示 `总时长`（聚合值），并在详情页提供 `本设备 / 其他设备` 的时长分布说明。
- **全局统计面板**：展示 `Global_Total` 及游玩趋势图。

## 7. 后续扩展
- **多实例识别**：通过实例目录下的核心指纹（如 Modpack 签名）识别不同设备上的“同一个游戏”，即使它们的文件夹名称不同。
- **隐私选项**：支持加密存储 WebDAV 上的 JSON 数据。

