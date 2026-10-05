import type { JobSpec } from "../types";
import { ATTACK_MODE_LABELS } from "./commandCompiler";

export function jobDisplayName(job: JobSpec): string {
  const mode = job.hashMode === "auto" ? "自动识别" : `#${job.hashMode}`;
  return `${mode} · ${ATTACK_MODE_LABELS[job.attackMode]}`;
}
