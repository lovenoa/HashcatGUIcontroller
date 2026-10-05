import { formatInteger, formatSpeed } from "../lib/format";
import { runStatus } from "../lib/runStatus";
import type { RunSnapshot, RunStats } from "../types";

function parseNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parseStats(lines: RunSnapshot["lines"]): RunStats | null {
  for (const line of [...lines].reverse()) {
    const text = line.text.trim();
    if (!text.startsWith("{")) continue;

    try {
      const raw = JSON.parse(text) as Record<string, unknown>;
      const rawDevices = Array.isArray(raw.devices) ? (raw.devices as Array<Record<string, unknown>>) : [];
      return {
        status: parseNumber(raw.status),
        progress: Array.isArray(raw.progress) ? raw.progress.map((value) => parseNumber(value)) : [0, 0],
        recoveredHashes: Array.isArray(raw.recovered_hashes) ? raw.recovered_hashes.map((value) => parseNumber(value)) : [0, 0],
        recoveredSalts: Array.isArray(raw.recovered_salts) ? raw.recovered_salts.map((value) => parseNumber(value)) : [0, 0],
        rejected: parseNumber(raw.rejected),
        devices: rawDevices.map((device, index) => ({
          deviceId: parseNumber(device.deviceId ?? device.device_id, index + 1),
          deviceName: String(device.deviceName ?? device.device_name ?? `Device ${index + 1}`),
          deviceType: String(device.deviceType ?? device.device_type ?? "GPU"),
          speed: parseNumber(device.speed),
          temp: parseNumber(device.temp, -1),
          util: parseNumber(device.util, -1)
        })),
        timeStart: parseNumber(raw.timeStart ?? raw.time_start),
        estimatedStop: parseNumber(raw.estimatedStop ?? raw.estimated_stop)
      };
    } catch {
      // Ignore non-JSON output lines.
    }
  }

  return null;
}

function formatDuration(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = value % 60;
  return hours > 0 ? `${hours}h ${minutes}m ${secs}s` : minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
}

export function RunMetrics({ run }: { run: RunSnapshot | null }) {
  if (!run) return null;

  const stats = run.stats ?? parseStats(run.lines);
  const progress = stats?.progress ?? [0, 0];
  const progressPercent = progress[1] > 0 ? Math.min(100, (progress[0] / progress[1]) * 100) : 0;
  const speed = stats?.devices.reduce((total, device) => total + device.speed, 0) ?? 0;
  const recovered = stats?.recoveredHashes?.[0] ?? 0;
  const totalHashes = stats?.recoveredHashes?.[1] ?? 0;
  const temperature = Math.max(...(stats?.devices.map((device) => device.temp) ?? [-1]));
  const firstTimestamp = run.lines[0]?.timestamp ?? stats?.timeStart ?? Date.now();
  const lastTimestamp = run.lines.at(-1)?.timestamp ?? firstTimestamp;
  const elapsedSeconds = ((run.running ? Date.now() : lastTimestamp) - firstTimestamp) / 1000;
  const status = runStatus(run);
  const phase = run.running ? (run.paused ? "已暂停" : stats ? "正在计算" : "初始化 / 等待首个状态") : status.label;

  return (
    <div className="run-metrics">
      <div className="run-progress-head">
        <span>当前段进度</span>
        <strong>{stats ? `${progressPercent.toFixed(1)}%` : run.running ? "等待状态" : "无状态输出"}</strong>
      </div>
      <div className="progress-track">
        <div style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="run-metric-grid">
        <div><span>速度</span><strong>{stats ? formatSpeed(speed) : "等待状态"}</strong></div>
        <div><span>当前段候选</span><strong>{stats ? `${formatInteger(progress[0])} / ${formatInteger(progress[1])}` : "等待状态"}</strong></div>
        <div><span>恢复</span><strong>{formatInteger(recovered)} / {formatInteger(totalHashes)}</strong></div>
        <div><span>温度</span><strong>{temperature >= 0 ? `${temperature}°C` : "未知"}</strong></div>
        <div><span>运行时间</span><strong>{formatDuration(elapsedSeconds)}</strong></div>
        <div><span>阶段</span><strong>{phase}</strong></div>
      </div>
    </div>
  );
}
