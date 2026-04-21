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

### 4.1 时长捕获 (Local Capture)
1. 游戏结束时，计算本次时长 `delta`。
2. 更新本地数据库：`playtime_secs += delta`, `pending_delta += delta`。

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

## 6. 后续扩展
- **多实例识别**：通过实例目录下的核心指纹（如 Modpack 签名）识别不同设备上的“同一个游戏”，即使它们的文件夹名称不同。
- **隐私选项**：支持加密存储 WebDAV 上的 JSON 数据。

