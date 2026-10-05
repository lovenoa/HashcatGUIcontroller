import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const binaries = resolve(root, "hashcat-7.1.2-binaries");
const hashcat = resolve(binaries, "hashcat.exe");
const exampleHashesPath = resolve(binaries, "docs", "hashcat-example-hashes.md");
const outputDir = resolve(root, "src", "data");
const outputPath = resolve(outputDir, "hashModes.generated.json");

function cleanCell(value) {
  return value.trim().replace(/^<sup>[\s\S]*<\/sup>$/, "").replace(/<[^>]+>/g, "").trim();
}

function extractBacktick(value) {
  const match = value.match(/`([^`]*)`/);
  return match ? match[1] : cleanCell(value);
}

function parseExampleTable(markdown) {
  const modes = new Map();

  for (const line of markdown.split(/\r?\n/)) {
    if (!line.startsWith("| [`")) continue;

    const cells = line.split("|").map((cell) => cell.trim());
    const modeMatch = cells[1]?.match(/\[`(\d+)`\]/);
    if (!modeMatch || cells.length < 6) continue;

    const kernels = [...cells[3].matchAll(/\[([^\]]+)\]/g)].map((match) => match[1]);
    modes.set(Number(modeMatch[1]), {
      id: Number(modeMatch[1]),
      name: extractBacktick(cells[2]),
      category: "Uncategorized",
      slowHash: false,
      deprecated: false,
      passwordType: "plain",
      passwordMin: 0,
      passwordMax: 256,
      kernels,
      exampleHash: extractBacktick(cells[5]),
      examplePassword: "",
      autodetect: true,
      selfTest: true,
      potfile: true,
      keepGuessing: false,
      customPlugin: false,
      encodings: ["ASCII", "HEX"]
    });
  }

  return modes;
}

function parseHashInfo(output, modes) {
  let current = null;

  const commit = () => {
    if (current && modes.has(current.id)) {
      modes.set(current.id, {
        ...modes.get(current.id),
        ...current.values,
        id: current.id,
        kernels: current.values.kernels ?? modes.get(current.id).kernels
      });
    }
    current = null;
  };

  for (const line of output.split(/\r?\n/)) {
    const modeMatch = line.match(/^Hash mode #(\d+)$/);
    if (modeMatch) {
      commit();
      current = { id: Number(modeMatch[1]), values: {} };
      continue;
    }

    if (!current) continue;

    const separator = line.indexOf(": ");
    if (separator < 0) continue;
    const key = line.slice(0, separator).replace(/\./g, "").trim();
    const value = line.slice(separator + 2).trim();
    const values = current.values;

    switch (key) {
      case "Name": values.name = value; break;
      case "Category": values.category = value; break;
      case "Slow.Hash": values.slowHash = value === "Yes"; break;
      case "Deprecated": values.deprecated = value === "Yes"; break;
      case "Password.Type": values.passwordType = value; break;
      case "Password.Len.Min": values.passwordMin = Number(value); break;
      case "Password.Len.Max": values.passwordMax = Number(value); break;
      case "Kernel.Type(s)": values.kernels = value.split(",").map((item) => item.trim()); break;
      case "Example.Hash": values.exampleHash = value; break;
      case "Example.Pass": values.examplePassword = value; break;
      case "Autodetect.Enabled": values.autodetect = value === "Yes"; break;
      case "Self.Test.Enabled": values.selfTest = value === "Yes"; break;
      case "Potfile.Enabled": values.potfile = value === "Yes"; break;
      case "Keep.Guessing": values.keepGuessing = value === "Yes"; break;
      case "Custom.Plugin": values.customPlugin = value === "Yes"; break;
      case "Plaintext.Encoding": values.encodings = value.split(",").map((item) => item.trim()); break;
    }
  }

  commit();
}

const markdown = readFileSync(exampleHashesPath, "utf8");
const modes = parseExampleTable(markdown);

const result = spawnSync(hashcat, ["--hash-info"], {
  cwd: binaries,
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
  windowsHide: true
});

if (result.status === 0 && result.stdout) {
  parseHashInfo(result.stdout, modes);
} else {
  console.warn("hashcat --hash-info unavailable; generating catalog from example hash table only.");
}

const catalog = [...modes.values()].sort((a, b) => a.id - b.id);
mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

console.log(`Generated ${catalog.length} hash modes at ${outputPath}`);
