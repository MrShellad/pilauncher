

# 🚀 PiLauncher v2.1 设计文档（模块化 + 多 Runtime）

---

# 一、设计升级目标

在 v2 基础上新增：

> ✅ **多 Runtime 支持（复用 PCL / HMCL / 官方资源）**
> ✅ **避免重复下载 libraries / assets / versions**
> ✅ **实例完全隔离，资源完全共享**

---

# 🧠 核心设计原则（新增重点）

---

## 1️⃣ 实例与资源彻底分离

```text
Instance = 用户数据（mods/config/saves）
Runtime = 游戏资源（libraries/assets/versions）
```

---

## 2️⃣ Runtime 可多源（关键）

```text
PiLauncher Runtime
+ 外部 .minecraft（PCL/HMCL）
```

---

## 3️⃣ Runtime 默认只读（防炸）

```text
External Runtime = 只读
Managed Runtime = 可写
```

---

# 二、总体架构（升级版）

```text
PiLauncher
│
├── Core
│   ├── Instance Manager
│   ├── Runtime Manager   ← 🆕
│   ├── Version Resolver
│   ├── Library Resolver
│   ├── Asset Manager
│   ├── Native Manager
│   ├── Classpath Builder
│   ├── Argument Builder
│   └── Process Launcher
│
└── Plugins
```

---

# 三、目录结构（重构）

```text
PiLauncher/
├── runtimes/                 ← 🆕 多 runtime
│   ├── default/
│   │   ├── libraries/
│   │   ├── assets/
│   │   └── versions/
│   │
│   └── external/         ← 指向 .minecraft
│
├── instances/
│   ├── instanceA/
│   │   ├── mods/
│   │   ├── config/
│   │   ├── saves/
│   │   └── instance.json
│
└── cache/
```

---

# 四、核心数据结构（升级）

---

## 📦 Runtime（新增核心）

```rust
struct Runtime {
    id: String,
    root: PathBuf,

    libraries: PathBuf,
    assets: PathBuf,
    versions: PathBuf,

    source: RuntimeSource,
}
```

---

## 📦 RuntimeSource

```rust
enum RuntimeSource {
    Managed,              // PiLauncher 自己维护
    External(PathBuf),    // 外部 .minecraft
}
```

---

## 📦 Instance（升级）

```rust
struct Instance {
    id: String,
    game_dir: PathBuf,

    version_id: String,
    loader: Option<LoaderType>,

    runtime_id: String,   // 🆕 指定 runtime

    mods: Vec<Mod>,
    config: InstanceConfig,
}
```

---

# 五、Runtime Manager（新增模块）

---

## 🎯 责任

* 管理所有 runtime
* 支持多 runtime 查找
* 提供资源解析接口

---

## 核心接口

```rust
struct RuntimeManager {
    runtimes: Vec<Runtime>,
}
```

---

## 🔍 资源查找（核心逻辑）

```rust
fn find_library(&self, lib: &Library) -> Option<PathBuf> {
    for runtime in &self.runtimes {
        let path = runtime.libraries.join(lib.path());

        if path.exists() {
            return Some(path);
        }
    }

    None
}
```

---

## 🧠 查找顺序（重要）

```text
1️⃣ Instance override（可选）
2️⃣ External runtime（PCL）
3️⃣ Managed runtime
```

---

# 六、核心流程（升级版）

---

## 🔥 启动流程（重点变化）

```text
Instance
   ↓
Runtime Manager（选择 runtime）
   ↓
Version Resolver
   ↓
Loader Plugin
   ↓
Library Resolver（多 runtime 查找） ← 🆕
   ↓
Native Extract
   ↓
Classpath Builder
   ↓
Launch
```

---

# 七、Library Resolver（关键修改）

---

## ❗ 新逻辑

```rust
fn resolve_library(lib: &Library) -> PathBuf {
    // 1. 查找 runtime
    if let Some(path) = runtime_manager.find_library(lib) {
        return path;
    }

    // 2. 不存在 → 下载到 managed runtime
    let path = download_to_managed(lib);

    path
}
```

---

## ✅ 效果

* 已有资源 → 不下载
* 缺失资源 → 自动补齐

---

# 八、Assets 处理（复用关键）

---

## 启动参数

```bash
--assetsDir /runtime/assets
```

---

## ❗ 规则

* 所有实例共享 assets
* 不复制 assets

---

# 九、Versions 处理（重点）

---

## 查找逻辑

```rust
fn find_version(version_id: &str) -> Option<PathBuf> {
    for runtime in runtimes {
        let path = runtime.versions.join(version_id);

        if path.exists() {
            return Some(path);
        }
    }

    None
}
```

---

## ❗ 不要做

```text
❌ 不要复制 version.json
❌ 不要重建 forge 版本
```

---

# 十、Classpath 构建（升级）

---

## 新来源

```text
libraries（来自 runtime）
+ version.jar（来自 runtime）
+ loader patch
```

---

## 示例

```bash
-cp /pcl/.minecraft/libraries/...:/runtime/libraries/...
```

---

# 十一、External Runtime 兼容（重点）

---

## 支持来源

* PCL `.minecraft`
* HMCL `.minecraft`
* 官方启动器

---

## 接入方式

```rust
Runtime {
    id: "pcl",
    source: External("/home/user/.minecraft"),
}
```

---

## ❗ 限制

```text
✔ 只读
❌ 不写入
```

---

# 十二、冲突与安全策略

---

## ⚠️ 1. 多启动器同时运行

👉 风险：文件写冲突

---

### 解决

```text
External runtime → 只读
Managed runtime → 写入
```

---

## ⚠️ 2. 文件损坏

👉 加：

```rust
sha1 校验（可选）
```

---

# 十三、性能优化（新增）

---

## ✅ 1. 避免重复下载

```rust
if path.exists() {
    skip
}
```

---

## ✅ 2. 多 runtime 命中

👉 优先 external

---

## ✅ 3. 缓存解析结果

---

# 十四、你当前问题对照（修复说明）

---

## 你之前的问题：

| 问题       | 解决方式             |
| -------- | ---------------- |
| lwjgl 缺失 | runtime 查找       |
| 重复下载     | 多 runtime        |
| PCL 不兼容  | external runtime |

---

# 十五、最终架构总结

---

## 🧠 三层结构

```text
Instance（用户数据）
        ↓
Runtime（资源层）
        ↓
Core（执行层）
```

---

# 🎯 最关键一句话

> ❗ 启动器不是管理 `.minecraft`，而是管理“多个 runtime + 多个 instance 的映射关系”

---

