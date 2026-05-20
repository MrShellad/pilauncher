# PiLauncher 本地化审计报告 (Localization Audit)

本报告总结了 PiLauncher 项目中尚未完全支持本地化（缺少 i18n 集成）的模块与文件。这些区域目前包含硬编码的中文字符串，需要迁移到 `i18next` 框架以支持多语言切换。

## 核心建议
1. **统一使用 `useTranslation` 钩子**：所有包含 UI 文本的 React 组件均应引入 `useTranslation`。
2. **提取字符串到 `locales/*.json`**：将硬编码文本按模块提取到 JSON 文件中。
3. **处理动态内容**：对于带参数的字符串（如 `共 {{count}} 项`），使用 i18next 的插值功能。

---

## 需本地化的模块列表

### 1. 收藏功能 (Library Feature)
该模块是近期新增的功能，目前几乎完全没有本地化支持。
- **路径**: `src/features/Library`
- **关键文件**:
  - `src/features/Library/components/CollectionCard.tsx` (准备就绪, 编辑整合包/模组集等)
  - `src/features/Library/components/CollectionMetadataModal.tsx` (上传封面, 重置封面, 游戏版本, 加载器等)
  - `src/features/Library/components/LibraryToolbar.tsx` (搜索占位符, 导出/导入 Library, 返回等)
  - `src/features/Library/data/libraryPageData.ts` (排序选项标签)
  - `src/pages/LibraryPage.tsx` (空状态文本, 导入确认弹窗文本)

### 2. 初始化向导 (Setup Feature)
引导用户进行首次设置的模块。目前已引入了部分 `useTranslation`，但仍有残留硬编码。
- **路径**: `src/features/Setup`
- **关键文件**:
  - `src/features/Setup/components/step/eula/EulaZh.tsx` (完全硬编码的用户许可协议)
  - `src/features/Setup/components/step/JavaDownloadStep.tsx` (部分硬编码 fallback)

### 3. 控制台与日志 (Game Log Feature)
实时输出游戏状态与日志分享的模块。
- **路径**: `src/features/GameLog`
- **关键文件**:
  - `src/features/GameLog/components/GameLogSidebar.tsx` (状态标签: 运行中/已崩溃, 性能遥测, 打包诊断等)
  - `src/features/GameLog/components/LogShareDialog.tsx` (上传日志, AI 分析选项等)
  - `src/features/GameLog/components/TelemetryPanel.tsx` (启动时间各项指标描述)

### 4. 联机与局域网 (Multiplayer & LAN Feature)
处理外部链接与好友请求的模块。
- **路径**: `src/features/multiplayer`, `src/features/lan`
- **关键文件**:
  - `src/features/multiplayer/components/OnlineServersList.tsx` (刷新提示, API 错误提示等)
  - `src/features/multiplayer/components/OnlineServerCard.tsx` (立即加入, 玩家数量等)
  - `src/features/lan/LanTrustModal.tsx` (建立信任请求, 安全警告等)

### 5. 实例管理 (Instances & Instance Detail)
虽然已有部分本地化，但仍有残留的硬编码文本。
- **路径**: `src/features/Instances`, `src/features/InstanceDetail`
- **关键文件**:
  - `src/features/Instances/components/InstanceCardView.tsx` (启动中, 详情提示等)
  - `src/features/InstanceDetail/components/tabs/OverviewPanel.tsx` (更换 Hero Logo, 实例目录提示等)
  - `src/features/InstanceDetail/components/tabs/mods/components/download/ResourceGrid.tsx` (加载更多, 搜索提示等)

### 6. 通用工具 (Utils)
- **路径**: `src/utils/formatters.ts`
- **现状**: 部分函数使用了 `t()`，但一些 fallback 字符串（如 `"未知时间"`）仍有硬编码。

### 7. 下载中心 (Download)
- **路径**: `src/features/Download`
- **关键文件**:
  - `src/features/Download/components/FavoritePlaceholderModal.tsx` (各种收藏弹窗提示词)
  - `src/features/Download/logic/sessionCache.ts` (缓存错误提示)

---

## 扫描结果统计 (近似)
| 模块 | 状态 | 优先级 |
| :--- | :--- | :--- |
| Library | 🔴 未开始 | 高 |
| Setup | 🟡 部分完成 | 高 |
| Game Log | 🟢 已完成 | - |
| Multiplayer | 🔴 未开始 | 中 |
| Instances | 🟡 部分完成 | 低 |
| Download | 🟡 部分完成 | 低 |

---
*生成日期: 2026-05-19*
