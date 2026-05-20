# PiLauncher 同步 & 备份系统设计文档

## 1. 设计目标

PiLauncher 的同步系统需要满足：

* 多设备同步收藏数据
* 支持离线操作
* 避免数据覆盖
* 支持 WebDAV
* 支持未来扩展：

  * Mod 收藏
  * 整合包收藏
  * 游戏历史
  * 用户配置
* 尽可能降低同步冲突
* 不依赖中心数据库

---

# 2. 系统架构

采用：

# Append-Only Operation Log（追加式操作日志）

而不是直接同步最终 JSON。

---

# 3. 为什么不直接同步 favorites.json

错误示例：

```json
[
  "modA",
  "modB"
]
```

问题：

设备 A：

```json
["A", "B"]
```

设备 B：

```json
["A", "C"]
```

无法判断：

* B 是否被删除
* C 是否新增
* 哪个设备更新更晚

最终只能互相覆盖。

---

# 4. 核心设计思想

系统不记录：

```text
当前状态
```

而是记录：

```text
用户做过什么操作
```

例如：

```json
{
  "opId": "uuid",
  "targetId": "farmer-delight",
  "action": "add",
  "timestamp": 1747550000,
  "deviceId": "steamdeck-01"
}
```

---

# 5. 数据结构设计

## 5.1 Operation（操作）

```ts
interface FavoriteOperation {
  opId: string;
  targetId: string;
  action: "add" | "remove";

  timestamp: number;

  deviceId: string;
}
```

---

# 6. 本地存储结构

推荐目录：

```text
userdata/
└── sync/
    ├── device.json
    ├── favorites/
    │   ├── operations/
    │   │   ├── op-1.json
    │   │   ├── op-2.json
    │   │   └── ...
    │   └── snapshot.json
    └── sync-meta.json
```

---

# 7. Device ID 设计

首次启动生成：

```text
UUID v4
```

例如：

```json
{
  "deviceId": "7d2f98ef-xxxx"
}
```

永久保存。

禁止频繁变更。

---

# 8. 时间戳设计

统一使用：

```ts
Date.now()
```

单位：

```text
毫秒
```

禁止依赖：

* 文件修改时间
* WebDAV 时间
* 系统同步时间

---

# 9. WebDAV 目录结构

推荐：

```text
/PiLauncherSync/
└── favorites/
    ├── operations/
    │   ├── op-uuid-1.json
    │   ├── op-uuid-2.json
    │   └── ...
    └── snapshot.json
```

---

# 10. 为什么不用单文件同步

错误方案：

```text
favorites.json
```

原因：

* WebDAV 没有事务
* 并发上传容易覆盖
* 文件锁不可靠
* 同步失败容易损坏

---

# 11. 正确同步方式

采用：

# Append-Only

每次操作：

```text
新增一个 operation 文件
```

例如：

```text
op-1747550000-uuid.json
```

这样：

* 不会覆盖
* 不会冲突
* 上传失败影响小
* 容易恢复

---

# 12. 同步流程

## 12.1 上传流程

用户点击收藏：

```text
生成 operation
↓
写入本地
↓
上传 WebDAV
```

---

## 12.2 下载流程

同步时：

```text
拉取远程 operation 列表
↓
下载缺失 operation
↓
本地 merge
↓
重建最终状态
```

---

# 13. 去重设计

根据：

```text
opId
```

去重。

如果：

```text
opId 已存在
```

则跳过。

---

# 14. 收藏状态重建

## 14.1 算法

同一个目标：

```text
最后一条操作生效
```

即：

# Last Write Wins（LWW）

---

## 14.2 示例

操作记录：

```text
10:00 add
10:05 remove
10:10 add
```

最终状态：

```text
已收藏
```

---

# 15. 删除同步（墓碑机制）

删除不能直接移除数据。

必须记录：

```json
{
  "action": "remove"
}
```

否则无法区分：

* 未同步
* 已删除

这叫：

# Tombstone（墓碑）

---

# 16. Snapshot（快照）

长期运行后：

```text
operation 文件会越来越多
```

需要快照。

---

## 16.1 Snapshot 示例

```json
{
  "version": 1,
  "favorites": [
    "modA",
    "modB"
  ],
  "lastTimestamp": 1747559999
}
```

---

# 17. Snapshot 生成时机

推荐：

* 每 100 次操作
* 或每 7 天
* 或启动时自动整理

---

# 18. Snapshot 后的处理

生成 snapshot 后：

```text
删除旧 operation
保留 snapshot 之后的新操作
```

---

# 19. 冲突处理策略

本系统采用：

# 时间优先

而不是：

* 设备优先
* 文件优先
* 上传顺序优先

---

# 20. 为什么不用文件时间

因为：

* WebDAV 时间可能被修改
* 时区可能不同
* 某些服务器时间错误
* 云盘可能重写时间

---

# 21. 离线支持

本地永远可操作。

离线期间：

```text
继续记录 operation
```

联网后：

```text
自动同步
```

---

# 22. 同步失败恢复

因为是 append-only：

即使：

* 上传失败
* 中途断网
* 部分文件缺失

也不会破坏已有数据。

---

# 23. 数据损坏恢复

即使 snapshot 损坏：

仍然可以：

```text
重新扫描 operations
```

恢复状态。

---

# 24. 推荐同步频率

建议：

| 场景    | 同步     |
| ----- | ------ |
| 启动时   | 同步     |
| 收藏操作后 | 立即同步   |
| 后台    | 每 5 分钟 |
| 退出前   | 同步     |

---

# 25. 安全建议

建议：

## HTTPS WebDAV

禁止：

```text
HTTP 明文
```

---

## Token 登录

尽量避免：

```text
用户名密码明文保存
```

---

# 26. 后续可扩展能力

该架构未来可扩展：

* Mod 收藏
* 整合包同步
* 最近启动记录
* 游戏时间
* 配置同步
* 云备份
* 多用户

---

# 27. 为什么不使用数据库同步

原因：

PiLauncher 更适合：

* 轻量
* 离线优先
* 无服务器
* 自托管友好

WebDAV 足够满足需求。

---

# 28. 不建议现在实现的内容

现阶段不要做：

* 实时协同
* CRDT
* 向量时钟
* P2P 同步
* WebSocket 实时广播

复杂度远大于收益。

---

# 29. 最终推荐方案

PiLauncher 推荐采用：

# WebDAV + Append-Only Operation Log + LWW

特点：

* 稳定
* 易恢复
* 易调试
* 冲突少
* 支持离线
* 易扩展

非常适合启动器场景。
