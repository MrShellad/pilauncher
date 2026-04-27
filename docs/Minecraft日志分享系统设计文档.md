# Minecraft 日志分享与分析系统设计文档

## 1. 概述
为了方便用户在遇到游戏崩溃或异常时能够快速分享日志并获得分析建议，本项目集成了 `LogShare.CN` (mclogs) 的 JavaScript SDK。该系统支持日志的上传、原始查看、自动洞察分析以及 AI 智能诊断。

## 2. 核心组件
### 2.1 SDK 基础 (`mclogsService.js`)
SDK 位于 `src/services/mclogsService.js`，封装了与 `api.logshare.cn` 通信的所有逻辑。
- **环境支持**：同时兼容浏览器环境和 Node.js 环境（Tauri 渲染层）。
- **主要功能**：
  - `paste(content)`: 上传日志内容并获取分享链接。
  - `analyse(content)`: 即时分析日志（不保存）。
  - `getInsights(id)`: 获取日志的版本、软件类型及已知问题列表。
  - `getAIAnalysis(id)`: 使用大模型进行深度智能诊断。

### 2.2 TypeScript 声明 (`mclogsService.d.ts`)
为了确保在 `.tsx` 组件中调用的类型安全，提供了完整的接口定义：
- `LogShareSDK`: 核心类。
- `PasteResult`: 上传返回结构。
- `InsightResult`: 基础分析返回结构。

## 3. 集成方案
### 3.1 服务封装
我们在 `src/services` 中导出单例或类实例，供各功能模块调用。

### 3.2 UI 接入点
建议在以下场景接入：
1. **实例详情页/控制台**：添加“上传日志”按钮。
2. **游戏崩溃检测**：当检测到游戏非正常退出时，主动提示用户上传日志并显示分析结果。

## 4. 使用示例
### 4.1 基础上传
```typescript
import LogShareSDK from '@/services/mclogsService';

const mclogs = new LogShareSDK();

async function handleUpload(logText: string) {
    const result = await mclogs.paste(logText);
    if (result.success) {
        console.log('分享链接:', result.url);
    }
}
```

### 4.2 AI 智能诊断
```typescript
const analysis = await mclogs.getAIAnalysis(logId);
if (analysis.success) {
    // analysis.analysis 包含 Markdown 格式的诊断报告
    renderMarkdown(analysis.analysis);
}
```

## 5. 安全与限制
- **大小限制**：单次上传最大支持 10MiB 或 25,000 行。
- **速率限制**：API 设有频率限制，SDK 已内置 `RATE_LIMIT_ERROR` 处理逻辑。
- **隐私保护**：上传前建议过滤日志中的敏感信息（如 Token、个人路径等，虽然 mclogs 服务端通常会自动处理部分脱敏）。

## 6. 未来规划
- [ ] 集成到全局异常捕获流程。
- [ ] 在 UI 中提供日志脱敏勾选框。
- [ ] 支持本地日志的批量打包上传。
