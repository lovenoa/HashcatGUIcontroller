import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const tempRoot = resolve(tmpdir());
const installRoot = resolve(tempRoot, `hashcat-studio-bundle-check-${process.pid}`);
const installer = resolve(
  root,
  "src-tauri",
  "target",
  "release",
  "bundle",
  "nsis",
  "Hashcat Studio_0.1.0_x64-setup.exe",
);

function fail(message) {
  console.error(`Bundle verification failed: ${message}`);
  process.exit(1);
}

function run(file, args, cwd = tempRoot) {
  const result = spawnSync(file, args, {
    cwd,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) fail(`${file} exited with code ${result.status}`);
}

function assertGuiSubsystem(file) {
  const image = readFileSync(file);
  const peOffset = image.readUInt32LE(0x3c);
  if (image.readUInt32LE(peOffset) !== 0x0000_4550) fail(`${file} is not a valid PE executable`);
  const subsystem = image.readUInt16LE(peOffset + 24 + 68);
  if (subsystem !== 2) fail(`${file} must use the Windows GUI subsystem, found ${subsystem}`);
}

if (!existsSync(installer)) fail(`installer not found at ${installer}`);
if (!installRoot.startsWith(`${tempRoot}${sep}`)) {
  fail(`refusing to use a verification directory outside ${tempRoot}`);
}

mkdirSync(installRoot, { recursive: true });

try {
  run(installer, ["/S", `/D=${installRoot}`]);

  for (const file of ["hashcat-gui.exe", "WebView2Loader.dll"]) {
    if (!existsSync(join(installRoot, file))) fail(`${file} was not installed beside hashcat-gui.exe`);
  }

  assertGuiSubsystem(join(installRoot, "hashcat-gui.exe"));
  console.log("NSIS bundle verification passed: GUI executable and WebView2 loader are present.");
} finally {
  const uninstaller = join(installRoot, "uninstall.exe");
  if (existsSync(uninstaller)) run(uninstaller, ["/S"]);

  if (!resolve(installRoot).startsWith(`${tempRoot}${sep}`)) {
    fail(`refusing to clean a verification directory outside ${tempRoot}`);
  }
  rmSync(installRoot, { recursive: true, force: true });
}
