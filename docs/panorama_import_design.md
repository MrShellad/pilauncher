# 材质包全景图导入功能设计文档

## 1. 功能概述
本功能允许用户通过导入 Minecraft 材质包（Resource Pack）来自动提取其中的全景图（Panorama）资源，并将其作为启动器的动态背景。支持 `.zip` 压缩包格式及解压后的文件夹格式。

## 2. 核心逻辑

### 2.1 材质包资源路径
全景图在标准 Minecraft 材质包中的存放位置为：
`assets/minecraft/textures/gui/title/background/`

包含以下 6 个关键文件（构成天空盒）：
- `panorama_0.png` (+X, 右)
- `panorama_1.png` (-X, 左)
- `panorama_2.png` (+Y, 上)
- `panorama_3.png` (-Y, 下)
- `panorama_4.png` (+Z, 前)
- `panorama_5.png` (-Z, 后)

### 2.2 后端实现 (Rust)
新增 Tauri 指令 `import_panorama_from_pack`，逻辑如下：

1. **类型识别**：判断输入路径是 `.zip` 文件还是文件夹。
2. **提取流程**：
   - **ZIP 格式**：使用 `zip` 库遍历压缩包，查找匹配 `assets/minecraft/textures/gui/title/background/panorama_[0-5].png` 路径的文件并读取内存。
   - **文件夹格式**：直接通过文件系统（`std::fs`）读取对应路径。
3. **命名规则**：
   - 优先尝试读取 `pack.mcmeta` 中的 `description` 或文件夹/文件名作为组名。
   - 目标存储路径为：`config/background/[组名]/`。
   - 存储文件名遵循正则 `^(.+)_([^_]+)_panorama_([0-5])$`，例如：`MyPack_resourcepack_panorama_0.png`。
4. **清理与存储**：确保目标目录存在，将 6 张图片完整转存。

### 2.3 前端实现 (React)
1. **交互入口**：在 `AppearanceSettings.tsx` 的“动态背景”部分新增“导入全景图”按钮。
2. **文件选择**：调用 `@tauri-apps/plugin-dialog` 插件的 `open` 方法，支持选择 `.zip` 文件或目录。
3. **状态刷新**：导入完成后，重新调用 `list_background_panoramas` 获取最新列表。
4. **选择器 UI**：新增全景图组选择下拉框，供用户在多个已导入的背景组之间切换。

## 3. 存储结构示例
```text
[App Root]/
  config/
    background/
      Vanilla_Default/
        Vanilla_Default_internal_panorama_0.png
        ...
      Custom_Pack_A/
        Custom_Pack_A_resourcepack_panorama_0.png
        ...
```

## 4. 后续扩展
- **预览功能**：在导入前展示全景图的缩略图。
- **Overlay 支持**：同时提取并应用 `panorama_overlay.png` 以获得更接近原版的视觉效果。
- **多版本适配**：兼容部分非标准路径或旧版本材质包的路径结构。
