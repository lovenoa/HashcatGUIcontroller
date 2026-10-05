import type {
  AttackMode,
  CapabilityProfile,
  CommandResult,
  Diagnostic,
  HashModeInfo,
  JobSpec
} from "../types";

export function createDefaultJob(): JobSpec {
  return {
    name: "MD5 字典任务",
    hashcatPath: "hashcat-7.1.2-binaries/hashcat.exe",
    hashMode: 0,
    hashFile: "hashcat-7.1.2-binaries/example0.hash",
    inlineHashes: "",
    username: false,
    attackMode: 0,
    candidateSources: [
      {
        id: "candidate-1",
        path: "hashcat-7.1.2-binaries/example.dict",
        kind: "wordlist"
      }
    ],
    ruleSources: [
      {
        id: "rule-1",
        path: "hashcat-7.1.2-binaries/rules/best66.rule"
      }
    ],
    masks: [
      {
        id: "mask-1",
        value: "?u?l?l?l?l?d?d?d?d",
        isFile: false
      }
    ],
    input: {
      hexCharset: false,
      hexSalt: false,
      hexWordlist: false,
      wordlistAutohexDisable: false,
      dynamicX: false,
      encodingFrom: "",
      encodingTo: "",
      trueCryptKeyFiles: "",
      veracryptKeyFiles: "",
      veracryptPimStart: 0,
      veracryptPimStop: 0,
      keyboardLayoutMapping: "",
      hccapxMessagePair: 0,
      nonceErrorCorrections: 0
    },
    output: {
      outfile: "",
      outfileFormat: [1, 2],
      outfileJson: false,
      separator: ":",
      potfileEnabled: true,
      potfile: "",
      remove: false,
      autohex: true,
      debugMode: 0,
      debugFile: "",
      inductionDir: "",
      outfileCheckDir: "",
      outfileCheckTimer: 0,
      removeTimer: 0,
      colorCracked: false,
      logfileDisabled: false
    },
    session: {
      name: "hashcat-gui-job",
      restore: false,
      restoreDisabled: false,
      restorePath: "",
      runtime: 0,
      status: true,
      statusJson: true,
      statusTimer: 1,
      machineReadable: false,
      quiet: false,
      stdinTimeoutAbort: 0,
      metalCompilerRuntime: 0,
      openConsoleWindow: false,
      keepConsoleOpen: true,
      consoleUpdateTimer: 2
    },
    device: {
      backendDevices: "",
      deviceTypes: "",
      ignoreCuda: false,
      ignoreHip: false,
      ignoreMetal: false,
      ignoreOpencl: false,
      workloadProfile: 2,
      optimizedKernel: false,
      kernelAccel: 0,
      kernelLoops: 0,
      kernelThreads: 0,
      backendKeepFree: 0,
      temperatureAbort: 0,
      hardwareMonitor: true,
      cpuAffinity: "",
      virtualMultiplier: 0,
      virtualHost: 0,
      multiplyAccelDisable: false,
      backendVectorWidth: 0,
      spinDamp: 0,
      scryptTmto: 0,
      hookThreads: 0,
      segmentSize: 0,
      bitmapMin: 0,
      bitmapMax: 0
    },
    attack: {
      markovMode: "default",
      markovThreshold: 0,
      markovHcstat2: "",
      increment: "none",
      incrementMin: 0,
      incrementMax: 0,
      slowCandidates: false,
      bypassDelay: 0,
      bypassThreshold: 0,
      customCharsets: ["?l?d", "", "", "", "", "", "", ""],
      ruleLeft: "",
      ruleRight: "",
      generateRules: 0,
      generateRulesFuncMin: 0,
      generateRulesFuncMax: 0,
      generateRulesFuncSel: "",
      generateRulesSeed: 0,
      skip: 0,
      limit: 0
    },
    brain: {
      enabled: false,
      role: "client",
      host: "127.0.0.1",
      port: 13743,
      password: "",
      session: "",
      clientFeatures: 3,
      serverTimer: 300,
      sessionWhitelist: ""
    },
    bridge: {
      enabled: false,
      mode: 73000,
      parameter1: "",
      parameter2: "",
      parameter3: "",
      parameter4: ""
    },
    risk: {
      force: false,
      selfTestDisable: false,
      keepGuessing: false,
      loopback: false,
      deprecatedCheckDisable: false,
      stdoutPreview: false,
      benchmark: false,
      benchmarkAll: false,
      benchmarkMin: 0,
      benchmarkMax: 0,
      speedOnly: false,
      progressOnly: false,
      keyspace: false,
      totalCandidates: false
    }
  };
}

function quote(value: string): string {
  if (/^[A-Za-z0-9_./:\\-]+$/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

export function formatCommand(program: string, args: string[], redactSensitive = false): string {
  const renderedArgs = args.reduce<string[]>((result, arg) => {
    if (redactSensitive && result.at(-1) === "--brain-password") result.push("<redacted>");
    else result.push(arg);
    return result;
  }, []);
  return [quote(program), ...renderedArgs.map(quote)].join(" ");
}

function diagnostic(level: Diagnostic["level"], field: string, message: string): Diagnostic {
  return { level, field, message };
}

function positive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function validateJob(job: JobSpec): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (!job.hashcatPath.trim()) {
    diagnostics.push(diagnostic("error", "hashcatPath", "请选择 hashcat 可执行文件"));
  }

  if (job.brain.enabled && job.brain.role === "server") {
    if (!positive(job.brain.port)) {
      diagnostics.push(diagnostic("error", "brain.port", "Brain 端口必须大于 0"));
    }
    return diagnostics;
  }

  if (job.risk.benchmark) {
    return diagnostics;
  }

  if (job.session.restore) {
    if (!job.session.name.trim()) {
      diagnostics.push(diagnostic("error", "session.name", "恢复会话需要会话名称"));
    }
    return diagnostics;
  }

  if (!job.hashFile.trim() && !job.inlineHashes.trim() && !job.risk.stdoutPreview) {
    diagnostics.push(diagnostic("error", "hashFile", "请选择哈希文件或粘贴哈希内容"));
  }

  if (job.hashFile.trim() && job.inlineHashes.trim()) {
    diagnostics.push(diagnostic("warning", "inlineHashes", "同时存在文件和粘贴内容时将使用粘贴内容"));
  }

  if (job.hashMode !== "auto") {
    if (!Number.isInteger(job.hashMode) || job.hashMode < 0) {
      diagnostics.push(diagnostic("error", "hashMode", "哈希模式必须是非负整数或自动识别"));
    }
  }

  const candidates = job.candidateSources.filter((item) => item.path.trim());
  const rules = job.ruleSources.filter((item) => item.path.trim());
  const masks = job.masks.filter((item) => item.value.trim());

  if (job.attackMode === 0 && candidates.length === 0 && !job.risk.stdoutPreview) {
    diagnostics.push(diagnostic("error", "candidateSources", "字典攻击至少需要一个词表或目录"));
  }

  if (job.attackMode === 1 && candidates.length !== 2) {
    diagnostics.push(diagnostic("error", "candidateSources", "组合攻击需要左右两个词表"));
  }

  if (job.attackMode === 3 && masks.length === 0) {
    diagnostics.push(diagnostic("error", "masks", "掩码攻击需要至少一个掩码"));
  }

  if ((job.attackMode === 6 || job.attackMode === 7) && (candidates.length === 0 || masks.length === 0)) {
    diagnostics.push(diagnostic("error", "candidateSources", "混合攻击同时需要词表和掩码"));
  }

  if (job.attackMode === 9 && candidates.length === 0) {
    diagnostics.push(diagnostic("error", "candidateSources", "关联攻击需要词表"));
  }

  if ((job.attackMode === 0 || job.attackMode === 9) && rules.length > 0 && job.attack.generateRules > 0) {
    diagnostics.push(diagnostic("warning", "attack.generateRules", "规则文件与随机规则会合并生效"));
  }

  if (job.attackMode !== 0 && job.attackMode !== 9 && rules.length > 0) {
    diagnostics.push(diagnostic("warning", "ruleSources", "hashcat 7.1.2 的 -r 仅适用于攻击模式 0 和 9"));
  }

  if (job.attackMode !== 3 && job.attack.increment !== "none") {
    diagnostics.push(diagnostic("warning", "attack.increment", "递增模式通常只用于掩码攻击"));
  }

  if (job.output.outfileFormat.length === 0) {
    diagnostics.push(diagnostic("error", "output.outfileFormat", "至少选择一种输出格式"));
  }

  if (job.output.outfileFormat.some((format) => format < 1 || format > 6)) {
    diagnostics.push(diagnostic("error", "output.outfileFormat", "输出格式只能是 1 到 6"));
  }

  if (job.session.statusJson && job.session.machineReadable) {
    diagnostics.push(diagnostic("warning", "session.machineReadable", "JSON 状态已启用，machine-readable 会重复输出"));
  }

  if (job.output.debugMode < 0 || job.output.debugMode > 5) {
    diagnostics.push(diagnostic("error", "output.debugMode", "Debug 模式只能是 0 到 5"));
  }

  if (job.output.debugMode > 0 && !job.output.debugFile.trim()) {
    diagnostics.push(diagnostic("warning", "output.debugFile", "启用规则调试时建议指定 debug 文件"));
  }

  if (job.input.veracryptPimStart > 0 && job.input.veracryptPimStop > 0 && job.input.veracryptPimStart > job.input.veracryptPimStop) {
    diagnostics.push(diagnostic("error", "input.veracryptPimStop", "VeraCrypt PIM 终点不能小于起点"));
  }

  if (job.input.hccapxMessagePair < 0 || job.input.hccapxMessagePair > 6) {
    diagnostics.push(diagnostic("warning", "input.hccapxMessagePair", "HCCAPX message pair 通常为 0 到 6"));
  }

  if (job.device.backendKeepFree < 0 || job.device.backendKeepFree > 100 || job.device.spinDamp < 0 || job.device.spinDamp > 100) {
    diagnostics.push(diagnostic("error", "device", "显存保留和 spin damp 百分比必须在 0 到 100 之间"));
  }

  const toolModes = [job.risk.speedOnly, job.risk.progressOnly, job.risk.keyspace, job.risk.totalCandidates].filter(Boolean).length;
  if (toolModes > 1) {
    diagnostics.push(diagnostic("warning", "risk", "诊断操作建议单独运行，避免输出语义混杂"));
  }

  if (job.risk.force) {
    diagnostics.push(diagnostic("warning", "risk.force", "--force 会绕过 hashcat 的兼容性和稳定性警告"));
  }

  if (job.device.optimizedKernel) {
    diagnostics.push(diagnostic("warning", "device.optimizedKernel", "优化内核可能限制密码长度，并影响复杂 UTF-16 输入"));
  }

  if (job.brain.enabled && job.brain.role === "client") {
    diagnostics.push(diagnostic("info", "brain.enabled", "Brain client 会自动启用 slow candidates"));
  }

  return diagnostics;
}

function appendNumber(args: string[], flag: string, value: number): void {
  if (Number.isFinite(value) && value > 0) args.push(flag, String(value));
}

function appendString(args: string[], flag: string, value: string): void {
  if (value.trim()) args.push(flag, value.trim());
}

export function compileCommand(job: JobSpec): CommandResult {
  const diagnostics = validateJob(job);
  const args: string[] = [];

  if (job.brain.enabled && job.brain.role === "server") {
    args.push("--brain-server");
    if (job.brain.password) args.push("--brain-password", job.brain.password);
    appendNumber(args, "--brain-server-timer", job.brain.serverTimer);
    appendString(args, "--brain-session-whitelist", job.brain.sessionWhitelist);
    return {
      program: job.hashcatPath,
      args,
      display: formatCommand(job.hashcatPath, args, true),
      diagnostics
    };
  }

  if (job.session.restore) {
    appendString(args, "--session", job.session.name);
    args.push("--restore");
    appendString(args, "--restore-file-path", job.session.restorePath);
    return {
      program: job.hashcatPath,
      args,
      display: formatCommand(job.hashcatPath, args, true),
      diagnostics
    };
  }

  if (job.risk.benchmark) {
    args.push("-b");
    if (job.hashMode !== "auto") args.push("-m", String(job.hashMode));
    if (job.risk.benchmarkAll) args.push("--benchmark-all");
    appendNumber(args, "--benchmark-min", job.risk.benchmarkMin);
    appendNumber(args, "--benchmark-max", job.risk.benchmarkMax);
    if (job.device.backendDevices) args.push("-d", job.device.backendDevices);
    return {
      program: job.hashcatPath,
      args,
      display: formatCommand(job.hashcatPath, args, true),
      diagnostics
    };
  }

  const effectiveHashMode = job.bridge.enabled ? job.bridge.mode : job.hashMode;
  if (effectiveHashMode !== "auto") args.push("-m", String(effectiveHashMode));
  args.push("-a", String(job.attackMode));

  if (job.username) args.push("--username");
  if (job.input.hexCharset) args.push("--hex-charset");
  if (job.input.hexSalt) args.push("--hex-salt");
  if (job.input.hexWordlist) args.push("--hex-wordlist");
  if (job.input.wordlistAutohexDisable) args.push("--wordlist-autohex-disable");
  if (job.input.dynamicX) args.push("--dynamic-x");
  appendString(args, "--encoding-from", job.input.encodingFrom);
  appendString(args, "--encoding-to", job.input.encodingTo);
  appendString(args, "--truecrypt-keyfiles", job.input.trueCryptKeyFiles);
  appendString(args, "--veracrypt-keyfiles", job.input.veracryptKeyFiles);
  appendNumber(args, "--veracrypt-pim-start", job.input.veracryptPimStart);
  appendNumber(args, "--veracrypt-pim-stop", job.input.veracryptPimStop);
  appendString(args, "--keyboard-layout-mapping", job.input.keyboardLayoutMapping);
  appendNumber(args, "--hccapx-message-pair", job.input.hccapxMessagePair);
  appendNumber(args, "--nonce-error-corrections", job.input.nonceErrorCorrections);

  const candidates = job.candidateSources.filter((item) => item.path.trim());
  const rules = job.ruleSources.filter((item) => item.path.trim());
  const masks = job.masks.filter((item) => item.value.trim());

  if (rules.length > 0 && (job.attackMode === 0 || job.attackMode === 9)) {
    for (const rule of rules) args.push("-r", rule.path.trim());
  }

  if (job.attack.ruleLeft.trim()) args.push("-j", job.attack.ruleLeft);
  if (job.attack.ruleRight.trim()) args.push("-k", job.attack.ruleRight);
  appendNumber(args, "-g", job.attack.generateRules);
  appendNumber(args, "--generate-rules-func-min", job.attack.generateRulesFuncMin);
  appendNumber(args, "--generate-rules-func-max", job.attack.generateRulesFuncMax);
  appendString(args, "--generate-rules-func-sel", job.attack.generateRulesFuncSel);
  appendNumber(args, "--generate-rules-seed", job.attack.generateRulesSeed);

  job.attack.customCharsets.forEach((charset, index) => {
    if (charset.trim()) args.push(`-${index + 1}`, charset.trim());
  });

  if (job.attack.increment === "normal") args.push("-i");
  if (job.attack.increment === "inverse") args.push("-ii");
  appendNumber(args, "--increment-min", job.attack.incrementMin);
  appendNumber(args, "--increment-max", job.attack.incrementMax);

  if (job.attack.markovMode === "disable") args.push("--markov-disable");
  if (job.attack.markovMode === "classic") args.push("--markov-classic");
  if (job.attack.markovMode === "inverse") args.push("--markov-inverse");
  appendNumber(args, "-t", job.attack.markovThreshold);
  appendString(args, "--markov-hcstat2", job.attack.markovHcstat2);

  if (job.attack.slowCandidates) args.push("-S");
  appendNumber(args, "--bypass-delay", job.attack.bypassDelay);
  appendNumber(args, "--bypass-threshold", job.attack.bypassThreshold);
  appendNumber(args, "-s", job.attack.skip);
  appendNumber(args, "-l", job.attack.limit);

  appendString(args, "-o", job.output.outfile);
  if (job.output.outfile) {
    args.push("--outfile-format", job.output.outfileFormat.join(","));
    if (job.output.outfileJson) args.push("--outfile-json");
  }
  if (!job.output.autohex) args.push("--outfile-autohex-disable");
  if (job.output.separator !== ":") args.push("-p", job.output.separator);
  if (!job.output.potfileEnabled) args.push("--potfile-disable");
  appendString(args, "--potfile-path", job.output.potfile);
  if (job.output.remove) args.push("--remove");
  appendNumber(args, "--remove-timer", job.output.removeTimer);
  appendNumber(args, "--debug-mode", job.output.debugMode);
  appendString(args, "--debug-file", job.output.debugFile);
  appendString(args, "--induction-dir", job.output.inductionDir);
  appendString(args, "--outfile-check-dir", job.output.outfileCheckDir);
  appendNumber(args, "--outfile-check-timer", job.output.outfileCheckTimer);
  if (job.output.colorCracked) args.push("--color-cracked");
  if (job.output.logfileDisabled) args.push("--logfile-disable");

  appendString(args, "--session", job.session.name);
  if (job.session.restoreDisabled) args.push("--restore-disable");
  appendString(args, "--restore-file-path", job.session.restorePath);
  appendNumber(args, "--runtime", job.session.runtime);
  if (job.session.statusJson) { args.push("--status", "--status-json"); }
  else if (job.session.status) args.push("--status");
  appendNumber(args, "--status-timer", job.session.statusTimer);
  if (job.session.machineReadable) args.push("--machine-readable");
  if (job.session.quiet) args.push("--quiet");
  appendNumber(args, "--stdin-timeout-abort", job.session.stdinTimeoutAbort);
  appendNumber(args, "--metal-compiler-runtime", job.session.metalCompilerRuntime);

  appendString(args, "-d", job.device.backendDevices);
  appendString(args, "-D", job.device.deviceTypes);
  if (job.device.ignoreCuda) args.push("--backend-ignore-cuda");
  if (job.device.ignoreHip) args.push("--backend-ignore-hip");
  if (job.device.ignoreMetal) args.push("--backend-ignore-metal");
  if (job.device.ignoreOpencl) args.push("--backend-ignore-opencl");
  if (job.device.workloadProfile > 0) args.push("-w", String(job.device.workloadProfile));
  if (job.device.optimizedKernel) args.push("-O");
  appendNumber(args, "-n", job.device.kernelAccel);
  appendNumber(args, "-u", job.device.kernelLoops);
  appendNumber(args, "-T", job.device.kernelThreads);
  appendNumber(args, "--backend-devices-keepfree", job.device.backendKeepFree);
  appendString(args, "--cpu-affinity", job.device.cpuAffinity);
  if (!job.device.hardwareMonitor) args.push("--hwmon-disable");
  appendNumber(args, "--hwmon-temp-abort", job.device.temperatureAbort);
  appendNumber(args, "-Y", job.device.virtualMultiplier);
  appendNumber(args, "-R", job.device.virtualHost);
  if (job.device.multiplyAccelDisable) args.push("-M");
  appendNumber(args, "--backend-vector-width", job.device.backendVectorWidth);
  appendNumber(args, "--spin-damp", job.device.spinDamp);
  appendNumber(args, "--scrypt-tmto", job.device.scryptTmto);
  appendNumber(args, "--hook-threads", job.device.hookThreads);
  appendNumber(args, "-c", job.device.segmentSize);
  appendNumber(args, "--bitmap-min", job.device.bitmapMin);
  appendNumber(args, "--bitmap-max", job.device.bitmapMax);

  if (job.risk.force) args.push("--force");
  if (job.risk.selfTestDisable) args.push("--self-test-disable");
  if (job.risk.keepGuessing) args.push("--keep-guessing");
  if (job.risk.loopback) args.push("--loopback");
  if (job.risk.deprecatedCheckDisable) args.push("--deprecated-check-disable");
  if (job.risk.speedOnly) args.push("--speed-only");
  if (job.risk.progressOnly) args.push("--progress-only");
  if (job.risk.keyspace) args.push("--keyspace");
  if (job.risk.totalCandidates) args.push("--total-candidates");

  if (job.bridge.enabled) {
    appendString(args, "--bridge-parameter1", job.bridge.parameter1);
    appendString(args, "--bridge-parameter2", job.bridge.parameter2);
    appendString(args, "--bridge-parameter3", job.bridge.parameter3);
    appendString(args, "--bridge-parameter4", job.bridge.parameter4);
  }

  if (job.brain.enabled && job.brain.role === "client") {
    args.push("-z");
    args.push("--brain-host", job.brain.host || "127.0.0.1");
    args.push("--brain-port", String(job.brain.port));
    if (job.brain.password) args.push("--brain-password", job.brain.password);
    appendString(args, "--brain-session", job.brain.session);
    args.push("--brain-client-features", String(job.brain.clientFeatures));
    if (!job.attack.slowCandidates) args.push("-S");
  }

  const positional: string[] = [];

  const queryOnly = job.risk.keyspace || job.risk.totalCandidates;
  if (!job.risk.stdoutPreview && !queryOnly) {
    const hashInput = job.inlineHashes.trim() ? "__inline_hashes__.hash" : job.hashFile.trim();
    if (hashInput) positional.push(hashInput);
  }

  if (job.attackMode === 0) {
    positional.push(...candidates.map((item) => item.path.trim()));
  } else if (job.attackMode === 1) {
    positional.push(...candidates.slice(0, 2).map((item) => item.path.trim()));
  } else if (job.attackMode === 3) {
    positional.push(...masks.map((item) => item.value.trim()));
  } else if (job.attackMode === 6) {
    positional.push(...candidates.map((item) => item.path.trim()));
    positional.push(...masks.map((item) => item.value.trim()));
  } else if (job.attackMode === 7) {
    positional.push(...masks.map((item) => item.value.trim()));
    positional.push(...candidates.map((item) => item.path.trim()));
  } else if (job.attackMode === 9) {
    positional.push(...candidates.map((item) => item.path.trim()));
  }

  if (job.risk.stdoutPreview) args.push("--stdout");
  args.push(...positional);

  return {
    program: job.hashcatPath,
    args,
    display: formatCommand(job.hashcatPath, args, true),
    diagnostics
  };
}

const charsetSizes: Record<string, number> = {
  l: 26,
  u: 26,
  d: 10,
  h: 16,
  H: 16,
  s: 33,
  a: 95,
  b: 256
};

function maskPositionSizes(mask: string, customCharsets: string[], seen: Set<number> = new Set()): number[] {
  const sizes: number[] = [];
  for (let index = 0; index < mask.length;) {
    if (mask[index] === "?" && mask[index + 1] === "?") {
      sizes.push(1);
      index += 2;
      continue;
    }
    if (mask[index] === "?") {
      const token = mask.slice(index, index + 2);
      const key = token[1];
      const customIndex = Number(key);
      if (customIndex >= 1 && customIndex <= 8 && !seen.has(customIndex)) {
        seen.add(customIndex);
        const nested = maskPositionSizes(customCharsets[customIndex - 1] || "", customCharsets, seen);
        sizes.push(nested.reduce((total, size) => total * size, 1));
      } else {
        sizes.push(charsetSizes[key] ?? 1);
      }
      index += 2;
      continue;
    }
    sizes.push(1);
    index += 1;
  }
  return sizes;
}

export function maskKeyspace(
  mask: string,
  customCharsets: string[],
  increment: "none" | "normal" | "inverse" = "none",
  incrementMin = 0,
  incrementMax = 0
): number {
  const sizes = maskPositionSizes(mask, customCharsets);
  const product = (values: number[]) => values.reduce((total, size) => total * size, 1);
  if (increment === "none") return product(sizes);

  const minLength = Math.max(1, incrementMin || 1);
  const maxLength = Math.min(sizes.length, incrementMax || sizes.length);
  let total = 0;
  for (let length = minLength; length <= maxLength; length += 1) {
    total += product(increment === "inverse" ? sizes.slice(-length) : sizes.slice(0, length));
  }
  return total;
}

export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return "未知";
  if (value < 1000) return String(value);
  const units = ["K", "M", "B", "T", "P"];
  let scaled = value;
  let unit = -1;
  while (scaled >= 1000 && unit < units.length - 1) {
    scaled /= 1000;
    unit += 1;
  }
  return `${scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1)}${units[unit]}`;
}

export function fallbackCapabilityProfile(hashModes: HashModeInfo[], executablePath: string): CapabilityProfile {
  return {
    hashcatVersion: "7.1.2",
    executablePath,
    attackModes: [0, 1, 3, 6, 7, 9],
    options: [],
    hashModes,
    devices: [],
    source: "fallback",
    probeWarnings: ["浏览器预览模式未连接本机 hashcat"]
  };
}

export const ATTACK_MODE_LABELS: Record<AttackMode, string> = {
  0: "字典",
  1: "组合",
  3: "掩码",
  6: "字典 + 掩码",
  7: "掩码 + 字典",
  9: "关联"
};
