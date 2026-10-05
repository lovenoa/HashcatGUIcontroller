import { useMemo, useState } from "react";
import { Activity, Calculator, FileSearch, Gauge, Play, TerminalSquare, Wrench } from "lucide-react";
import type { CapabilityProfile, JobSpec, RunSnapshot } from "../types";
import { compileCommand, formatCount, maskKeyspace } from "../lib/commandCompiler";
import { pollHashcat, startHashcat } from "../lib/hashcat";
import { runConverter } from "../lib/files";
import { Button, Field, PathInput, Section, Select, StatusPill, TextInput } from "./ui";
import { RunMetrics } from "./RunMetrics";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function ToolboxPage({ job, profile }: { job: JobSpec; profile: CapabilityProfile }) {
  const [hashText, setHashText] = useState("");
  const [hashPath, setHashPath] = useState(job.hashFile);
  const [mask, setMask] = useState(job.masks[0]?.value ?? "?u?l?l?l?l?d?d?d?d");
  const [busy, setBusy] = useState<string | null>(null);
  const [toolRun, setToolRun] = useState<RunSnapshot | null>(null);
  const [toolError, setToolError] = useState("");
  const [converterScript, setConverterScript] = useState("hashcat-7.1.2-binaries/tools/veracrypt2hashcat.py");
  const [converterInput, setConverterInput] = useState("");
  const [converterOutput, setConverterOutput] = useState("converted.hash");
  const [converterOutputText, setConverterOutputText] = useState("");

  const previewCommand = useMemo(
    () => compileCommand({ ...job, risk: { ...job.risk, stdoutPreview: true } }),
    [job]
  );
  const estimatedCandidates = useMemo(
    () => maskKeyspace(mask, job.attack.customCharsets, job.attack.increment, job.attack.incrementMin, job.attack.incrementMax),
    [job.attack.customCharsets, job.attack.increment, job.attack.incrementMax, job.attack.incrementMin, mask]
  );

  async function runTool(label: string, args: string[], inlineContent = "") {
    setBusy(label);
    setToolError("");
    setToolRun(null);

    if (!isTauri()) {
      setToolRun({
        id: "browser-tool-preview",
        paused: false,
        running: false,
        exitCode: 0,
        stats: null,
        lines: [{ stream: "stdout", text: "浏览器预览模式：工具命令已生成，桌面模式才会执行。", timestamp: Date.now() }]
      });
      setBusy(null);
      return;
    }

    try {
      const actualArgs = [...args];
      if (inlineContent.trim()) {
        const { invoke } = await import("@tauri-apps/api/core");
        const tempPath = await invoke<string>("write_temp_hashes", {
          content: inlineContent.endsWith("\n") ? inlineContent : `${inlineContent}\n`
        });
        actualArgs[actualArgs.length - 1] = tempPath;
      }

      const runId = await startHashcat(job.hashcatPath, actualArgs, "", {
        openConsole: job.session.openConsoleWindow,
        keepConsoleOpen: job.session.keepConsoleOpen,
        consoleUpdateSeconds: Math.max(1, job.session.consoleUpdateTimer || job.session.statusTimer || 2)
      });
      let snapshot: RunSnapshot = { id: runId, running: true, paused: false, exitCode: null, stats: null, lines: [] };
      while (snapshot.running) {
        await wait(250);
        snapshot = await pollHashcat(runId);
      }
      setToolRun(snapshot);
    } catch (error) {
      setToolError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  async function runConverterTool() {
    if (!converterInput.trim() || !converterOutput.trim()) return;
    setBusy("converter");
    setToolError("");
    try {
      const result = await runConverter(converterScript, converterInput, converterOutput);
      setConverterOutputText(result.output || `转换完成，退出码 ${result.exitCode}`);
    } catch (reason) {
      setToolError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="single-page">
      <div className="page-toolbar">
        <div>
          <div className="eyebrow">TOOLBOX / DIAGNOSTICS</div>
          <h1>工具箱</h1>
          <p>把 hashcat 的识别、性能、候选和键空间操作集中到独立工作面。</p>
        </div>
        <StatusPill tone={profile.source === "live" ? "success" : "neutral"}>
          {profile.hashcatVersion === "unknown" ? "未探测" : `hashcat ${profile.hashcatVersion}`}
        </StatusPill>
      </div>

      <Section
        eyebrow="01 / IDENTIFY"
        title="哈希识别"
        description="输入样例或文件路径，运行 hashcat --identify 查看候选算法。"
        action={
            <Button
            variant="primary"
            icon={<FileSearch size={15} />}
            disabled={busy !== null || (!hashText.trim() && !hashPath.trim())}
            onClick={() => runTool("identify", ["--identify", hashText.trim() ? "__inline_hashes__.hash" : hashPath.trim()], hashText)}
          >
            运行识别
          </Button>
        }
      >
        <div className="settings-grid">
          <Field label="样例哈希" hint="可直接粘贴一行或多行哈希">
            <textarea className="text-area" value={hashText} onChange={(event) => setHashText(event.target.value)} placeholder="例如 8743b52063cd84097a65d1633f5c74f5" />
          </Field>
          <Field label="或哈希文件路径">
            <PathInput value={hashPath} onChange={setHashPath} placeholder="拖入 hashes.txt" />
          </Field>
        </div>
      </Section>

      <Section
        eyebrow="01B / POTFILE"
        title="Potfile 查询"
        description="显示当前哈希列表中已经恢复或仍未恢复的项目。"
        action={
          <div className="inline-actions">
            <Button variant="quiet" disabled={busy !== null || (!hashText.trim() && !hashPath.trim())} onClick={() => runTool("show", ["--show", hashText.trim() ? "__inline_hashes__.hash" : hashPath.trim()], hashText)}>显示已恢复</Button>
            <Button variant="quiet" disabled={busy !== null || (!hashText.trim() && !hashPath.trim())} onClick={() => runTool("left", ["--left", hashText.trim() ? "__inline_hashes__.hash" : hashPath.trim()], hashText)}>显示未恢复</Button>
          </div>
        }
      >{null}</Section>

      <Section
        eyebrow="02 / PERFORMANCE"
        title="Benchmark"
        description="测试当前设备的 hashcat 速度，不读取任务哈希。"
        action={
          <Button
            variant="primary"
            icon={<Gauge size={15} />}
            disabled={busy !== null}
            onClick={() => runTool("benchmark", ["-b", ...(job.hashMode === "auto" ? [] : ["-m", String(job.hashMode)])])}
          >
            运行 Benchmark
          </Button>
        }
      >
        <div className="tool-summary-row">
          <div>
            <span>测试模式</span>
            <strong>{job.hashMode === "auto" ? "自动识别" : `#${job.hashMode}`}</strong>
          </div>
          <div>
            <span>设备</span>
            <strong>{profile.devices.length ? `${profile.devices.length} 个后端设备` : "等待探测"}</strong>
          </div>
          <div>
            <span>运行状态</span>
            <StatusPill tone={busy === "benchmark" ? "warning" : "neutral"}>{busy === "benchmark" ? "运行中" : "待运行"}</StatusPill>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="03 / CANDIDATES"
        title="候选预览"
        description="复用当前攻击配置生成 --stdout 命令，不写入 potfile 或结果文件。"
        action={
          <Button
            variant="quiet"
            icon={<Play size={15} />}
            disabled={busy !== null}
            onClick={() => runTool("preview", previewCommand.args)}
          >
            运行候选预览
          </Button>
        }
      >
        <pre className="tool-command">{previewCommand.display}</pre>
      </Section>

      <Section eyebrow="04 / KEYSPACE" title="键空间估算" description="按掩码、字符集和长度递增估算候选数量。">
        <div className="settings-grid">
          <Field label="掩码" guidance="mask">
            <TextInput value={mask} onChange={setMask} placeholder="?u?l?l?l?l?d?d?d?d" />
          </Field>
          <Field label="递增模式">
            <Select
              value={job.attack.increment}
              options={[
                { value: "none", label: "固定长度" },
                { value: "normal", label: "从左到右" },
                { value: "inverse", label: "从右到左" }
              ]}
              onChange={() => undefined}
              disabled
            />
          </Field>
        </div>
        <div className="keyspace-result">
          <Calculator size={18} />
          <div>
            <span>估算候选数</span>
            <strong>{formatCount(estimatedCandidates)}</strong>
          </div>
          <code>{mask}</code>
        </div>
      </Section>

      <Section eyebrow="05 / CONVERSION" title="格式转换工具" description="复杂容器和应用格式需要先转换为 hashcat 可读取的哈希。">
        <div className="settings-grid converter-form">
          <Field label="转换器脚本">
            <Select
              value={converterScript}
              options={[
                { value: "hashcat-7.1.2-binaries/tools/veracrypt2hashcat.py", label: "VeraCrypt" },
                { value: "hashcat-7.1.2-binaries/tools/truecrypt2hashcat.py", label: "TrueCrypt" },
                { value: "hashcat-7.1.2-binaries/tools/luks2hashcat.py", label: "LUKS" },
                { value: "hashcat-7.1.2-binaries/tools/bitlocker2hashcat.py", label: "BitLocker" },
                { value: "hashcat-7.1.2-binaries/tools/metamask2hashcat.py", label: "MetaMask" }
              ]}
              onChange={setConverterScript}
            />
          </Field>
          <Field label="输入文件">
            <PathInput value={converterInput} onChange={setConverterInput} placeholder="拖入容器、钱包或备份文件" />
          </Field>
          <Field label="输出哈希文件">
            <PathInput value={converterOutput} onChange={setConverterOutput} placeholder="converted.hash" />
          </Field>
          <div className="converter-action">
            <Button variant="primary" icon={<Wrench size={14} />} onClick={runConverterTool} disabled={busy !== null || !converterInput.trim() || !converterOutput.trim()}>运行转换器</Button>
          </div>
        </div>

        <div className="tool-link-grid">
          {[
            ["TrueCrypt / VeraCrypt", "truecrypt2hashcat.py · veracrypt2hashcat.py"],
            ["LUKS", "luks2hashcat.py"],
            ["BitLocker", "bitlocker2hashcat.py"],
            ["钱包与密码管理器", "bitwarden2hashcat.py · metamask2hashcat.py"],
            ["更多官方脚本", "hashcat-7.1.2-binaries/tools"]
          ].map(([title, detail]) => (
            <div className="tool-link" key={title}>
              <Wrench size={15} />
              <div>
                <strong>{title}</strong>
                <small>{detail}</small>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {converterOutputText ? <Section title="转换器输出" description="转换结果同时写入指定的哈希文件。"><pre className="tool-output">{converterOutputText}</pre></Section> : null}

      {toolError ? <div className="inline-warning"><Activity size={16} /><div><strong>工具执行失败</strong><p>{toolError}</p></div></div> : null}

      {toolRun ? (
        <Section title="工具输出" description="显示状态指标并保留最近一次工具命令的 stdout / stderr。">
          <RunMetrics run={toolRun} />
          <pre className="tool-output">{toolRun.lines.map((line) => line.text).join("\n") || "无输出"}</pre>
        </Section>
      ) : null}

      <div className="workspace-footer-note">
        <TerminalSquare size={15} />
        <span>工具箱只执行显式点击的命令；输入样例和结果仍遵循本地数据边界。</span>
      </div>
    </div>
  );
}
