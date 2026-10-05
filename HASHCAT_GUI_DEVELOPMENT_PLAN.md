# Hashcat GUI 开发方案

## 1. 文档目的

本项目为 hashcat 提供开源桌面 UI，让用户能够配置、执行、监控和学习 hashcat 的完整命令行能力。

本方案基于工作区中的 hashcat 7.1.2 发行包与源码，并参考 hashcat 官方文档。方案只定义产品与技术实现路径，不重写 hashcat 算法。

## 2. 产品目标

1. 覆盖 hashcat 7.1.2 的公开命令、参数、哈希模式和辅助操作。
2. 让新手通过任务式界面完成常用攻击，让高级用户能够访问全部参数。
3. 在每个配置环节提供简短、准确、按需展开的指导。
4. 始终显示并支持反向解析 hashcat 命令，使 UI 成为学习 CLI 的入口。
5. 优先保证兼容性、可恢复性、本地数据安全和结果可追溯性。

### 非目标

- 不重新实现哈希算法、候选生成器或 GPU 内核。
- 不支持在线账号密码恢复。
- 不提供集群调度、Web 服务或多用户账户系统。
- 不默认自动执行第三方转换脚本。
- 不承诺覆盖 master/beta 中尚未进入稳定发行版的攻击模式。

## 3. 基线与兼容策略

### 3.1 当前基线

- hashcat 版本：7.1.2。
- 哈希模块：582 个。
- 稳定攻击模式：`0`、`1`、`3`、`6`、`7`、`9`。
- 公开 CLI 参数约 115 个。
- 计算后端：CUDA、HIP、Metal、OpenCL。
- 重要子系统：规则、掩码、Markov、Brain、会话恢复、Benchmark、Assimilation Bridge、Python/Rust 桥接插件。

### 3.2 动态能力模型

UI 不硬编码 hashcat 能力。应用启动和切换 hashcat 路径时执行：

- `hashcat -h`：读取公开参数和攻击模式。
- `hashcat --hash-info`：读取哈希模式、类别、限制和示例。
- `hashcat -I`：读取计算后端和设备。
- `hashcat -V`：确认版本。

解析结果生成 `CapabilityProfile`。控件根据该配置文件显示、禁用或提示升级。master/beta 新增模式只能在运行版本明确支持时启用。

### 3.3 平台范围

- 首发平台：Windows 10/11 x64。
- 架构保持跨平台，后续支持 Linux；macOS 需要用户自行编译 hashcat。
- 不支持 UTF-16 文件名；UI 应在选择文件时提前提示该 hashcat 限制。

## 4. 技术架构

### 4.1 推荐技术栈

| 层 | 技术 | 职责 |
|---|---|---|
| 桌面壳 | Tauri 2 | 窗口、文件对话框、系统集成、打包 |
| 后端 | Rust | 进程管理、参数编译、状态解析、文件与敏感数据处理 |
| 前端 | React + TypeScript | 表单、算法库、任务编辑器、运行监控 |
| 本地数据库 | SQLite | 任务、历史、算法目录、指导内容、用户设置 |
| UI 组件 | Radix UI + Lucide | 可访问控件、图标、提示框 |
| 测试 | Vitest + Playwright + Rust tests | 单元、集成、界面与跨版本测试 |

### 4.2 核心组件

```text
UI
 |
Job Editor -> JobSpec -> Command Compiler -> Argument Array
                                  |
                           Validation Engine
                                  |
                           Process Runner -> hashcat
                                  |
                  Status Parser / Log Parser / Result Store
                                  |
                    Session Manager + Local Database
```

#### Command Compiler

- 输入结构化 `JobSpec`，输出参数数组、可复制命令和诊断结果。
- 不通过 Shell 字符串启动进程。
- 支持命令行导入，并反向填充 UI。
- 为所有参数建立唯一的字段映射和冲突规则。

#### Process Runner

- 启动、暂停、恢复、checkpoint 停止和中止 hashcat。
- 使用 `--status-json` 或 `--machine-readable` 获取运行状态。
- 保留 stdout、stderr、退出码和设备状态码。
- 正确处理空格、Unicode 路径、相对路径和工作目录。

#### Session Manager

- 保存原始 cwd、argv、输入文件、输出文件和 restore 文件。
- 恢复时不修改原任务参数。
- checkpoint 停止优先于强制退出，避免丢失 restore 进度。
- 记录运行历史和命令，但对敏感内容脱敏。

## 5. 信息架构

### 5.1 新建任务

- 导入哈希文件、粘贴哈希或使用 stdin。
- 显示有效行、无效行、重复项和格式警告。
- 调用 `--identify` 提供候选算法，但允许人工选择。
- 提供算法搜索：模式 ID、名称、产品、类别、公式、示例。
- 对需要转换的格式显示转换工具或官方转换指南。
- 显示一次简短授权提示：仅处理有权审计的离线哈希。

### 5.2 攻击设计

为每种攻击模式提供专用界面，而不是通用参数表：

- `0 Straight`：词表、目录、多规则文件、`-j/-k`、规则调试。
- `1 Combination`：左右词表、左右单规则、组合数量。
- `3 Brute-force`：掩码、8 组自定义字符集、递增范围、Markov。
- `6 Hybrid Wordlist + Mask`：词表和后缀掩码。
- `7 Hybrid Mask + Wordlist`：前缀掩码和词表。
- `9 Association`：哈希行与候选行对应关系。

所有模式均支持候选样例、键空间计算、`--stdout` 预览、`--keyspace` 和 `--total-candidates`。

### 5.3 专家参数

按任务分组展示全部公开参数：

| 分组 | 参数范围 |
|---|---|
| 哈希输入 | 模式、分隔符、用户名、hex、编码、二进制哈希、格式专属参数 |
| 候选生成 | 词表、规则、掩码、Markov、递增、skip/limit、loopback、slow candidates |
| 输出 | potfile、outfile、格式、JSON、remove、debug、autohex |
| 会话 | session、restore、restore path、runtime、超时 |
| 设备 | 后端、设备、设备类型、虚拟实例、内存保留、CPU affinity |
| 性能 | workload、kernel 参数、optimized kernel、vector width、scrypt TMTO |
| 诊断 | status、machine-readable、benchmark、speed-only、progress-only |
| 安全 | self-test、温度中止、硬件监控、deprecated plugin、force |
| Brain | server/client、host、port、password、session、whitelist、features |
| Bridge | Python/Rust 模式、bridge parameter 1-4、运行环境检查 |

`--force`、`--self-test-disable`、`--potfile-disable`、`--restore-disable`、`--hwmon-disable` 等放入高级风险区，默认关闭。

### 5.4 运行中心

- 总进度、恢复点、运行时间、预计剩余时间。
- 每个设备的速度、温度、内存和执行状态。
- 开始、暂停、恢复、checkpoint 停止、中止。
- 原始日志和翻译后的错误建议。
- 已恢复、未恢复、拒绝候选和输出文件状态。

### 5.5 结果与历史

- 已恢复哈希、明文、来源任务和时间。
- `--show`、`--left`、potfile 管理和结果导出。
- 任务模板、参数差异、重复运行和恢复会话。
- 明文默认遮挡，显式操作后显示或导出。

### 5.6 工具箱

- Benchmark 与设备对比。
- 哈希识别和格式检查。
- 规则测试器与规则调试。
- 掩码构建器和键空间估算。
- 候选生成预览。
- 哈希转换工具入口。
- Brain 服务端/客户端状态。
- Python/Rust Bridge 环境诊断。

## 6. 指导内容设计

指导内容必须轻量，不把界面变成文档。

### 6.1 三级指导

| 层级 | 载体 | 内容限制 |
|---|---|---|
| L1 | 悬停提示/键盘聚焦提示 | 不超过 120 个汉字，只说明用途、影响和风险 |
| L2 | 可固定详情面板 | 不超过 8 行，包含默认值、适用范围、冲突和示例 |
| L3 | 官方文档链接 | 打开对应 hashcat Wiki、FAQ 或本地发行文档 |

### 6.2 展示规则

- 非显然控件旁使用信息图标；普通文本标签不附长说明。
- 悬停延迟约 300ms；提示可固定、复制，并支持键盘访问。
- 默认值、单位和合法范围直接放在控件附近，不重复写入提示。
- 仅在当前模式或配置下显示相关指导和警告。
- 风险提示说明后果，不用大段教育性文字。
- 算法、攻击模式和规则提供一个典型示例，完整资料通过 L3 获取。
- 指导内容存入版本化知识库，并标注适用的 hashcat 版本。

## 7. 数据模型

```text
JobSpec
- id, name, createdAt, hashcatVersion
- hashInput, hashMode, username, separator, encoding
- attackMode
- candidateSources[]
- rules[]
- masks[]
- markovOptions
- deviceOptions
- performanceOptions
- outputOptions
- sessionOptions
- brainOptions
- bridgeOptions
- riskOptions
```

```text
CapabilityProfile
- hashcatVersion
- options[]
- attackModes[]
- hashModes[]
- backends[]
- devices[]
- platformLimits[]
```

```text
GuidanceEntry
- controlId
- hashcatRange
- shortText
- detailText
- conflicts[]
- documentationUrl
```

数据库只保存任务元数据和必要路径。哈希、明文、Brain 密码等敏感字段使用操作系统凭据库保护的密钥加密。

## 8. 校验与错误处理

启动任务前执行三层校验：

1. 类型校验：必填、数字范围、路径、端口、字符集和枚举。
2. 兼容校验：参数与攻击模式、哈希模式、平台、hashcat 版本的适用关系。
3. hashcat 校验：使用只读命令或测试输出确认格式和参数组合。

必须覆盖的主要冲突：

- 7.1.2 中规则文件仅适用于攻击模式 `0` 和 `9`。
- 递增参数不适用于普通字典和关联攻击。
- `--stdout` 与 slow candidates 不兼容。
- `--show`、`--left` 对 outfile 格式有专门限制。
- `--remove` 与关联攻击不兼容。
- restore 命令不能修改任务参数。
- optimized kernel 可能限制密码长度并影响复杂 UTF-16 场景。
- Brain client 会自动启用 slow candidates。
- Bridge 模式受操作系统、Python ABI 和 Rust 库构建方式限制。

## 9. 安全与隐私

- 默认无遥测、无云同步、无远程日志。
- 明文、哈希、potfile、Brain 密码和恢复数据不写入普通日志。
- 命令预览和导出报告默认隐藏 Brain 密码及敏感明文。
- 外部转换器和插件必须由用户显式选择，不执行下载后自动运行。
- 所有子进程使用参数数组和明确工作目录启动。
- 应用界面明确限定为有权处理的离线哈希审计和密码恢复。

## 10. 开发阶段

### M0：基础框架

- Tauri/Rust/React 工程、SQLite、日志和设置。
- hashcat 路径管理、版本探测、能力解析。
- `JobSpec`、命令编译器和参数知识库结构。

### M1：任务与攻击配置

- 哈希导入、识别、算法目录。
- 六种稳定攻击模式构建器。
- 参数分组、冲突校验、命令预览和命令导入。
- 候选预览、键空间和估算工具。

### M2：运行与结果

- 进程生命周期、状态解析、设备监控。
- 输出、potfile、结果、历史和导出。
- session、restore、checkpoint 和退出码解释。

### M3：高级功能

- Benchmark、规则调试、Markov、Brain、Bridge。
- 格式转换工具入口和特殊哈希参数。
- 高级风险设置与平台诊断。

### M4：质量与发布

- Windows 打包、签名准备、升级策略。
- 跨 hashcat 版本测试和界面自动化。
- 中文指导内容、英文 CLI 术语、可访问性检查。
- Linux 构建验证和发布文档。

## 11. 测试策略

- 命令编译单元测试：每个参数至少一个 golden command 测试。
- 冲突测试：覆盖 `user_options_sanity` 中的限制。
- 算法目录测试：582 个模式均可加载、搜索和显示。
- 进程集成测试：stdout、stderr、退出码、暂停、恢复和中断。
- 状态解析测试：JSON、machine-readable 和异常输出。
- 会话测试：正常 checkpoint、强制退出、恢复和输入文件变更。
- Playwright：新建任务、六种攻击、运行、结果、命令导入和提示框。
- 实机测试：CUDA、OpenCL、CPU、无可用后端、驱动错误。

## 12. 验收标准

1. hashcat 7.1.2 的公开参数均可通过 UI 设置或查看。
2. 582 个哈希模式均可检索，并显示版本化能力信息。
3. 六种稳定攻击模式可配置、预览和执行。
4. UI 生成的命令可直接复制到终端执行；终端命令可反向导入。
5. 所有非法参数组合在启动前给出明确诊断。
6. 运行中断后可通过 checkpoint/restore 继续。
7. 默认日志、导出和界面不泄露明文、potfile 或 Brain 密码。
8. 指导内容不会遮挡主工作流，L1 提示保持简短，完整说明按需打开。

## 13. 参考资料

- `hashcat-7.1.2-binaries/docs/hashcat-help.md`
- `hashcat-7.1.2-binaries/docs/hashcat-example-hashes.md`
- `hashcat-7.1.2-binaries/docs/limits.txt`
- `hashcat-7.1.2-binaries/docs/exit_status_code.txt`
- `hashcat-7.1.2-binaries/docs/hashcat-brain.md`
- `hashcat-7.1.2-binaries/docs/hashcat-assimilation-bridge.md`
- https://hashcat.net/hashcat/
- https://hashcat.net/faq/
- https://hashcat.net/wiki/doku.php?id=hash_format_guidance
- https://github.com/hashcat/hashcat
