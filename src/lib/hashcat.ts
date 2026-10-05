import type { CapabilityProfile, DeviceInfo, HashModeInfo, RunControl, RunSnapshot } from "../types";
export type { RunControl, RunSnapshot };
import { fallbackCapabilityProfile } from "./commandCompiler";
import hashModesJson from "../data/hashModes.generated.json";

export const STATIC_HASH_MODES = hashModesJson as HashModeInfo[];

export interface HashcatProbe {
  version: string;
  help: string;
  hashInfo: string;
  backendInfo: string;
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function probeHashcat(executablePath: string): Promise<CapabilityProfile> {
  if (!isTauri()) {
    return fallbackCapabilityProfile(STATIC_HASH_MODES, executablePath);
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const probe = await invoke<HashcatProbe>("probe_hashcat", {
      executablePath
    });
    return parseProbe(probe, executablePath);
  } catch (error) {
    return {
      ...fallbackCapabilityProfile(STATIC_HASH_MODES, executablePath),
      probeWarnings: [`无法探测 hashcat：${error instanceof Error ? error.message : String(error)}`]
    };
  }
}

export function parseProbe(probe: HashcatProbe, executablePath: string): CapabilityProfile {
  const versionMatch = probe.version.match(/v(\d+\.\d+\.\d+)/);
  const attackModes = [...probe.help.matchAll(/^\s+(\d+)\s+\|\s+[A-Za-z]/gm)]
    .map((match) => Number(match[1]))
    .filter((mode) => [0, 1, 3, 6, 7, 9].includes(mode));

  const options = [...probe.help.matchAll(/(--[a-z0-9][a-z0-9-]+)/g)]
    .map((match) => match[1])
    .filter((value, index, all) => all.indexOf(value) === index);

  return {
    hashcatVersion: versionMatch ? versionMatch[1] : "unknown",
    executablePath,
    attackModes: attackModes.length ? attackModes : [0, 1, 3, 6, 7, 9],
    options,
    hashModes: STATIC_HASH_MODES,
    devices: parseDevices(probe.backendInfo),
    source: "live",
    probeWarnings: []
  };
}

function parseDevices(output: string): DeviceInfo[] {
  const devices: DeviceInfo[] = [];
  const lines = output.split(/\r?\n/);
  let backend = "Unknown";

  for (const line of lines) {
    const sectionMatch = line.match(/^([A-Za-z]+) Info:/);
    if (sectionMatch) {
      backend = sectionMatch[1];
      continue;
    }

    const idMatch = line.match(/Backend Device ID #(\d+)/);
    if (!idMatch) continue;

    const device: DeviceInfo = {
      id: idMatch[1],
      backend,
      name: "",
      type: "GPU"
    };

    for (const next of lines.slice(lines.indexOf(line) + 1, lines.indexOf(line) + 16)) {
      if (/Backend Device ID #/.test(next) || /^[A-Za-z]+ Info:/.test(next)) break;
      const separator = next.indexOf("..:");
      if (separator < 0) continue;
      const key = next.slice(0, separator).replace(/\./g, "").trim();
      const value = next.slice(separator + 3).trim();

      if (key === "Name") device.name = value;
      if (key === "Type") device.type = value;
      if (key === "Processor(s)") device.processors = Number(value);
      if (key === "Memory.Total") device.memoryTotal = value;
      if (key === "Memory.Free") device.memoryFree = value;
      if (key === "Clock") device.clock = value;
    }

    devices.push(device);
  }

  return devices;
}


export async function startHashcat(
  executablePath: string,
  args: string[],
  cwd: string,
  options: { openConsole?: boolean; keepConsoleOpen?: boolean; consoleUpdateSeconds?: number } = {}
): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("start_hashcat", {
    executablePath,
    args,
    cwd,
    openConsole: options.openConsole ?? false,
    keepConsoleOpen: options.keepConsoleOpen ?? true,
    consoleUpdateSeconds: options.consoleUpdateSeconds ?? 2
  });
}

export async function pollHashcat(runId: string): Promise<RunSnapshot> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<RunSnapshot>("poll_hashcat", { runId });
}

export async function controlHashcat(runId: string, control: RunControl): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("control_hashcat", { runId, control });
}

export async function stopHashcat(runId: string, force = false): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("stop_hashcat", { runId, force });
}
