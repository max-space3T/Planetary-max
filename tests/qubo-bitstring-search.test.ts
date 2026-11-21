import { describe, expect, it } from "vitest";
import { searchBoundedQuboBitstrings } from "../qubo-bitstring-search";

describe("QUBO bitstring search", () => {
  it("evaluates bounded candidates and returns best objective first", () => {
    const qMatrix = [
      [-2, 1],
      [1, -2],
    ];
    const res = searchBoundedQuboBitstrings({
      numVariables: 2,
      qMatrix,
      maxCandidates: 16,
    });

    expect(res.evaluatedCount).toBe(4);
    expect(res.best.bitstring).toHaveLength(2);
    expect(Number.isFinite(res.best.energy)).toBe(true);
    expect(res.best.energy).toBe(-2);
    expect(res.topCandidates[0].energy).toBe(res.best.energy);
  });
});
