#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::{
  collections::HashMap,
  fs,
  fs::File,
  io::{BufRead, BufReader, Write},
  path::{Path, PathBuf},
  process::{Child, ChildStdin, Command, Stdio},
  sync::{atomic::{AtomicU64, Ordering}, Arc, Mutex},
  thread,
  time::{Duration, SystemTime, UNIX_EPOCH},
};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[cfg(windows)]
mod process_control {
  use std::ffi::c_void;

  type Handle = *mut c_void;
  const PROCESS_SUSPEND_RESUME: u32 = 0x0800;

  #[link(name = "kernel32")]
  extern "system" {
    fn OpenProcess(access: u32, inherit: i32, pid: u32) -> Handle;
    fn CloseHandle(handle: Handle) -> i32;
  }

  #[link(name = "ntdll")]
  extern "system" {
    fn NtSuspendProcess(handle: Handle) -> i32;
    fn NtResumeProcess(handle: Handle) -> i32;
  }

  pub fn set_suspended(pid: u32, suspended: bool) -> bool {
    unsafe {
      let handle = OpenProcess(PROCESS_SUSPEND_RESUME, 0, pid);
      if handle.is_null() { return false; }
      let status = if suspended { NtSuspendProcess(handle) } else { NtResumeProcess(handle) };
      CloseHandle(handle);
      status == 0
    }
  }
}

#[cfg(not(windows))]
mod process_control {
  pub fn set_suspended(_pid: u32, _suspended: bool) -> bool { false }
}

#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct RunDeviceStatus {
  #[serde(alias = "device_id")] device_id: u32,
  #[serde(alias = "device_name")] device_name: String,
  #[serde(alias = "device_type")] device_type: String,
  speed: u64,
  temp: i32,
  util: i32,
}

#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(default)]
#[serde(rename_all = "camelCase")]
struct RunStats {
  status: u32,
  progress: Vec<u64>,
  #[serde(alias = "recovered_hashes")] recovered_hashes: Vec<u64>,
  #[serde(alias = "recovered_salts")] recovered_salts: Vec<u64>,
  rejected: u64,
  devices: Vec<RunDeviceStatus>,
  #[serde(alias = "time_start")] time_start: u64,
  #[serde(alias = "estimated_stop")] estimated_stop: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RunLine {
  stream: String,
  text: String,
  timestamp: u128,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RunSnapshot {
  paused: bool,
  id: String,
  running: bool,
  exit_code: Option<i32>,
  stats: Option<RunStats>,
  lines: Vec<RunLine>,
}

struct RunningProcess {
  child: Child,
  stdin: Arc<Mutex<ChildStdin>>,
  snapshot: Arc<Mutex<RunSnapshot>>,
  log_path: PathBuf,
}

#[derive(Default)]
struct AppState {
  runs: Mutex<HashMap<String, RunningProcess>>,
}

static RUN_COUNTER: AtomicU64 = AtomicU64::new(1);


fn resolve_output_path(path: &str) -> PathBuf {
  let candidate = PathBuf::from(path);
  if candidate.is_absolute() { return candidate; }
  let current = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
  if current.file_name().and_then(|name| name.to_str()) == Some("src-tauri") {
    current.parent().unwrap_or(&current).join(candidate)
  } else {
    current.join(candidate)
  }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ConverterResult {
  output: String,
  exit_code: i32,
}

#[tauri::command]
fn run_converter(script: String, input_file: String, output_file: String) -> Result<ConverterResult, String> {
  let script_path = resolve_data_path(&script);
  let script_path_text = script_path.to_string_lossy().to_lowercase();
  if !script_path_text.contains("hashcat-7.1.2-binaries") || !script_path_text.contains("tools") {
    return Err("转换器必须来自 hashcat-7.1.2-binaries/tools".to_string());
  }
  let input_path = resolve_data_path(&input_file);
  let output_path = resolve_output_path(&output_file);
  let extension = script_path.extension().unwrap_or_default().to_string_lossy().to_lowercase();
  let interpreter = match extension.as_str() {
    "py" => "python",
    "pl" => "perl",
    "sh" => "bash",
    _ => return Err("仅支持 Python、Perl 或 Shell 转换器".to_string()),
  };
  let output = Command::new(interpreter).arg(&script_path).arg(&input_path).output().map_err(|error| error.to_string())?;
  let mut content = output.stdout;
  if content.is_empty() { content = output.stderr; }
  fs::write(&output_path, &content).map_err(|error| error.to_string())?;
  Ok(ConverterResult { output: String::from_utf8_lossy(&content).to_string(), exit_code: output.status.code().unwrap_or(-1) })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HashcatProbe {
  version: String,
  help: String,
  hash_info: String,
  backend_info: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ArtifactInfo {
  path: String,
  name: String,
  kind: String,
  size: u64,
  modified: u64,
  clear_mode: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FilePreview {
  path: String,
  content: String,
  truncated: bool,
}

fn now_ms() -> u128 {
  SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis()
}

fn resolve_executable_path(executable_path: &str) -> PathBuf {
  let candidate = PathBuf::from(executable_path);
  if candidate.is_absolute() || candidate.is_file() {
    return candidate;
  }

  if let Ok(current_dir) = std::env::current_dir() {
    let direct = current_dir.join(&candidate);
    if direct.is_file() {
      return direct;
    }

    if let Some(parent) = current_dir.parent() {
      let from_parent = parent.join(&candidate);
      if from_parent.is_file() {
        return from_parent;
      }
    }
  }

  candidate
}

fn is_path_flag(flag: &str) -> bool {
  matches!(
    flag,
    "-o" | "-r" | "--outfile" | "--rules-file" | "--markov-hcstat2" | "--restore-file-path" |
    "--potfile-path" | "--debug-file" | "--induction-dir" | "--outfile-check-dir" |
    "--keyboard-layout-mapping" | "--truecrypt-keyfiles" | "--veracrypt-keyfiles" |
    "--bridge-parameter1" | "--bridge-parameter2" | "--bridge-parameter3" | "--bridge-parameter4"
  )
}

fn normalize_args(args: &[String], root: &Path) -> Vec<String> {
  let mut normalized = Vec::with_capacity(args.len());
  let mut expect_path = false;

  for arg in args {
    if expect_path {
      let candidate = PathBuf::from(arg);
      let absolute = if candidate.is_absolute() { candidate } else { root.join(arg) };
      normalized.push(absolute.to_string_lossy().to_string());
      expect_path = false;
      continue;
    }

    if arg.starts_with('-') {
      expect_path = is_path_flag(arg);
      normalized.push(arg.clone());
      continue;
    }

    let candidate = PathBuf::from(arg);
    let is_path_like = arg.contains('/') || arg.contains('\\') || root.join(arg).exists();
    if is_path_like && !candidate.is_absolute() {
      normalized.push(root.join(arg).to_string_lossy().to_string());
    } else {
      normalized.push(arg.clone());
    }
  }

  normalized
}

fn command_base(executable_path: &str, args: &[String], cwd: &str) -> Command {
  let executable = resolve_executable_path(executable_path);
  let root = if !cwd.is_empty() {
    PathBuf::from(cwd)
  } else {
    executable.parent().and_then(|path| path.parent()).map(PathBuf::from).unwrap_or_else(|| PathBuf::from("."))
  };
  let mut command = Command::new(&executable);
  command.args(normalize_args(args, &root));
  if let Some(workdir) = executable.parent().filter(|path| path.is_dir()) {
    command.current_dir(workdir);
  }
  command.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
  #[cfg(windows)]
  command.creation_flags(CREATE_NO_WINDOW);
  command
}

fn capture_command(executable_path: &str, args: &[&str], cwd: &str) -> Result<String, String> {
  let mut command = command_base(
    executable_path,
    &args.iter().map(|value| (*value).to_string()).collect::<Vec<_>>(),
    cwd,
  );
  let output = command.output().map_err(|error| error.to_string())?;
  let mut text = String::from_utf8_lossy(&output.stdout).to_string();
  text.push_str(&String::from_utf8_lossy(&output.stderr));
  Ok(text)
}

#[tauri::command]
fn probe_hashcat(executable_path: String) -> Result<HashcatProbe, String> {
  let version = capture_command(&executable_path, &["-V"], "")?;
  let help = capture_command(&executable_path, &["-h"], "")?;
  let hash_info = capture_command(&executable_path, &["--hash-info"], "")?;
  let backend_info = capture_command(&executable_path, &["-I"], "")?;
  Ok(HashcatProbe { version, help, hash_info, backend_info })
}

#[tauri::command]
fn write_temp_hashes(content: String) -> Result<String, String> {
  let mut directory = std::env::temp_dir();
  directory.push("hashcat-gui");
  fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
  let filename = format!("inline-hashes-{}-{}.hash", now_ms(), RUN_COUNTER.fetch_add(1, Ordering::Relaxed));
  let path: PathBuf = directory.join(filename);
  fs::write(&path, content).map_err(|error| error.to_string())?;
  Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn open_log_console(log_path: &Path, update_seconds: u32, keep_open: bool) -> Option<Child> {
  #[cfg(windows)]
  {
    const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;
    let escaped_path = log_path.to_string_lossy().replace('\'', "''");
    let escaped_done = format!("{}.done", escaped_path);
    let ending = if keep_open { "Read-Host 'Task finished. Press Enter to close this window'" } else { "exit" };
    let script = format!(
      "$Host.UI.RawUI.WindowTitle='Hashcat Run'; $offset=0; while($true) {{ if(Test-Path -LiteralPath '{escaped_path}') {{ $lines=@(Get-Content -LiteralPath '{escaped_path}'); if($lines.Count -gt $offset) {{ for($i=$offset; $i -lt $lines.Count; $i++) {{ Write-Output $lines[$i] }}; $offset=$lines.Count }} }}; if(Test-Path -LiteralPath '{escaped_done}') {{ Write-Output 'Task finished.'; break }}; Start-Sleep -Seconds {update_seconds} }}; {ending}"
    );
    let mut command = Command::new("powershell.exe");
    command.args(["-NoLogo", "-NoProfile", "-Command", &script]);
    command.creation_flags(CREATE_NEW_CONSOLE);
    command.spawn().ok()
  }
  #[cfg(not(windows))]
  {
    None
  }
}

#[tauri::command]
fn start_hashcat(
  executable_path: String,
  args: Vec<String>,
  cwd: String,
  open_console: Option<bool>,
  keep_console_open: Option<bool>,
  console_update_seconds: Option<u32>,
  state: tauri::State<'_, AppState>,
) -> Result<String, String> {
  let run_id = format!("run-{}", RUN_COUNTER.fetch_add(1, Ordering::Relaxed));
  let runtime_dir = std::env::temp_dir().join("hashcat-gui");
  fs::create_dir_all(&runtime_dir).map_err(|error| error.to_string())?;
  let log_path = runtime_dir.join(format!("{}.log", run_id));
  let log_file = Arc::new(Mutex::new(File::create(&log_path).map_err(|error| error.to_string())?));
  let mut redacted_args = Vec::with_capacity(args.len());
  let mut redact_next = false;
  for arg in &args {
    if redact_next { redacted_args.push("<redacted>".to_string()); redact_next = false; }
    else if arg == "--brain-password" { redacted_args.push(arg.clone()); redact_next = true; }
    else { redacted_args.push(arg.clone()); }
  }
  if let Ok(mut log) = log_file.lock() {
    let _ = writeln!(log, "[{}] command: {} {}", now_ms(), executable_path, redacted_args.join(" "));
  }
  if open_console.unwrap_or(false) {
    let _ = open_log_console(&log_path, console_update_seconds.unwrap_or(2).max(1), keep_console_open.unwrap_or(true));
  }

  let mut child = command_base(&executable_path, &args, &cwd)
    .spawn()
    .map_err(|error| error.to_string())?;

  let stdin = child.stdin.take().ok_or("hashcat stdin unavailable")?;
  let stdout = child.stdout.take().ok_or("hashcat stdout unavailable")?;
  let stderr = child.stderr.take().ok_or("hashcat stderr unavailable")?;
  let snapshot = Arc::new(Mutex::new(RunSnapshot {
    id: run_id.clone(),
    running: true,
    paused: false,
    exit_code: None,
    stats: None,
    lines: Vec::new(),
  }));

  spawn_reader(stdout, "stdout", Arc::clone(&log_file), Arc::clone(&snapshot));
  spawn_reader(stderr, "stderr", Arc::clone(&log_file), Arc::clone(&snapshot));

  state.runs.lock().map_err(|_| "run state lock poisoned")?.insert(
    run_id.clone(),
    RunningProcess {
      child,
      stdin: Arc::new(Mutex::new(stdin)),
      snapshot,
      log_path,
    },
  );

  Ok(run_id)
}

fn format_speed(value: u64) -> String {
  let units = ["H/s", "KH/s", "MH/s", "GH/s", "TH/s"];
  let mut speed = value as f64;
  let mut unit = 0;
  while speed >= 1000.0 && unit < units.len() - 1 { speed /= 1000.0; unit += 1; }
  format!("{:.1} {}", speed, units[unit])
}

fn format_status(stats: &RunStats) -> String {
  let progress = stats.progress.first().copied().unwrap_or(0);
  let total = stats.progress.get(1).copied().unwrap_or(0);
  let speed = stats.devices.iter().map(|device| device.speed).sum::<u64>();
  let recovered = stats.recovered_hashes.first().copied().unwrap_or(0);
  let recovered_total = stats.recovered_hashes.get(1).copied().unwrap_or(0);
  let temperature = stats.devices.iter().map(|device| device.temp).max().unwrap_or(-1);
  format!("[status] progress {}/{} | speed {} | recovered {}/{} | temp {}C", progress, total, format_speed(speed), recovered, recovered_total, temperature)
}

fn spawn_reader<R: std::io::Read + Send + 'static>(
  reader: R,
  stream: &'static str,
  log_file: Arc<Mutex<File>>,
  snapshot: Arc<Mutex<RunSnapshot>>,
) {
  thread::spawn(move || {
    for line in BufReader::new(reader).lines().map_while(Result::ok) {
      let stats = serde_json::from_str::<RunStats>(&line).ok();
      let log_line = stats.as_ref().map(format_status).unwrap_or_else(|| line.clone());

      if let Ok(mut log) = log_file.lock() {
        let _ = writeln!(log, "{}", log_line);
      }

      if let Ok(mut current) = snapshot.lock() {
        if let Some(stats) = stats {
          current.stats = Some(stats);
        }

        current.lines.push(RunLine {
          stream: stream.to_string(),
          text: line,
          timestamp: now_ms(),
        });
      }
    }
  });
}

#[tauri::command]
fn poll_hashcat(run_id: String, state: tauri::State<'_, AppState>) -> Result<RunSnapshot, String> {
  let mut runs = state.runs.lock().map_err(|_| "run state lock poisoned")?;
  let run = runs.get_mut(&run_id).ok_or("run not found")?;

  if let Some(status) = run.child.try_wait().map_err(|error| error.to_string())? {
    thread::sleep(Duration::from_millis(250));
    let done_path = format!("{}.done", run.log_path.to_string_lossy());
    let _ = fs::write(done_path, "finished\n");
    if let Ok(mut snapshot) = run.snapshot.lock() {
      snapshot.running = false;
      snapshot.exit_code = status.code();
    }
  }

  run.snapshot.lock().map(|snapshot| (*snapshot).clone()).map_err(|_| "snapshot lock poisoned".to_string())
}

#[tauri::command]
fn control_hashcat(run_id: String, control: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
  let mut runs = state.runs.lock().map_err(|_| "run state lock poisoned")?;
  let run = runs.get_mut(&run_id).ok_or("run not found")?;
  if control == "pause" || control == "resume" {
    let suspended = control == "pause";
    let system_updated = process_control::set_suspended(run.child.id(), suspended);
    if !system_updated {
      let mut stdin = run.stdin.lock().map_err(|_| "stdin lock poisoned")?;
      stdin.write_all(b"p").map_err(|error| error.to_string())?;
      stdin.flush().map_err(|error| error.to_string())?;
    }
    if let Ok(mut snapshot) = run.snapshot.lock() { snapshot.paused = suspended; }
    return Ok(());
  }

  let key = match control.as_str() {
    "checkpoint" => "c",
    "quit" => "q",
    "status" => "s",
    _ => return Err("unknown control action".to_string()),
  };
  let mut stdin = run.stdin.lock().map_err(|_| "stdin lock poisoned")?;
  stdin.write_all(key.as_bytes()).map_err(|error| error.to_string())?;
  stdin.flush().map_err(|error| error.to_string())?;
  Ok(())
}

#[tauri::command]
fn stop_hashcat(run_id: String, force: Option<bool>, state: tauri::State<'_, AppState>) -> Result<(), String> {
  let mut runs = state.runs.lock().map_err(|_| "run state lock poisoned")?;
  let run = runs.get_mut(&run_id).ok_or("run not found")?;

  if force.unwrap_or(false) {
    let _ = run.child.kill();
    let status = run.child.wait().map_err(|error| error.to_string())?;
    if let Ok(mut snapshot) = run.snapshot.lock() {
      snapshot.running = false;
      snapshot.exit_code = status.code();
    }
    return Ok(());
  }

  {
    let mut stdin = run.stdin.lock().map_err(|_| "stdin lock poisoned")?;
    let _ = stdin.write_all(b"c");
    let _ = stdin.flush();
  }
  thread::sleep(Duration::from_millis(500));
  if let Some(status) = run.child.try_wait().map_err(|error| error.to_string())? {
    let done_path = format!("{}.done", run.log_path.to_string_lossy());
    let _ = fs::write(done_path, "finished\n");
    if let Ok(mut snapshot) = run.snapshot.lock() { snapshot.running = false; snapshot.exit_code = status.code(); }
    return Ok(());
  }

  let _ = run.child.kill();
  let status = run.child.wait().map_err(|error| error.to_string())?;
  let done_path = format!("{}.done", run.log_path.to_string_lossy());
  let _ = fs::write(done_path, "finished\n");
  if let Ok(mut snapshot) = run.snapshot.lock() { snapshot.running = false; snapshot.exit_code = status.code(); }
  Ok(())
}

fn resolve_data_path(path: &str) -> PathBuf {
  let candidate = PathBuf::from(path);
  if candidate.is_absolute() || candidate.exists() { return candidate; }
  if let Ok(current) = std::env::current_dir() {
    let direct = current.join(&candidate);
    if direct.exists() { return direct; }
    if let Some(parent) = current.parent() {
      let from_parent = parent.join(&candidate);
      if from_parent.exists() { return from_parent; }
    }
  }
  candidate
}

fn modified_seconds(path: &PathBuf) -> u64 {
  fs::metadata(path).and_then(|meta| meta.modified()).ok()
    .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
    .map(|duration| duration.as_secs()).unwrap_or(0)
}

fn artifact_kind(path: &Path) -> Option<(&'static str, &'static str)> {
  let name = path.file_name()?.to_string_lossy().to_lowercase();
  if name.ends_with(".potfile") { return Some(("potfile", "clear")); }
  if name.ends_with(".log.done") { return Some(("log", "delete")); }
  if name.ends_with(".log") { return Some(("log", "clear")); }
  if name.ends_with(".restore") { return Some(("restore", "delete")); }
  if name.ends_with(".outfile") || name.ends_with(".out") { return Some(("output", "delete")); }
  if name.starts_with("inline-hashes-") { return Some(("temporary", "delete")); }
  None
}

fn push_artifact(list: &mut Vec<ArtifactInfo>, path: PathBuf, kind: &str, clear_mode: &str) {
  let metadata = match fs::metadata(&path) { Ok(meta) => meta, Err(_) => return };
  list.push(ArtifactInfo {
    name: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
    path: path.to_string_lossy().to_string(),
    kind: kind.to_string(),
    size: if metadata.is_file() { metadata.len() } else { 0 },
    modified: modified_seconds(&path),
    clear_mode: clear_mode.to_string(),
  });
}

#[tauri::command]
fn read_text_file(path: String, max_bytes: Option<u64>) -> Result<FilePreview, String> {
  let path = resolve_data_path(&path);
  let limit = max_bytes.unwrap_or(2 * 1024 * 1024) as usize;
  let data = fs::read(&path).map_err(|error| error.to_string())?;
  let truncated = data.len() > limit;
  let content = String::from_utf8_lossy(&data[..data.len().min(limit)]).to_string();
  Ok(FilePreview { path: path.to_string_lossy().to_string(), content, truncated })
}

#[tauri::command]
fn clear_text_file(path: String) -> Result<(), String> {
  File::create(resolve_data_path(&path)).map_err(|error| error.to_string())?;
  Ok(())
}

#[tauri::command]
fn list_generated_artifacts(executable_path: String) -> Result<Vec<ArtifactInfo>, String> {
  let mut artifacts = Vec::new();
  let executable = resolve_executable_path(&executable_path);
  if let Some(base) = executable.parent() {
    if let Ok(entries) = fs::read_dir(base) {
      for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
          let name = path.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
          if name == "inducts" || name == "profiles" { push_artifact(&mut artifacts, path, "temporary", "delete"); }
        } else if let Some((kind, mode)) = artifact_kind(&path) {
          push_artifact(&mut artifacts, path, kind, mode);
        }
      }
    }
  }

  let runtime_dir = std::env::temp_dir().join("hashcat-gui");
  if let Ok(entries) = fs::read_dir(runtime_dir) {
    for entry in entries.flatten() {
      let path = entry.path();
      if let Some((kind, mode)) = artifact_kind(&path) { push_artifact(&mut artifacts, path, kind, mode); }
    }
  }

  artifacts.sort_by(|a, b| a.path.cmp(&b.path));
  Ok(artifacts)
}

#[tauri::command]
fn clear_generated_artifact(path: String) -> Result<(), String> {
  let path = resolve_data_path(&path);
  let name = path.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
  let allowed = name.ends_with(".potfile") || name.ends_with(".log") || name.ends_with(".log.done") || name.ends_with(".restore") || name.ends_with(".outfile") || name.ends_with(".out") || name.starts_with("inline-hashes-") || name == "inducts" || name == "profiles";
  if !allowed { return Err("该路径不属于可清理的生成文件".to_string()); }
  if path.is_dir() { fs::remove_dir_all(path).map_err(|error| error.to_string()) }
  else if name.ends_with(".potfile") || (name.ends_with(".log") && !name.ends_with(".log.done")) {
    File::create(path).map_err(|error| error.to_string())?; Ok(())
  } else { fs::remove_file(path).map_err(|error| error.to_string()) }
}


#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
  if !url.starts_with("https://") && !url.starts_with("http://") {
    return Err("只允许打开 HTTP/HTTPS 官方链接".to_string());
  }
  open::that(url).map_err(|error| error.to_string())
}

fn main() {
  tauri::Builder::default()
    .setup(|app| {
      use tauri::Manager;
      let window = app.get_webview_window("main").ok_or("main window unavailable")?;
      if let Ok(Some(monitor)) = window.primary_monitor() {
        let size = monitor.size();
        let width = (size.width * 3) / 4;
        let height = (size.height * 3) / 4;
        let desired = tauri::PhysicalSize::new(width, height);
        let _ = window.set_size(desired);
        if let (Ok(outer), Ok(inner)) = (window.outer_size(), window.inner_size()) {
          let border_width = outer.width.saturating_sub(inner.width);
          let border_height = outer.height.saturating_sub(inner.height);
          let _ = window.set_size(tauri::PhysicalSize::new(width.saturating_sub(border_width), height.saturating_sub(border_height)));
        }
      }
      Ok(())
    })
    .plugin(tauri_plugin_dialog::init())
    .manage(AppState::default())
    .invoke_handler(tauri::generate_handler![
      probe_hashcat,
      write_temp_hashes,
      start_hashcat,
      poll_hashcat,
      control_hashcat,
      stop_hashcat,
      read_text_file,
      clear_text_file,
      list_generated_artifacts,
      clear_generated_artifact,
      run_converter,
      open_external
    ])
    .run(tauri::generate_context!())
    .expect("error while running Hashcat Studio");
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn parses_hashcat_status_json() {
    let json = r#"{"status":3,"progress":[10,100],"recovered_hashes":[1,2],"recovered_salts":[0,1],"rejected":0,"devices":[{"device_id":1,"device_name":"GPU","device_type":"GPU","speed":123,"temp":70,"util":90}],"time_start":1,"estimated_stop":2}"#;
    let stats: RunStats = serde_json::from_str(json).unwrap();
    assert_eq!(stats.recovered_hashes, vec![1, 2]);
    assert_eq!(stats.devices[0].device_name, "GPU");
    assert_eq!(stats.progress, vec![10, 100]);
  }
}
