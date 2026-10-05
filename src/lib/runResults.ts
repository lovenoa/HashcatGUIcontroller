import type { RunLine } from "../types";

export interface RecoveredResult {
  hash: string;
  plain: string;
}

export function parseRecoveredResults(lines: RunLine[]): RecoveredResult[] {
  const results: RecoveredResult[] = [];

  for (const line of lines) {
    const text = line.text.trim();
    if (!text || text.startsWith("{") || text.startsWith("hashcat (")) continue;

    const separator = text.indexOf(":");
    if (separator <= 0 || separator >= text.length - 1) continue;

    results.push({
      hash: text.slice(0, separator),
      plain: text.slice(separator + 1)
    });
  }

  return results;
}
