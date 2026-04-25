# 整合包导出 Manifest 模式失效原因分析报告

## 1. 现象描述
在 `InstanceDetail` 的导出功能中，即便用户开启了 **Manifest 模式**（旨在通过引用平台链接而非直接打包 JAR 文件来减小包体积），导出的压缩包内依然包含了完整的 Mod 文件。

## 2. 核心逻辑分析

### 2.1 后端配置项解析（`ExportConfig`）
在 `src-tauri\src\services\modpack_service\export.rs` 中，后端定义了接收前端参数的结构体：

```rust
pub struct ExportConfig {
    pub instance_id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub description: String,
    pub format: String, // "zip", "curseforge", "mrpack", "pipack"
    pub manifest_mode: bool, // <-- 此处定义了该字段
    // ... 其他字段
}
```

**分析结果：**
虽然 `ExportConfig` 中定义了 `manifest_mode` 字段，但在整个 `export.rs` 的业务逻辑中，**该字段从未被读取或使用**。这意味着无论前端传递 `true` 还是 `false`，后端逻辑均保持一致。

### 2.2 文件收集逻辑（`collect_files_to_pack`）
负责收集待打包文件的函数逻辑如下：

```rust
fn collect_files_to_pack(...) -> Result<Vec<PlannedArchiveFile>, String> {
    // ...
    if config.format == "pipack" && pipack_skip_mods.contains(&relative_path_str) {
        continue; // 仅当格式为 pipack 且 mod 在跳过列表中时才不打包
    }
    // ...
    // 其他格式（zip, curseforge, mrpack）没有任何跳过逻辑
}
```

**分析结果：**
1. **硬编码限制**：Mod 的跳过（即 Manifest 模式的核心行为）被硬编码为仅在 `pipack` 格式下生效。
2. **缺乏判断**：即便格式是 `pipack`，判断是否跳过也不是依据 `manifest_mode` 开关，而是依据 `pipack_skip_mods` 列表。

### 2.3 PiPack 模式下的跳过机制
`pipack_skip_mods` 的生成逻辑位于 `prepare_pipack_manifest`：

```rust
let platform_scanned = has_platform_reference(&manifest_entry);
if platform_scanned {
    skip_mods.insert(relative_path_str.clone());
}
```

**分析结果：**
该逻辑仅检查 Mod 是否具有平台引用（Modrinth/CurseForge ID）。如果一个 Mod 是用户手动放入 `mods` 文件夹且未经过 Launcher 扫描匹配到平台信息，即使开启了 Manifest 模式，它也会被强制打包进去。

### 2.4 CurseForge 与 Modrinth (mrpack) 格式实现缺失
在 `write_export_manifest` 中，针对标准格式的 manifest 生成逻辑极其简陋，完全忽略了远程文件的映射：

```rust
"curseforge" => {
    let manifest = serde_json::json!({
        "minecraft": { ... },
        "manifestType": "minecraftModpack",
        "manifestVersion": 1,
        "name": config.name,
        "files": [], // <--- 关键点：硬编码为空数组，不记录任何远程下载信息
        "overrides": "overrides"
    });
    // ... 将该 manifest 写入压缩包根目录
}
"mrpack" => {
    let modrinth_index = serde_json::json!({
        "formatVersion": 1,
        "name": config.name,
        "files": [] // <--- 关键点：硬编码为空数组
    });
    // ... 将该 index 写入压缩包根目录
}
```

**深入分析：**
1. **Manifest 语义失效**：由于导出的 `manifest.json` 或 `modrinth.index.json` 中没有包含任何远程下载条目（`files` 为空），导出的压缩包如果也不包含 JAR 文件，那么该整合包在导入时将变成一个“空壳”。
2. **打包策略兜底**：在 `collect_files_to_pack` 中，由于没有针对 `curseforge` 和 `mrpack` 的“跳过逻辑”，系统会将 `mods/` 文件夹下的所有物理文件全部视为 `overrides`（覆盖文件）进行全量打包。
3. **功能未实现**：将本地 JAR 重新映射回远程平台 ID（Modrinth/CurseForge ID）是一个复杂的反向查询过程，当前的后端导出服务尚未实现此功能，因此直接采取了“全量物理打包”的保守策略。

## 3. 结论总结

开启 Manifest 模式后依然打包完整 Mod 的根本原因如下：

1. **逻辑断层**：后端的 `ExportConfig` 结构体虽然定义了 `manifest_mode` 字段，但在具体的导出执行流中**该字段从未被读取**。
2. **格式排他性**：Manifest 过滤（跳过已识别远程来源的 Mod）逻辑被硬编码限定在 `pipack` 格式内，对于行业通用的 `curseforge` 和 `mrpack` 格式，后端完全没有编写过滤代码。
3. **清单生成占位化**：CurseForge 和 Modrinth 的清单生成器仅输出了一个格式框架，其中的文件下载列表（`files`）被硬编码为空，导致系统不得不将所有物理文件打包进 `overrides` 以维持包的可用性。
4. **元数据缺失**：即便在 `pipack` 格式下，跳过逻辑也完全依赖于本地 `mod_manifest.json`。如果是手动拖入或未通过本启动器识别的 Mod，由于缺少平台 ID 信息，依然会被全量打包。

---
*文档更新于: 2026-04-24*

