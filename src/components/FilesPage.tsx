import { useEffect, useState } from "react";
import { Eraser, FileText, FolderCog, RefreshCw, Trash2 } from "lucide-react";
import type { ArtifactInfo, FilePreview, JobSpec } from "../types";
import { clearGeneratedArtifact, clearTextFile, listGeneratedArtifacts, readTextFile } from "../lib/files";
import { Button, Field, PathInput, Section, StatusPill, TextInput } from "./ui";

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilesPage({ job }: { job: JobSpec }) {
  const [potPath, setPotPath] = useState(job.output.potfile || "hashcat-7.1.2-binaries/hashcat.potfile");
  const [logPath, setLogPath] = useState("");
  const [potPreview, setPotPreview] = useState<FilePreview | null>(null);
  const [logPreview, setLogPreview] = useState<FilePreview | null>(null);
  const [artifacts, setArtifacts] = useState<ArtifactInfo[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refreshArtifacts() {
    setBusy(true);
    setError("");
    try {
      setArtifacts(await listGeneratedArtifacts(job.hashcatPath));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refreshArtifacts();
    // Artifact list follows the current hashcat path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.hashcatPath]);

  async function loadFile(kind: "pot" | "log", path: string) {
    if (!path.trim()) return;
    setBusy(true);
    setError("");
    try {
      const preview = await readTextFile(path);
      if (kind === "pot") setPotPreview(preview);
      else setLogPreview(preview);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function clearFile(kind: "pot" | "log", path: string) {
    if (!path.trim() || !window.confirm(`确认清空 ${path} 的内容？`)) return;
    setBusy(true);
    try {
      await clearTextFile(path);
      await loadFile(kind, path);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function clearArtifact(artifact: ArtifactInfo) {
    const action = artifact.clearMode === "clear" ? "清空" : "删除";
    if (!window.confirm(`确认${action} ${artifact.name}？`)) return;
    setBusy(true);
    try {
      await clearGeneratedArtifact(artifact.path);
      await refreshArtifacts();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function clearAllArtifacts() {
    if (!artifacts.length || !window.confirm(`确认清理 ${artifacts.length} 个生成文件？`)) return;
    setBusy(true);
    try {
      for (const artifact of artifacts) await clearGeneratedArtifact(artifact.path);
      await refreshArtifacts();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="single-page">
      <div className="page-toolbar">
        <div>
          <div className="eyebrow">FILES / OUTPUTS</div>
          <h1>日志与文件</h1>
          <p>查看和清理 potfile、运行日志以及 hashcat 产生的临时文件。</p>
        </div>
        <StatusPill tone={artifacts.length ? "warning" : "success"}>{artifacts.length} 个生成文件</StatusPill>
      </div>

      <Section
        title="Potfile"
        description="potfile 保存已经恢复的哈希。清空不会影响原始哈希文件。"
        action={
          <div className="inline-actions">
            <Button variant="quiet" onClick={() => loadFile("pot", potPath)} disabled={busy}>读取</Button>
            <Button variant="danger" icon={<Eraser size={14} />} onClick={() => clearFile("pot", potPath)} disabled={busy}>清空</Button>
          </div>
        }
      >
        <div className="settings-grid">
          <Field label="Potfile 路径" hint="支持拖入文件。">
            <PathInput value={potPath} onChange={setPotPath} />
          </Field>
          <Field label="文件状态">
            <div className="readonly-value">{potPreview ? `${formatBytes(potPreview.content.length)} 已读取` : "未读取"}</div>
          </Field>
        </div>
        {potPreview ? <pre className="file-preview">{potPreview.content || "文件为空"}{potPreview.truncated ? "\n[内容已截断]" : ""}</pre> : null}
      </Section>

      <Section
        title="运行日志"
        description="每次运行会写入 stdout、stderr 和脱敏后的命令记录。"
        action={
          <div className="inline-actions">
            <Button variant="quiet" onClick={() => loadFile("log", logPath)} disabled={busy || !logPath.trim()}>读取</Button>
            <Button variant="danger" icon={<Eraser size={14} />} onClick={() => clearFile("log", logPath)} disabled={busy || !logPath.trim()}>清空</Button>
          </div>
        }
      >
        <div className="settings-grid">
          <Field label="日志路径" hint="运行后可在生成文件列表中找到 run-*.log。">
            <PathInput value={logPath} onChange={setLogPath} placeholder="拖入 run-*.log 文件" />
          </Field>
          <Field label="文件状态">
            <div className="readonly-value">{logPreview ? `${formatBytes(logPreview.content.length)} 已读取` : "未读取"}</div>
          </Field>
        </div>
        {logPreview ? <pre className="file-preview">{logPreview.content || "文件为空"}{logPreview.truncated ? "\n[内容已截断]" : ""}</pre> : null}
      </Section>

      <Section
        title="生成文件清理"
        description="restore 文件用于恢复任务；删除后无法从 checkpoint 继续。"
        action={
          <div className="inline-actions">
            <Button variant="quiet" icon={<RefreshCw size={14} />} onClick={refreshArtifacts} disabled={busy}>刷新</Button>
            <Button variant="danger" icon={<Trash2 size={14} />} onClick={clearAllArtifacts} disabled={busy || !artifacts.length}>清理全部</Button>
          </div>
        }
      >
        {artifacts.length ? (
          <div className="artifact-table-wrap">
            <table className="artifact-table">
              <thead>
                <tr><th>文件</th><th>类型</th><th>大小</th><th>操作</th></tr>
              </thead>
              <tbody>
                {artifacts.map((artifact) => (
                  <tr key={artifact.path}>
                    <td><strong>{artifact.name}</strong><small>{artifact.path}</small></td>
                    <td><StatusPill tone={artifact.kind === "restore" ? "warning" : "neutral"}>{artifact.kind}</StatusPill></td>
                    <td>{formatBytes(artifact.size)}</td>
                    <td>
                      <Button variant="danger" icon={<Trash2 size={13} />} onClick={() => clearArtifact(artifact)}>
                        {artifact.clearMode === "clear" ? "清空" : "删除"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <FolderCog size={24} />
            <strong>没有发现生成文件</strong>
            <p>运行 hashcat 后，日志、potfile、restore 和临时哈希会显示在这里。</p>
          </div>
        )}
      </Section>

      {error ? <div className="inline-warning"><FileText size={16} /><div><strong>文件操作失败</strong><p>{error}</p></div></div> : null}
    </div>
  );
}
