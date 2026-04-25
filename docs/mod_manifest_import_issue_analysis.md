# 整合包导入后 Mod 来源信息缺失问题分析报告

## 1. 问题描述
用户反馈在导入整合包（Modpack）后，生成的实例目录下的 `mod_manifest.json` 文件中，部分或全部 Mod 的来源信息（Source Information，如平台名称、项目 ID、文件 ID 等）丢失，导致在启动器 UI 中显示为“未知来源”或“外部导入”。

## 2. 核心原因分析

经过对后端 `orchestrator.rs` 及相关服务的代码审计，确定了以下四个核心原因：

### 2.1 CurseForge 导入逻辑 Bug (逻辑顺序错误)
在 `download_curseforge_mods` 函数中，代码在处理已存在文件时过早跳出。
*   **代码位置**: `src-tauri/src/services/modpack_service/orchestrator.rs`
*   **具体逻辑**: 
    1.  程序遍历清单中的文件。
    2.  检测到 `target_path.exists()` 且 Hash 匹配时，直接执行 `continue`。
    3.  记录来源信息的 `tracked_manifest_sources.push` 位于循环体底部。
*   **后果**: 任何本地已存在的 Mod（缓存或重用文件）都不会被记录到 `mod_manifest.json` 中，导致来源信息丢失。

### 2.2 Overrides 目录中的 Mod 未被索引
整合包通常将非平台库 Mod 直接存放在 `overrides/mods` 目录中。
*   **逻辑缺陷**: 导入流程先解压 `overrides` 目录，然后仅根据平台清单（`manifest.json` / `modrinth.index.json`）下载并记录 Mod。
*   **后果**: 解压出来的 JAR 文件并未在导入阶段被加入 `mod_manifest.json`。
*   **二次影响**: 当启动器随后扫描目录时，由于 manifest 中没有记录，这些 Mod 会被当作新发现的本地文件处理，来源标记为 `Unknown`。

### 2.3 Modrinth 来源信息提取逻辑脆弱
Modrinth 的来源信息是通过解析 CDN URL 提取的。
*   **逻辑结构**: 依赖 `/data/<project_id>/versions/<version_id>/` 这一特定路径结构。
*   **风险**: 一旦 Modrinth 调整 CDN 结构或整合包使用外部下载链接，该解析逻辑将失效。
*   **代码位置**: `orchestrator.rs` L936-951。

### 2.4 PiPack 导出源数据质量
PiPack 格式的导入直接继承自压缩包内的 `pi_manifest.json`。
*   **因果链**: 如果导出端（Exporter）在打包时因“清单模式”未开启或原本数据就缺失，导入端无法凭空生成来源信息。

---

## 3. 总结与改进建议

### 3.1 立即修复逻辑错误 (Quick Fix)
*   **调整顺序**: 在 CurseForge 导入循环中，将来源信息收集逻辑（`tracked_manifest_sources.push`）移至 `exists()` 检测之前。
*   **对齐逻辑**: 参考 `download_modrinth_mods` 的实现方式，确保所有清单内文件无论是否需要下载都能被正确索引。

### 3.2 增加后置扫描与“治愈”机制
*   **全局索引**: 在所有 Mod 下载/解压完成后，执行一次 `mods` 文件夹的全局扫描。
*   **反向比对**: 遍历文件夹中的所有 JAR，通过文件 Hash 反向去平台清单中查找对应的项目信息，补全 `overrides` 中 Mod 的来源记录。

### 3.3 增强 URL 解析容错性
*   **多模式匹配**: 增加对不同 Modrinth/CurseForge URL 结构的正则表达式支持，或在清单解析阶段预提取 ID 信息。

### 3.4 规范化 Key 管理
*   **统一 Key**: 确保在操作 `ModManifest` 字典时，所有 Key 强制通过 `mod_manifest_key` 处理，避免因 `.disabled` 后缀或大小写问题导致的数据覆盖或查询失败。
