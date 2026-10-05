import { spawn } from "node:child_process";
import { delimiter, join, resolve } from "node:path";
import { homedir } from "node:os";

const root = resolve(import.meta.dirname, "..");
const cargoHome = process.env.CARGO_HOME || join(homedir(), ".cargo");
const cargoBin = join(cargoHome, "bin");
process.env.PATH = `${cargoBin}${delimiter}${process.env.PATH || ""}`;

const cli = resolve(root, "node_modules", "@tauri-apps", "cli", "tauri.js");
const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], {
  cwd: root,
  env: process.env,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 0;
});
