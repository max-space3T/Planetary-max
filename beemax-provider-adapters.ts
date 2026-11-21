import {
  ClassificationDecision,
  createRosettaEnvelope,
  IngressSource,
  IntelligenceLayerId,
  promoteEnvelopeToVerified,
  RosettaEnvelope,
  VerifiedSnapshotFallbackHandler,
} from "./beemax-rosetta-fallback";

export interface AdapterInvokeParams<TInput = unknown> {
  decision: ClassificationDecision;
  ingress: IngressSource;
  scopeKey: string;
  input: TInput;
  correlationId?: string;
  signal?: AbortSignal;
}

export interface BeemaxProviderAdapter<TInput = unknown, TOutput = unknown> {
  readonly adapterId: string;
  readonly layerId: IntelligenceLayerId;
  invoke(params: AdapterInvokeParams<TInput>): Promise<RosettaEnvelope<TOutput>>;
}

export interface FastRouterClient<TInput = unknown, TOutput = unknown> {
  routeCommand(params: AdapterInvokeParams<TInput>): Promise<TOutput>;
}

export interface MaxDeepNeuralClient<TInput = unknown, TOutput = unknown> {
  inferPatterns(params: AdapterInvokeParams<TInput>): Promise<TOutput>;
}

export interface MaxLlmClient<TInput = unknown, TOutput = unknown> {
  completeReasoning(params: AdapterInvokeParams<TInput>): Promise<TOutput>;
}

export interface DeterministicSolverClient<TInput = unknown, TOutput = unknown> {
  solveAndVerify(params: AdapterInvokeParams<TInput>): Promise<TOutput>;
}

export class FastRouterAdapter<TInput = unknown, TOutput = unknown>
  implements BeemaxProviderAdapter<TInput, TOutput>
{
  readonly layerId: IntelligenceLayerId = "beemax_fast_router";

  constructor(
    private readonly client: FastRouterClient<TInput, TOutput>,
    readonly adapterId = "beemax-fast-router-adapter"
  ) {}

  async invoke(
    params: AdapterInvokeParams<TInput>
  ): Promise<RosettaEnvelope<TOutput>> {
    const output = await this.client.routeCommand(params);
    return createRosettaEnvelope({
      packetId: params.correlationId ?? `r1_${Date.now()}`,
      ingress: params.ingress,
      sourceLayer: this.layerId,
      targetLayer: "Portal-OS1",
      scopeKey: params.scopeKey,
      payload: output,
      statusTag: "proposed",
      metadata: { adapterId: this.adapterId, tier: "R1" },
    });
  }
}

export class MaxDeepNeuralAdapter<TInput = unknown, TOutput = unknown>
  implements BeemaxProviderAdapter<TInput, TOutput>
{
  readonly layerId: IntelligenceLayerId = "max_deep_neural_network";

  constructor(
    private readonly client: MaxDeepNeuralClient<TInput, TOutput>,
    readonly adapterId = "max-deep-neural-adapter"
  ) {}

  async invoke(
    params: AdapterInvokeParams<TInput>
  ): Promise<RosettaEnvelope<TOutput>> {
    const output = await this.client.inferPatterns(params);
    return createRosettaEnvelope({
      packetId: params.correlationId ?? `r2_${Date.now()}`,
      ingress: params.ingress,
      sourceLayer: this.layerId,
      targetLayer: "MAXSPACE",
      scopeKey: params.scopeKey,
      payload: output,
      statusTag: "proposed",
      metadata: { adapterId: this.adapterId, tier: "R2" },
    });
  }
}

export class MaxLlmAdapter<TInput = unknown, TOutput = unknown>
  implements BeemaxProviderAdapter<TInput, TOutput>
{
  readonly layerId: IntelligenceLayerId = "max_llm";

  constructor(
    private readonly client: MaxLlmClient<TInput, TOutput>,
    readonly adapterId = "max-llm-adapter"
  ) {}

  async invoke(
    params: AdapterInvokeParams<TInput>
  ): Promise<RosettaEnvelope<TOutput>> {
    const output = await this.client.completeReasoning(params);
    return createRosettaEnvelope({
      packetId: params.correlationId ?? `r3_${Date.now()}`,
      ingress: params.ingress,
      sourceLayer: this.layerId,
      targetLayer: "MAXSPACE",
      scopeKey: params.scopeKey,
      payload: output,
      statusTag: "proposed",
      metadata: { adapterId: this.adapterId, tier: "R3" },
    });
  }
}

export class DeterministicSolverAdapter<TInput = unknown, TOutput = unknown>
  implements BeemaxProviderAdapter<TInput, TOutput>
{
  readonly layerId: IntelligenceLayerId = "deterministic_and_quantum_solvers";

  constructor(
    private readonly client: DeterministicSolverClient<TInput, TOutput>,
    readonly adapterId = "deterministic-solver-adapter"
  ) {}

  async invoke(
    params: AdapterInvokeParams<TInput>
  ): Promise<RosettaEnvelope<TOutput>> {
    const draftEnvelope = createRosettaEnvelope({
      packetId: params.correlationId ?? `r4_draft_${Date.now()}`,
      ingress: params.ingress,
      sourceLayer: this.layerId,
      targetLayer: "MAXSPACE",
      scopeKey: params.scopeKey,
      payload: params.input,
      statusTag: "proposed",
      metadata: { adapterId: this.adapterId, tier: "R4" },
    });

    const verifiedOutput = await this.client.solveAndVerify(params);
    return promoteEnvelopeToVerified(
      draftEnvelope,
      verifiedOutput,
      `${draftEnvelope.packetId}_verified`
    );
  }
}

export class BeemaxAdapterRegistry {
  private readonly adapters = new Map<IntelligenceLayerId, BeemaxProviderAdapter>();

  constructor(private readonly fallbackHandler: VerifiedSnapshotFallbackHandler) {}

  register<TInput, TOutput>(
    adapter: BeemaxProviderAdapter<TInput, TOutput>
  ): this {
    this.adapters.set(adapter.layerId, adapter as BeemaxProviderAdapter);
    return this;
  }

  get(layerId: IntelligenceLayerId): BeemaxProviderAdapter | undefined {
    return this.adapters.get(layerId);
  }

  async invokeWithFallback<TInput, TOutput>(params: {
    decision: ClassificationDecision;
    ingress: IngressSource;
    scopeKey: string;
    input: TInput;
    timeoutMs: number;
    correlationId?: string;
  }) {
    const targetLayer = params.decision.routeTo;
    return this.fallbackHandler.executeWithFallback<TInput, TOutput>({
      decision: params.decision,
      scopeKey: params.scopeKey,
      input: params.input,
      timeoutMs: params.timeoutMs,
      dispatch: async (decision, currentInput, signal) => {
        const adapter = this.adapters.get(targetLayer);
        if (!adapter) return null;
        return adapter.invoke({
          decision,
          ingress: params.ingress,
          scopeKey: params.scopeKey,
          input: currentInput,
          correlationId: params.correlationId,
          signal,
        }) as Promise<RosettaEnvelope<TOutput>>;
      },
    });
  }
}
