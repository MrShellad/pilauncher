# Minecraft 启动器存档备份与恢复系统设计文档（JSON版）

---

# 一、设计目标

本方案采用 **纯文件 + JSON 元数据**，不依赖数据库，实现：

* ✔ 可直接复制整个备份目录迁移
* ✔ 人类可读（便于排查 / 手动修改）
* ✔ 简单稳定（避免数据库损坏问题）
* ✔ 为未来扩展（云同步）保留结构

---

# 二、核心设计理念

> **备份 = 世界数据 + Mod环境指纹 + 配置环境 + 元数据描述**

不是单纯 zip 文件。

---

# 三、目录结构设计（核心）

```text
/backups/
  └── {instanceId}/
        └── {worldUUID}/
              └── {backupId}/
                    ├── world/          # 存档内容
                    ├── configs/        # 配置文件
                    ├── meta.json       # 元数据
                    └── preview.png     # (可选) 世界截图
```

---

## 设计说明

* ❗ 每个备份一个独立文件夹（不要用单一 zip）
* ❗ 避免压缩 → 提升速度 + 可读性
* ❗ backupId 使用 UUID，避免冲突

---

# 四、meta.json 设计（核心）

## 示例

```json
{
  "backupId": "uuid-xxx",
  "instanceId": "instance-1",

  "world": {
    "name": "World1",
    "uuid": "world-uuid"
  },

  "createdAt": 1710000000,
  "trigger": "auto_exit",

  "game": {
    "mcVersion": "1.20.1",
    "loader": "fabric"
  },

  "environment": [
    {
    "modsname": "abc",
    "modsHash": "abc123",
    "configHash": "def456"
  }
  ],

  "files": {
    "worldSize": 12345678,
    "configSize": 45678
  },

  "state": {
    "safeBackup": true
  },

  "user": {
    "note": "打龙前",
    "tags": ["关键节点"]
  }
}
```

---

# 五、Mod 与配置策略（关键）

## 5.1 Mod 处理

### ❌ 不做

* 不备份 `/mods`

### ✅ 只记录环境指纹

```json
{
  "modsHash": "hash"
}
```

---

### Hash 生成规则

```text
1. 获取所有 mod 文件
2. 提取 fileId / 文件名
3. 排序
4. 拼接
5. hash
```

---

## 5.2 configs 处理

### ✅ 必须备份

路径：

```text
/config/
/defaultconfigs/
```

---

### 恢复策略

| 模式       | 行为          |
| -------- | ----------- |
| 安全模式（默认） | 不覆盖 configs |
| 完整模式     | 覆盖 configs  |

---

# 六、备份流程设计

## 6.1 标准流程

```text
点击备份
 → 检测游戏是否运行
 → 复制 world（快照）
 → 复制 configs
 → 生成 meta.json
 → 写入备份目录
```

---

## 6.2 游戏运行中备份

```text
world → 先复制 → 再处理
safeBackup = false
```

---

## 6.3 自动备份触发

支持：

```text
- manual（手动）
- auto_exit（退出游戏）
- auto_interval（定时）
```

---

# 七、恢复流程设计（重点）

## 7.1 标准流程

```text
选择备份
 → 读取 meta.json
 → 校验环境（mcVersion / loader）
 → 提示风险
 → 自动备份当前 world（必须）
 → 删除当前 world
 → 拷贝备份 world
 → （可选）恢复 configs
```

---

## 7.2 环境校验

```text
当前实例 vs 备份：

- mcVersion
- loader
- modsHash
```

---

### 不一致提示

```text
⚠ Mod环境或版本不同，可能导致存档损坏
```

---

## 7.3 configs 恢复选项

```text
[ ] 同时恢复配置文件（高级选项）
```

---

# 八、空间管理策略

## 8.1 限制规则

```text
- 最大备份数（默认20）
- 或最大空间（默认2GB）
```

---

## 8.2 清理策略

```text
按 createdAt 删除最旧
```

---

# 九、文件安全策略

## 9.1 原子写入

```text
写入 temp 目录 → rename
```

---

## 9.2 校验机制（可选）

```json
{
  "checksum": "sha1"
}
```

---

# 十、UI 设计建议

## 10.1 列表展示

```text
World1

[立即备份]

- 03-29 03:21（退出）
- 03-29 02:50（自动）
- 03-28 22:10（手动 ⭐ 打龙前）
```

---

## 10.2 操作

* 恢复
* 删除
* 重命名
* 添加备注

---

## 10.3 恢复弹窗

```text
⚠ 将覆盖当前存档

✔ 自动备份当前状态
[ ] 恢复配置文件

[确认恢复]
```

---

# 十一、扩展能力（已预留）

## 11.1 云同步

* 上传整个 backup 文件夹
* meta.json 作为索引

---

## 11.2 增量备份（未来）

* world diff
* configs diff

---

## 11.3 自动补 Mod（未来）

* 根据 modsHash
* 调用 CurseForge / Modrinth API

---

# 十二、优缺点总结

## 优点

```text
✔ 可直接复制迁移
✔ 无数据库依赖
✔ 易调试
✔ 结构清晰
```

---

## 缺点

```text
❌ 查询性能较弱
❌ 文件数量较多
❌ 同步冲突较难处理
```

---

# 十三、总结

> **本方案本质是“文件化快照系统”，强调可迁移性与稳定性，而非复杂数据管理**

核心原则：

* 每个备份独立目录
* JSON 驱动
* 环境感知（mods + configs）
* 恢复前强制备份

---

（适用于：单机启动器 / 轻量同步 / 高可迁移场景）
