import type { FailureFingerprint } from './intelligenceTypes.js';

export function blockingKeysFor(fp: FailureFingerprint): string[] {
  const keys: string[] = [];
  for (const p of fp.failedRequestPaths) keys.push(`endpoint:${p}`);
  if (fp.errorSignature.category !== 'unknown') keys.push(`category:${fp.errorSignature.category}`);
  if (fp.affectedArea) keys.push(`area:${fp.affectedArea.trim().toLowerCase()}`);
  if (fp.normalizedPath && fp.normalizedPath !== '/') keys.push(`page:${fp.normalizedPath}`);
  for (const c of fp.consoleErrorSignatures) keys.push(`console:${c.slice(0, 80)}`);
  if (fp.selectorSignature) keys.push(`selector:${fp.selectorSignature}`);
  if (fp.errorSignature.normalizedMessage)
    keys.push(`err:${fp.errorSignature.normalizedMessage.slice(0, 80)}`);
  return Array.from(new Set(keys));
}

export interface CandidatePair {
  a: FailureFingerprint;
  b: FailureFingerprint;
  sharedBlockKeys: string[];
}

export function generateCandidatePairs(
  fingerprints: FailureFingerprint[],
  maxPairs: number,
): CandidatePair[] {
  const buckets = new Map<string, FailureFingerprint[]>();
  for (const fp of fingerprints) {
    for (const key of blockingKeysFor(fp)) {
      let b = buckets.get(key);
      if (!b) {
        b = [];
        buckets.set(key, b);
      }
      b.push(fp);
    }
  }

  const seenPair = new Set<string>();
  const sharedByPair = new Map<string, string[]>();
  const out: CandidatePair[] = [];

  for (const [key, group] of buckets) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group[i]!;
        const b = group[j]!;
        if (a.testRunId === b.testRunId) continue;
        const pairKey = pairId(a.testRunId, b.testRunId);
        let shared = sharedByPair.get(pairKey);
        if (!shared) {
          shared = [];
          sharedByPair.set(pairKey, shared);
        }
        shared.push(key);
        if (!seenPair.has(pairKey)) {
          seenPair.add(pairKey);
          if (out.length >= maxPairs) continue;
          out.push({ a, b, sharedBlockKeys: shared });
        }
      }
    }
    if (out.length >= maxPairs) break;
  }
  // The shared-key list captured earlier is a reference to the same array; ensure order deterministic.
  for (const p of out) p.sharedBlockKeys = Array.from(new Set(p.sharedBlockKeys)).sort();
  return out;
}

export function pairId(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
