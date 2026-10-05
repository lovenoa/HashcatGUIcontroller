# Hashcat Studio Release Review

日期：2026-10-05
修订日期：2026-10-06
目标版本：0.1.0
平台：Windows 10/11 x64

## 发布结论

**工程构建已就绪，可进入候选发布阶段。公开分发前必须完成 Windows 代码签名。**

仓库内可完成的功能、测试、安全、打包和文档工作已完成。代码签名依赖发布者证书，无法通过普通构建命令替代；自签名不会建立 Windows 信任。

## 产物

- NSIS 安装包：`src-tauri/target/release/bundle/nsis/Hashcat Studio_0.1.0_x64-setup.exe`
- 主程序：`src-tauri/target/release/hashcat-gui.exe`
- 安装包 SHA-256：`F6557A87865E392AF9E6CAB031A089FE5858CDAD2734E533404FC88DE5CBC70B`
- 主程序 SHA-256：`C3776FA8A21722249592C89222ED141AE2338A0D91C04E38635EFFD45DF15E63`

## 自动检查

| 检查项 | 结果 |
|---|---|
| 前端单元测试 | 19/19 通过 |
| Rust 单元测试 | 1/1 通过 |
| TypeScript production build | 通过 |
| Vite production build | 通过 |
| Rust Clippy | 0 warnings，warnings 被拒绝 |
| Rust cargo check | 通过 |
| npm 生产依赖审计 | 0 vulnerabilities |
| TODO/FIXME/HACK/源码工具残留 | 0 |
| NSIS release build | 通过 |
| NSIS 静默安装布局验证 | 通过，主程序旁包含 `WebView2Loader.dll` |
| 安装版启动冒烟测试 | 通过，进程持续运行并正常响应 |
| Windows GUI 子系统检查 | 通过，启动时不附带命令提示符 |
| hashcat 7.1.2 算法目录 | 582 项 |

## 命令覆盖

hashcat 7.1.2 共检测到 139 个长参数。134 个由命令编译器、命令导入器或工具箱直接处理。

剩余 5 个为信息查询命令，已通过 UI 功能覆盖：

- `--version`：设置页运行时版本。
- `--help`：指导与文档、控件提示。
- `--hash-info` / `--example-hashes`：动态算法目录和 582 项模式数据。
- `--backend-info`：设备探测与设备页。

## 审核中修复的问题

- hashcat `snake_case` 状态 JSON 与 Rust `camelCase` 输出映射不一致。
- 增量掩码键空间计算不正确，并存在自定义字符集递归风险。
- 任务草稿和 JSON 导出保存粘贴哈希与 Brain 密码。
- 命令预览显示 Brain 明文密码。
- 转换器允许源码目录脚本和相对输出路径。
- 暂停/继续按钮状态不明确，停止任务可能不终止。
- 长参数和 `--flag=value` 命令导入不完整。
- 进度初始化阶段没有明确状态。
- 动态窗口尺寸没有补偿标题栏和边框。
- 桌面 WebView 中官方资料链接无法调用系统浏览器。
- 进程结束时输出线程尚未刷新，导致最终状态停在“正在计算”。
- 运行历史没有清理入口。
- Windows 安装包遗漏 `WebView2Loader.dll`，导致安装版无法启动；现已随主程序安装并增加自动布局验证。
- 发布主程序使用控制台子系统，启动时额外打开命令提示符；现已改为 Windows GUI 子系统，任务日志窗口继续由独立开关控制。

## 发布条件

1. 使用正式 Windows 发布者证书对 `hashcat-gui.exe` 和 NSIS 安装包签名。
2. 签名后重新计算并发布 SHA-256。
3. 在一台未安装开发工具的 Windows 10/11 x64 设备完成安装、启动、hashcat 路径选择和样例任务验收。
4. 发布说明中明确：安装包是 hashcat UI；hashcat 7.1.2 二进制发行包和 WebView2 是运行依赖。

## 非阻塞事项

- Vite 主包约 1.33 MB，gzip 约 525 KB。当前为单窗口桌面工具，可接受；后续可拆分算法目录。
- 运行历史目前使用 Webview 本地存储，SQLite 是后续增强。
- Windows 安装包暂未包含 hashcat 7.1.2 发行包，以避免 UI 与 hashcat 发布版本绑定。
