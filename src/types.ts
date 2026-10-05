export type AttackMode = 0 | 1 | 3 | 6 | 7 | 9;
export type HashModeSelection = "auto" | number;
export type MarkovMode = "default" | "disable" | "classic" | "inverse";

export interface HashModeInfo {
  id: number;
  name: string;
  category: string;
  slowHash: boolean;
  deprecated: boolean;
  passwordType: string;
  passwordMin: number;
  passwordMax: number;
  kernels: string[];
  exampleHash: string;
  examplePassword: string;
  autodetect: boolean;
  selfTest: boolean;
  potfile: boolean;
  keepGuessing: boolean;
  customPlugin: boolean;
  encodings: string[];
}

export interface DeviceInfo {
  id: string;
  backend: string;
  name: string;
  type: string;
  processors?: number;
  memoryTotal?: string;
  memoryFree?: string;
  clock?: string;
}

export interface CapabilityProfile {
  hashcatVersion: string;
  executablePath: string;
  attackModes: number[];
  options: string[];
  hashModes: HashModeInfo[];
  devices: DeviceInfo[];
  source: "live" | "fallback";
  probeWarnings: string[];
}

export interface Diagnostic {
  level: "error" | "warning" | "info";
  field: string;
  message: string;
}

export interface CandidateSource {
  id: string;
  path: string;
  kind: "wordlist" | "directory";
}

export interface RuleSource {
  id: string;
  path: string;
}

export interface MaskSource {
  id: string;
  value: string;
  isFile: boolean;
}

export interface InputOptions {
  hexCharset: boolean;
  hexSalt: boolean;
  hexWordlist: boolean;
  wordlistAutohexDisable: boolean;
  dynamicX: boolean;
  encodingFrom: string;
  encodingTo: string;
  trueCryptKeyFiles: string;
  veracryptKeyFiles: string;
  veracryptPimStart: number;
  veracryptPimStop: number;
  keyboardLayoutMapping: string;
  hccapxMessagePair: number;
  nonceErrorCorrections: number;
}

export interface OutputOptions {
  outfile: string;
  outfileFormat: number[];
  outfileJson: boolean;
  separator: string;
  potfileEnabled: boolean;
  potfile: string;
  remove: boolean;
  autohex: boolean;
  debugMode: number;
  debugFile: string;
  inductionDir: string;
  outfileCheckDir: string;
  outfileCheckTimer: number;
  removeTimer: number;
  colorCracked: boolean;
  logfileDisabled: boolean;
}

export interface SessionOptions {
  name: string;
  restore: boolean;
  restoreDisabled: boolean;
  restorePath: string;
  runtime: number;
  status: boolean;
  statusJson: boolean;
  statusTimer: number;
  machineReadable: boolean;
  quiet: boolean;
  stdinTimeoutAbort: number;
  metalCompilerRuntime: number;
  openConsoleWindow: boolean;
  keepConsoleOpen: boolean;
  consoleUpdateTimer: number;
}

export interface DeviceOptions {
  backendDevices: string;
  deviceTypes: string;
  ignoreCuda: boolean;
  ignoreHip: boolean;
  ignoreMetal: boolean;
  ignoreOpencl: boolean;
  workloadProfile: 0 | 1 | 2 | 3 | 4;
  optimizedKernel: boolean;
  kernelAccel: number;
  kernelLoops: number;
  kernelThreads: number;
  backendKeepFree: number;
  temperatureAbort: number;
  hardwareMonitor: boolean;
  cpuAffinity: string;
  virtualMultiplier: number;
  virtualHost: number;
  multiplyAccelDisable: boolean;
  backendVectorWidth: number;
  spinDamp: number;
  scryptTmto: number;
  hookThreads: number;
  segmentSize: number;
  bitmapMin: number;
  bitmapMax: number;
}

export interface AttackOptions {
  markovMode: MarkovMode;
  markovThreshold: number;
  markovHcstat2: string;
  increment: "none" | "normal" | "inverse";
  incrementMin: number;
  incrementMax: number;
  slowCandidates: boolean;
  bypassDelay: number;
  bypassThreshold: number;
  customCharsets: string[];
  ruleLeft: string;
  ruleRight: string;
  generateRules: number;
  generateRulesFuncMin: number;
  generateRulesFuncMax: number;
  generateRulesFuncSel: string;
  generateRulesSeed: number;
  skip: number;
  limit: number;
}

export interface BrainOptions {
  enabled: boolean;
  role: "client" | "server";
  host: string;
  port: number;
  password: string;
  session: string;
  clientFeatures: number;
  serverTimer: number;
  sessionWhitelist: string;
}

export interface BridgeOptions {
  enabled: boolean;
  mode: 72000 | 73000 | 74000;
  parameter1: string;
  parameter2: string;
  parameter3: string;
  parameter4: string;
}

export interface RiskOptions {
  force: boolean;
  selfTestDisable: boolean;
  keepGuessing: boolean;
  loopback: boolean;
  deprecatedCheckDisable: boolean;
  stdoutPreview: boolean;
  benchmark: boolean;
  benchmarkAll: boolean;
  benchmarkMin: number;
  benchmarkMax: number;
  speedOnly: boolean;
  progressOnly: boolean;
  keyspace: boolean;
  totalCandidates: boolean;
}

export interface JobSpec {
  name: string;
  hashcatPath: string;
  hashMode: HashModeSelection;
  hashFile: string;
  inlineHashes: string;
  username: boolean;
  attackMode: AttackMode;
  candidateSources: CandidateSource[];
  ruleSources: RuleSource[];
  masks: MaskSource[];
  input: InputOptions;
  output: OutputOptions;
  session: SessionOptions;
  device: DeviceOptions;
  attack: AttackOptions;
  brain: BrainOptions;
  bridge: BridgeOptions;
  risk: RiskOptions;
}

export interface CommandResult {
  program: string;
  args: string[];
  display: string;
  diagnostics: Diagnostic[];
}

export interface ArtifactInfo {
  path: string;
  name: string;
  kind: "potfile" | "log" | "restore" | "output" | "temporary";
  size: number;
  modified: number;
  clearMode: "clear" | "delete";
}

export interface FilePreview {
  path: string;
  content: string;
  truncated: boolean;
}

export interface RunLine {
  stream: "stdout" | "stderr";
  text: string;
  timestamp: number;
}

export interface RunDeviceStatus {
  deviceId: number;
  deviceName: string;
  deviceType: string;
  speed: number;
  temp: number;
  util: number;
}

export interface RunStats {
  status: number;
  progress: number[];
  recoveredHashes: number[];
  recoveredSalts: number[];
  rejected: number;
  devices: RunDeviceStatus[];
  timeStart: number;
  estimatedStop: number;
}

export interface RunSnapshot {
  paused: boolean;
  id: string;
  running: boolean;
  exitCode: number | null;
  lines: RunLine[];
  stats: RunStats | null;
}

export type RunControl = "pause" | "resume" | "checkpoint" | "quit" | "status";

export interface RunHistoryEntry {
  id: string;
  jobName: string;
  sessionName: string;
  command: string;
  startedAt: number;
  finishedAt: number;
  exitCode: number | null;
  recovered: number;
  total: number;
  speed: number;
}
