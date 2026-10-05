import { Eraser, FolderClock, TerminalSquare, Trash2 } from "lucide-react";
import type { JobSpec, RunHistoryEntry, RunSnapshot } from "../types";
import { formatClock, formatInteger, formatSpeed } from "../lib/format";
import { jobDisplayName } from "../lib/jobDisplay";
import { runStatus } from "../lib/runStatus";
import { Button, Section, StatusPill } from "./ui";

export function SessionsPage({
  job,
  run,
  history,
  onClearHistory,
  onDeleteHistory
}: {
  job: JobSpec;
  run: RunSnapshot | null;
  history: RunHistoryEntry[];
  onClearHistory: () => void;
  onDeleteHistory: (id: string) => void;
}) {
  return (
    <div className="single-page">
      <div className="page-toolbar">
        <div>
          <div className="eyebrow">SESSION / HISTORY</div>
          <h1>运行记录</h1>
          <p>任务历史会保存命令结构和状态；恢复明文与 Brain 密码默认脱敏。</p>
        </div>
      </div>

      <Section title="当前会话" description="当前编辑任务的运行摘要。">
        <div className="session-summary">
          <div>
            <span>任务名称</span>
            <strong>{jobDisplayName(job)}</strong>
          </div>
          <div>
            <span>会话</span>
            <strong>{job.session.name}</strong>
          </div>
          <div>
            <span>运行状态</span>
            <StatusPill tone={runStatus(run).tone}>
              {runStatus(run).label}
            </StatusPill>
          </div>
          <div>
            <span>已恢复</span>
            <strong>{formatInteger(run?.stats?.recoveredHashes?.[0] ?? 0)} / {formatInteger(run?.stats?.recoveredHashes?.[1] ?? 0)}</strong>
          </div>
        </div>
      </Section>

      <Section
        title="历史记录"
        description="保留最近 20 次任务摘要；完整参数与 SQLite 持久化将在后续里程碑接入。"
        action={
          <div className="inline-actions">
            <StatusPill tone="neutral">{history.length} / 20</StatusPill>
            <Button variant="danger" icon={<Eraser size={14} />} onClick={onClearHistory} disabled={!history.length}>清理历史</Button>
          </div>
        }
      >
        {history.length ? (
          <div className="history-table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th>完成时间</th>
                  <th>任务</th>
                  <th>会话</th>
                  <th>退出码</th>
                  <th>恢复</th>
                  <th>最终速度</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatClock(entry.finishedAt)}</td>
                    <td>
                      <strong>{entry.jobName || "未命名任务"}</strong>
                      <code>{entry.command.length > 48 ? `${entry.command.slice(0, 48)}…` : entry.command}</code>
                    </td>
                    <td>{entry.sessionName}</td>
                    <td>
                      <StatusPill tone={entry.exitCode === 0 ? "success" : "danger"}>
                        {entry.exitCode ?? "—"}
                      </StatusPill>
                    </td>
                    <td>{formatInteger(entry.recovered)} / {formatInteger(entry.total)}</td>
                    <td>{formatSpeed(entry.speed)}</td>
                    <td>
                      <button className="icon-button danger" type="button" aria-label="删除运行记录" onClick={() => onDeleteHistory(entry.id)}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <FolderClock size={24} />
            <strong>暂无历史任务</strong>
            <p>启动任务后，运行状态和退出码会出现在这里。</p>
          </div>
        )}
      </Section>

      <Section title="恢复建议" description="hashcat restore 文件绑定原始 cwd 和参数。">
        <div className="session-guidance">
          <TerminalSquare size={17} />
          <div>
            <strong>使用 checkpoint 停止</strong>
            <p>停止运行时优先发送 checkpoint 命令；强制退出可能丢失最近的 restore point。</p>
          </div>
        </div>
      </Section>
    </div>
  );
}
