import { useEffect, useMemo, useRef, useState } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import type { CapabilityProfile, JobSpec, RunHistoryEntry, RunSnapshot } from "./types";
import { compileCommand, createDefaultJob, fallbackCapabilityProfile } from "./lib/commandCompiler";
import { applyCommandToJob, parseCommandLine } from "./lib/commandParser";
import { jobDisplayName } from "./lib/jobDisplay";
import { sanitizedJob } from "./lib/jobStorage";
import { initTauriDragDrop } from "./lib/dragDrop";
import { controlHashcat, probeHashcat, startHashcat, stopHashcat, pollHashcat, STATIC_HASH_MODES } from "./lib/hashcat";
import { AlgorithmsPage } from "./components/AlgorithmsPage";
import { DevicesPage } from "./components/DevicesPage";
import { ToolboxPage } from "./components/ToolboxPage";
import { SessionsPage } from "./components/SessionsPage";
import { FilesPage } from "./components/FilesPage";
import { GuidancePage, SettingsPage } from "./components/InfoPages";
import { Sidebar, type PageId } from "./components/Sidebar";
import { WorkspacePage } from "./components/WorkspacePage";

const HISTORY_KEY = "hashcat-studio-run-history-v1";
const DRAFT_KEY = "hashcat-studio-job-draft-v1";

function mergeJob(saved: Partial<JobSpec>): JobSpec {
  const base = createDefaultJob();
  return {
    ...base,
    ...saved,
    input: { ...base.input, ...saved.input },
    output: { ...base.output, ...saved.output },
    session: { ...base.session, ...saved.session },
    device: { ...base.device, ...saved.device },
    attack: { ...base.attack, ...saved.attack, customCharsets: saved.attack?.customCharsets ?? base.attack.customCharsets },
    brain: { ...base.brain, ...saved.brain },
    bridge: { ...base.bridge, ...saved.bridge },
    risk: { ...base.risk, ...saved.risk }
  };
}

function loadDraftJob(): JobSpec {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? mergeJob(JSON.parse(raw) as Partial<JobSpec>) : createDefaultJob();
  } catch {
    return createDefaultJob();
  }
}

function loadRunHistory(): RunHistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as RunHistoryEntry[]).slice(0, 20) : [];
  } catch {
    return [];
  }
}

function persistRunHistory(history: RunHistoryEntry[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
  } catch {
    // Local persistence is optional in restricted webviews.
  }
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export default function App() {
  const [page, setPage] = useState<PageId>("workspace");
  const [job, setJob] = useState<JobSpec>(loadDraftJob);
  const [profile, setProfile] = useState<CapabilityProfile>(() =>
    fallbackCapabilityProfile(STATIC_HASH_MODES, "hashcat-7.1.2-binaries/hashcat.exe")
  );
  const [run, setRun] = useState<RunSnapshot | null>(null);
  const [runHistory, setRunHistory] = useState<RunHistoryEntry[]>(loadRunHistory);
  const activeRunMeta = useRef<{ id: string; jobName: string; sessionName: string; command: string; startedAt: number } | null>(null);
  const [probePending, setProbePending] = useState(false);

  const command = useMemo(() => compileCommand(job), [job]);

  async function handleProbe() {
    setProbePending(true);
    try {
      const nextProfile = await probeHashcat(job.hashcatPath);
      setProfile(nextProfile);
    } finally {
      setProbePending(false);
    }
  }

  function handleImport(command: string) {
    setJob((current) => applyCommandToJob(current, parseCommandLine(command)));
  }

  function clearRunHistory() {
    setRunHistory([]);
    persistRunHistory([]);
  }

  function deleteRunHistory(id: string) {
    setRunHistory((current) => {
      const next = current.filter((entry) => entry.id !== id);
      persistRunHistory(next);
      return next;
    });
  }

  function handleExportJob() {
    const blob = new Blob([JSON.stringify(sanitizedJob(job), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${job.name || "hashcat-job"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handleImportJob(text: string) {
    try {
      setJob(mergeJob(JSON.parse(text) as Partial<JobSpec>));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "无法读取任务 JSON");
    }
  }

  async function handleControl() {
    if (!run?.running || !isTauri()) return;
    const paused = run.paused ?? run.stats?.status === 4;
    setRun({ ...run, paused: !paused });
    try {
      await controlHashcat(run.id, paused ? "resume" : "pause");
      setRun(await pollHashcat(run.id));
    } catch (error) {
      setRun({ ...run, paused });
      window.alert(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleRun() {
    if (command.diagnostics.some((item) => item.level === "error")) return;

    if (!isTauri()) {
      const runId = `browser-preview-${Date.now()}`;
      activeRunMeta.current = { id: runId, jobName: jobDisplayName(job), sessionName: job.session.name, command: command.display, startedAt: Date.now() };
      setRun({
        id: runId,
        paused: false,
        running: false,
        exitCode: 0,
        stats: null,
        lines: [
          {
            stream: "stdout",
            text: "浏览器预览模式：命令已验证，桌面模式才会启动 hashcat。",
            timestamp: Date.now()
          }
        ]
      });
      return;
    }

    try {
      const args = [...command.args];
      if (job.inlineHashes.trim()) {
        const { invoke } = await import("@tauri-apps/api/core");
        const tempPath = await invoke<string>("write_temp_hashes", {
          content: job.inlineHashes.endsWith("\n") ? job.inlineHashes : `${job.inlineHashes}\n`
        });
        const placeholderIndex = args.indexOf("__inline_hashes__.hash");
        if (placeholderIndex >= 0) args[placeholderIndex] = tempPath;
      }

      const runId = await startHashcat(job.hashcatPath, args, "", {
        openConsole: job.session.openConsoleWindow,
        keepConsoleOpen: job.session.keepConsoleOpen,
        consoleUpdateSeconds: Math.max(1, job.session.consoleUpdateTimer || job.session.statusTimer || 2)
      });
      activeRunMeta.current = { id: runId, jobName: jobDisplayName(job), sessionName: job.session.name, command: command.display, startedAt: Date.now() };
      setRun({ id: runId, running: true, paused: false, exitCode: null, stats: null, lines: [] });
    } catch (error) {
      const runId = `start-error-${Date.now()}`;
      activeRunMeta.current = { id: runId, jobName: jobDisplayName(job), sessionName: job.session.name, command: command.display, startedAt: Date.now() };
      setRun({
        id: runId,
        paused: false,
        running: false,
        exitCode: -1,
        stats: null,
        lines: [
          {
            stream: "stderr",
            text: error instanceof Error ? error.message : String(error),
            timestamp: Date.now()
          }
        ]
      });
    }
  }

  async function handleStop() {
    if (!run || !isTauri()) return;
    try {
      await stopHashcat(run.id);
    } catch {
      await stopHashcat(run.id, true).catch(() => undefined);
    }
  }

  useEffect(() => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(sanitizedJob(job)));
  }, [job]);

  useEffect(() => {
    let dispose: (() => void) | undefined;
    let disposed = false;
    void initTauriDragDrop().then((unlisten) => {
      if (disposed) unlisten();
      else dispose = unlisten;
    });
    return () => {
      disposed = true;
      dispose?.();
    };
  }, []);

  useEffect(() => {
    if (!run || run.running || run.exitCode === null) return;
    const meta = activeRunMeta.current;
    if (!meta || meta.id !== run.id) return;

    setRunHistory((current) => {
      if (current.some((entry) => entry.id === run.id)) return current;
      const stats = run.stats;
      const entry: RunHistoryEntry = {
        id: run.id,
        jobName: meta.jobName,
        sessionName: meta.sessionName,
        command: meta.command,
        startedAt: meta.startedAt,
        finishedAt: Date.now(),
        exitCode: run.exitCode,
        recovered: stats?.recoveredHashes?.[0] ?? 0,
        total: stats?.recoveredHashes?.[1] ?? 0,
        speed: stats?.devices.reduce((total, device) => total + device.speed, 0) ?? 0
      };
      const next = [entry, ...current].slice(0, 20);
      persistRunHistory(next);
      return next;
    });
  }, [run?.exitCode, run?.id, run?.running, run?.stats]);

  useEffect(() => {
    if (!run?.running || !isTauri()) return;
    const timer = window.setInterval(async () => {
      try {
        const snapshot = await pollHashcat(run.id);
        setRun(snapshot);
      } catch {
        // Keep polling until the backend reports a terminal state.
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [run?.id, run?.running]);

  useEffect(() => {
    if (probePending) return;
    void handleProbe();
    // Probe once when the workspace shell mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="app-shell">
        <Sidebar active={page} onChange={setPage} profile={profile} />
        <div className="app-content">
          {page === "workspace" ? (
            <WorkspacePage
              job={job}
              profile={profile}
              command={command}
              run={run}
              onChange={setJob}
              onProbe={handleProbe}
              onRun={handleRun}
              onStop={handleStop}
              onControl={handleControl}
              onReset={() => setRun(null)}
              onImport={handleImport}
            />
          ) : null}
          {page === "algorithms" ? <AlgorithmsPage profile={profile} onUseMode={(mode) => { setJob((current) => ({ ...current, hashMode: mode })); setPage("workspace"); }} /> : null}
          {page === "toolbox" ? <ToolboxPage job={job} profile={profile} /> : null}
          {page === "devices" ? <DevicesPage profile={profile} onProbe={handleProbe} /> : null}
          {page === "sessions" ? <SessionsPage job={job} run={run} history={runHistory} onClearHistory={clearRunHistory} onDeleteHistory={deleteRunHistory} /> : null}
          {page === "files" ? <FilesPage job={job} /> : null}
          {page === "guidance" ? <GuidancePage profile={profile} /> : null}
          {page === "settings" ? (
            <SettingsPage
              job={job}
              profile={profile}
              onChange={setJob}
              onProbe={handleProbe}
              onExport={handleExportJob}
              onImport={handleImportJob}
            />
          ) : null}
        </div>
      </div>
    </Tooltip.Provider>
  );
}
