import {
  ClassificationDecision,
  IngressSource,
} from "./beemax-rosetta-fallback";
import { DeterministicSolverAdapter } from "./beemax-provider-adapters";
import {
  BeemaxUnifiedRuntime,
  UnifiedDispatchResult,
} from "./beemax-unified-runtime";
import {
  ExtendedSolverReport,
  MatrixAndQuboInput,
  MatrixAndQuboSolverClient,
} from "./qubo-matrix-solver-extension";
import { InMemorySnapshotStore } from "./in-memory-snapshot-store";
import { SubstrateClass } from "./substrate-fallback-policy";

export function createQuboEnabledRuntime(options?: {
  snapshotStore?: InMemorySnapshotStore;
  quboSolverClient?: MatrixAndQuboSolverClient;
}): {
  runtime: BeemaxUnifiedRuntime;
  quboSolver: MatrixAndQuboSolverClient;
} {
  const quboSolver =
    options?.quboSolverClient ?? new MatrixAndQuboSolverClient();
  const runtime = new BeemaxUnifiedRuntime({
    snapshotStore: options?.snapshotStore,
    solverClient: quboSolver,
  });

  runtime.registry.register(
    new DeterministicSolverAdapter<MatrixAndQuboInput, ExtendedSolverReport>(
      { solveAndVerify: (params) => quboSolver.solveAndVerifyExtended(params) },
      "max-math-qubo-solver-adapter"
    )
  );

  return { runtime, quboSolver };
}

export async function runSolverVerification(params: {
  runtime: BeemaxUnifiedRuntime;
  ingress: IngressSource;
  scopeKey: string;
  solverInput: MatrixAndQuboInput;
  substrateClass?: SubstrateClass;
  correlationId?: string;
}): Promise<UnifiedDispatchResult<ExtendedSolverReport>> {
  const decision: ClassificationDecision = {
    ruleId: "R4_EXACT_COMPUTE_AND_STATE_COMMIT",
    routeTo: "deterministic_and_quantum_solvers",
    downstreamConsumers: ["MAXSPACE", "Portal-OS1"],
    verification: {
      required: true,
      mode: "solver_gate",
    },
  };

  return params.runtime.execute<MatrixAndQuboInput, ExtendedSolverReport>({
    decision,
    ingress: params.ingress,
    scopeKey: params.scopeKey,
    input: params.solverInput,
    solverInput: params.solverInput,
    substrateClass: params.substrateClass,
    correlationId: params.correlationId,
  });
}
