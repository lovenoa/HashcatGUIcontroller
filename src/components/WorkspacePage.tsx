import * as Tabs from "@radix-ui/react-tabs";
import {
  ClipboardPaste,
  FolderOpen,
  Play,
  RefreshCw,
  ScanSearch,
  ShieldCheck
} from "lucide-react";
import type { CapabilityProfile, CommandResult, JobSpec, RunSnapshot } from "../types";
import { ATTACK_MODE_LABELS } from "../lib/commandCompiler";
import { AttackEditor } from "./AttackEditor";
import { CommandPanel } from "./CommandPanel";
import { HashModeCombobox } from "./HashModeCombobox";
import { Button, Field, InfoTip, NumberInput, PathInput, Section, Select, StatusPill, TextInput, Toggle } from "./ui";

async function browseFile(): Promise<string> {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({ multiple: false });
    return typeof selected === "string" ? selected : "";
  } catch {
    return "";
  }
}

export function WorkspacePage({
  job,
  profile,
  command,
  run,
  onChange,
  onProbe,
  onRun,
  onStop,
  onControl,
  onReset,
  onImport
}: {
  job: JobSpec;
  profile: CapabilityProfile;
  command: CommandResult;
  run: RunSnapshot | null;
  onChange: (job: JobSpec) => void;
  onProbe: () => void;
  onRun: () => void;
  onStop: () => void;
  onControl: () => void;
  onReset: () => void;
  onImport: (command: string) => void;
}) {
  const selectedHashMode = profile.hashModes.find((mode) => mode.id === job.hashMode);
  const inlineLineCount = job.inlineHashes.trim() ? job.inlineHashes.trim().split(/\r?\n/).length : 0;

  function update(patch: Partial<JobSpec>) {
    onChange({ ...job, ...patch });
  }

  function updateInput(patch: Partial<JobSpec["input"]>) {
    onChange({ ...job, input: { ...job.input, ...patch } });
  }

  function updateOutput(patch: Partial<JobSpec["output"]>) {
    onChange({ ...job, output: { ...job.output, ...patch } });
  }

  function updateSession(patch: Partial<JobSpec["session"]>) {
    onChange({ ...job, session: { ...job.session, ...patch } });
  }

  function updateDevice(patch: Partial<JobSpec["device"]>) {
    onChange({ ...job, device: { ...job.device, ...patch } });
  }

  function updateRisk(patch: Partial<JobSpec["risk"]>) {
    onChange({ ...job, risk: { ...job.risk, ...patch } });
  }

  function updateBrain(patch: Partial<JobSpec["brain"]>) {
    onChange({ ...job, brain: { ...job.brain, ...patch } });
  }

  function updateBridge(patch: Partial<JobSpec["bridge"]>) {
    onChange({ ...job, bridge: { ...job.bridge, ...patch } });
  }

  return (
    <div className="workspace-layout">
      <main className="workspace-main">
        <div className="page-toolbar">
          <div>
            <div className="eyebrow">NEW JOB / M0-M1</div>
            <h1>任务工作台</h1>
            <p>从哈希目标到命令预览，在一个连续工作流中配置 hashcat。</p>
          </div>
          <div className="toolbar-actions">
            <StatusPill tone={profile.source === "live" ? "success" : "neutral"}>
              {profile.hashcatVersion === "unknown" ? "未探测" : `hashcat ${profile.hashcatVersion}`}
            </StatusPill>
            <Button variant="quiet" icon={<RefreshCw size={15} />} onClick={onProbe}>
              探测运行时
            </Button>
            <Button variant="primary" icon={<Play size={15} />} onClick={onRun}>
              启动
            </Button>
          </div>
        </div>

        <Section
          eyebrow="01 / TARGET"
          title="哈希目标"
          description="hashcat 只处理离线哈希；容器、文档和档案通常先要转换。"
          action={
            <div className="inline-actions">
              <Button
                variant="quiet"
                icon={<ClipboardPaste size={15} />}
                onClick={() => document.querySelector<HTMLTextAreaElement>("#inline-hashes")?.focus()}
              >
                粘贴哈希
              </Button>
              <Button
                variant="quiet"
                icon={<FolderOpen size={15} />}
                onClick={async () => {
                  const path = await browseFile();
                  if (path) update({ hashFile: path });
                }}
              >
                选择文件
              </Button>
            </div>
          }
        >
          <div className="target-grid">
            <Field label="hashcat 可执行文件" hint="Windows 首发默认使用工作区内的 7.1.2 发行包。">
              <PathInput value={job.hashcatPath} onChange={(value) => update({ hashcatPath: value })} placeholder="hashcat.exe 路径" />
            </Field>
            <Field label="哈希文件" guidance="hashFile" hint="每行一个哈希；也支持 hashcat 支持的二进制哈希文件。">
              <PathInput value={job.hashFile} onChange={(value) => update({ hashFile: value })} placeholder="拖入哈希文件或输入路径" />
            </Field>
            <Field label="哈希模式" guidance="hashMode" hint={selectedHashMode ? `${selectedHashMode.category} · 密码 ${selectedHashMode.passwordMin}-${selectedHashMode.passwordMax}` : "自动识别会按输入格式匹配"}>
              <HashModeCombobox
                value={job.hashMode}
                modes={profile.hashModes}
                onChange={(value) => update({ hashMode: value })}
              />
            </Field>
            <div className="target-inline field-wide">
              <div className="field-label">
                <span>粘贴哈希</span>
                <InfoTip label="hashFile" />
                {inlineLineCount ? <StatusPill tone="success">{inlineLineCount} 行</StatusPill> : null}
              </div>
              <textarea
                id="inline-hashes"
                className="text-area"
                value={job.inlineHashes}
                onChange={(event) => update({ inlineHashes: event.target.value })}
                placeholder="可选：每行粘贴一个哈希。运行时会写入临时输入文件。"
              />
            </div>
            <div className="target-summary">
              <div>
                <span>输入状态</span>
                <strong>{inlineLineCount ? "使用粘贴内容" : job.hashFile ? "使用文件" : "尚未选择"}</strong>
              </div>
              <div>
                <span>用户名行</span>
                <Toggle
                  checked={job.username}
                  onChange={(checked) => update({ username: checked })}
                  label="忽略 username 字段"
                />
              </div>
              <div>
                <span>授权边界</span>
                <strong className="text-success"><ShieldCheck size={14} /> 仅限有权处理的离线哈希</strong>
              </div>
            </div>
          </div>
        </Section>

        <Section
          eyebrow="02 / ATTACK"
          title="算法与攻击"
          description="算法决定如何验证候选；攻击模式决定候选从哪里生成。"
          action={
            <div className="algorithm-summary">
              <span>当前</span>
              <strong>{job.hashMode === "auto" ? "自动识别" : `#${job.hashMode} ${selectedHashMode?.name ?? ""}`}</strong>
              <span>·</span>
              <strong>{ATTACK_MODE_LABELS[job.attackMode]}</strong>
            </div>
          }
        >
          <AttackEditor job={job} onChange={onChange} />
        </Section>

        <Section eyebrow="03 / CONTROL" title="运行控制" description="常用设置直接可见，专家参数按任务分组。">
          <Tabs.Root className="settings-tabs" defaultValue="output">
            <Tabs.List className="tabs-list" aria-label="运行设置">
              <Tabs.Trigger value="input">输入 / 格式</Tabs.Trigger>
              <Tabs.Trigger value="output">输出</Tabs.Trigger>
              <Tabs.Trigger value="performance">设备与性能</Tabs.Trigger>
              <Tabs.Trigger value="session">会话</Tabs.Trigger>
              <Tabs.Trigger value="network">Brain / Bridge</Tabs.Trigger>
              <Tabs.Trigger value="risk">风险选项</Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="input" className="tabs-content">
              <div className="settings-grid">
                <Field label="输入编码" hint="源编码；留空表示不强制转换">
                  <TextInput value={job.input.encodingFrom} onChange={(value) => updateInput({ encodingFrom: value })} placeholder="例如 iso-8859-15" />
                </Field>
                <Field label="内部编码" hint="目标编码；建议优先使用纯内核">
                  <TextInput value={job.input.encodingTo} onChange={(value) => updateInput({ encodingTo: value })} placeholder="例如 utf-32le" />
                </Field>
                <div className="toggle-grid full">
                  <Toggle checked={job.input.hexCharset} onChange={(checked) => updateInput({ hexCharset: checked })} label="字符集为 HEX" description="对应 --hex-charset" />
                  <Toggle checked={job.input.hexSalt} onChange={(checked) => updateInput({ hexSalt: checked })} label="Salt 为 HEX" description="对应 --hex-salt" />
                  <Toggle checked={job.input.hexWordlist} onChange={(checked) => updateInput({ hexWordlist: checked })} label="词表为 HEX" description="对应 --hex-wordlist" />
                  <Toggle checked={job.input.wordlistAutohexDisable} onChange={(checked) => updateInput({ wordlistAutohexDisable: checked })} label="禁用词表 $HEX[] 转换" description="对应 --wordlist-autohex-disable" />
                  <Toggle checked={job.input.dynamicX} onChange={(checked) => updateInput({ dynamicX: checked })} label="忽略 dynamic_X 前缀" description="对应 --dynamic-x" />
                </div>
                <div className="format-specific">
                  <strong>格式专属参数</strong>
                  <div className="settings-grid">
                    <Field label="TrueCrypt keyfiles">
                      <PathInput value={job.input.trueCryptKeyFiles} onChange={(value) => updateInput({ trueCryptKeyFiles: value })} placeholder="拖入 keyfile，多个用逗号分隔" />
                    </Field>
                    <Field label="VeraCrypt keyfiles">
                      <PathInput value={job.input.veracryptKeyFiles} onChange={(value) => updateInput({ veracryptKeyFiles: value })} placeholder="拖入 keyfile，多个用逗号分隔" />
                    </Field>
                    <Field label="VeraCrypt PIM 起点">
                      <NumberInput value={job.input.veracryptPimStart} onChange={(value) => updateInput({ veracryptPimStart: value })} />
                    </Field>
                    <Field label="VeraCrypt PIM 终点">
                      <NumberInput value={job.input.veracryptPimStop} onChange={(value) => updateInput({ veracryptPimStop: value })} />
                    </Field>
                    <Field label="键盘布局映射">
                      <PathInput value={job.input.keyboardLayoutMapping} onChange={(value) => updateInput({ keyboardLayoutMapping: value })} placeholder="拖入 .hckmap 文件" />
                    </Field>
                    <Field label="HCCAPX message pair">
                      <NumberInput value={job.input.hccapxMessagePair} onChange={(value) => updateInput({ hccapxMessagePair: value })} />
                    </Field>
                    <Field label="Nonce error corrections">
                      <NumberInput value={job.input.nonceErrorCorrections} onChange={(value) => updateInput({ nonceErrorCorrections: value })} />
                    </Field>
                  </div>
                </div>
              </div>
              <div className="settings-grid" style={{ marginTop: 14 }}>
                <Field label="Debug 模式" hint="规则调试输出模式 0-5">
                  <Select value={job.output.debugMode} options={[{ value: 0, label: "关闭" }, { value: 1, label: "Finding-Rule" }, { value: 2, label: "Original-Word" }, { value: 3, label: "Original + Rule" }, { value: 4, label: "Original + Rule + Result" }, { value: 5, label: "完整追踪" }]} onChange={(value) => updateOutput({ debugMode: Number(value) })} />
                </Field>
                <Field label="Debug 文件">
                  <PathInput value={job.output.debugFile} onChange={(value) => updateOutput({ debugFile: value })} placeholder="拖入文件或输入 good.log" />
                </Field>
                <Field label="Loopback 诱导目录">
                  <PathInput value={job.output.inductionDir} onChange={(value) => updateOutput({ inductionDir: value })} placeholder="拖入目录或输入 inducts" />
                </Field>
                <Field label="第三方 outfile 监控目录">
                  <PathInput value={job.output.outfileCheckDir} onChange={(value) => updateOutput({ outfileCheckDir: value })} placeholder="拖入目录或输入路径" />
                </Field>
                <Field label="outfile 检查间隔" hint="秒">
                  <NumberInput value={job.output.outfileCheckTimer} onChange={(value) => updateOutput({ outfileCheckTimer: value })} />
                </Field>
                <Field label="remove 更新间隔" hint="秒">
                  <NumberInput value={job.output.removeTimer} onChange={(value) => updateOutput({ removeTimer: value })} />
                </Field>
                <Toggle checked={job.output.colorCracked} onChange={(checked) => updateOutput({ colorCracked: checked })} label="彩色已恢复输出" description="对应 --color-cracked" />
                <Toggle checked={job.output.logfileDisabled} onChange={(checked) => updateOutput({ logfileDisabled: checked })} label="禁用 hashcat 日志" description="对应 --logfile-disable" />
              </div>
            </Tabs.Content>

            <Tabs.Content value="output" className="tabs-content">
              <div className="settings-grid">
                <Field label="结果输出文件" guidance="potfile">
                  <PathInput value={job.output.outfile} onChange={(value) => updateOutput({ outfile: value })} placeholder="拖入文件或输入 recovered.txt" />
                </Field>
                <Field label="输出格式" hint="1 hash · 2 plain · 3 hex · 4 position · 5/6 timestamp">
                  <Select
                    value={job.output.outfileFormat.join(",")}
                    options={[
                      { value: "1,2", label: "哈希 + 明文" },
                      { value: "2", label: "仅明文" },
                      { value: "1,2,3", label: "哈希 + 明文 + HEX" },
                      { value: "1,2,4", label: "哈希 + 明文 + 位置" },
                      { value: "1,2,5", label: "哈希 + 明文 + 时间" }
                    ]}
                    onChange={(value) => updateOutput({ outfileFormat: value.split(",").map(Number) })}
                  />
                </Field>
                <Field label="分隔符">
                  <TextInput value={job.output.separator} onChange={(value) => updateOutput({ separator: value })} />
                </Field>
                <Field label="Potfile 路径" guidance="potfile">
                  <PathInput value={job.output.potfile} onChange={(value) => updateOutput({ potfile: value })} placeholder="留空使用 hashcat 默认位置" />
                </Field>
                <div className="toggle-grid">
                  <Toggle checked={job.output.potfileEnabled} onChange={(checked) => updateOutput({ potfileEnabled: checked })} label="启用 potfile" description="避免重复恢复相同哈希" />
                  <Toggle checked={job.output.outfileJson} onChange={(checked) => updateOutput({ outfileJson: checked })} label="JSON 输出" description="适合程序化处理" />
                  <Toggle checked={job.output.remove} onChange={(checked) => updateOutput({ remove: checked })} label="恢复后移除哈希" description="会修改原哈希文件" />
                  <Toggle checked={job.output.autohex} onChange={(checked) => updateOutput({ autohex: checked })} label="自动 HEX 输出" description="保留不可打印明文" />
                </div>
              </div>
            </Tabs.Content>

            <Tabs.Content value="performance" className="tabs-content">
              <div className="settings-grid">
                <Field label="后端设备 ID" hint="例如 1 或 1,2">
                  <TextInput value={job.device.backendDevices} onChange={(value) => updateDevice({ backendDevices: value })} placeholder="全部可用设备" />
                </Field>
                <Field label="工作负载" guidance="workloadProfile">
                  <Select
                    value={job.device.workloadProfile}
                    options={[
                      { value: 0, label: "自动" },
                      { value: 1, label: "1 · 低干扰" },
                      { value: 2, label: "2 · 默认" },
                      { value: 3, label: "3 · 高性能" },
                      { value: 4, label: "4 · Nightmare" }
                    ]}
                    onChange={(value) => updateDevice({ workloadProfile: Number(value) as JobSpec["device"]["workloadProfile"] })}
                  />
                </Field>
                <Field label="温度中止" hint="摄氏度；0 表示不设置">
                  <NumberInput value={job.device.temperatureAbort} onChange={(value) => updateDevice({ temperatureAbort: value })} />
                </Field>
                <Field label="保留显存" hint="百分比">
                  <NumberInput value={job.device.backendKeepFree} onChange={(value) => updateDevice({ backendKeepFree: value })} />
                </Field>
                <Field label="Kernel accel">
                  <NumberInput value={job.device.kernelAccel} onChange={(value) => updateDevice({ kernelAccel: value })} />
                </Field>
                <Field label="Kernel loops">
                  <NumberInput value={job.device.kernelLoops} onChange={(value) => updateDevice({ kernelLoops: value })} />
                </Field>
                <Field label="Kernel threads">
                  <NumberInput value={job.device.kernelThreads} onChange={(value) => updateDevice({ kernelThreads: value })} />
                </Field>
                <Field label="CPU affinity">
                  <TextInput value={job.device.cpuAffinity} onChange={(value) => updateDevice({ cpuAffinity: value })} placeholder="例如 1,2,3" />
                </Field>
                <div className="toggle-grid">
                  <Toggle checked={job.device.optimizedKernel} onChange={(checked) => updateDevice({ optimizedKernel: checked })} label="优化内核" description="更快但限制密码长度" />
                  <Toggle checked={job.device.hardwareMonitor} onChange={(checked) => updateDevice({ hardwareMonitor: checked })} label="硬件监控" description="读取温度并触发保护" />
                </div>
              </div>
            </Tabs.Content>

            <Tabs.Content value="session" className="tabs-content">
              <div className="settings-grid">
                <Field label="会话名称" guidance="restore">
                  <TextInput value={job.session.name} onChange={(value) => updateSession({ name: value })} />
                </Field>
                <Field label="运行时限" hint="秒；0 表示不限制">
                  <NumberInput value={job.session.runtime} onChange={(value) => updateSession({ runtime: value })} />
                </Field>
                <Field label="状态刷新" hint="秒">
                  <NumberInput value={job.session.statusTimer} onChange={(value) => updateSession({ statusTimer: value })} />
                </Field>
                <Field label="命令行窗口更新时间" hint="日志控制台刷新间隔，单位秒">
                  <NumberInput value={job.session.consoleUpdateTimer} min={1} onChange={(value) => updateSession({ consoleUpdateTimer: Math.max(1, value) })} />
                </Field>
                <Field label="Restore 文件">
                  <PathInput value={job.session.restorePath} onChange={(value) => updateSession({ restorePath: value })} placeholder="拖入 restore 文件或使用默认" />
                </Field>
                <div className="toggle-grid">
                  <Toggle checked={job.session.statusJson} onChange={(checked) => updateSession({ statusJson: checked })} label="JSON 状态" description="用于运行监控" />
                  <Toggle checked={job.session.restoreDisabled} onChange={(checked) => updateSession({ restoreDisabled: checked })} label="禁用 restore" description="不保存恢复检查点" />
                  <Toggle checked={job.session.machineReadable} onChange={(checked) => updateSession({ machineReadable: checked })} label="Machine-readable" description="兼容旧状态解析" />
                  <Toggle checked={job.session.quiet} onChange={(checked) => updateSession({ quiet: checked })} label="静默输出" description="只保留必要结果" />
                  <Toggle checked={job.session.openConsoleWindow} onChange={(checked) => updateSession({ openConsoleWindow: checked })} label="打开命令行日志窗口" description="持续显示完整 stdout / stderr" />
                  <Toggle checked={job.session.keepConsoleOpen} onChange={(checked) => updateSession({ keepConsoleOpen: checked })} label="任务结束后保持窗口" description="便于查看错误和最终记录" />
                </div>
              </div>
            </Tabs.Content>

            <Tabs.Content value="network" className="tabs-content">
              <div className="settings-grid">
                <div className="toggle-grid full">
                  <Toggle checked={job.brain.enabled} onChange={(checked) => updateBrain({ enabled: checked })} label="启用 Hashcat Brain" description="去重候选，不是集群调度器" />
                  <Toggle checked={job.bridge.enabled} onChange={(checked) => updateBridge({ enabled: checked })} label="启用 Bridge 模式" description="使用 Python / Rust 通用哈希插件" />
                </div>
                <Field label="Brain 角色">
                  <Select
                    value={job.brain.role}
                    options={[
                      { value: "client", label: "客户端" },
                      { value: "server", label: "服务端" }
                    ]}
                    onChange={(value) => updateBrain({ role: value as JobSpec["brain"]["role"] })}
                  />
                </Field>
                <Field label="Brain host">
                  <TextInput value={job.brain.host} onChange={(value) => updateBrain({ host: value })} />
                </Field>
                <Field label="Brain port">
                  <NumberInput value={job.brain.port} onChange={(value) => updateBrain({ port: value })} />
                </Field>
                <Field label="Brain password" guidance="brain">
                  <TextInput value={job.brain.password} type="password" onChange={(value) => updateBrain({ password: value })} />
                </Field>
                <Field label="Bridge 模式" guidance="bridge">
                  <Select
                    value={job.bridge.mode}
                    options={[
                      { value: 72000, label: "72000 · Python free-threading" },
                      { value: 73000, label: "73000 · Python with GIL" },
                      { value: 74000, label: "74000 · Rust" }
                    ]}
                    onChange={(value) => updateBridge({ mode: Number(value) as JobSpec["bridge"]["mode"] })}
                  />
                </Field>
                <Field label="Bridge parameter 1">
                  <PathInput value={job.bridge.parameter1} onChange={(value) => updateBridge({ parameter1: value })} placeholder="拖入插件、脚本或动态库" />
                </Field>
              </div>
            </Tabs.Content>

            <Tabs.Content value="risk" className="tabs-content">
              <div className="toggle-grid full">
                <Toggle checked={job.risk.stdoutPreview} onChange={(checked) => updateRisk({ stdoutPreview: checked })} label="候选预览模式" description="只生成候选，不执行破解" />
                <Toggle checked={job.risk.benchmark} onChange={(checked) => updateRisk({ benchmark: checked })} label="Benchmark 模式" description="测试设备速度" />
                <Toggle checked={job.risk.keepGuessing} onChange={(checked) => updateRisk({ keepGuessing: checked })} label="继续猜测" description="找到后仍继续运行" />
                <Toggle checked={job.risk.loopback} onChange={(checked) => updateRisk({ loopback: checked })} label="Loopback" description="把新明文送回候选队列" />
                <Toggle checked={job.risk.force} onChange={(checked) => updateRisk({ force: checked })} label="忽略 hashcat 警告" description="只用于明确接受风险时" />
                <Toggle checked={job.risk.selfTestDisable} onChange={(checked) => updateRisk({ selfTestDisable: checked })} label="禁用自检" description="跳过启动自检" />
              </div>
            </Tabs.Content>
          </Tabs.Root>
        </Section>

        <Section eyebrow="04 / EXPERT" title="专家参数补全" description="低频参数保持可见，但不干扰主任务流。">
          <div className="settings-grid">
            <Field label="虚拟设备倍数" hint="-Y；0 表示关闭">
              <NumberInput value={job.device.virtualMultiplier} onChange={(value) => updateDevice({ virtualMultiplier: value })} />
            </Field>
            <Field label="虚拟设备宿主" hint="-R 的真实设备 ID">
              <NumberInput value={job.device.virtualHost} onChange={(value) => updateDevice({ virtualHost: value })} />
            </Field>
            <Field label="Backend vector width">
              <NumberInput value={job.device.backendVectorWidth} onChange={(value) => updateDevice({ backendVectorWidth: value })} />
            </Field>
            <Field label="Spin damp" hint="CPU 同步百分比">
              <NumberInput value={job.device.spinDamp} onChange={(value) => updateDevice({ spinDamp: value })} />
            </Field>
            <Field label="scrypt TMTO">
              <NumberInput value={job.device.scryptTmto} onChange={(value) => updateDevice({ scryptTmto: value })} />
            </Field>
            <Field label="Hook threads">
              <NumberInput value={job.device.hookThreads} onChange={(value) => updateDevice({ hookThreads: value })} />
            </Field>
            <Field label="Wordfile 缓存" hint="-c，单位 MB">
              <NumberInput value={job.device.segmentSize} onChange={(value) => updateDevice({ segmentSize: value })} />
            </Field>
            <Field label="Bitmap 最小位数">
              <NumberInput value={job.device.bitmapMin} onChange={(value) => updateDevice({ bitmapMin: value })} />
            </Field>
            <Field label="Bitmap 最大位数">
              <NumberInput value={job.device.bitmapMax} onChange={(value) => updateDevice({ bitmapMax: value })} />
            </Field>
            <Field label="stdin 超时" hint="秒；0 表示不中止">
              <NumberInput value={job.session.stdinTimeoutAbort} onChange={(value) => updateSession({ stdinTimeoutAbort: value })} />
            </Field>
            <Field label="Metal 编译时限" hint="秒">
              <NumberInput value={job.session.metalCompilerRuntime} onChange={(value) => updateSession({ metalCompilerRuntime: value })} />
            </Field>
            <Field label="Benchmark 最小模式">
              <NumberInput value={job.risk.benchmarkMin} onChange={(value) => updateRisk({ benchmarkMin: value })} />
            </Field>
            <Field label="Benchmark 最大模式">
              <NumberInput value={job.risk.benchmarkMax} onChange={(value) => updateRisk({ benchmarkMax: value })} />
            </Field>
            <div className="toggle-grid full">
              <Toggle checked={job.device.multiplyAccelDisable} onChange={(checked) => updateDevice({ multiplyAccelDisable: checked })} label="禁用 multiply accel" description="对应 -M" />
              <Toggle checked={job.risk.speedOnly} onChange={(checked) => updateRisk({ speedOnly: checked })} label="仅返回速度" description="对应 --speed-only" />
              <Toggle checked={job.risk.progressOnly} onChange={(checked) => updateRisk({ progressOnly: checked })} label="仅返回进度建议" description="对应 --progress-only" />
              <Toggle checked={job.risk.keyspace} onChange={(checked) => updateRisk({ keyspace: checked })} label="查询 keyspace" description="对应 --keyspace" />
              <Toggle checked={job.risk.totalCandidates} onChange={(checked) => updateRisk({ totalCandidates: checked })} label="查询候选总数" description="对应 --total-candidates" />
            </div>
          </div>
        </Section>

        <div className="workspace-footer-note">
          <ScanSearch size={15} />
          <span>命令检查器会实时标出模式冲突。更多 hashcat 限制请查看算法详情和官方文档。</span>
          <InfoTip label="force" />
        </div>
      </main>

      <CommandPanel job={job} command={command} run={run} onRun={onRun} onStop={onStop} onControl={onControl} onReset={onReset} onImport={onImport} />
    </div>
  );
}
