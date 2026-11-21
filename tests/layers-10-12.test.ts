import { describe, expect, it } from "vitest";
import { createQuboEnabledRuntime } from "../qubo-runtime-integration";
import { dispatchMaxMath } from "../max-math-dispatcher";

describe("Layers 10-12 QUBO runtime & MAX-MATH dispatch", () => {
  it("dispatches a verified math check and stores a verified snapshot", async () => {
    const { runtime } = createQuboEnabledRuntime();
    const result = await dispatchMaxMath(runtime, {
      domain: "manifold",
      substrateClass: "class_c",
      topic: "conservation-check",
      solverInput: {
        metrics: { a: 10, b: 20, total: 30 },
        constraints: [{ kind: "maxSum", fields: ["a", "b"], limit: 50 }],
      },
    });

    expect(result.finalResult.envelope?.statusTag).toBe("verified");
    expect(result.finalResult.envelope?.verifiedBySolver).toBe(true);
    expect(runtime.snapshotStore.hasVerified("manifold:class_c:max-math:conservation-check")).toBe(true);
  });
});
