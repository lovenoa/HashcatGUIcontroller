import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const npmCli = process.env.npm_execpath;
const cargo = join(process.env.CARGO_HOME || join(homedir(), ".cargo"), "bin", process.platform === "win32" ? "cargo.exe" : "cargo");

function run(command, args, cwd = root) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`\nRelease check failed: ${message}`);
    process.exit(1);
  }
}

assert(Boolean(npmCli), "npm_execpath is unavailable");

const sourceFiles = [
  ...filesUnder(resolve(root, "src")),
  ...filesUnder(resolve(root, "src-tauri", "src")),
  ...filesUnder(resolve(root, "scripts"))
];

const forbidden = ["hashcat-7.1.2-" + "sources", "TO" + "DO", "FIX" + "ME", "HA" + "CK"];
for (const file of sourceFiles) {
  if (!statSync(file).isFile() || !/\.(ts|tsx|rs|mjs)$/.test(file)) continue;
  const content = readFileSync(file, "utf8");
  for (const token of forbidden) {
    assert(!content.includes(token), `${file} contains release-blocker token ${token}`);
  }
}

const config = JSON.parse(readFileSync(resolve(root, "src-tauri", "tauri.conf.json"), "utf8"));
assert(config.bundle?.active === true, "Tauri bundle must be active");
assert(Array.isArray(config.bundle?.targets) && config.bundle.targets.includes("nsis"), "NSIS target must be configured");

run(process.execPath, [npmCli, "test"]);
run(process.execPath, [npmCli, "run", "build"]);
run(cargo, ["clippy", "--all-targets", "--", "-D", "warnings"], resolve(root, "src-tauri"));
run(cargo, ["check"], resolve(root, "src-tauri"));
run(cargo, ["test"], resolve(root, "src-tauri"));

console.log("\nRelease checks passed.");
