import { describe, expect, it } from "vitest";
import type { RunLine } from "../types";
import { parseRecoveredResults } from "./runResults";

function line(text: string): RunLine {
  return { stream: "stdout", text, timestamp: 1 };
}

describe("runResults", () => {
  it("extracts recovered hash and plaintext", () => {
    expect(parseRecoveredResults([line("8743b52063cd84097a65d1633f5c74f5:hashcat")])).toEqual([
      { hash: "8743b52063cd84097a65d1633f5c74f5", plain: "hashcat" }
    ]);
  });

  it("keeps colons inside the recovered plaintext", () => {
    expect(parseRecoveredResults([line("abc123:pass:with:colon")])).toEqual([
      { hash: "abc123", plain: "pass:with:colon" }
    ]);
  });

  it("ignores JSON status and startup lines", () => {
    const results = parseRecoveredResults([
      line('{ "status": 5, "recovered_hashes": [1, 2] }'),
      line("hashcat (v7.1.2) starting"),
      line("abc:def")
    ]);

    expect(results).toEqual([{ hash: "abc", plain: "def" }]);
  });
});
