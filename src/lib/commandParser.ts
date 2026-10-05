import type { AttackMode, JobSpec } from "../types";

export interface ParsedCommand {
  program: string;
  args: string[];
}

export function parseCommandLine(input: string): ParsedCommand {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let escaped = false;

  const characters = [...input.trim()];
  for (let cursor = 0; cursor < characters.length; cursor += 1) {
    const character = characters[cursor];
    const next = characters[cursor + 1];
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }

    if (character === "\\" && quote !== "'" && (next === quote || next === "\\" || next === "\"" || next === "'")) {
      escaped = true;
      continue;
    }

    if (quote) {
      if (character === quote) quote = null;
      else current += character;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (/\s/.test(character)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += character;
  }

  if (escaped) current += "\\";
  if (current) tokens.push(current);

  return {
    program: tokens.shift() ?? "hashcat",
    args: tokens
  };
}

function takeValue(args: string[], index: number): [string, number] {
  const token = args[index];
  const equals = token.indexOf("=");
  if (equals > 0) return [token.slice(equals + 1), index];

  return [args[index + 1] ?? "", index + 1];
}

const OPTION_ALIASES: Record<string, string> = {
  "--hash-type": "-m", "--attack-mode": "-a", "--markov-threshold": "-t", "--segment-size": "-c",
  "--backend-devices-virtmulti": "-Y", "--backend-devices-virthost": "-R", "--opencl-device-types": "-D",
  "--multiply-accel-disable": "-M", "--kernel-accel": "-n", "--kernel-loops": "-u", "--kernel-threads": "-T",
  "--skip": "-s", "--limit": "-l", "--rule-left": "-j", "--rule-right": "-k",
  "--increment": "-i", "--increment-inverse": "-ii", "--custom-charset1": "-1", "--custom-charset2": "-2",
  "--custom-charset3": "-3", "--custom-charset4": "-4", "--custom-charset5": "-5", "--custom-charset6": "-6",
  "--custom-charset7": "-7", "--custom-charset8": "-8"
};

function canonicalOption(token: string): string {
  const equalsIndex = token.indexOf("=");
  const flag = equalsIndex > 0 ? token.slice(0, equalsIndex) : token;
  const value = equalsIndex > 0 ? token.slice(equalsIndex + 1) : "";
  const canonical = OPTION_ALIASES[flag] ?? flag;
  return equalsIndex > 0 ? `${canonical}=${value}` : canonical;
}

export function applyCommandToJob(job: JobSpec, parsed: ParsedCommand): JobSpec {
  const next: JobSpec = {
    ...job,
    hashcatPath: parsed.program,
    candidateSources: [],
    ruleSources: [],
    masks: [],
    input: { ...job.input },
    attack: {
      ...job.attack,
      customCharsets: [...job.attack.customCharsets]
    },
    risk: { ...job.risk },
    brain: { ...job.brain },
    bridge: { ...job.bridge },
    output: { ...job.output },
    session: { ...job.session },
    device: { ...job.device }
  };

  const positional: string[] = [];
  let restore = false;
  let stdoutPreview = false;
  let benchmark = false;

  const numberFlags: Record<string, (value: string) => void> = {
    "-g": (value) => next.attack.generateRules = Number(value) || 0,
    "--generate-rules-seed": (value) => next.attack.generateRulesSeed = Number(value) || 0,
    "--generate-rules-func-min": (value) => next.attack.generateRulesFuncMin = Number(value) || 0,
    "--generate-rules-func-max": (value) => next.attack.generateRulesFuncMax = Number(value) || 0,
    "-t": (value) => next.attack.markovThreshold = Number(value) || 0,
    "--increment-min": (value) => next.attack.incrementMin = Number(value) || 0,
    "--increment-max": (value) => next.attack.incrementMax = Number(value) || 0,
    "--bypass-delay": (value) => next.attack.bypassDelay = Number(value) || 0,
    "--bypass-threshold": (value) => next.attack.bypassThreshold = Number(value) || 0,
    "-s": (value) => next.attack.skip = Number(value) || 0,
    "-l": (value) => next.attack.limit = Number(value) || 0,
    "--remove-timer": (value) => next.output.removeTimer = Number(value) || 0,
    "--debug-mode": (value) => next.output.debugMode = Number(value) || 0,
    "--outfile-check-timer": (value) => next.output.outfileCheckTimer = Number(value) || 0,
    "--runtime": (value) => next.session.runtime = Number(value) || 0,
    "--status-timer": (value) => next.session.statusTimer = Number(value) || 0,
    "--stdin-timeout-abort": (value) => next.session.stdinTimeoutAbort = Number(value) || 0,
    "--metal-compiler-runtime": (value) => next.session.metalCompilerRuntime = Number(value) || 0,
    "-Y": (value) => next.device.virtualMultiplier = Number(value) || 0,
    "-R": (value) => next.device.virtualHost = Number(value) || 0,
    "--backend-devices-keepfree": (value) => next.device.backendKeepFree = Number(value) || 0,
    "-n": (value) => next.device.kernelAccel = Number(value) || 0,
    "-u": (value) => next.device.kernelLoops = Number(value) || 0,
    "-T": (value) => next.device.kernelThreads = Number(value) || 0,
    "--backend-vector-width": (value) => next.device.backendVectorWidth = Number(value) || 0,
    "--spin-damp": (value) => next.device.spinDamp = Number(value) || 0,
    "--scrypt-tmto": (value) => next.device.scryptTmto = Number(value) || 0,
    "--hook-threads": (value) => next.device.hookThreads = Number(value) || 0,
    "-c": (value) => next.device.segmentSize = Number(value) || 0,
    "--bitmap-min": (value) => next.device.bitmapMin = Number(value) || 0,
    "--bitmap-max": (value) => next.device.bitmapMax = Number(value) || 0,
    "--hwmon-temp-abort": (value) => next.device.temperatureAbort = Number(value) || 0,
    "--veracrypt-pim-start": (value) => next.input.veracryptPimStart = Number(value) || 0,
    "--veracrypt-pim-stop": (value) => next.input.veracryptPimStop = Number(value) || 0,
    "--hccapx-message-pair": (value) => next.input.hccapxMessagePair = Number(value) || 0,
    "--nonce-error-corrections": (value) => next.input.nonceErrorCorrections = Number(value) || 0,
    "--benchmark-min": (value) => next.risk.benchmarkMin = Number(value) || 0,
    "--benchmark-max": (value) => next.risk.benchmarkMax = Number(value) || 0,
    "--brain-server-timer": (value) => next.brain.serverTimer = Number(value) || 0,
    "--brain-client-features": (value) => next.brain.clientFeatures = Number(value) || 0
  };

  const stringFlags: Record<string, (value: string) => void> = {
    "--encoding-from": (value) => next.input.encodingFrom = value,
    "--encoding-to": (value) => next.input.encodingTo = value,
    "--truecrypt-keyfiles": (value) => next.input.trueCryptKeyFiles = value,
    "--veracrypt-keyfiles": (value) => next.input.veracryptKeyFiles = value,
    "--keyboard-layout-mapping": (value) => next.input.keyboardLayoutMapping = value,
    "--debug-file": (value) => next.output.debugFile = value,
    "--induction-dir": (value) => next.output.inductionDir = value,
    "--outfile-check-dir": (value) => next.output.outfileCheckDir = value,
    "--restore-file-path": (value) => next.session.restorePath = value,
    "-D": (value) => next.device.deviceTypes = value,
    "--cpu-affinity": (value) => next.device.cpuAffinity = value,
    "--markov-hcstat2": (value) => next.attack.markovHcstat2 = value,
    "--generate-rules-func-sel": (value) => next.attack.generateRulesFuncSel = value,
    "--brain-session": (value) => next.brain.session = value,
    "--brain-session-whitelist": (value) => next.brain.sessionWhitelist = value,
    "--bridge-parameter1": (value) => next.bridge.parameter1 = value,
    "--bridge-parameter2": (value) => next.bridge.parameter2 = value,
    "--bridge-parameter3": (value) => next.bridge.parameter3 = value,
    "--bridge-parameter4": (value) => next.bridge.parameter4 = value
  };

  const booleanFlags: Record<string, () => void> = {
    "--hex-charset": () => next.input.hexCharset = true,
    "--hex-salt": () => next.input.hexSalt = true,
    "--hex-wordlist": () => next.input.hexWordlist = true,
    "--wordlist-autohex-disable": () => next.input.wordlistAutohexDisable = true,
    "--dynamic-x": () => next.input.dynamicX = true,
    "--outfile-json": () => next.output.outfileJson = true,
    "--outfile-autohex-disable": () => next.output.autohex = false,
    "--remove": () => next.output.remove = true,
    "--color-cracked": () => next.output.colorCracked = true,
    "--logfile-disable": () => next.output.logfileDisabled = true,
    "--restore-disable": () => next.session.restoreDisabled = true,
    "--machine-readable": () => next.session.machineReadable = true,
    "-M": () => next.device.multiplyAccelDisable = true,
    "--hwmon-disable": () => next.device.hardwareMonitor = false,
    "--self-test-disable": () => next.risk.selfTestDisable = true,
    "--deprecated-check-disable": () => next.risk.deprecatedCheckDisable = true,
    "--loopback": () => next.risk.loopback = true,
    "--speed-only": () => next.risk.speedOnly = true,
    "--progress-only": () => next.risk.progressOnly = true,
    "--keyspace": () => next.risk.keyspace = true,
    "--total-candidates": () => next.risk.totalCandidates = true,
    "--benchmark-all": () => next.risk.benchmarkAll = true,
    "--backend-ignore-cuda": () => next.device.ignoreCuda = true,
    "--backend-ignore-hip": () => next.device.ignoreHip = true,
    "--backend-ignore-metal": () => next.device.ignoreMetal = true,
    "--backend-ignore-opencl": () => next.device.ignoreOpencl = true
  };

  for (let index = 0; index < parsed.args.length; index += 1) {
    const canonicalToken = canonicalOption(parsed.args[index]);
    const equalsIndex = canonicalToken.indexOf("=");
    const token = equalsIndex > 0 ? canonicalToken.slice(0, equalsIndex) : canonicalToken;
    const flag = token;
    const inlineValue = equalsIndex > 0 ? canonicalToken.slice(equalsIndex + 1) : null;

    if (booleanFlags[flag]) {
      booleanFlags[flag]();
      continue;
    }

    if (numberFlags[flag] || stringFlags[flag]) {
      const [value, nextIndex] = inlineValue === null ? takeValue(parsed.args, index) : [inlineValue, index];
      numberFlags[flag]?.(value);
      stringFlags[flag]?.(value);
      index = nextIndex;
      continue;
    }

    if (token === "-m") {
      const [value, nextIndex] = takeValue(parsed.args, index);
      if (value !== "") next.hashMode = Number(value);
      index = nextIndex;
    } else if (token === "-a") {
      const [value, nextIndex] = takeValue(parsed.args, index);
      const mode = Number(value);
      if ([0, 1, 3, 6, 7, 9].includes(mode)) next.attackMode = mode as AttackMode;
      index = nextIndex;
    } else if (token === "-r" || token === "--rules-file") {
      const [value, nextIndex] = takeValue(parsed.args, index);
      if (value) next.ruleSources.push({ id: `rule-${index}`, path: value });
      index = nextIndex;
    } else if (token === "-j") {
      const [value, nextIndex] = takeValue(parsed.args, index);
      next.attack.ruleLeft = value;
      index = nextIndex;
    } else if (token === "-k") {
      const [value, nextIndex] = takeValue(parsed.args, index);
      next.attack.ruleRight = value;
      index = nextIndex;
    } else if (/^-[1-8]$/.test(token)) {
      const charsetIndex = Number(token.slice(1)) - 1;
      const [value, nextIndex] = takeValue(parsed.args, index);
      next.attack.customCharsets[charsetIndex] = value;
      index = nextIndex;
    } else if (token === "-i") {
      next.attack.increment = "normal";
    } else if (token === "-ii") {
      next.attack.increment = "inverse";
    } else if (token === "-o" || token === "--outfile") {
      const [value, nextIndex] = takeValue(parsed.args, index);
      next.output.outfile = value;
      index = nextIndex;
    } else if (token === "--outfile-format") {
      const [value, nextIndex] = takeValue(parsed.args, index);
      next.output.outfileFormat = value.split(",").map(Number).filter((item) => Number.isFinite(item));
      index = nextIndex;
    } else if (token === "-p" || token === "--separator") {
      const [value, nextIndex] = takeValue(parsed.args, index);
      next.output.separator = value || ":";
      index = nextIndex;
    } else if (token === "--potfile-disable") {
      next.output.potfileEnabled = false;
    } else if (token === "--potfile-path") {
      const [value, nextIndex] = takeValue(parsed.args, index);
      next.output.potfile = value;
      index = nextIndex;
    } else if (token === "--session") {
      const [value, nextIndex] = takeValue(parsed.args, index);
      next.session.name = value;
      index = nextIndex;
    } else if (token === "--restore") {
      restore = true;
    } else if (token === "--status-json") {
      next.session.statusJson = true;
    } else if (token === "--status") {
      next.session.status = true;
    } else if (token === "--quiet") {
      next.session.quiet = true;
    } else if (token === "--stdout") {
      stdoutPreview = true;
    } else if (token === "-b" || token === "--benchmark") {
      benchmark = true;
    } else if (token === "--force") {
      next.risk.force = true;
    } else if (token === "--keep-guessing") {
      next.risk.keepGuessing = true;
    } else if (token === "-S" || token === "--slow-candidates") {
      next.attack.slowCandidates = true;
    } else if (token === "-z" || token === "--brain-client") {
      next.brain.enabled = true;
      next.brain.role = "client";
    } else if (token === "--brain-server") {
      next.brain.enabled = true;
      next.brain.role = "server";
    } else if (token === "--brain-host") {
      const [value, nextIndex] = takeValue(parsed.args, index);
      next.brain.host = value;
      index = nextIndex;
    } else if (token === "--brain-port") {
      const [value, nextIndex] = takeValue(parsed.args, index);
      next.brain.port = Number(value) || next.brain.port;
      index = nextIndex;
    } else if (token === "--brain-password") {
      const [value, nextIndex] = takeValue(parsed.args, index);
      next.brain.password = value;
      index = nextIndex;
    } else if (token === "-d" || token === "--backend-devices") {
      const [value, nextIndex] = takeValue(parsed.args, index);
      next.device.backendDevices = value;
      index = nextIndex;
    } else if (token === "-w" || token === "--workload-profile") {
      const [value, nextIndex] = takeValue(parsed.args, index);
      next.device.workloadProfile = Math.max(0, Math.min(4, Number(value) || 0)) as JobSpec["device"]["workloadProfile"];
      index = nextIndex;
    } else if (token === "-O" || token === "--optimized-kernel-enable") {
      next.device.optimizedKernel = true;
    } else if (!token.startsWith("-")) {
      positional.push(token);
    }
  }

  next.session.restore = restore;
  next.risk.stdoutPreview = stdoutPreview;
  next.risk.benchmark = benchmark;

  if (positional.length && !stdoutPreview && !benchmark) {
    next.hashFile = positional[0];
  }

  const sourceValues = positional.slice(stdoutPreview || benchmark ? 0 : 1);
  if (next.attackMode === 0) {
    next.candidateSources = sourceValues.map((path, index) => ({ id: `candidate-${index}`, path, kind: "wordlist" }));
  } else if (next.attackMode === 1) {
    next.candidateSources = sourceValues.slice(0, 2).map((path, index) => ({ id: `candidate-${index}`, path, kind: "wordlist" }));
  } else if (next.attackMode === 3) {
    next.masks = sourceValues.map((value, index) => ({ id: `mask-${index}`, value, isFile: value.includes("/") || value.includes("\\") || /\.[a-z0-9]+$/i.test(value) }));
  } else if (next.attackMode === 6 || next.attackMode === 7) {
    const split = Math.max(1, sourceValues.length - 1);
    const words = next.attackMode === 6 ? sourceValues.slice(0, split) : sourceValues.slice(1);
    const masks = next.attackMode === 6 ? sourceValues.slice(split) : sourceValues.slice(0, 1);
    next.candidateSources = words.map((path, index) => ({ id: `candidate-${index}`, path, kind: "wordlist" }));
    next.masks = masks.map((value, index) => ({ id: `mask-${index}`, value, isFile: value.includes("/") || value.includes("\\") || /\.[a-z0-9]+$/i.test(value) }));
  } else if (next.attackMode === 9) {
    next.candidateSources = sourceValues.map((path, index) => ({ id: `candidate-${index}`, path, kind: "wordlist" }));
  }

  return next;
}
