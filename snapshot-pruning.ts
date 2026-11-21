import { InMemorySnapshotStore } from "./in-memory-snapshot-store";

export interface PruneExpiredResult {
  prunedScopeKeys: string[];
  retainedCount: number;
}

export function pruneExpiredSnapshots(
  store: InMemorySnapshotStore,
  scopeKeys: Iterable<string>,
  maxAgeMs: number,
  nowMs = Date.now()
): PruneExpiredResult {
  const safeMaxAge = Math.max(0, maxAgeMs);
  const prunedScopeKeys: string[] = [];
  let retainedCount = 0;

  for (const key of scopeKeys) {
    const entry = store.getLatestVerified(key);
    if (!entry) continue;

    const ageMs = nowMs - entry.savedAtMs;
    if (ageMs > safeMaxAge) {
      store.delete(key);
      prunedScopeKeys.push(key);
    } else {
      retainedCount += 1;
    }
  }

  return { prunedScopeKeys, retainedCount };
}
