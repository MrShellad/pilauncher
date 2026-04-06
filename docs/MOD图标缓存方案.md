
---

# 📄 MOD列表图标拉取与缓存系统设计文档（完整版本）

---

# 1. 🎯 设计目标

为 MOD 列表提供稳定、高性能的图标加载能力：

### 功能目标

* 展示 MOD 图标（支持多来源）
* 支持缓存（避免重复下载）
* 支持离线访问

### 性能目标

* 列表滚动流畅（60FPS）
* 首屏快速渲染（≤100ms）
* 控制网络并发
* 避免重复请求

---

# 2. 🧠 设计原则（非常关键）

### 2.1 渐进加载（Progressive Rendering）

```text
占位图 → 缓存图 → 高清图
```

---

### 2.2 不阻塞 UI

* 所有 IO（磁盘 / 网络）必须异步
* UI 立即渲染

---

### 2.3 统一调度（核心思想）

👉 **所有 icon 请求必须走统一 IconService**

---

### 2.4 缓存是“加速器”，不是“依赖”

* 没缓存也能工作
* 有缓存更快

---

# 3. 🧱 系统架构

```text
ModList UI（虚拟列表）
        ↓
IconService（统一调度）
        ↓
 ┌───────────────┐
 │ Memory Cache  │
 └───────────────┘
        ↓
 ┌───────────────┐
 │ SQLite(DB)    │
 └───────────────┘
        ↓
 ┌───────────────┐
 │ File System   │
 └───────────────┘
        ↓
     Network
```

---

# 4. 🧩 模块设计

---

## 4.1 IconService（核心入口）

### 职责

* 对 UI 提供统一接口
* 调度缓存 / 下载
* 控制优先级与并发

### 接口

```ts
getIcon(mod: ModInfo, priority: Priority): Promise<IconResult>
```

---

## 4.2 MemoryCache（一级缓存）

### 结构

```ts
Map<key, ImageBitmap>
```

### 策略

* LRU
* 容量：100~300

### 作用

👉 决定滚动是否流畅（最关键）

---

## 4.3 CacheDB（SQLite）

### 表结构

```sql
CREATE TABLE icon_cache (
  key TEXT PRIMARY KEY,

  mod_id TEXT,
  source TEXT,

  file_path TEXT,
  file_size INTEGER,

  etag TEXT,
  last_modified TEXT,

  status TEXT, -- ready / downloading / failed

  created_at INTEGER,
  last_access INTEGER
);
```

---

## 4.4 FileStore（磁盘）

### 目录结构

```bash
cache/icons/
  ab/
    abcdef123456.png
```

### 规则

* key 前2位分桶
* 避免单目录爆炸

---

## 4.5 DownloadQueue（下载队列）

### 参数

```text
最大并发：4~8
```

### 数据结构

```ts
queue: PriorityQueue<Task>
downloadingMap: Map<key, Promise>
```

---

# 5. 🔑 Key 设计

```text
key = sha1(icon_url)
```

### 原因

* 去重
* 支持多来源
* URL变化自动更新

---

# 6. 🔄 核心流程

---

## 6.1 单个图标请求流程

```text
1. 查 Memory
   → 命中 → 返回

2. 查 DB
   → ready → 读文件 → 写入 Memory → 返回

3. 文件不存在
   → 标记下载

4. 加入下载队列
   → 下载完成 → 更新 DB + Memory

5. UI 更新
```

---

## 6.2 列表加载流程

```text
1. 渲染占位图

2. 获取可视区域
   → 请求 icon（高优先级）

3. 预加载上下区域
   → 中优先级

4. 其他
   → 低优先级
```

---

# 7. 🚀 优先级调度

### 优先级定义

```text
HIGH   → 当前可见
MEDIUM → 即将进入视口
LOW    → 预加载
```

---

# 8. ⚡ 并发与去重

---

## 8.1 下载去重

```ts
if (downloadingMap.has(key)) {
  return existingPromise
}
```

---

## 8.2 队列执行

```text
同时最多 N 个下载任务
```

---

# 9. 📦 缓存策略

---

## 9.1 命中条件

```text
DB存在 + 文件存在 + status=ready
```

---

## 9.2 过期策略

### 简单版

```text
7天过期
```

---

## 9.3 LRU 清理

触发条件：

```text
缓存 > 200MB
```

执行：

```sql
DELETE FROM icon_cache
ORDER BY last_access ASC
LIMIT 100;
```

---

# 10. ⚠️ 异常处理

---

## 10.1 下载失败

```text
status = failed
```

处理：

* 返回默认图标
* 延迟重试

---

## 10.2 文件丢失

```text
DB有但文件没了
→ 重新下载
```

---

## 10.3 网络异常

* fallback 占位图
* 不阻塞 UI

---

# 11. 🎨 UI设计规范（关键体验）

---

## 11.1 占位图策略

```text
灰色块 → 模糊图 → 高清图
```

---

## 11.2 虚拟列表（必须）

👉 否则：

* DOM爆炸
* FPS下降

---

## 11.3 懒加载

```text
只加载可见区域 + buffer
```

---

## 11.4 批量更新

```text
每帧合并更新（16ms）
```

---

# 12. 📈 性能优化点

---

## 必做

* Memory Cache
* 下载队列
* 去重

---

## 进阶

* WebP 转码
* 预加载策略
* 批量 DB 查询

---

# 13. 🔮 扩展设计

未来扩展统一缓存：

```text
cache.db
├── icon_cache
├── screenshot_cache
├── mod_file_cache
├── api_cache
```

---

# 14. 🧪 测试方案

---

## 场景

* 100+ mod 列表
* 弱网
* 离线
* 滚动测试

---

## 指标

* 首屏时间
* FPS
* 请求数
* 命中率

