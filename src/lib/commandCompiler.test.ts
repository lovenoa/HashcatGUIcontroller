import { describe, expect, it } from "vitest";
import {
  compileCommand,
  createDefaultJob,
  formatCount,
  maskKeyspace,
  validateJob
} from "./commandCompiler";

describe("commandCompiler", () => {
  it("compiles a straight attack with hash mode and rules", () => {
    const job = createDefaultJob();
    const command = compileCommand(job);

    expect(command.args).toContain("-m");
    expect(command.args).toContain("0");
    expect(command.args).toContain("-a");
    expect(command.args).toContain("0");
    expect(command.args).toContain("-r");
    expect(command.display).toContain("example0.hash");
    expect(command.display).toContain("example.dict");
  });

  it("uses inline hash placeholder when content is pasted", () => {
    const job = createDefaultJob();
    job.inlineHashes = "8743b52063cd84097a65d1633f5c74f5";

    expect(compileCommand(job).args).toContain("__inline_hashes__.hash");
  });

  it("builds a mask-only command without hash input in stdout preview", () => {
    const job = createDefaultJob();
    job.attackMode = 3;
    job.candidateSources = [];
    job.ruleSources = [];
    job.risk.stdoutPreview = true;
    job.hashFile = "";

    const command = compileCommand(job);
    expect(command.args).toContain("--stdout");
    expect(command.args).toContain("?u?l?l?l?l?d?d?d?d");
    expect(validateJob(job).some((item) => item.level === "error")).toBe(false);
  });

  it("rejects combination attacks without two wordlists", () => {
    const job = createDefaultJob();
    job.attackMode = 1;
    job.candidateSources = job.candidateSources.slice(0, 1);

    expect(validateJob(job).some((item) => item.field === "candidateSources")).toBe(true);
  });

  it("compiles a Brain server as a standalone operation", () => {
    const job = createDefaultJob();
    job.brain.enabled = true;
    job.brain.role = "server";

    const command = compileCommand(job);
    expect(command.args).toEqual(["--brain-server", "--brain-server-timer", "300"]);
  });

  it("estimates mask keyspace", () => {
    expect(maskKeyspace("?d?d", [])).toBe(100);
    expect(maskKeyspace("?u?l?l?d?d", [])).toBe(26 * 26 * 26 * 10 * 10);
  });

  it("compiles format-specific and expert options", () => {
    const job = createDefaultJob();
    job.input.hexCharset = true;
    job.input.encodingFrom = "iso-8859-15";
    job.input.veracryptPimStart = 450;
    job.output.debugMode = 4;
    job.output.debugFile = "good.log";
    job.device.spinDamp = 10;
    job.device.scryptTmto = 3;

    const args = compileCommand(job).args;
    expect(args).toContain("--hex-charset");
    expect(args).toContain("--encoding-from");
    expect(args).toContain("--veracrypt-pim-start");
    expect(args).toContain("--debug-mode");
    expect(args).toContain("--spin-damp");
    expect(args).toContain("--scrypt-tmto");
  });

  it("omits hash input for keyspace and candidate-count queries", () => {
    const job = createDefaultJob();
    job.risk.keyspace = true;

    const args = compileCommand(job).args;
    expect(args).toContain("--keyspace");
    expect(args).not.toContain("hashcat-7.1.2-binaries/example0.hash");
  });

  it("redacts Brain passwords in displayed commands but preserves runtime args", () => {
    const job = createDefaultJob();
    job.brain.enabled = true;
    job.brain.password = "super-secret";
    const command = compileCommand(job);
    expect(command.args).toContain("super-secret");
    expect(command.display).not.toContain("super-secret");
    expect(command.display).toContain("<redacted>");
  });

  it("formats large counts", () => {
    expect(formatCount(1000)).toBe("1.0K");
    expect(formatCount(1000000)).toBe("1.0M");
  });
});
