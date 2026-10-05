import { useMemo, useState } from "react";
import { Check, Copy, Eye, EyeOff, Pause, Play, RotateCcw, Square, Upload } from "lucide-react";
import type { CommandResult, Diagnostic, JobSpec, RunSnapshot } from "../types";
import { RunMetrics } from "./RunMetrics";
import { parseRecoveredResults } from "../lib/runResults";
import { jobDisplayName } from "../lib/jobDisplay";
import { runStatus } from "../lib/runStatus";
import { Button, StatusPill } from "./ui";

export function CommandPanel({
  job,
  command,
  run,
  onRun,
  onStop,
  onControl,
  onReset,
  onImport
}: {
  job: JobSpec;
  command: CommandResult;
  run: RunSnapshot | null;
  onRun: () => void;
  onStop: () => void;
  onControl: () => void;
  onReset: () => void;
  onImport: (command: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [revealResults, setRevealResults] = useState(false);
  const recoveredResults = useMemo(() => parseRecoveredResults(run?.lines ?? []).slice(-4), [run?.lines]);
  const visibleLogLines = run?.lines?.filter((line) => !line.text.trim().startsWith("{")).slice(-8) ?? [];
  const errors = command.diagnostics.filter((item) => item.level === "error");
  const warnings = command.diagnostics.filter((item) => item.level === "warning");
  const paused = run?.paused ?? run?.stats?.status === 4;

  const status = runStatus(run);

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(command.display);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <aside className="command-panel">
      <div className="command-header">
        <div>
          <div className="eyebrow">COMMAND PREVIEW</div>
          <h2>命令检查器</h2>
        </div>
        <StatusPill tone={status.tone}>
          {status.label}
        </StatusPill>
      </div>

      <div className="command-code-wrap">
        <pre className="command-code">{command.display}</pre>
        <button className="icon-button copy-button" type="button" onClick={copyCommand} aria-label="复制命令">
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>

      <div className="command-meta">
        <div>
          <span>任务</span>
          <strong>{jobDisplayName(job)}</strong>
        </div>
        <div>
          <span>参数</span>
          <strong>{command.args.length} 项</strong>
        </div>
        <div>
          <span>诊断</span>
          <strong className={errors.length ? "text-danger" : warnings.length ? "text-warning" : "text-success"}>
            {errors.length ? `${errors.length} 错误` : warnings.length ? `${warnings.length} 提醒` : "通过"}
          </strong>
        </div>
      </div>

      <RunMetrics run={run} />

      {recoveredResults.length ? (
        <div className="quick-results">
          <div className="quick-results-head">
            <span>密码结果快速预览</span>
            <Button variant="quiet" icon={revealResults ? <EyeOff size={14} /> : <Eye size={14} />} onClick={() => setRevealResults((current) => !current)}>
              {revealResults ? "隐藏明文" : "显示明文"}
            </Button>
          </div>
          <div className="quick-result-list">
            {recoveredResults.map((result, index) => (
              <div className="quick-result-row" key={`${result.hash}-${index}`}>
                <code>{result.hash.length > 28 ? `${result.hash.slice(0, 28)}…` : result.hash}</code>
                <strong>{revealResults ? result.plain : "••••••"}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {command.diagnostics.length > 0 ? (
        <div className="diagnostic-list">
          {command.diagnostics.slice(0, 5).map((diagnostic: Diagnostic, index) => (
            <div key={`${diagnostic.field}-${index}`} className={`diagnostic ${diagnostic.level}`}>
              <span>{diagnostic.level === "error" ? "!" : diagnostic.level === "warning" ? "△" : "i"}</span>
              <div>
                <strong>{diagnostic.field}</strong>
                <p>{diagnostic.message}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="diagnostic ok">
          <span>✓</span>
          <div>
            <strong>命令结构通过</strong>
            <p>可以复制到终端执行，也可以在桌面模式直接启动。</p>
          </div>
        </div>
      )}

      {visibleLogLines.length ? (
        <div className="run-log">
          <div className="run-log-title">
            <span>实时输出</span>
            <small>{run?.lines?.length ?? 0} 行</small>
          </div>
          <pre>{visibleLogLines.map((line) => line.text).join("\n")}</pre>
        </div>
      ) : null}

      <div className="command-actions">
        {run?.running ? (
          <div className="run-actions">
            <Button variant="danger" icon={<Square size={15} />} onClick={onStop}>
              停止任务
            </Button>
            <Button variant="quiet" icon={paused ? <Play size={15} /> : <Pause size={15} />} onClick={onControl}>
              {paused ? "继续" : "暂停"}
            </Button>
          </div>
        ) : (
          <Button variant="primary" icon={<Play size={15} />} onClick={onRun} disabled={errors.length > 0}>
            启动任务
          </Button>
        )}
        <Button
          variant="quiet"
          icon={<Upload size={15} />}
          onClick={() => {
            const value = window.prompt("粘贴 hashcat 命令", command.display);
            if (value?.trim()) onImport(value.trim());
          }}
        >
          导入命令
        </Button>
        <Button variant="quiet" icon={<RotateCcw size={15} />} onClick={onReset}>
          重置状态
        </Button>
      </div>

      <div className="command-footnote">
        参数以数组传递给 hashcat，不经过 Shell。敏感字段会在导出报告中脱敏。
      </div>
    </aside>
  );
}
