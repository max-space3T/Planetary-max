import type { classifyRoutingRequest } from './routing-policy';

export type PolicyVersion = '1.1.0';
export type IngressSource = 'Portal-OS1' | 'MAX-INTERNET' | 'MAX TELECOMMUNICATIONS';
export type RoutingRuleId = 'R1_INSTANT_UI_AND_VIEWPORT' | 'R2_TENSOR_PATTERN_AND_PERCEPTION' | 'R3_DEEP_REASONING_AND_SYNTHESIS' | 'R4_EXACT_COMPUTE_AND_STATE_COMMIT';
export type IntelligenceLayerId = 'beemax_fast_router' | 'max_deep_neural_network' | 'max_llm' | 'deterministic_and_quantum_solvers';
export type StateStatusTag = 'proposed' | 'verified';
export type VerificationSignal = 'equations' | 'physics_parameters' | 'financial_valuations' | 'simulation_steps';
export interface VerificationRequirement {
  required: boolean;
  status: 'not_required' | 'required' | 'unknown';
  detectedSignals: VerificationSignal[];
  forwardTo: IntelligenceLayerId | null;
  reason?: string;
}
export interface TimeoutBehaviorConfig {
  keepShellResponsive: boolean;
  fallbackLayer: 'beemax_fast_router';
  serveLastVerifiedSnapshot: boolean;
}
export interface ClassificationDecision {
  policyVersion: PolicyVersion;
  orchestrator: 'BEEMAX';
  normalizer: 'MAX-ROSETTA';
  ruleId: RoutingRuleId;
  priority: 1 | 2 | 3 | 4;
  routeTo: IntelligenceLayerId;
  commitAuthority: 'ui_and_viewport_only' | 'advisory_priors_and_overlays' | 'proposed_plans_and_schemas' | 'verified_twin_and_ledger_state';
  onAmbiguity?: 'escalate_to_R3';
  downstreamConsumers?: string[];
  publishTo?: string[];
  verification: VerificationRequirement;
  timeoutBehavior: TimeoutBehaviorConfig;
  classifiedAt: string;
}
export interface RosettaEnvelope<TPayload = unknown> {
  envelopeVersion: '1.0.0';
  packetId: string;
  policyVersion: PolicyVersion;
  ingress: IngressSource;
  sourceLayer: IntelligenceLayerId;
  targetLayer: IntelligenceLayerId | 'MAXSPACE' | 'Portal-OS1';
  scopeKey: string;
  statusTag: StateStatusTag;
  verifiedBySolver: boolean;
  timestamp: string;
  correlationId?: string;
  payload: TPayload;
  metadata?: Record<string, unknown>;
}
type VerifiedEnvelope<T> = RosettaEnvelope<T> & { statusTag: 'verified'; verifiedBySolver: true; sourceLayer: 'deterministic_and_quantum_solvers' };
export interface VerifiedSnapshotEntry<TPayload = unknown> {
  scopeKey: string;
  envelope: VerifiedEnvelope<TPayload>;
  recordedAt: string;
}
// Both adapters are trusted server-side dependencies, never supplied by a request.
export interface SnapshotStore {
  // Writes must atomically retain the most recently recorded entry per scope.
  getVerified<T>(scopeKey: string): Promise<VerifiedSnapshotEntry<T> | null>;
  setVerified<T>(entry: VerifiedSnapshotEntry<T>): Promise<void>;
}
export interface SolverVerifier {
  verify<TInput, TVerified>(envelope: RosettaEnvelope<TInput>, verifiedPayload: TVerified, signal?: AbortSignal): Promise<boolean>;
}
export interface FallbackExecutionResult<TPayload = unknown> {
  servedFromFallback: boolean;
  fallbackReason?: 'unwired_service' | 'timeout' | 'execution_error';
  activeLayer: IntelligenceLayerId;
  shellResponsive: boolean;
  decision: ClassificationDecision;
  envelope: RosettaEnvelope<TPayload> | null;
}
export const DEFAULT_TIMEOUT_BEHAVIOR: Readonly<TimeoutBehaviorConfig> = Object.freeze({ keepShellResponsive: true, fallbackLayer: 'beemax_fast_router', serveLastVerifiedSnapshot: true });

// Converts only matched classifier results; unmatched inputs cannot execute.
export function toExecutionDecision(result: ReturnType<typeof classifyRoutingRequest>): ClassificationDecision | null {
  if (result.status !== 'matched') return null;
  const priorities = { R1_INSTANT_UI_AND_VIEWPORT: 1, R2_TENSOR_PATTERN_AND_PERCEPTION: 2, R3_DEEP_REASONING_AND_SYNTHESIS: 3, R4_EXACT_COMPUTE_AND_STATE_COMMIT: 4 } as const;
  const reasoning = result.rule_id === 'R3_DEEP_REASONING_AND_SYNTHESIS';
  const status = reasoning ? (result.verification === 'not_indicated' ? 'not_required' : result.verification) : 'not_required';
  return {
    policyVersion: '1.1.0', orchestrator: 'BEEMAX', normalizer: 'MAX-ROSETTA', ruleId: result.rule_id,
    priority: priorities[result.rule_id], routeTo: result.route_to, commitAuthority: result.commit_authority,
    ...(result.rule_id === 'R1_INSTANT_UI_AND_VIEWPORT' ? { onAmbiguity: 'escalate_to_R3' as const } : {}),
    ...('downstream_consumers' in result ? { downstreamConsumers: [...result.downstream_consumers] } : {}),
    ...('publish_to' in result ? { publishTo: [...result.publish_to] } : {}),
    verification: { required: status !== 'not_required', status, detectedSignals: reasoning ? [...result.verification_signals] : [], forwardTo: reasoning && status !== 'not_required' ? 'deterministic_and_quantum_solvers' : null, ...(reasoning ? { reason: 'Verification signals are caller declarations; output has not been inspected.' } : {}) },
    timeoutBehavior: { ...DEFAULT_TIMEOUT_BEHAVIOR }, classifiedAt: new Date().toISOString(),
  };
}

export function createRosettaEnvelope<TPayload>(params: {
  packetId: string; ingress: IngressSource; sourceLayer: IntelligenceLayerId;
  targetLayer: IntelligenceLayerId | 'MAXSPACE' | 'Portal-OS1'; scopeKey: string; payload: TPayload;
  statusTag?: StateStatusTag; correlationId?: string; metadata?: Record<string, unknown>;
}): RosettaEnvelope<TPayload> {
  if (params.statusTag === 'verified') throw new Error('Verification requires a trusted solver adapter.');
  if (!params.packetId.trim() || !params.scopeKey.trim()) throw new Error('Packet ID and scope key are required.');
  return { ...params, envelopeVersion: '1.0.0', policyVersion: '1.1.0', statusTag: 'proposed', verifiedBySolver: false, timestamp: new Date().toISOString() };
}

// The verifier must actually check this exact envelope and payload. No default is provided.
export async function promoteEnvelopeToVerified<TInput, TVerified>(envelope: RosettaEnvelope<TInput>, verifiedPayload: TVerified, packetId: string, verifier: SolverVerifier, signal?: AbortSignal): Promise<VerifiedEnvelope<TVerified>>;
export async function promoteEnvelopeToVerified<TInput, TVerified>(envelope: RosettaEnvelope<TInput>, verifiedPayload: TVerified, verifier: SolverVerifier, signal?: AbortSignal): Promise<VerifiedEnvelope<TVerified>>;
export async function promoteEnvelopeToVerified<TInput, TVerified>(envelope: RosettaEnvelope<TInput>, verifiedPayload: TVerified, packetIdOrVerifier: string | SolverVerifier, verifierOrSignal?: SolverVerifier | AbortSignal, maybeSignal?: AbortSignal): Promise<VerifiedEnvelope<TVerified>> {
  const packetId = typeof packetIdOrVerifier === 'string' ? packetIdOrVerifier : `${envelope.packetId}_verified`;
  const verifier = typeof packetIdOrVerifier === 'string' ? verifierOrSignal as SolverVerifier : packetIdOrVerifier;
  const signal = typeof packetIdOrVerifier === 'string' ? maybeSignal : verifierOrSignal as AbortSignal | undefined;
  if (!packetId.trim() || !envelope.packetId?.trim() || envelope.statusTag !== 'proposed' || envelope.verifiedBySolver) throw new Error('A proposed envelope and packet ID are required.');
  const candidate = structuredClone(envelope);
  const payload = structuredClone(verifiedPayload);
  await checkSolverVerification(candidate, payload, verifier, signal);
  return { ...candidate, packetId, sourceLayer: 'deterministic_and_quantum_solvers', statusTag: 'verified', verifiedBySolver: true, timestamp: new Date().toISOString(), payload, metadata: { ...candidate.metadata, promotedFromPacketId: candidate.packetId, promotedFromLayer: candidate.sourceLayer } };
}

async function checkSolverVerification<TInput, TVerified>(source: RosettaEnvelope<TInput>, payload: TVerified, verifier: SolverVerifier, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  const valid = signal ? await verifier.verify(structuredClone(source), structuredClone(payload), signal) : await verifier.verify(structuredClone(source), structuredClone(payload));
  signal?.throwIfAborted();
  if (!valid) throw new Error('Solver verification failed.');
}

const timeoutMarker = Symbol('timeout');
async function withTimeout<T>(operation: () => Promise<T>, timeoutMs: number, onTimeout?: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve().then(operation), new Promise<never>((_, reject) => { timer = setTimeout(() => { reject(timeoutMarker); onTimeout?.(); }, timeoutMs); })]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}

export class VerifiedSnapshotFallbackHandler {
  constructor(private readonly store: SnapshotStore, private readonly verifier: SolverVerifier) {}

  async verifyAndRecord<TInput, TVerified>(envelope: RosettaEnvelope<TInput>, verifiedPayload: TVerified, packetId?: string, signal?: AbortSignal): Promise<VerifiedEnvelope<TVerified>> {
    const verified = packetId === undefined
      ? await promoteEnvelopeToVerified(envelope, verifiedPayload, this.verifier, signal)
      : await promoteEnvelopeToVerified(envelope, verifiedPayload, packetId, this.verifier, signal);
    await this.saveVerified(verified, signal);
    return verified;
  }

  async recordVerified<T>(envelope: RosettaEnvelope<T>, signal?: AbortSignal): Promise<VerifiedEnvelope<T>> {
    const candidate = structuredClone(envelope);
    if (candidate.envelopeVersion !== '1.0.0' || candidate.policyVersion !== '1.1.0' || !candidate.packetId?.trim() || !candidate.scopeKey?.trim() || candidate.sourceLayer !== 'deterministic_and_quantum_solvers' || candidate.statusTag !== 'verified' || candidate.verifiedBySolver !== true) throw new Error('A solver result is required.');
    // The caller's flags are untrusted; a separate verifier must check the payload.
    await checkSolverVerification({ ...candidate, statusTag: 'proposed', verifiedBySolver: false }, candidate.payload, this.verifier, signal);
    const verified: VerifiedEnvelope<T> = { ...candidate, statusTag: 'verified', verifiedBySolver: true, sourceLayer: 'deterministic_and_quantum_solvers' };
    await this.saveVerified(verified, signal);
    return verified;
  }

  private async saveVerified<T>(verified: VerifiedEnvelope<T>, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    await this.store.setVerified({ scopeKey: verified.scopeKey, envelope: structuredClone(verified), recordedAt: new Date().toISOString() });
    signal?.throwIfAborted();
  }

  async executeWithFallback<TInput, TPayload>(params: {
    decision: ClassificationDecision; scopeKey: string; input: TInput; timeoutMs: number;
    dispatch: (decision: ClassificationDecision, input: TInput, signal: AbortSignal) => Promise<RosettaEnvelope<TPayload> | null>;
  }): Promise<FallbackExecutionResult<TPayload>> {
    const { decision, scopeKey, input, timeoutMs, dispatch } = params;
    if (!scopeKey.trim() || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw new Error('A scope key and timeout between 1 and 120000 ms are required.');
    const controller = new AbortController();
    let reason: 'unwired_service' | 'timeout' | 'execution_error';
    try {
      const live = await withTimeout(async () => {
        const result = await dispatch(decision, input, controller.signal);
        controller.signal.throwIfAborted();
        if (!result) return null;
        const candidate = structuredClone(result);
        if (candidate.envelopeVersion !== '1.0.0' || candidate.policyVersion !== '1.1.0' || !candidate.packetId?.trim() || candidate.scopeKey !== scopeKey || candidate.sourceLayer !== decision.routeTo) throw new Error('Invalid dispatch envelope.');
        if (candidate.statusTag === 'proposed' && candidate.verifiedBySolver === false) return candidate;
        if (candidate.statusTag === 'verified' && candidate.verifiedBySolver === true && decision.routeTo === 'deterministic_and_quantum_solvers') return this.recordVerified(candidate, controller.signal);
        throw new Error('Invalid dispatch envelope.');
      }, timeoutMs, () => controller.abort());
      if (live) return { servedFromFallback: false, activeLayer: decision.routeTo, shellResponsive: decision.timeoutBehavior.keepShellResponsive, decision, envelope: live };
      reason = 'unwired_service';
    } catch (error) { reason = error === timeoutMarker ? 'timeout' : 'execution_error'; }

    let cached: VerifiedSnapshotEntry<TPayload> | null = null;
    if (decision.timeoutBehavior.serveLastVerifiedSnapshot) {
      try {
        const entry = await withTimeout(() => this.store.getVerified<TPayload>(scopeKey), timeoutMs);
        if (entry && entry.scopeKey === scopeKey && entry.envelope.envelopeVersion === '1.0.0' && entry.envelope.policyVersion === '1.1.0' && entry.envelope.packetId?.trim() && entry.envelope.scopeKey === scopeKey && entry.envelope.statusTag === 'verified' && entry.envelope.verifiedBySolver === true && entry.envelope.sourceLayer === 'deterministic_and_quantum_solvers') cached = entry;
      } catch { /* Return an empty fallback if snapshot storage is unavailable. */ }
    }
    return { servedFromFallback: true, fallbackReason: reason, activeLayer: decision.timeoutBehavior.fallbackLayer, shellResponsive: decision.timeoutBehavior.keepShellResponsive, decision, envelope: cached ? structuredClone(cached.envelope) : null };
  }
}
