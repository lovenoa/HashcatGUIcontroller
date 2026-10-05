# Hashcat Studio Release Review

日期：2026-10-05
目标版本：0.1.0
平台：Windows 10/11 x64

## 发布结论

**工程构建已就绪，可进入候选发布阶段。公开分发前必须完成 Windows 代码签名。**

仓库内可完成的功能、测试、安全、打包和文档工作已完成。代码签名依赖发布者证书，无法通过普通构建命令替代；自签名不会建立 Windows 信任。

## 产物

- NSIS 安装包：`src-tauri/target/release/bundle/nsis/Hashcat Studio_0.1.0_x64-setup.exe`
- 主程序：`src-tauri/target/release/hashcat-gui.exe`
- 安装包 SHA-256：`3A72D4F984990A519E7C7F2B0E3BBC2C8B5709CFD138DA7B59A68C4E74F41407`
- 主程序 SHA-256：`3A5493D9725FAB10FCCCAFAC703A379EE37FA153D1009CF2B11787584E9B8338`

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

## 发布条件

1. 使用正式 Windows 发布者证书对 `hashcat-gui.exe` 和 NSIS 安装包签名。
2. 签名后重新计算并发布 SHA-256。
3. 在一台未安装开发工具的 Windows 10/11 x64 设备完成安装、启动、hashcat 路径选择和样例任务验收。
4. 发布说明中明确：安装包是 hashcat UI；hashcat 7.1.2 二进制发行包和 WebView2 是运行依赖。

## 非阻塞事项

- Vite 主包约 1.33 MB，gzip 约 525 KB。当前为单窗口桌面工具，可接受；后续可拆分算法目录。
- 运行历史目前使用 Webview 本地存储，SQLite 是后续增强。
- Windows 安装包暂未包含 hashcat 7.1.2 发行包，以避免 UI 与 hashcat 发布版本绑定。
