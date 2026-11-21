import { describe, expect, it } from "vitest";
import { QuboSolverService } from "../qubo-solver-service";
import { pruneExpiredSnapshots } from "../snapshot-pruning";

describe("Layers 20-21 QuboSolverService & snapshot pruning", () => {
  it("runs QuboSolverService", async () => {
    const service = new QuboSolverService();
    const solved = await service.solve({
      scopeKey: "manifold:class_c:qubo-smoke",
      searchConfig: {
        numVariables: 2,
        qMatrix: [
          [-1, 0],
          [0, -1],
        ],
        maxCandidates: 8,
      },
    });
    expect(solved.verification.quboResult?.passed).toBe(true);
    expect(solved.verification.quboResult?.objectiveValue).toBe(-2);
  });

  it("prunes expired snapshots from a substitute store", () => {
    const entries = new Map([
      ["old", { savedAtMs: 899 }],
      ["current", { savedAtMs: 900 }],
    ]);
    const store = {
      getLatestVerified: (key: string) => entries.get(key),
      delete: (key: string) => entries.delete(key),
    } as Parameters<typeof pruneExpiredSnapshots>[0];

    const result = pruneExpiredSnapshots(store, ["old", "current", "missing"], 100, 1000);

    expect(result.prunedScopeKeys).toEqual(["old"]);
    expect(result.retainedCount).toBe(1);
    expect(entries.has("old")).toBe(false);
    expect(entries.has("current")).toBe(true);
  });
});
