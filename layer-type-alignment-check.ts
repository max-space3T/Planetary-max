import type { EnvelopeStatusTag, RosettaEnvelope } from "./beemax-rosetta-fallback";
import type { SubstrateClass } from "./substrate-fallback-policy";

export type AssertAssignable<T, U extends T> = U;

export type _CheckSubstrateAlignment = AssertAssignable<
  SubstrateClass,
  "class_b" | "class_c"
>;

export type _CheckStatusAlignment = AssertAssignable<
  EnvelopeStatusTag,
  "proposed" | "verified"
>;

export function assertEnvelopeIntegrity<T>(
  envelope: RosettaEnvelope<T>
): RosettaEnvelope<T> {
  if (envelope.statusTag === "verified" && !envelope.verifiedBySolver) {
    throw new Error(
      `Envelope integrity violation: "${envelope.envelopeId}" is marked verified without verifiedBySolver=true.`
    );
  }
  return envelope;
}

export type {
  ClassificationDecision,
  EnvelopeStatusTag,
  FallbackExecutionResult,
  IngressSource,
  IntelligenceLayerId,
  PolicyRuleId,
  RosettaEnvelope,
  VerificationRequirement,
  VerifiedSnapshotFallbackHandler,
} from "./beemax-rosetta-fallback";

export type {
  AdapterInvokeParams,
  BeemaxProviderAdapter,
  DeterministicSolverClient,
  FastRouterClient,
  MaxDeepNeuralClient,
  MaxLlmClient,
} from "./beemax-provider-adapters";

export {
  BeemaxAdapterRegistry,
  DeterministicSolverAdapter,
  FastRouterAdapter,
  MaxDeepNeuralAdapter,
  MaxLlmAdapter,
} from "./beemax-provider-adapters";

export type {
  ConstraintCheckResult,
  ConstraintRule,
  SolverProblemInput,
  SolverVerificationReport,
} from "./deterministic-constraint-solver";
export { DeterministicConstraintSolverClient } from "./deterministic-constraint-solver";

export type { MeshManifoldContext, StructuralNamespace } from "./beemax-mesh-manifold-substrates";
export { wrapMeshManifoldPacket } from "./beemax-mesh-manifold-substrates";

export type { SubstrateClass, SubstrateFallbackPolicy } from "./substrate-fallback-policy";
export {
  DEFAULT_SUBSTRATE_POLICIES,
  SubstrateAwareFallbackRunner,
  resolveSubstrateClassFromScope,
} from "./substrate-fallback-policy";

export type { StoredSnapshotEntry } from "./in-memory-snapshot-store";
export { InMemorySnapshotStore } from "./in-memory-snapshot-store";

export type { UnifiedDispatchParams, UnifiedDispatchResult } from "./beemax-unified-runtime";
export { BeemaxUnifiedRuntime, createExampleBeemaxRuntime } from "./beemax-unified-runtime";

export type { ExtendedSolverReport, MatrixAndQuboInput } from "./qubo-matrix-solver-extension";
export {
  MatrixAndQuboSolverClient,
  computeDotProduct,
  evaluateQuboObjective,
} from "./qubo-matrix-solver-extension";

export { createQuboEnabledRuntime, runSolverVerification } from "./qubo-runtime-integration";
export type { AppliedMigrationRow, MigrationEntry, SqlExecutor } from "./idempotent-migration-runner";
export { applyMigrationsIdempotently } from "./idempotent-migration-runner";
export type { MaxMathOperation, MaxMathRequest, MaxMathResponse } from "./max-math-dispatcher";
export { MaxMathDispatcher } from "./max-math-dispatcher";
export type { QuboSearchCandidate, QuboSearchResult, QuboSearchConfig, QuboCandidateScore, SeededQuboSearchResult } from "./qubo-bitstring-search";
export { searchBoundedQuboBitstrings } from "./qubo-bitstring-search";
export type { PortalOS1LayoutProps } from "./PortalOS1Layout";
export { PortalOS1Layout } from "./PortalOS1Layout";
