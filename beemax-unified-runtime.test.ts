import { describe, expect, it } from "vitest";
import type { ClassificationDecision } from "./beemax-rosetta-fallback";
import { createExampleBeemaxRuntime } from "./beemax-unified-runtime";

describe("BeemaxUnifiedRuntime end-to-end", () => {
  it("keeps unverified LLM output as 'proposed' when verification is not required", async () => {
    const runtime = createExampleBeemaxRuntime();
    const decision: ClassificationDecision = {
      ruleId: "R3_DEEP_REASONING_AND_SYNTHESIS",
      routeTo: "max_llm",
      downstreamConsumers: ["MAXSPACE"],
      verification: { required: false, mode: "none" },
    };

    const out = await runtime.execute({
      decision,
      ingress: "portal_os1",
      scopeKey: "icv:class_b:workspace-1",
      input: { goal: "outline-scene" },
    });

    expect(out.substrateClass).toBe("class_b");
    expect(out.finalResult.envelope?.statusTag).toBe("proposed");
    expect(out.finalResult.envelope?.verifiedBySolver).toBe(false);
    expect(runtime.snapshotStore.hasVerified("icv:class_b:workspace-1")).toBe(false);
  });

  it("promotes solver-verified results to 'verified' and caches snapshot for class_c", async () => {
    const runtime = createExampleBeemaxRuntime();
    const decision: ClassificationDecision = {
      ruleId: "R3_DEEP_REASONING_AND_SYNTHESIS",
      routeTo: "max_llm",
      downstreamConsumers: ["MAXSPACE"],
      verification: { required: true, mode: "solver_gate" },
    };

    const out = await runtime.execute({
      decision,
      ingress: "portal_os1",
      scopeKey: "manifold:class_c:energy-check",
      input: { summary: "check conservation" },
      solverInput: {
        expression: "2 * x + 4",
        variables: { x: 3 },
        expectedValue: 10,
        metrics: { beforeA: 50, beforeB: 50, afterA: 75, afterB: 25 },
        constraints: [
          {
            kind: "conservation",
            beforeFields: ["beforeA", "beforeB"],
            afterFields: ["afterA", "afterB"],
            label: "total_energy_conserved",
          },
        ],
      },
    });

    expect(out.substrateClass).toBe("class_c");
    expect(out.proposedEnvelope?.statusTag).toBe("proposed");
    expect(out.finalResult.envelope?.statusTag).toBe("verified");
    expect(out.finalResult.envelope?.verifiedBySolver).toBe(true);
    expect(runtime.snapshotStore.hasVerified("manifold:class_c:energy-check")).toBe(true);
  });

  it("rejects failed constraints without writing a verified snapshot", async () => {
    const runtime = createExampleBeemaxRuntime();
    const decision: ClassificationDecision = {
      ruleId: "R4_EXACT_COMPUTE_AND_STATE_COMMIT",
      routeTo: "deterministic_and_quantum_solvers",
      downstreamConsumers: ["MAXSPACE"],
      verification: { required: true, mode: "solver_gate" },
    };

    await expect(
      runtime.execute({
          decision,
          ingress: "worker_dispatch",
          scopeKey: "manifold:class_c:bad-budget",
          input: {},
          solverInput: {
            metrics: { costA: 80, costB: 40 },
            constraints: [{ kind: "maxSum", fields: ["costA", "costB"], limit: 100 }],
          },
      })
    ).rejects.toThrow(/Deterministic verification failed/);

    expect(runtime.snapshotStore.hasVerified("manifold:class_c:bad-budget")).toBe(false);
  });
});
