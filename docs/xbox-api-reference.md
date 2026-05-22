# OpenFriend Xbox / Xbox Live API 使用文档

> **版本**: 1.0.7  
> **生成日期**: 2026-05-21  
> **适用范围**: OpenFriendMod 全部源码 (1.16.5 / 1.20.4+ 通用)

---

## 目录

- [1. 架构概览](#1-架构概览)
- [2. IPC 通信协议](#2-ipc-通信协议)
  - [2.1 协议规范](#21-协议规范)
  - [2.2 IpcClient 核心类](#22-ipcclient-核心类)
  - [2.3 IpcListener 监听接口](#23-ipclistener-监听接口)
  - [2.4 IpcException 错误码](#24-ipcexception-错误码)
- [3. 认证 API (auth.*)](#3-认证-api-auth)
  - [3.1 auth.useMojangSession — 使用 Minecraft 会话认证](#31-authusemojangsession--使用-minecraft-会话认证)
  - [3.2 auth.signIn — 设备码登录](#32-authsignin--设备码登录)
  - [3.3 auth.status — 查询认证状态](#33-authstatus--查询认证状态)
  - [3.4 auth.deviceCode — 通知：设备码下发](#34-authdevicecode--通知设备码下发)
  - [3.5 auth.signedIn — 通知：登录成功](#35-authsignedin--通知登录成功)
- [4. 好友管理 API (friends.*)](#4-好友管理-api-friends)
  - [4.1 friends.list — 获取好友列表](#41-friendslist--获取好友列表)
  - [4.2 friends.search — 搜索 Gamertag](#42-friendssearch--搜索-gamertag)
  - [4.3 friends.add — 发送好友请求](#43-friendsadd--发送好友请求)
  - [4.4 friends.accept — 接受好友请求](#44-friendsaccept--接受好友请求)
  - [4.5 friends.decline — 拒绝好友请求](#45-friendsdecline--拒绝好友请求)
  - [4.6 friends.remove — 删除好友/取消请求](#46-friendsremove--删除好友取消请求)
  - [4.7 friends.snapshot — 通知：好友快照更新](#47-friendssnapshot--通知好友快照更新)
  - [4.8 friend.added — 通知：新好友添加](#48-friendadded--通知新好友添加)
  - [4.9 friend.removed — 通知：好友移除](#49-friendremoved--通知好友移除)
  - [4.10 friend.requestIncoming — 通知：收到好友请求](#410-friendrequestincoming--通知收到好友请求)
  - [4.11 friend.requestIncomingResolved — 通知：收到的请求已处理](#411-friendrequestincomingresolved--通知收到的请求已处理)
  - [4.12 friend.requestOutgoing — 通知：发出好友请求](#412-friendrequestoutgoing--通知发出好友请求)
  - [4.13 friend.requestOutgoingResolved — 通知：发出的请求已处理](#413-friendrequestoutgoingresolved--通知发出的请求已处理)
  - [4.14 friend.joined — 通知：好友加入](#414-friendjoined--通知好友加入)
- [5. 在线状态 API (presence.*)](#5-在线状态-api-presence)
  - [5.1 presence.set — 设置自身在线状态](#51-presenceset--设置自身在线状态)
  - [5.2 presence.watch — 启动在线状态监听](#52-presencewatch--启动在线状态监听)
  - [5.3 presence.changed — 通知：好友在线状态变化](#53-presencechanged--通知好友在线状态变化)
- [6. 屏蔽管理 API (blocks.*)](#6-屏蔽管理-api-blocks)
  - [6.1 blocks.list — 获取屏蔽列表](#61-blockslist--获取屏蔽列表)
  - [6.2 blocks.add — 屏蔽玩家](#62-blocksadd--屏蔽玩家)
  - [6.3 blocks.remove — 解除屏蔽](#63-blocksremove--解除屏蔽)
- [7. 主机托管 API (host.*)](#7-主机托管-api-host)
  - [7.1 host.start — 开始托管](#71-hoststart--开始托管)
  - [7.2 host.stop — 停止托管](#72-hoststop--停止托管)
  - [7.3 host.status — 查询托管状态](#73-hoststatus--查询托管状态)
  - [7.4 host.started — 通知：托管已启动](#74-hoststarted--通知托管已启动)
  - [7.5 host.stopped — 通知：托管已停止](#75-hoststopped--通知托管已停止)
- [8. 加入好友 API (join.*)](#8-加入好友-api-join)
  - [8.1 join.start — 发起加入](#81-joinstart--发起加入)
  - [8.2 join.started — 通知：加入已启动](#82-joinstarted--通知加入已启动)
  - [8.3 join.stopped — 通知：加入已停止](#83-joinstopped--通知加入已停止)
- [9. 日志 API (log)](#9-日志-api-log)
- [10. 控制命令 (quit)](#10-控制命令-quit)
- [11. 数据模型](#11-数据模型)
  - [11.1 Friend](#111-friend)
  - [11.2 PresenceStatus](#112-presencestatus)
  - [11.3 FriendsState 内部状态结构](#113-friendsstate-内部状态结构)
- [12. 认证流程详解](#12-认证流程详解)
  - [12.1 完整认证链路](#121-完整认证链路)
  - [12.2 会话传递流程 (auth.useMojangSession)](#122-会话传递流程-authusemojangsession)
  - [12.3 设备码认证流程 (auth.signIn)](#123-设备码认证流程-authsignin)
- [13. Core 二进制管理](#13-core-二进制管理)
- [14. 使用示例](#14-使用示例)
- [15. 附录：源码文件索引](#15-附录源码文件索引)

---

## 1. 架构概览

OpenFriend 的 Xbox/Xbox Live 集成采用 **进程间通信 (IPC)** 架构，分为两个主要组件：

```
┌───────────────────────┐       stdin/stdout        ┌─────────────────────────────┐
│  OpenFriendMod (Java) │  ◄──── JSON-RPC 2.0 ────► │  OpenFriendCore (Go binary) │
│  - Minecraft 客户端    │                           │  - MSA / Xbox Live 认证      │
│  - UI 渲染             │                           │  - Mojang Friends API 信令   │
│  - Mixin 注入          │                           │  - WebRTC 网络桥接           │
└───────────────────────┘                           └─────────────────────────────┘
```

**关键要点**：

- **Mod 层** (`common/`, `common-mc/`, `helper/`) 不直接调用任何 Xbox REST API
- 所有 Xbox Live 认证、好友列表、在线状态等功能通过 **JSON-RPC 2.0** 发送给 **Core 二进制**
- Core 负责 MSA (Microsoft Account) → Xbox Live → XSTS → Mojang 认证链
- 通信通过 Core 进程的 **stdin/stdout** 管道进行

---

## 2. IPC 通信协议

### 2.1 协议规范

| 项目 | 值 |
|---|---|
| **协议** | JSON-RPC 2.0 |
| **传输方式** | Core 进程的 stdin (请求) / stdout (响应) |
| **编码** | UTF-8 |
| **分隔符** | 换行符 (`\n`)，每行一个完整的 JSON 对象 |
| **消息类型** | 请求 (含 `id`)、通知 (不含 `id`)、响应 |

**请求格式**：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "friends.list",
  "params": null
}
```

**响应格式（成功）**：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "friends": [...],
    "incoming": [...],
    "outgoing": [...]
  }
}
```

**响应格式（错误）**：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32001,
    "message": "not authenticated",
    "data": "optional detail"
  }
}
```

**通知格式（Core → Mod，无 `id`）**：

```json
{
  "jsonrpc": "2.0",
  "method": "friend.added",
  "params": {
    "profileId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "name": "PlayerName"
  }
}
```

### 2.2 IpcClient 核心类

**源文件**: [`IpcClient.java`](../common/src/main/java/jp/zpw/openfriend/common/ipc/IpcClient.java)

```java
public final class IpcClient {
    // 异步请求 — 返回 CompletableFuture
    public CompletableFuture<JsonObject> requestAsync(String method, JsonObject params);

    // 同步请求 — 阻塞等待指定超时
    public JsonObject request(String method, JsonObject params, long timeoutMs)
        throws IpcException;

    // 发送通知（不期望回复）
    public void notify(String method, JsonObject params) throws IpcException;

    // 监听来自 Core 的通知
    public void addListener(IpcListener l);
    public void removeListener(IpcListener l);

    // 生命周期
    public synchronized void start() throws IOException;
    public synchronized void stop();
    public boolean isRunning();

    // 参数构建辅助方法
    public static JsonObject params(Object... kv);
}
```

**`params()` 辅助方法用法**：

```java
// 构建 {"name": "Steve", "listen": "127.0.0.1:25577"}
JsonObject p = IpcClient.params("name", "Steve", "listen", "127.0.0.1:25577");

// 支持的值类型: String, Number, Boolean, JsonElement, null
IpcClient.params("status", "ONLINE");
IpcClient.params("intervalSeconds", 60);
IpcClient.params("useBypass", false);
```

### 2.3 IpcListener 监听接口

**源文件**: [`IpcListener.java`](../common/src/main/java/jp/zpw/openfriend/common/ipc/IpcListener.java)

```java
@FunctionalInterface
public interface IpcListener {
    void onNotification(String method, JsonObject params);
}
```

项目中有三个 `IpcListener` 实现：

| 实现类 | 职责 |
|---|---|
| `FriendsState` | 接收所有通知并更新内存中的好友/在线状态/认证/托管状态 |
| `ToastDispatcher` | 接收 `auth.deviceCode`、`auth.signedIn`、`friend.*` 通知并显示 Minecraft Toast |
| 匿名日志监听器 | 接收 `log` 通知并转发到 SLF4J 日志 |

### 2.4 IpcException 错误码

**源文件**: [`IpcException.java`](../common/src/main/java/jp/zpw/openfriend/common/ipc/IpcException.java)

| 错误码 | 含义 | 辅助方法 |
|---|---|---|
| `-32001` | 未认证 (Not Authenticated) | `isNotAuthenticated()` |
| `-32002` | 已在运行 (Already Running) | `isAlreadyRunning()` |
| `-32003` | 未在运行 (Not Running) | `isNotRunning()` |
| `-32011` | 未找到 (Not Found) | `isNotFound()` |
| `0` | 通用错误 | — |

---

## 3. 认证 API (auth.*)

### 3.1 auth.useMojangSession — 使用 Minecraft 会话认证

将 Minecraft 客户端的现有会话令牌传递给 Core，让 Core 用它完成 MSA → Xbox Live → XSTS 认证链。

| 项目 | 详情 |
|---|---|
| **方向** | Mod → Core (请求) |
| **方法名** | `auth.useMojangSession` |
| **调用位置** | [`OpenFriendMod.handOffMinecraftSessionOrSignIn()`](../common-mc/src/main/java/jp/zpw/openfriend/mc/OpenFriendMod.java#L49-L83) |

**请求参数**：

```json
{
  "accessToken": "eyJhbGciOi...",
  "profileId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "name": "PlayerName"
}
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `accessToken` | `string` | Minecraft 客户端的 MSA 访问令牌 (`User.getAccessToken()`) |
| `profileId` | `string` (UUID) | 玩家的 Minecraft Profile UUID (`User.getProfileId()`) |
| `name` | `string` | 玩家显示名 (`User.getName()`) |

**成功后续动作**：

```java
s.primeFromList(ipc);          // 拉取好友列表
probeFriendsList(ipc);         // 日志记录好友数量
ipc.requestAsync("presence.set", IpcClient.params("status", "ONLINE"));
ipc.requestAsync("presence.watch", IpcClient.params("intervalSeconds", 60));
```

**失败回退**：调用 `triggerDeviceCodeSignIn()` 回退到设备码认证。

> **注意**: 1.16.5 ~ 1.19.x 的旧版 `User.getAccessToken()` 返回 Yggdrasil 令牌，
> 无法通过 MSA → XSTS 握手。这些版本总是回退到设备码登录。

### 3.2 auth.signIn — 设备码登录

触发 Microsoft 设备码认证流程。Core 会生成一个设备码，通过 `auth.deviceCode` 通知发回给 Mod。

| 项目 | 详情 |
|---|---|
| **方向** | Mod → Core (请求) |
| **方法名** | `auth.signIn` |
| **调用位置** | [`OpenFriendMod.triggerDeviceCodeSignIn()`](../common-mc/src/main/java/jp/zpw/openfriend/mc/OpenFriendMod.java#L98-L113) |

**请求参数**：

```json
{
  "expectedProfileId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

| 参数 | 类型 | 必需 | 说明 |
|---|---|---|---|
| `expectedProfileId` | `string` (UUID) | 否 | 期望匹配的 Minecraft Profile UUID，用于校验登录账号 |

**响应**：请求在用户完成设备码认证后才会返回结果。

**成功后续动作**：与 `auth.useMojangSession` 成功后相同。

### 3.3 auth.status — 查询认证状态

| 项目 | 详情 |
|---|---|
| **方向** | Mod → Core (请求) |
| **方法名** | `auth.status` |
| **调用位置** | [`FriendsState.primeFromList()`](../common/src/main/java/jp/zpw/openfriend/common/state/FriendsState.java#L116-L119) |

**请求参数**: `null`

**响应**：

```json
{
  "authenticated": true,
  "profileId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "name": "PlayerName"
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `authenticated` | `boolean` | 是否已完成认证 |
| `profileId` | `string` (UUID) | 已认证用户的 Profile UUID |
| `name` | `string` | 已认证用户的显示名 |

### 3.4 auth.deviceCode — 通知：设备码下发

Core 在收到 `auth.signIn` 请求后，发送此通知给 Mod，携带用户需要在浏览器中输入的设备码。

| 项目 | 详情 |
|---|---|
| **方向** | Core → Mod (通知) |
| **方法名** | `auth.deviceCode` |
| **处理位置** | [`ToastDispatcher.onNotification()`](../common-mc/src/main/java/jp/zpw/openfriend/mc/toast/ToastDispatcher.java#L25-L37) |

**通知参数**：

```json
{
  "userCode": "ABCD-EFGH",
  "verificationUri": "https://www.microsoft.com/link"
}
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `userCode` | `string` | 用户需要在浏览器中输入的设备码 |
| `verificationUri` | `string` | 微软设备码登录页面 URL |

**Mod 处理行为**：

1. 创建 `SignInScreen` 显示设备码和验证 URL
2. 自动调用 `Util.getPlatform().openUri(uri)` 打开浏览器
3. 用户可手动复制代码或点击 "Open browser" 按钮

### 3.5 auth.signedIn — 通知：登录成功

Core 在用户完成设备码认证（或会话认证成功）后发送此通知。

| 项目 | 详情 |
|---|---|
| **方向** | Core → Mod (通知) |
| **方法名** | `auth.signedIn` |
| **处理位置** | [`FriendsState.onNotification()`](../common/src/main/java/jp/zpw/openfriend/common/state/FriendsState.java#L214-L218) 和 [`ToastDispatcher`](../common-mc/src/main/java/jp/zpw/openfriend/mc/toast/ToastDispatcher.java#L39-L48) |

**通知参数**：

```json
{
  "profileId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "name": "PlayerName"
}
```

**Mod 处理行为**：

1. `FriendsState` 更新 `auth.authenticated = true`、`auth.profileId`、`auth.name`
2. `ToastDispatcher` 在 `SignInScreen` 上标记登录成功
3. 显示 Minecraft Toast 通知 "Signed in — PlayerName"

---

## 4. 好友管理 API (friends.*)

### 4.1 friends.list — 获取好友列表

| 项目 | 详情 |
|---|---|
| **方向** | Mod → Core (请求) |
| **方法名** | `friends.list` |
| **调用位置** | [`FriendsState.primeFromList()`](../common/src/main/java/jp/zpw/openfriend/common/state/FriendsState.java#L103-L111), [`OpenFriendMod.probeFriendsList()`](../common-mc/src/main/java/jp/zpw/openfriend/mc/OpenFriendMod.java#L85-L96) |

**请求参数**: `null`

**响应**：

```json
{
  "friends": [
    { "profileId": "uuid-1", "name": "Alice" },
    { "profileId": "uuid-2", "name": "Bob" }
  ],
  "incoming": [
    { "profileId": "uuid-3", "name": "Charlie" }
  ],
  "outgoing": [
    { "profileId": "uuid-4", "name": "Diana" }
  ]
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `friends` | `Array<Friend>` | 已确认的好友列表 |
| `incoming` | `Array<Friend>` | 收到的待处理好友请求 |
| `outgoing` | `Array<Friend>` | 发出的待确认好友请求 |

### 4.2 friends.search — 搜索 Gamertag

按 Xbox Gamertag 搜索玩家。

| 项目 | 详情 |
|---|---|
| **方向** | Mod → Core (请求) |
| **方法名** | `friends.search` |
| **调用位置** | [`FriendsController.addActions()`](../common/src/main/java/jp/zpw/openfriend/common/screen/FriendsController.java#L170-L173) |

**请求参数**：

```json
{ "name": "SteveGamer123" }
```

**响应**：

```json
{
  "found": true,
  "name": "SteveGamer123",
  "isFriend": false,
  "isIncoming": false,
  "isOutgoing": false
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `found` | `boolean` | 是否找到匹配的玩家 |
| `name` | `string` | 玩家的实际显示名 |
| `isFriend` | `boolean` | 是否已经是好友 |
| `isIncoming` | `boolean` | 是否已有来自该玩家的好友请求 |
| `isOutgoing` | `boolean` | 是否已向该玩家发出好友请求 |

**Mod 搜索结果状态枚举** (来自 `AddFriendTab.State`)：

| 状态 | 含义 |
|---|---|
| `FOUND` | 找到玩家，可发送好友请求 |
| `NOT_FOUND` | 未找到匹配的玩家 |
| `ALREADY_FRIEND` | 已经是好友 |
| `INCOMING_EXISTS` | 已有来自该玩家的好友请求 |
| `OUTGOING_EXISTS` | 已向该玩家发出过请求 |
| `ERROR` | 搜索失败 |

### 4.3 friends.add — 发送好友请求

| 项目 | 详情 |
|---|---|
| **方向** | Mod → Core (请求) |
| **方法名** | `friends.add` |
| **调用位置** | [`FriendsController.addActions()`](../common/src/main/java/jp/zpw/openfriend/common/screen/FriendsController.java#L176-L188) |

**请求参数**：

```json
{ "name": "SteveGamer123" }
```

### 4.4 friends.accept — 接受好友请求

| 项目 | 详情 |
|---|---|
| **方向** | Mod → Core (请求) |
| **方法名** | `friends.accept` |
| **调用位置** | [`FriendsController.pendingActions()`](../common/src/main/java/jp/zpw/openfriend/common/screen/FriendsController.java#L148) |

**请求参数**：

```json
{ "profileId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }
```

### 4.5 friends.decline — 拒绝好友请求

| 项目 | 详情 |
|---|---|
| **方向** | Mod → Core (请求) |
| **方法名** | `friends.decline` |
| **调用位置** | [`FriendsController.pendingActions()`](../common/src/main/java/jp/zpw/openfriend/common/screen/FriendsController.java#L149) |

**请求参数**：

```json
{ "profileId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }
```

### 4.6 friends.remove — 删除好友/取消请求

| 项目 | 详情 |
|---|---|
| **方向** | Mod → Core (请求) |
| **方法名** | `friends.remove` |
| **调用位置** | [`FriendsController.friendActions().onRemove()`](../common/src/main/java/jp/zpw/openfriend/common/screen/FriendsController.java#L105-L115), [`FriendsController.pendingActions().onCancel()`](../common/src/main/java/jp/zpw/openfriend/common/screen/FriendsController.java#L150) |

**请求参数**：

```json
{ "profileId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }
```

### 4.7 friends.snapshot — 通知：好友快照更新

Core 推送完整的好友列表快照（增量替换所有数据）。

| 项目 | 详情 |
|---|---|
| **方向** | Core → Mod (通知) |
| **方法名** | `friends.snapshot` |
| **处理位置** | [`FriendsState.onNotification()`](../common/src/main/java/jp/zpw/openfriend/common/state/FriendsState.java#L178-L183) |

**通知参数**：与 `friends.list` 响应格式相同。

### 4.8 friend.added — 通知：新好友添加

| 项目 | 详情 |
|---|---|
| **方向** | Core → Mod (通知) |
| **方法名** | `friend.added` |

**通知参数**：

```json
{
  "profileId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "name": "PlayerName"
}
```

**Mod 处理行为**：

1. 将该玩家添加到 `friends` 列表
2. 从 `incoming` 和 `outgoing` 中移除（如存在）
3. 显示 Minecraft Toast "Friend added — PlayerName"

### 4.9 friend.removed — 通知：好友移除

| 方向 | Core → Mod (通知) |
|---|---|
| **方法名** | `friend.removed` |

**通知参数**：`{ "profileId": "uuid" }`

### 4.10 friend.requestIncoming — 通知：收到好友请求

| 方向 | Core → Mod (通知) |
|---|---|
| **方法名** | `friend.requestIncoming` |

**通知参数**：`{ "profileId": "uuid", "name": "PlayerName" }`

**Mod 处理行为**：添加到 `incoming` 列表 + 显示 Toast "Friend request — PlayerName"

### 4.11 friend.requestIncomingResolved — 通知：收到的请求已处理

| 方向 | Core → Mod (通知) |
|---|---|
| **方法名** | `friend.requestIncomingResolved` |

**通知参数**：`{ "profileId": "uuid" }`  
**Mod 处理行为**：从 `incoming` 中移除

### 4.12 friend.requestOutgoing — 通知：发出好友请求

| 方向 | Core → Mod (通知) |
|---|---|
| **方法名** | `friend.requestOutgoing` |

**通知参数**：`{ "profileId": "uuid", "name": "PlayerName" }`  
**Mod 处理行为**：添加到 `outgoing` 列表

### 4.13 friend.requestOutgoingResolved — 通知：发出的请求已处理

| 方向 | Core → Mod (通知) |
|---|---|
| **方法名** | `friend.requestOutgoingResolved` |

**通知参数**：`{ "profileId": "uuid" }`  
**Mod 处理行为**：从 `outgoing` 中移除

### 4.14 friend.joined — 通知：好友加入

| 方向 | Core → Mod (通知) |
|---|---|
| **方法名** | `friend.joined` |
| **处理位置** | [`ToastDispatcher`](../common-mc/src/main/java/jp/zpw/openfriend/mc/toast/ToastDispatcher.java#L52-L68) |

**通知参数**：

```json
{ "pmid": "peer-multiplayer-id-string" }
```

**Mod 处理行为**：显示 Toast "Friend joined — {pmid前8字符}..."

---

## 5. 在线状态 API (presence.*)

### 5.1 presence.set — 设置自身在线状态

| 项目 | 详情 |
|---|---|
| **方向** | Mod → Core (请求) |
| **方法名** | `presence.set` |
| **调用位置** | [`OpenFriendMod`](../common-mc/src/main/java/jp/zpw/openfriend/mc/OpenFriendMod.java#L72) 认证成功后, [`FriendsController.refreshIfStale()`](../common/src/main/java/jp/zpw/openfriend/common/screen/FriendsController.java#L48) 每次打开好友列表时 |

**请求参数**：

```json
{ "status": "ONLINE" }
```

| 参数 | 类型 | 可选值 |
|---|---|---|
| `status` | `string` | 见 [PresenceStatus 枚举](#112-presencestatus) |

### 5.2 presence.watch — 启动在线状态监听

指示 Core 定期轮询好友的在线状态，并通过 `presence.changed` 通知推送变更。

| 项目 | 详情 |
|---|---|
| **方向** | Mod → Core (请求) |
| **方法名** | `presence.watch` |
| **调用位置** | [`OpenFriendMod`](../common-mc/src/main/java/jp/zpw/openfriend/mc/OpenFriendMod.java#L73) 认证成功后 |

**请求参数**：

```json
{ "intervalSeconds": 60 }
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `intervalSeconds` | `number` | 轮询间隔秒数 |

### 5.3 presence.changed — 通知：好友在线状态变化

| 项目 | 详情 |
|---|---|
| **方向** | Core → Mod (通知) |
| **方法名** | `presence.changed` |
| **处理位置** | [`FriendsState.onNotification()`](../common/src/main/java/jp/zpw/openfriend/common/state/FriendsState.java#L204-L213) |

**通知参数**：

```json
{
  "profileId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "status": "PLAYING_HOSTED_SERVER"
}
```

---

## 6. 屏蔽管理 API (blocks.*)

### 6.1 blocks.list — 获取屏蔽列表

| 项目 | 详情 |
|---|---|
| **方向** | Mod → Core (请求) |
| **方法名** | `blocks.list` |
| **调用位置** | [`FriendsState.primeFromList()`](../common/src/main/java/jp/zpw/openfriend/common/state/FriendsState.java#L112-L115), [`FriendsController.refreshBlocks()`](../common/src/main/java/jp/zpw/openfriend/common/screen/FriendsController.java#L140-L144) |

**请求参数**: `null`

**响应**：

```json
{
  "blocks": [
    { "profileId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }
  ]
}
```

### 6.2 blocks.add — 屏蔽玩家

| 项目 | 详情 |
|---|---|
| **方向** | Mod → Core (请求) |
| **方法名** | `blocks.add` |
| **调用位置** | [`FriendsController.friendActions().onBlock()`](../common/src/main/java/jp/zpw/openfriend/common/screen/FriendsController.java#L117-L126) |

**请求参数**：

```json
{
  "profileId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "name": "PlayerName"
}
```

### 6.3 blocks.remove — 解除屏蔽

| 项目 | 详情 |
|---|---|
| **方向** | Mod → Core (请求) |
| **方法名** | `blocks.remove` |
| **调用位置** | [`FriendsController.friendActions().onUnblock()`](../common/src/main/java/jp/zpw/openfriend/common/screen/FriendsController.java#L128-L136), [`FriendsController.blocksActions().unblock()`](../common/src/main/java/jp/zpw/openfriend/common/screen/FriendsController.java#L236-L238) |

**请求参数**：

```json
{ "profileId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }
```

---

## 7. 主机托管 API (host.*)

"Host" 功能通过 WebRTC 桥接将 Minecraft 服务器暴露给 Xbox Live 好友。

### 7.1 host.start — 开始托管

| 项目 | 详情 |
|---|---|
| **方向** | Mod → Core (请求) |
| **方法名** | `host.start` |
| **调用位置** | [`MCScreenOpener.onServerPublished()`](../common-mc/src/main/java/jp/zpw/openfriend/mc/ui/MCScreenOpener.java#L104-L105) |

**请求参数**：

```json
{
  "target": "127.0.0.1:25565",
  "useBypass": false
}
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `target` | `string` | 要桥接的 Minecraft 服务器地址 (`host:port`) |
| `useBypass` | `boolean` | 是否使用 OpenFriendBypass 插件绕过在线模式认证 |

**典型触发场景**：

1. 玩家在单人世界中点击 "Open to Friends"
2. Mod 调用 `IntegratedServer.publishServer()` 开放 LAN
3. `IntegratedServerMixin` 拦截 `publishServer` 的 RETURN
4. 调用 `MCScreenOpener.onServerPublished(port)` → 发送 `host.start`

### 7.2 host.stop — 停止托管

| 项目 | 详情 |
|---|---|
| **方向** | Mod → Core (请求) |
| **方法名** | `host.stop` |
| **调用位置** | [`FriendsController.multiplayActions().stopHosting()`](../common/src/main/java/jp/zpw/openfriend/common/screen/FriendsController.java#L224-L228) |

**请求参数**: `null`

### 7.3 host.status — 查询托管状态

| 项目 | 详情 |
|---|---|
| **方向** | Mod → Core (请求) |
| **方法名** | `host.status` |
| **调用位置** | [`FriendsState.primeFromList()`](../common/src/main/java/jp/zpw/openfriend/common/state/FriendsState.java#L120-L123) |

**请求参数**: `null`

**响应**：

```json
{
  "running": true,
  "target": "127.0.0.1:25565",
  "useBypass": false
}
```

### 7.4 host.started — 通知：托管已启动

| 方向 | Core → Mod (通知) |
|---|---|
| **方法名** | `host.started` |

**通知参数**：

```json
{
  "target": "127.0.0.1:25565",
  "useBypass": false
}
```

### 7.5 host.stopped — 通知：托管已停止

| 方向 | Core → Mod (通知) |
|---|---|
| **方法名** | `host.stopped` |

**通知参数**: `{}`（空对象）

---

## 8. 加入好友 API (join.*)

### 8.1 join.start — 发起加入

通过 WebRTC 连接到正在托管的好友，并在本地创建一个 TCP 代理。

| 项目 | 详情 |
|---|---|
| **方向** | Mod → Core (请求) |
| **方法名** | `join.start` |
| **调用位置** | [`FriendsController.friendActions().onJoin()`](../common/src/main/java/jp/zpw/openfriend/common/screen/FriendsController.java#L76-L102) |

**请求参数**：

```json
{
  "name": "FriendName",
  "listen": "127.0.0.1:25577"
}
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `name` | `string` | 好友的 Gamertag |
| `listen` | `string` | 本地监听地址，Minecraft 客户端将连接此地址 |

**响应**：

```json
{
  "listen": "127.0.0.1:25577"
}
```

**成功后**：Mod 调用 `JoinLauncher.connectToLocalAddress(listen)` 自动连接到本地代理。

**错误处理**：

- `-32002` (Already Running)：直接连接到已有代理
- HTTP 429 / "rate limited"：显示 Toast "Mojang rate limit — Please wait a moment before retrying."
- 其他错误：显示 Toast "Could not join {name}"

### 8.2 join.started — 通知：加入已启动

| 方向 | Core → Mod (通知) |
|---|---|
| **方法名** | `join.started` |

**通知参数**：

```json
{
  "peer": "peer-identifier",
  "pmid": "peer-multiplayer-id",
  "listen": "127.0.0.1:25577"
}
```

### 8.3 join.stopped — 通知：加入已停止

| 方向 | Core → Mod (通知) |
|---|---|
| **方法名** | `join.stopped` |

**通知参数**: `{}`（空对象）

---

## 9. 日志 API (log)

Core 通过此通知将自身的日志转发给 Mod 进行显示。

| 项目 | 详情 |
|---|---|
| **方向** | Core → Mod (通知) |
| **方法名** | `log` |
| **处理位置** | [`OpenFriendMod.bootstrap()`](../common-mc/src/main/java/jp/zpw/openfriend/mc/OpenFriendMod.java#L141-L156) 中的匿名监听器 |

**通知参数**：

```json
{
  "level": "INFO",
  "msg": "connected to Xbox Live",
  "attrs": {
    "xuid": "123456789"
  }
}
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `level` | `string` | 日志级别: `DEBUG`, `INFO`, `WARN`, `ERROR` |
| `msg` | `string` | 日志消息 |
| `attrs` | `object` | 可选的附加属性 |

---

## 10. 控制命令 (quit)

| 项目 | 详情 |
|---|---|
| **方向** | Mod → Core (请求) |
| **方法名** | `quit` |
| **调用位置** | [`IpcClient.stop()`](../common/src/main/java/jp/zpw/openfriend/common/ipc/IpcClient.java#L76) |

**请求参数**: `null`  
**说明**: 通知 Core 优雅关闭。在 JVM 关闭钩子中调用，超时 500ms 后强制销毁进程。

---

## 11. 数据模型

### 11.1 Friend

**源文件**: [`Friend.java`](../common/src/main/java/jp/zpw/openfriend/common/model/Friend.java)

```java
public final class Friend {
    public final UUID profileId;   // Minecraft Profile UUID
    public final String name;      // Xbox Gamertag / 显示名
}
```

**JSON 表示**：

```json
{
  "profileId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "name": "PlayerName"
}
```

### 11.2 PresenceStatus

**源文件**: [`PresenceStatus.java`](../common/src/main/java/jp/zpw/openfriend/common/model/PresenceStatus.java)

| 枚举值 | 说明 | `isOnline()` | `isPlaying()` | `isHosting()` |
|---|---|---|---|---|
| `UNKNOWN` | 状态未知 | ✗ | ✗ | ✗ |
| `ONLINE` | 在线 | ✓ | ✗ | ✗ |
| `PLAYING_OFFLINE` | 单人游戏中 | ✓ | ✓ | ✗ |
| `PLAYING_REALMS` | Realms 中 | ✓ | ✓ | ✗ |
| `PLAYING_SERVER` | 多人服务器中 | ✓ | ✓ | ✗ |
| `PLAYING_HOSTED_SERVER` | 正在托管（可加入） | ✓ | ✓ | ✓ |
| `OFFLINE` | 离线 | ✗ | ✗ | ✗ |

### 11.3 FriendsState 内部状态结构

**源文件**: [`FriendsState.java`](../common/src/main/java/jp/zpw/openfriend/common/state/FriendsState.java)

```
FriendsState
├── friends: Map<UUID, Friend>          // 已确认好友
├── incoming: Map<UUID, Friend>         // 收到的好友请求
├── outgoing: Map<UUID, Friend>         // 发出的好友请求
├── presence: Map<UUID, PresenceStatus> // 好友在线状态
├── blocks: Set<UUID>                   // 已屏蔽玩家
├── host: HostInfo                      // 托管状态
│   ├── running: boolean
│   ├── target: String                  // 桥接的目标地址
│   └── useBypass: boolean
├── join: JoinInfo                      // 加入状态
│   ├── running: boolean
│   ├── peer: String
│   ├── pmid: String
│   └── listen: String                  // 本地代理监听地址
└── auth: AuthInfo                      // 认证状态
    ├── authenticated: boolean
    ├── profileId: UUID
    └── name: String
```

---

## 12. 认证流程详解

### 12.1 完整认证链路

```
┌──────────────┐    accessToken     ┌──────────────┐    MSA Token     ┌─────────────┐
│  Minecraft   │  ───────────────►  │  OpenFriend   │  ─────────────►  │  Xbox Live   │
│  Launcher    │                    │  Core (Go)    │                   │  User Auth   │
│              │                    │               │  ◄─────────────   │  API         │
└──────────────┘                    │               │   XBL Token      └─────────────┘
                                    │               │
                                    │               │    XBL Token     ┌─────────────┐
                                    │               │  ─────────────►  │  XSTS        │
                                    │               │  ◄─────────────  │  Token       │
                                    │               │   XSTS Token     │  Service     │
                                    │               │                  └─────────────┘
                                    │               │
                                    │               │   XSTS Token     ┌─────────────┐
                                    │               │  ─────────────►  │  Minecraft   │
                                    │               │  ◄─────────────  │  Services    │
                                    │               │  MC Token+UUID   │  REST API    │
                                    └──────────────┘                   └─────────────┘
```

### 12.2 会话传递流程 (auth.useMojangSession)

```
  Mod 启动
    │
    ▼
  检查 User.getAccessToken() 和 User.getProfileId()
    │
    ├─ 有令牌 ──► 发送 auth.useMojangSession
    │                  │
    │                  ├─ 成功 ──► primeFromList() + presence.set + presence.watch
    │                  │
    │                  └─ 失败 ──► 回退到 auth.signIn (设备码)
    │
    └─ 无令牌 ──► 直接调用 auth.signIn (设备码)
```

### 12.3 设备码认证流程 (auth.signIn)

```
  Mod                              Core                          Microsoft
   │                                │                                │
   │  auth.signIn                   │                                │
   │ ──────────────────────────►    │                                │
   │                                │   请求设备码                    │
   │                                │ ─────────────────────────────► │
   │                                │   ◄───────────────────────────  │
   │  auth.deviceCode (通知)        │   deviceCode + verificationUri │
   │ ◄──────────────────────────    │                                │
   │                                │                                │
   │  显示 SignInScreen             │                                │
   │  打开浏览器                    │                                │
   │  用户在浏览器登录              │    轮询设备码状态               │
   │                                │ ─────────────────────────────► │
   │                                │   ◄───────────────────────────  │
   │                                │   MSA Token                    │
   │                                │                                │
   │                                │   MSA → XBL → XSTS → MC       │
   │                                │   (内部认证链)                  │
   │                                │                                │
   │  auth.signedIn (通知)          │                                │
   │ ◄──────────────────────────    │                                │
   │                                │                                │
   │  auth.signIn 响应 (成功)       │                                │
   │ ◄──────────────────────────    │                                │
   │                                │                                │
   │  primeFromList()               │                                │
   │  presence.set("ONLINE")        │                                │
   │  presence.watch(60)            │                                │
```

---

## 13. Core 二进制管理

**相关源文件**：
- [`CoreBinary.java`](../helper/src/main/java/jp/zpw/openfriend/helper/CoreBinary.java)
- [`CoreLauncher.java`](../helper/src/main/java/jp/zpw/openfriend/helper/CoreLauncher.java)

### 二进制命名规则

```
openfriend-{os}-{arch}[.exe]
```

| OS | Arch | 二进制名 |
|---|---|---|
| Windows | amd64 | `openfriend-windows-amd64.exe` |
| Windows | arm64 | `openfriend-windows-arm64.exe` |
| macOS | amd64 | `openfriend-darwin-amd64` |
| macOS | arm64 | `openfriend-darwin-arm64` |
| Linux | amd64 | `openfriend-linux-amd64` |
| Linux | arm64 | `openfriend-linux-arm64` |

### 数据目录

| 平台 | 路径 |
|---|---|
| Windows | `%APPDATA%\openfriend\` |
| macOS | `~/Library/Application Support/openfriend/` |
| Linux | `$XDG_DATA_HOME/openfriend/` 或 `~/.local/share/openfriend/` |

### Core 进程启动参数

```bash
/path/to/openfriend-{os}-{arch} --ipc-stdio --watch-parent --no-update --data-dir /path/to/data
```

| 参数 | 说明 |
|---|---|
| `--ipc-stdio` | 使用 stdin/stdout 进行 JSON-RPC 通信 |
| `--watch-parent` | 监控父进程，父进程退出时自动退出 |
| `--no-update` | 禁用自动更新 |
| `--data-dir` | 指定数据存储目录 |

---

## 14. 使用示例

### 初始化 IPC 连接

```java
// 1. 创建 CoreLauncher
CoreLauncher launcher = new CoreLauncher(
    CoreLauncher.defaultDataDir("openfriend"),
    OpenFriendMod.class.getClassLoader()
);

// 2. 创建 IpcClient
IpcClient ipc = new IpcClient(
    () -> launcher.spawnIpc(),     // 进程工厂
    line -> LOG.info("core: {}", line)  // stderr 日志接收
);

// 3. 添加监听器
FriendsState state = new FriendsState();
ipc.addListener(state);

// 4. 启动
ipc.start();
```

### 执行认证

```java
// 尝试使用 Minecraft 会话
JsonObject params = IpcClient.params(
    "accessToken", user.getAccessToken(),
    "profileId", user.getProfileId().toString(),
    "name", user.getName()
);

ipc.requestAsync("auth.useMojangSession", params)
    .whenComplete((result, err) -> {
        if (err == null) {
            // 认证成功，初始化好友列表
            state.primeFromList(ipc);
            ipc.requestAsync("presence.set", IpcClient.params("status", "ONLINE"));
            ipc.requestAsync("presence.watch", IpcClient.params("intervalSeconds", 60));
        } else {
            // 回退到设备码认证
            ipc.requestAsync("auth.signIn", null);
        }
    });
```

### 搜索并添加好友

```java
// 搜索玩家
ipc.requestAsync("friends.search", IpcClient.params("name", "SteveGamer123"))
    .whenComplete((result, err) -> {
        if (err != null) return;
        boolean found = result.get("found").getAsBoolean();
        if (found && !result.get("isFriend").getAsBoolean()) {
            // 发送好友请求
            ipc.requestAsync("friends.add", IpcClient.params("name", "SteveGamer123"));
        }
    });
```

### 托管世界给好友

```java
// 将本地服务器暴露给好友
ipc.requestAsync("host.start",
    IpcClient.params("target", "127.0.0.1:25565", "useBypass", false))
    .whenComplete((res, err) -> {
        if (err != null) {
            LOG.warn("host.start failed: {}", err.getMessage());
        } else {
            LOG.info("World shared — friends can join.");
        }
    });
```

### 加入好友的世界

```java
// 连接到好友的托管世界
ipc.requestAsync("join.start",
    IpcClient.params("name", "FriendName", "listen", "127.0.0.1:25577"))
    .whenComplete((result, err) -> {
        if (err == null && result != null) {
            String listen = result.get("listen").getAsString();
            // 连接到本地代理
            connectToServer(listen);
        }
    });
```

---

## 15. 附录：源码文件索引

### IPC 通信层

| 文件 | 说明 |
|---|---|
| `common/src/main/java/jp/zpw/openfriend/common/ipc/IpcClient.java` | JSON-RPC 2.0 客户端，管理与 Core 的 stdin/stdout 通信 |
| `common/src/main/java/jp/zpw/openfriend/common/ipc/IpcListener.java` | 通知监听接口 |
| `common/src/main/java/jp/zpw/openfriend/common/ipc/IpcException.java` | IPC 错误类型，含语义化错误码 |

### 数据模型

| 文件 | 说明 |
|---|---|
| `common/src/main/java/jp/zpw/openfriend/common/model/Friend.java` | 好友数据模型 (profileId + name) |
| `common/src/main/java/jp/zpw/openfriend/common/model/PresenceStatus.java` | 在线状态枚举 (7 种状态) |

### 状态管理

| 文件 | 说明 |
|---|---|
| `common/src/main/java/jp/zpw/openfriend/common/state/FriendsState.java` | 核心状态管理器，实现 IpcListener，维护所有好友/认证/托管/加入状态 |

### 控制器

| 文件 | 说明 |
|---|---|
| `common/src/main/java/jp/zpw/openfriend/common/screen/FriendsController.java` | 好友功能控制器，封装所有 IPC 调用的业务逻辑 |

### Core 二进制管理

| 文件 | 说明 |
|---|---|
| `helper/src/main/java/jp/zpw/openfriend/helper/CoreBinary.java` | Core 二进制的解压、权限设置、路径解析 |
| `helper/src/main/java/jp/zpw/openfriend/helper/CoreLauncher.java` | Core 进程的启动与管理 |

### Minecraft 集成

| 文件 | 说明 |
|---|---|
| `common-mc/src/main/java/jp/zpw/openfriend/mc/OpenFriendMod.java` | Mod 主入口，引导初始化、认证、IPC 启动 |
| `common-mc/src/main/java/jp/zpw/openfriend/mc/ui/SignInScreen.java` | 设备码登录 UI 界面 |
| `common-mc/src/main/java/jp/zpw/openfriend/mc/ui/MCScreenOpener.java` | 好友覆盖层打开器 + MultiplayBridge + host/join 集成 |
| `common-mc/src/main/java/jp/zpw/openfriend/mc/toast/ToastDispatcher.java` | IPC 通知 → Minecraft Toast 分发 |
| `common-mc/src/main/java/jp/zpw/openfriend/mc/mixin/IntegratedServerMixin.java` | 拦截 LAN 发布事件，触发 `host.start` |

---

## API 方法速查表

| 方法名 | 方向 | 类型 | 说明 |
|---|---|---|---|
| `auth.useMojangSession` | Mod → Core | 请求 | 传递 Minecraft 会话令牌 |
| `auth.signIn` | Mod → Core | 请求 | 触发设备码登录 |
| `auth.status` | Mod → Core | 请求 | 查询认证状态 |
| `auth.deviceCode` | Core → Mod | 通知 | 下发设备码 |
| `auth.signedIn` | Core → Mod | 通知 | 登录成功 |
| `friends.list` | Mod → Core | 请求 | 获取好友列表 |
| `friends.search` | Mod → Core | 请求 | 搜索 Gamertag |
| `friends.add` | Mod → Core | 请求 | 发送好友请求 |
| `friends.accept` | Mod → Core | 请求 | 接受好友请求 |
| `friends.decline` | Mod → Core | 请求 | 拒绝好友请求 |
| `friends.remove` | Mod → Core | 请求 | 删除好友/取消请求 |
| `friends.snapshot` | Core → Mod | 通知 | 好友快照更新 |
| `friend.added` | Core → Mod | 通知 | 新好友添加 |
| `friend.removed` | Core → Mod | 通知 | 好友移除 |
| `friend.requestIncoming` | Core → Mod | 通知 | 收到好友请求 |
| `friend.requestIncomingResolved` | Core → Mod | 通知 | 收到的请求已处理 |
| `friend.requestOutgoing` | Core → Mod | 通知 | 发出好友请求 |
| `friend.requestOutgoingResolved` | Core → Mod | 通知 | 发出的请求已处理 |
| `friend.joined` | Core → Mod | 通知 | 好友加入 |
| `presence.set` | Mod → Core | 请求 | 设置在线状态 |
| `presence.watch` | Mod → Core | 请求 | 启动状态监听 |
| `presence.changed` | Core → Mod | 通知 | 好友状态变化 |
| `blocks.list` | Mod → Core | 请求 | 获取屏蔽列表 |
| `blocks.add` | Mod → Core | 请求 | 屏蔽玩家 |
| `blocks.remove` | Mod → Core | 请求 | 解除屏蔽 |
| `host.start` | Mod → Core | 请求 | 开始托管 |
| `host.stop` | Mod → Core | 请求 | 停止托管 |
| `host.status` | Mod → Core | 请求 | 查询托管状态 |
| `host.started` | Core → Mod | 通知 | 托管已启动 |
| `host.stopped` | Core → Mod | 通知 | 托管已停止 |
| `join.start` | Mod → Core | 请求 | 发起加入 |
| `join.started` | Core → Mod | 通知 | 加入已启动 |
| `join.stopped` | Core → Mod | 通知 | 加入已停止 |
| `log` | Core → Mod | 通知 | 日志转发 |
| `quit` | Mod → Core | 请求 | 优雅关闭 |
