# MC 存档备份功能闭环分析与设计

## 结论

当前项目的 MC 存档备份功能只有手动操作的局部闭环，不具备完整逻辑闭环。

已闭合的部分是：存档列表展示、手动创建备份、备份列表展示、恢复前校验、恢复前保护备份、恢复、删除备份、删除存档到回收目录。这条链路主要由前端 `SavePanel/useSaveManager/saveService` 调用 Tauri command，再落到后端 `SaveManagerService`。

未闭合的部分集中在三类：

1. 自动备份触发没有落地。UI 和元数据识别了 `auto_exit`、`auto_interval`，但后端只有 `manual` 和 `restore_guard` 两个实际触发源。游戏退出事件只发出 `game-exit`，没有接入存档备份。
2. 备份安全状态没有真实判定。`safeBackup` 在手动备份和恢复保护备份中都直接写 `true`，没有判断游戏是否运行、存档是否仍在写入、文件是否稳定。
3. 差异备份不是可可靠恢复的闭环。差异包只按“文件修改时间晚于最近全量备份创建时间”过滤，不记录删除文件，不校验 base 是否存在，也允许删除被依赖的全量备份。恢复时如果 base 缺失会静默跳过，可能把不完整差异包当成完整存档恢复。

## 当前实现梳理

### 前端链路

- `src/features/InstanceDetail/logic/saveService.ts` 封装了 `get_saves`、`backup_save`、`get_save_backups`、`verify_save_restore`、`restore_save_backup`、`delete_save_backup`、`delete_save`。
- `src/features/InstanceDetail/hooks/useSaveManager.ts` 负责加载存档和备份，监听 `save-backup-progress`，并在备份、恢复、删除后刷新数据。
- `src/features/InstanceDetail/components/tabs/SavePanel.tsx` 提供恢复中心、打开目录、每个存档的备份/历史/删除入口。
- `BackupConfirmModal.tsx` 支持全量和差异备份选择。有全量备份时默认选择差异备份。
- `SaveRestoreModal.tsx` 在恢复前调用 `verifyRestore`，展示版本、Loader、Mod、配置差异和安全提示。

### 后端链路

- `src-tauri/src/commands/instance/save_cmd.rs` 只是 Tauri command 转发层。
- `src-tauri/src/services/instance/save_manager.rs` 是核心逻辑：
  - 存档目录：`<game_dir>/saves/<folderName>`。
  - 备份目录：`<base>/backups/saves/<instanceId>/<worldUuid>/<backupId>/`。
  - 单个备份包含 `meta.json`、`world.zip`、可选 `configs.zip`、可选 `preview.png`。
  - 手动备份通过 `backup_save -> create_backup(..., "manual", true, mode)`。
  - 恢复前保护备份通过 `restore_backup -> create_backup(..., "restore_guard", true, "full")`。
  - 恢复差异备份时先解压 base 的 `world.zip/configs.zip`，再叠加当前差异包。

### 启动/退出链路

- `src-tauri/src/services/launcher/mod.rs` 在游戏进程退出后完成游玩时长统计，并发出 `game-exit`。
- `src/features/GameLog/hooks/useLogService.ts` 监听 `game-exit`，只处理日志面板、崩溃分析和状态切换。
- 当前没有任何地方在 `game-exit` 后调用存档备份，也没有定时备份调度器。

## 断点与风险

### 1. 自动备份触发断开

备份元数据支持 `trigger`，前端也能展示 `auto_exit` 和 `auto_interval`，但代码搜索显示实际调用 `create_backup` 的地方只有：

- 手动备份：`backup_save` 写入 `manual`。
- 恢复前保护：`restore_backup` 写入 `restore_guard`。

因此“退出备份”和“定时备份”目前只是预留概念，不是业务闭环。用户退出游戏后不会自动生成备份，恢复中心也不会出现真实的退出备份记录。

### 2. 安全备份标记不可信

`safeBackup` 是恢复校验的重要提示，但当前由调用方直接传入，手动备份和恢复保护备份都写 `true`。系统没有判断：

- 当前实例的游戏进程是否仍在运行。
- 存档目录是否在短时间内持续变化。
- `level.dat`、region 文件、session lock 等关键文件是否处于写入状态。
- 备份过程中是否出现部分读取失败或文件变化。

这会导致 UI 显示“安全快照”，但实际可能是在游戏写盘期间打包出来的不一致状态。

### 3. 差异备份缺少恢复闭环

当前差异备份以最近全量备份的 `createdAt` 为基准，只打包修改时间更晚的文件。这存在几个关键缺口：

- 无删除清单：如果 base 中存在文件 A，差异备份时 A 已被删除，恢复会先还原 base，再叠加差异包，A 会被错误保留。
- 无目录状态清单：空目录、新增后又删除的路径无法表达。
- base 缺失不阻断恢复：恢复差异备份时找不到 base 会继续执行，最终可能只解压差异包。
- 删除备份无依赖检查：用户可以删除某个全量备份，导致依赖它的差异备份仍显示可恢复。
- 差异链只依赖最近全量，不支持链完整性校验、压缩合并或过期策略。

因此差异备份当前更像“增量文件包”，不是严格可恢复的快照。

### 4. 恢复操作不具备事务级回滚

恢复时会先创建恢复前保护备份，然后把目标存档目录删除，再移动临时恢复目录。如果删除目标后移动失败，理论上可以靠保护备份找回，但流程本身没有自动回滚，也没有恢复操作状态记录。配置恢复也是先删除再复制，失败后可能留下半恢复状态。

### 5. 备份元数据缺少完整性校验

`meta.json` 记录了环境摘要和大小，但没有记录：

- 每个备份 payload 的 hash。
- 文件清单 hash。
- 备份 schema version。
- 差异备份的 base 完整性摘要。
- 创建时文件稳定性检查结果。

因此系统只能判断 zip 文件是否存在，不能判断 zip 是否损坏、是否属于期望 base、是否能完整恢复到某个世界状态。

## 闭环目标

闭环定义：一次存档备份能力必须覆盖“触发、创建、记录、校验、保留、恢复、回滚、清理、可观测”全生命周期，且每一步失败都有明确状态和补偿路径。

目标能力：

1. 触发闭环：手动、退出、定时、恢复前保护都进入同一个备份任务入口。
2. 安全闭环：备份前判断实例运行状态和文件稳定性，不能安全备份时明确降级为 `unsafe` 或阻断。
3. 快照闭环：全量和差异都能表达一个完整世界状态，恢复时必须验证依赖完整。
4. 恢复闭环：恢复前保护、临时目录恢复、原目录交换、失败自动回滚。
5. 清理闭环：删除备份时检查差异依赖，保留策略不会破坏可恢复链。
6. 可观测闭环：所有任务都有状态、进度、失败原因和可重试信息。

## 建议架构

### 核心模块

新增或重构为以下服务边界：

- `SaveBackupOrchestrator`：统一入口，接收备份请求，负责排队、锁、触发来源、任务状态。
- `SaveSnapshotBuilder`：负责构建全量或差异快照，包括文件清单、删除清单、payload hash。
- `SaveBackupRepository`：负责备份目录、元数据读写、依赖查询、保留策略。
- `SaveRestoreService`：负责恢复校验、恢复计划、目录交换、失败回滚。
- `SaveBackupScheduler`：负责退出自动备份和定时备份触发。
- `InstanceRuntimeRegistry`：记录实例运行状态、进程 PID、启动时间、退出时间，供备份安全判断使用。

### 备份状态模型

建议引入任务状态文件或数据库表：

```text
Queued -> Running -> Verifying -> Completed
                  -> Failed
                  -> Cancelled
```

备份目录写入阶段使用临时目录：

```text
<backupId>.tmp/
  meta.pending.json
  world.zip
  configs.zip
  manifest.json
```

完成后原子移动为：

```text
<backupId>/
  meta.json
  world.zip
  configs.zip
  manifest.json
  preview.png
```

启动时扫描 `.tmp` 和 `meta.pending.json`，标记为失败或清理。

## 元数据设计

建议在 `meta.json` 中加入 schema version 和完整性字段：

```json
{
  "schemaVersion": 2,
  "backupId": "...",
  "instanceId": "...",
  "world": {
    "uuid": "...",
    "folderName": "...",
    "name": "..."
  },
  "type": "full",
  "baseBackupId": null,
  "createdAt": 1780000000,
  "trigger": "manual",
  "safety": {
    "safeBackup": true,
    "gameRunning": false,
    "stableCheckPassed": true,
    "changedDuringBackup": false,
    "warnings": []
  },
  "environment": {
    "mcVersion": "...",
    "loader": "...",
    "loaderVersion": "...",
    "modsHash": "...",
    "configHash": "..."
  },
  "payloads": {
    "world": {
      "file": "world.zip",
      "sha256": "...",
      "size": 123
    },
    "configs": {
      "file": "configs.zip",
      "sha256": "...",
      "size": 456
    }
  },
  "manifest": {
    "file": "manifest.json",
    "sha256": "..."
  }
}
```

`manifest.json` 用于描述快照文件状态：

```json
{
  "entries": [
    {
      "path": "region/r.0.0.mca",
      "kind": "file",
      "size": 123,
      "mtime": 1780000000,
      "sha256": "..."
    }
  ],
  "deleted": [
    "region/r.1.0.mca"
  ]
}
```

差异备份必须记录相对于 base 的新增、修改、删除。恢复差异时按以下顺序：

1. 校验 base 存在且 payload hash 正确。
2. 解压 base 到临时目录。
3. 应用差异包新增/修改文件。
4. 按 `deleted` 清单删除文件。
5. 校验恢复后 manifest hash。
6. 与目标目录进行原子交换。

## 触发闭环设计

### 手动备份

前端继续调用 `backup_save`，后端改为创建 `BackupJob`：

```text
manual request -> enqueue job -> acquire instance save lock -> safety check -> build snapshot -> verify payload -> publish metadata -> emit completed
```

如果游戏正在运行，默认策略应提示用户：

- 继续备份但标记 `unsafe`。
- 等游戏退出后自动执行。
- 取消。

### 退出自动备份

在 `LauncherService::launch_instance` 的 `child.wait()` 后触发：

```text
game process exits -> finish playtime -> emit game-exit -> SaveBackupScheduler.onGameExit(instanceId)
```

`onGameExit` 应：

1. 读取实例备份设置。
2. 等待冷却时间，例如 3-10 秒，确保 MC 写盘完成。
3. 扫描 `saves`，按策略选择要备份的世界：
   - 最近游玩世界优先。
   - 或上次启动前记录的存档状态中有变化的世界。
4. 为每个目标世界创建 `trigger=auto_exit` 的备份任务。
5. 备份失败时记录任务失败，不阻塞游戏退出。

### 定时备份

定时备份不应只靠前端页面存在。建议后端维护调度：

```text
app startup -> load backup policies -> scheduler tick -> if instance not running and save changed -> enqueue auto_interval job
```

如果实例正在运行，可以根据策略选择跳过、延后或 unsafe 备份。

## 恢复闭环设计

恢复流程应从“直接删除目标目录”改为“计划式恢复”：

```text
verify backup chain
create restore guard backup
extract snapshot to .restore-<id>
verify extracted manifest
rename current save to .rollback-<id>
rename .restore-<id> to target
verify target exists
remove rollback after success or retain for N days
```

失败补偿：

- 如果提取失败：删除 `.restore-*`，不动原存档。
- 如果交换失败：尝试把 `.rollback-*` 移回原目录。
- 如果配置恢复失败：保留配置 rollback，并在结果中返回 `partial=true`。

恢复返回值建议增加：

```json
{
  "backupId": "...",
  "restoredFolderName": "...",
  "restoredConfigs": true,
  "guardBackupId": "...",
  "rollbackPath": "...",
  "partial": false,
  "warnings": []
}
```

## 删除与保留策略

删除备份前必须检查依赖：

- 如果删除全量备份会影响差异备份，默认阻止删除。
- 可提供“级联删除依赖差异备份”选项。
- 保留策略按链处理，不能只按时间删除单个备份。

建议策略：

- 每个世界至少保留最近 1 个完整可恢复链。
- 每 N 次差异备份后强制创建全量备份，例如 5 次。
- 差异链最大跨度，例如 7 天。
- 删除前先验证剩余链仍有完整恢复点。

## 配置项建议

实例级备份设置：

```json
{
  "saveBackup": {
    "enabled": true,
    "manualDefaultMode": "differential",
    "autoOnExit": true,
    "autoIntervalMinutes": 0,
    "includeConfigs": true,
    "backupAllWorldsOnExit": false,
    "retention": {
      "maxBackupsPerWorld": 20,
      "maxDifferentialsPerFull": 5,
      "keepDays": 30
    },
    "safety": {
      "waitAfterExitSeconds": 5,
      "requireStableFiles": true,
      "stableWindowSeconds": 2
    }
  }
}
```

全局设置可提供默认值，实例设置覆盖全局设置。

## 实施优先级

### P0：补齐真实闭环

1. 增加统一备份任务入口，保留现有 command 兼容。
2. 接入游戏退出后的 `auto_exit` 备份触发。
3. 增加实例级备份配置和默认策略。
4. 恢复差异备份时强制校验 base，base 缺失则禁止恢复。
5. 删除全量备份时检查差异依赖。

### P1：修正差异备份语义

1. 增加 manifest 和 deleted 清单。
2. 差异恢复应用删除清单。
3. payload 增加 sha256 校验。
4. 备份列表标识“完整可恢复 / 依赖缺失 / 损坏”。

### P2：强化事务与安全

1. 恢复目录交换增加 rollback。
2. 备份前后做文件稳定性检查。
3. `safeBackup` 改为检测结果，不再由调用方直接写死。
4. 增加启动时残留 `.tmp/.restore/.rollback` 清理和恢复提示。

### P3：体验和维护

1. 定时备份调度。
2. 保留策略自动清理。
3. 备份任务历史和失败重试。
4. 文案编码修复，目前多个 saves 相关 TSX 输出呈现乱码，建议统一确认文件编码和 i18n 文案来源。

## 验收标准

1. 手动备份后能在恢复中心看到记录，恢复成功后世界目录可用。
2. 游戏正常退出后，在启用 `autoOnExit` 时自动生成 `trigger=auto_exit` 的备份记录。
3. 游戏运行中触发备份时，系统不会误标 `safeBackup=true`。
4. 删除某个全量备份时，如果仍有差异备份依赖它，系统会阻止或要求级联删除。
5. base 缺失的差异备份不能执行恢复。
6. 差异备份能正确表达文件删除，恢复后不会保留 base 中已删除的旧文件。
7. 恢复失败时原存档目录仍可恢复，返回结果明确标识失败阶段。
8. 应用重启后不会展示半成品 `.tmp` 备份为可恢复备份。

## 推荐的最小改造路径

最小可交付闭环不必一次完成完整调度系统，建议先做：

1. 后端新增 `backup_save_internal(instanceId, folderName, trigger, mode, safetyPolicy)`，让手动、退出、恢复保护共用。
2. 在游戏退出后调用自动备份，只备份最近修改的一个世界，默认全量或按现有 UI 策略选择差异。
3. 恢复差异备份时如果找不到 base，直接返回错误。
4. 删除全量备份前扫描是否有差异备份依赖，存在则阻止。
5. `safeBackup` 至少基于“实例进程不在运行 + 文件稳定窗口通过”计算。

完成以上 5 点后，功能才算具备基本闭环；后续再补 manifest、删除清单、hash 校验和事务 rollback。
