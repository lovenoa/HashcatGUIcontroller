import { describe, expect, it } from "vitest";
import { createDefaultJob } from "./commandCompiler";
import { applyCommandToJob, parseCommandLine } from "./commandParser";

describe("commandParser", () => {
  it("tokenizes quoted paths and program names", () => {
    const parsed = parseCommandLine('"C:\\Program Files\\hashcat.exe" -m 0 "hashes file.hash" "word list.txt"');
    expect(parsed.program).toBe("C:\\Program Files\\hashcat.exe");
    expect(parsed.args).toEqual(["-m", "0", "hashes file.hash", "word list.txt"]);
  });

  it("imports a straight attack into JobSpec", () => {
    const parsed = parseCommandLine("hashcat -m 1000 -a 0 -r rules/best66.rule hashes.txt wordlist.txt");
    const job = applyCommandToJob(createDefaultJob(), parsed);

    expect(job.hashMode).toBe(1000);
    expect(job.attackMode).toBe(0);
    expect(job.hashFile).toBe("hashes.txt");
    expect(job.ruleSources.map((item) => item.path)).toEqual(["rules/best66.rule"]);
    expect(job.candidateSources.map((item) => item.path)).toEqual(["wordlist.txt"]);
  });

  it("imports a mask attack and custom charset", () => {
    const parsed = parseCommandLine("hashcat -m 0 -a 3 -1 ?l?d hashes.txt ?1?1?1?d");
    const job = applyCommandToJob(createDefaultJob(), parsed);

    expect(job.attackMode).toBe(3);
    expect(job.attack.customCharsets[0]).toBe("?l?d");
    expect(job.masks[0].value).toBe("?1?1?1?d");
    expect(job.masks[0].isFile).toBe(false);
  });
  it("imports advanced input, output and device flags", () => {
    const parsed = parseCommandLine(
      "hashcat --hex-charset --encoding-from iso-8859-15 --debug-mode 4 --debug-file good.log --spin-damp 10 --scrypt-tmto 3 --backend-ignore-cuda hashes.txt words.txt"
    );
    const job = applyCommandToJob(createDefaultJob(), parsed);

    expect(job.input.hexCharset).toBe(true);
    expect(job.input.encodingFrom).toBe("iso-8859-15");
    expect(job.output.debugMode).toBe(4);
    expect(job.output.debugFile).toBe("good.log");
    expect(job.device.spinDamp).toBe(10);
    expect(job.device.scryptTmto).toBe(3);
    expect(job.device.ignoreCuda).toBe(true);
  });

  it("imports long aliases and inline values", () => {
    const parsed = parseCommandLine("hashcat --hash-type=1400 --attack-mode=3 --markov-threshold=40 --increment-inverse hashes.txt ?d?d");
    const job = applyCommandToJob(createDefaultJob(), parsed);
    expect(job.hashMode).toBe(1400);
    expect(job.attackMode).toBe(3);
    expect(job.attack.markovThreshold).toBe(40);
    expect(job.attack.increment).toBe("inverse");
  });

  it("imports Brain and Bridge flags", () => {
    const parsed = parseCommandLine(
      "hashcat -m 73000 -a 0 -z --brain-host 10.0.0.2 --brain-port 14000 --brain-client-features 2 --bridge-parameter1 plugin.py hashes.txt words.txt"
    );
    const job = applyCommandToJob(createDefaultJob(), parsed);

    expect(job.brain.enabled).toBe(true);
    expect(job.brain.host).toBe("10.0.0.2");
    expect(job.brain.port).toBe(14000);
    expect(job.brain.clientFeatures).toBe(2);
    expect(job.bridge.parameter1).toBe("plugin.py");
  });
});
