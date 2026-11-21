import {
  ClassificationDecision,
  FallbackExecutionResult,
  IngressSource,
  RosettaEnvelope,
  VerifiedSnapshotFallbackHandler,
} from "./beemax-rosetta-fallback";
import {
  BeemaxAdapterRegistry,
  DeterministicSolverAdapter,
  FastRouterAdapter,
  MaxDeepNeuralAdapter,
  MaxLlmAdapter,
} from "./beemax-provider-adapters";
import {
  DeterministicConstraintSolverClient,
  SolverProblemInput,
  SolverVerificationReport,
} from "./deterministic-constraint-solver";
import { InMemorySnapshotStore } from "./in-memory-snapshot-store";
import {
  SubstrateAwareFallbackRunner,
  SubstrateClass,
} from "./substrate-fallback-policy";

export interface UnifiedDispatchParams<TInput, TOutput> {
  decision: ClassificationDecision;
  ingress: IngressSource;
  scopeKey: string;
  input: TInput;
  substrateClass?: SubstrateClass;
  correlationId?: string;
  solverInput?: SolverProblemInput;
}

export interface UnifiedDispatchResult<TOutput> {
  substrateClass: SubstrateClass;
  proposedEnvelope?: RosettaEnvelope<unknown> | null;
  finalResult: FallbackExecutionResult<TOutput>;
}

function createSnapshotStoreFallbackHandler(
  store: InMemorySnapshotStore
): VerifiedSnapshotFallbackHandler {
  return {
    async executeWithFallback<TInput, TOutput>(params: {
      decision: ClassificationDecision;
      scopeKey: string;
      input: TInput;
      timeoutMs: number;
      dispatch: (
        decision: ClassificationDecision,
        input: TInput,
        signal?: AbortSignal
      ) => Promise<RosettaEnvelope<TOutput> | null>;
    }): Promise<FallbackExecutionResult<TOutput>> {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;

      try {
        const live = await Promise.race([
          params.dispatch(params.decision, params.input, controller.signal),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              controller.abort();
              reject(new Error(`Adapter timed out after ${params.timeoutMs}ms`));
            }, params.timeoutMs);
          }),
        ]);

        if (live) {
          if (live.statusTag === "verified" && live.verifiedBySolver === true) {
            store.saveVerified(params.scopeKey, live);
          }
          return { envelope: live, usedFallback: false, fallbackReason: null };
        }

        const cached = store.getLatestVerified<TOutput>(params.scopeKey);
        if (cached) {
          return {
            envelope: cached.envelope,
            usedFallback: true,
            fallbackReason: "Adapter unwired; served last verified snapshot",
          };
        }

        return {
          envelope: null,
          usedFallback: false,
          fallbackReason: "Adapter unwired and no verified snapshot available",
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const cached = store.getLatestVerified<TOutput>(params.scopeKey);
        if (cached) {
          return {
            envelope: cached.envelope,
            usedFallback: true,
            fallbackReason: message,
          };
        }
        return { envelope: null, usedFallback: false, fallbackReason: message };
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  };
}

export class BeemaxUnifiedRuntime {
  readonly snapshotStore: InMemorySnapshotStore;
  readonly fallbackRunner: SubstrateAwareFallbackRunner;
  readonly registry: BeemaxAdapterRegistry;
  readonly solverClient: DeterministicConstraintSolverClient;

  constructor(options?: {
    snapshotStore?: InMemorySnapshotStore;
    solverClient?: DeterministicConstraintSolverClient;
  }) {
    this.snapshotStore = options?.snapshotStore ?? new InMemorySnapshotStore();
    this.solverClient =
      options?.solverClient ?? new DeterministicConstraintSolverClient();

    const storeHandler = createSnapshotStoreFallbackHandler(this.snapshotStore);
    this.fallbackRunner = new SubstrateAwareFallbackRunner(storeHandler);
    this.registry = new BeemaxAdapterRegistry(storeHandler);

    this.registry.register(
      new DeterministicSolverAdapter<SolverProblemInput, SolverVerificationReport>(
        this.solverClient,
        "deterministic-constraint-solver-v1"
      )
    );
  }

  async execute<TInput = unknown, TOutput = unknown>(
    params: UnifiedDispatchParams<TInput, TOutput>
  ): Promise<UnifiedDispatchResult<TOutput>> {
    const {
      decision,
      ingress,
      scopeKey,
      input,
      substrateClass,
      correlationId,
      solverInput,
    } = params;

    let proposedEnvelope: RosettaEnvelope<unknown> | null | undefined;

    if (decision.routeTo !== "deterministic_and_quantum_solvers") {
      const modelOutcome = await this.fallbackRunner.runWithSubstratePolicy<
        TInput,
        TOutput
      >({
        decision,
        scopeKey,
        input,
        substrateClass,
        dispatch: async (activeDecision, currentInput, signal) => {
          const adapter = this.registry.get(activeDecision.routeTo);
          if (!adapter) return null;
          return adapter.invoke({
            decision: activeDecision,
            ingress,
            scopeKey,
            input: currentInput,
            correlationId,
            signal,
          });
        },
      });

      proposedEnvelope = modelOutcome.result.envelope;

      if (!decision.verification.required) {
        return {
          substrateClass: modelOutcome.substrateClass,
          proposedEnvelope,
          finalResult: modelOutcome.result,
        };
      }
    }

    const solverDecision: ClassificationDecision = {
      ...decision,
      ruleId: "R4_EXACT_COMPUTE_AND_STATE_COMMIT",
      routeTo: "deterministic_and_quantum_solvers",
    };

    const effectiveSolverInput: SolverProblemInput = solverInput ?? {
      metrics:
        typeof input === "object" && input !== null
          ? (input as Record<string, number>)
          : {},
      constraints: [],
    };

    const solverOutcome = await this.fallbackRunner.runWithSubstratePolicy<
      SolverProblemInput,
      SolverVerificationReport
    >({
      decision: solverDecision,
      scopeKey,
      input: effectiveSolverInput,
      substrateClass,
      dispatch: async (activeDecision, currentSolverInput, signal) => {
        const solverAdapter = this.registry.get(
          "deterministic_and_quantum_solvers"
        );
        if (!solverAdapter) return null;
        return solverAdapter.invoke({
          decision: activeDecision,
          ingress,
          scopeKey,
          input: currentSolverInput,
          correlationId,
          signal,
        });
      },
    });

    return {
      substrateClass: solverOutcome.substrateClass,
      proposedEnvelope,
      finalResult: solverOutcome.result as unknown as FallbackExecutionResult<TOutput>,
    };
  }
}

export function createExampleBeemaxRuntime(): BeemaxUnifiedRuntime {
  const runtime = new BeemaxUnifiedRuntime();
  runtime.registry
    .register(
      new FastRouterAdapter({
        async routeCommand({ input }) {
          return { routedPayload: input, mode: "fast-command" };
        },
      })
    )
    .register(
      new MaxDeepNeuralAdapter({
        async inferPatterns({ input }) {
          return { patternPrior: input, confidence: 0.84 };
        },
      })
    )
    .register(
      new MaxLlmAdapter({
        async completeReasoning({ input }) {
          return { proposedPlan: input, status: "draft-proposal" };
        },
      })
    );
  return runtime;
}
