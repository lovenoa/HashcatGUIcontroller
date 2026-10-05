import type { RunSnapshot } from "../types";

export interface RunStatus {
  label: string;
  tone: "neutral" | "success" | "warning" | "danger";
}

export function runStatus(run: RunSnapshot | null): RunStatus {
  if (!run) return { label: "待运行", tone: "neutral" };
  if (run.paused) return { label: "已暂停", tone: "warning" };
  if (run.running) return { label: "运行中", tone: "warning" };

  switch (run.exitCode) {
    case 0:
      return { label: "已完成", tone: "success" };
    case 1:
      return { label: "已耗尽", tone: "neutral" };
    case 2:
      return { label: "已中止", tone: "warning" };
    case 3:
      return { label: "Checkpoint 停止", tone: "warning" };
    case 4:
      return { label: "运行时限结束", tone: "warning" };
    case 5:
      return { label: "已完成", tone: "success" };
    default:
      return { label: "异常结束", tone: "danger" };
  }
}
