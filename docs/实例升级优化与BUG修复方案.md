# 实例升级优化与 BUG 修复方案

## 目标

实例升级必须和新建实例、整合包部署使用同一套运行库下载与验证能力，并满足以下约束：

- 升级成功后，实例 JSON、实例清单、SQLite 列表数据和实际可启动运行库一致。
- 同一实例不能并发升级；共享运行库不能被多个升级任务并发写入。
- 取消、失败和重试不会覆盖其他任务的取消令牌，也不会留下“配置已升级、数据库未升级”的半完成状态。
- 自动 Java 在启动和 Forge/NeoForge 安装阶段使用同一解析规则，优先使用版本匹配的托管 Java。
- 可选严格镜像模式下，所有可控下载请求仅访问用户配置的第三方源；镜像不覆盖资源时应明确失败，不得静默回退官方。
- 第三方实例升级前必须提示其 Mod、配置和存档目录不会自动迁移，并提供快照入口。

## 当前链路

~~~mermaid
flowchart LR
  UI["实例环境编辑"] --> CMD["update_instance_environment"]
  CMD --> ENV["InstanceEnvironmentService"]
  ENV --> CORE["安装游戏核心"]
  ENV --> DEPS["下载游戏依赖与资源"]
  ENV --> LOADER["安装 Loader"]
  LOADER --> VERIFY["校验 Loader"]
  VERIFY --> COMMIT["写实例清单、JSON 与数据库"]
  COMMIT --> LAUNCH["启动前校验与启动"]
~~~

## 已确认缺陷

| 优先级 | 缺陷 | 影响 |
| --- | --- | --- |
| P1 | Forge/NeoForge 安装器未使用托管 Java 回退 | Flatpak 或无系统 Java 环境无法升级 Loader |
| P1 | 同一版本核心、Loader 和临时下载文件缺少互斥 | 并发升级会竞争共享文件并产生损坏或随机失败 |
| P1 | 实例 JSON、清单、数据库非原子提交 | 写入失败后会出现磁盘与列表不一致，重试可能“假成功” |
| P1 | 同实例重复任务覆盖取消令牌 | 取消命令可能失效或取消错误任务 |
| P2 | 镜像策略会自动回退官方源 | 受限网络用户无法保证只使用第三方源 |
| P2 | Loader 构建传入的 Java 目录多拼一层 runtime | 外部 Loader 库可能访问错误缓存或 Java 目录 |
| P2 | 第三方实例没有升级兼容性保护 | 保留旧 Mod、配置直接切换新运行时，易导致启动崩溃 |
| P2 | 缺少环境升级的失败、并发与重试回归测试 | 高风险行为缺少自动化保护 |

## 目标设计

### 下载源策略

新增 DownloadSourcePolicy，由设置生成并在一次部署或升级开始时冻结：

- prefer：配置源优先，可回退用户允许的备用源。
- strict：只使用配置的第三方地址；资源未被镜像覆盖时返回可诊断错误。
- 核心版本、客户端 JAR、库、资源、Fabric/Quilt profile、Forge/NeoForge installer 与 NeoForge 列表均使用同一策略。
- 所有请求日志记录实际 URL、来源类型和回退原因。

### 运行库并发控制

- 实例任务使用排他注册，拒绝同实例重复升级。
- 共享运行库按资源键互斥：vanilla:<mcVersion>、loader:<type>:<mcVersion>:<loaderVersion>。
- 下载临时文件带任务唯一后缀，完成校验后原子发布。

### 提交与恢复

1. 下载并校验核心、依赖和 Loader。
2. 在实例目录生成临时 manifest。
3. 原子替换 instance_manifest.json 与 instance.json。
4. 使用 SQLite 事务更新实例及标签记录。
5. 若数据库提交失败，恢复旧 JSON 和旧 manifest；任务发出 ERROR。
6. 已处于目标环境时仍同步数据库并发出 DONE，确保重试闭环。

### Java 解析

实例启动和 Loader 安装都走统一函数：

1. 实例显式 Java。
2. 全局指定 Java。
3. runtime/java 中版本匹配的托管 Java。
4. 系统 java。

## 实施顺序

1. 修复 Loader 安装器 Java 解析与错误 java_dir。
2. 为环境升级接入排他实例任务，并修正成功、取消和重试事件。
3. 为核心与 Loader 安装增加共享资源锁和唯一临时文件。
4. 引入严格镜像模式并统一镜像策略。
5. 将实例文件和数据库更新改为可恢复提交。
6. 为第三方实例加入升级风险提示和快照。

## 回归矩阵

- Vanilla、Fabric、Quilt、Forge、NeoForge 的游戏版本升级与仅 Loader 升级。
- 已安装托管 Java、无系统 Java、显式错误 Java、Java 主版本不足。
- 同实例双击提交、同版本双实例并发、取消后重试。
- 下载中断、JSON 写失败、SQLite 写失败、清单写失败。
- prefer 与 strict 镜像策略下的核心、库、资源和 Loader 安装请求。
- 普通实例与第三方实例的升级后启动前校验和实际启动。

## 本次执行状态

已完成：

- Loader 安装的受管 Java 回退与正确的 Java 缓存目录。
- 同实例重复升级/创建任务的排他注册，及升级幂等路径的数据库同步和 DONE 事件。
- 核心版本目录写入锁，避免相同游戏版本的核心 JSON/JAR 被并发写入。
- 升级末尾提交失败时恢复原 instance.json 和 instance_manifest.json。
- 严格镜像开关，以及核心、资产、库、Fabric/Quilt、Forge/NeoForge 请求的候选源过滤。

后续阶段：

- 将运行库锁扩展为 Loader 和依赖下载的资源级锁，并为临时文件使用任务唯一名称。
- 将实例文件、SQLite 记录和标签写入收敛为单个可恢复事务。
- 为第三方实例增加升级前快照和显式兼容性确认，不自动迁移其 Mod、配置或存档目录。
