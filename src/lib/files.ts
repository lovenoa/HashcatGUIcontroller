import type { ArtifactInfo, FilePreview } from "../types";

async function invoke<T>(command: string, args: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
  return tauriInvoke<T>(command, args);
}

export function readTextFile(path: string, maxBytes = 2 * 1024 * 1024): Promise<FilePreview> {
  return invoke<FilePreview>("read_text_file", { path, maxBytes });
}

export function clearTextFile(path: string): Promise<void> {
  return invoke<void>("clear_text_file", { path });
}

export function listGeneratedArtifacts(executablePath: string): Promise<ArtifactInfo[]> {
  return invoke<ArtifactInfo[]>("list_generated_artifacts", { executablePath });
}

export function clearGeneratedArtifact(path: string): Promise<void> {
  return invoke<void>("clear_generated_artifact", { path });
}

export function runConverter(
  script: string,
  inputFile: string,
  outputFile: string
): Promise<{ output: string; exitCode: number }> {
  return invoke("run_converter", { script, inputFile, outputFile });
}
