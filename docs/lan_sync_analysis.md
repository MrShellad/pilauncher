# 局域网好友同步与识别问题分析报告

## 1. 核心问题概述
在 PiLauncher 的局域网（LAN）功能开发过程中，出现了添加好友后 UI 状态不更新、无法识别好友关系以及 `userUuid` 写入异常的问题。经过深度排查，确定了三个核心诱因。

## 2. 详细诱因分析


### 2.2 前后端命名规范冲突 (核心阻塞点)
*   **现象**：数据库中已有正确好友数据，但前端雷达依然显示为“添加好友”。
*   **原因**：
    *   **后端**：Rust 结构体（如 `DeviceInitInfo`, `TrustedDevice`）使用了 `#[serde(rename_all = "camelCase")]`，输出的 JSON 是小驼峰式（如 `deviceId`）。
    *   **前端**：TypeScript 接口定义（`useLan.ts`）和组件调用使用了蛇形式（如 `device_id`）。
*   **后果**：
    1.  前端从 `/device/init` 获取富文本名片时，尝试访问 `richInfo.device_id` 得到 `undefined`。
    2.  前端从 `get_friend_devices` 获取好友列表时，尝试访问 `item.device_id` 得到 `undefined`。
    3.  由于 ID 匹配失效，雷达无法将扫描到的设备与好友列表中的 UUID 关联起来，导致 UI 始终显示为初始的“添加好友”状态。

### 2.3 密钥对初始化缺失 (潜在隐患)
*   **现象**：数据库中的 `public_key_b64` 列为空。
*   **原因**：`TrustStore::get_or_create_identity` 逻辑中，目前仅初始化了设备基础信息，公钥和私钥字段被硬编码为空字符串 `String::new()`。
*   **后果**：虽然目前不影响好友关系的 UI 展示，但后续在进行“实例投送”或“存档传输”时，由于无法进行签名校验，会导致传输失败。

## 3. 后续修复计划
1.  **全量模型对齐**：修改 `src/hooks/useLan.ts`，将所有与后端交互的模型属性统一为小驼峰命名法。
2.  **组件调用更新**：同步更新 `LanRadar.tsx`、`LanDeviceItem.tsx` 等组件，确保使用正确的属性名。
3.  **密钥对生成逻辑**：在后端完善 `DeviceIdentity` 的生成逻辑，确保每台设备在初始化时生成唯一的 Ed25519 密钥对。
