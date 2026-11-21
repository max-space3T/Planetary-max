import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyRoutingRequest } from '../routing-policy';
import { createRosettaEnvelope, promoteEnvelopeToVerified, toExecutionDecision, VerifiedSnapshotFallbackHandler, type SnapshotStore, type SolverVerifier } from '../beemax-rosetta-fallback';

const decision = () => toExecutionDecision(classifyRoutingRequest({ ingress: 'Portal-OS1', intent_type: 'synthesize', multi_module_coordination: true, contains: ['equations'] }))!;
const envelope = () => createRosettaEnvelope({ packetId: 'p1', ingress: 'Portal-OS1', sourceLayer: 'max_llm', targetLayer: 'Portal-OS1', scopeKey: 'universe:earth', payload: { value: 1 } });
function setup(verified = true) {
  const entries = new Map<string, any>();
  const store: SnapshotStore = { getVerified: vi.fn(async key => entries.get(key) ?? null), setVerified: vi.fn(async entry => { entries.set(entry.scopeKey, entry); }) };
  const verifier: SolverVerifier = { verify: vi.fn(async () => verified) };
  return { entries, store, verifier, handler: new VerifiedSnapshotFallbackHandler(store, verifier) };
}
afterEach(() => vi.useRealTimers());

describe('ROSETTA fallback', () => {
  it('bridges matched classifier decisions and conservatively handles unknown verification', () => {
    expect(decision()).toMatchObject({ ruleId: 'R3_DEEP_REASONING_AND_SYNTHESIS', priority: 3, verification: { required: true, status: 'required', detectedSignals: ['equations'] } });
    const unknown = classifyRoutingRequest({ ingress: 'Portal-OS1', intent_type: 'navigate' });
    expect(toExecutionDecision(unknown)).toMatchObject({ verification: { required: true, status: 'unknown' } });
    expect(toExecutionDecision(classifyRoutingRequest({ ingress: 'Portal-OS1', intent_type: 'other' }))).toBeNull();
  });
  it('rejects self-certification and only records after the trusted verifier checks the payload', async () => {
    expect(() => createRosettaEnvelope({ ...envelope(), statusTag: 'verified' })).toThrow();
    const rejected = setup(false);
    await expect(rejected.handler.verifyAndRecord(envelope(), { value: 2 }, 'p2')).rejects.toThrow('Solver verification failed');
    expect(rejected.store.setVerified).not.toHaveBeenCalled();
    const accepted = setup();
    const verified = await accepted.handler.verifyAndRecord(envelope(), { value: 2 }, 'p2');
    expect(accepted.verifier.verify).toHaveBeenCalledWith(expect.objectContaining({ statusTag: 'proposed' }), { value: 2 });
    expect(verified).toMatchObject({ sourceLayer: 'deterministic_and_quantum_solvers', statusTag: 'verified', verifiedBySolver: true, payload: { value: 2 } });
    expect(accepted.entries.get('universe:earth').envelope).toEqual(verified);
    await expect(promoteEnvelopeToVerified(verified, { value: 2 }, 'p3', accepted.verifier)).rejects.toThrow();
  });
  it('supports different verified payloads and records authoritative promotion provenance', async () => {
    const { handler, verifier } = setup();
    const source = createRosettaEnvelope({ ...envelope(), metadata: { detail: { unit: 'meters' }, promotedFromPacketId: 'forged', promotedFromLayer: 'beemax_fast_router' } });
    const verified = await handler.verifyAndRecord(source, { solution: 'two meters' });
    expect(verified).toMatchObject({ packetId: 'p1_verified', payload: { solution: 'two meters' }, metadata: { detail: { unit: 'meters' }, promotedFromPacketId: 'p1', promotedFromLayer: 'max_llm' } });
    expect(verifier.verify).toHaveBeenCalledWith(expect.objectContaining({ payload: { value: 1 } }), { solution: 'two meters' });
    expect(source.metadata).toMatchObject({ promotedFromPacketId: 'forged' });
  });
  it('preserves solver-supplied provenance during independent verification', async () => {
    const { handler } = setup();
    const solverResult = { ...envelope(), sourceLayer: 'deterministic_and_quantum_solvers' as const, statusTag: 'verified' as const, verifiedBySolver: true, metadata: { promotedFromPacketId: 'original', promotedFromLayer: 'max_llm' } };
    expect(await handler.recordVerified(solverResult)).toMatchObject({ metadata: { promotedFromPacketId: 'original', promotedFromLayer: 'max_llm' } });
  });
  it('returns a proposed live response and rejects forged or cross-scope outputs', async () => {
    const { handler } = setup();
    const run = (result: any) => handler.executeWithFallback({ decision: decision(), scopeKey: 'universe:earth', input: {}, timeoutMs: 50, dispatch: async () => result });
    expect(await run(envelope())).toMatchObject({ servedFromFallback: false, activeLayer: 'max_llm', envelope: { statusTag: 'proposed' } });
    expect(await run({ ...envelope(), statusTag: 'verified', verifiedBySolver: true })).toMatchObject({ servedFromFallback: true, fallbackReason: 'execution_error', envelope: null });
    expect(await run({ ...envelope(), scopeKey: 'other' })).toMatchObject({ servedFromFallback: true, fallbackReason: 'execution_error', envelope: null });
  });
  it('checks and stores a live solver result before serving it as verified', async () => {
    const { handler, store, verifier } = setup();
    const solverDecision = toExecutionDecision(classifyRoutingRequest({ ingress: 'Portal-OS1', intent_type: 'solve_math', target_module: 'MAX-MATH' }))!;
    const raw = { ...envelope(), packetId: 'solver-packet', sourceLayer: 'deterministic_and_quantum_solvers' as const, statusTag: 'verified' as const, verifiedBySolver: true, payload: { value: 42 } };
    const response = await handler.executeWithFallback({ decision: solverDecision, scopeKey: 'universe:earth', input: {}, timeoutMs: 50, dispatch: async () => raw });
    expect(response).toMatchObject({ servedFromFallback: false, envelope: { statusTag: 'verified', verifiedBySolver: true, payload: { value: 42 } } });
    expect(verifier.verify).toHaveBeenCalledWith(expect.objectContaining({ sourceLayer: 'deterministic_and_quantum_solvers', statusTag: 'proposed' }), { value: 42 }, expect.any(AbortSignal));
    expect(store.setVerified).toHaveBeenCalledTimes(1);
    const fallback = await handler.executeWithFallback({ decision: solverDecision, scopeKey: 'universe:earth', input: {}, timeoutMs: 50, dispatch: async () => null });
    expect(fallback).toMatchObject({ servedFromFallback: true, envelope: { packetId: 'solver-packet', payload: { value: 42 } } });
  });
  it('fails closed when a solver result fails independent verification or storage', async () => {
    const solverDecision = toExecutionDecision(classifyRoutingRequest({ ingress: 'Portal-OS1', intent_type: 'solve_math', target_module: 'MAX-MATH' }))!;
    const raw = { ...envelope(), sourceLayer: 'deterministic_and_quantum_solvers' as const, statusTag: 'verified' as const, verifiedBySolver: true };
    const rejected = setup(false);
    const run = (handler: VerifiedSnapshotFallbackHandler) => handler.executeWithFallback({ decision: solverDecision, scopeKey: 'universe:earth', input: {}, timeoutMs: 50, dispatch: async () => raw });
    expect(await run(rejected.handler)).toMatchObject({ fallbackReason: 'execution_error', envelope: null });
    expect(rejected.store.setVerified).not.toHaveBeenCalled();
    const unavailable = setup();
    vi.mocked(unavailable.store.setVerified).mockRejectedValue(Error('offline'));
    expect(await run(unavailable.handler)).toMatchObject({ fallbackReason: 'execution_error', envelope: null });
    await expect(unavailable.handler.recordVerified({ ...raw, sourceLayer: 'max_llm' })).rejects.toThrow('solver result');
  });
  it('times out verification without storing a result that completes late', async () => {
    vi.useFakeTimers();
    const { handler, verifier, store } = setup();
    let finish: (valid: boolean) => void = () => {};
    vi.mocked(verifier.verify).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const solverDecision = toExecutionDecision(classifyRoutingRequest({ ingress: 'Portal-OS1', intent_type: 'solve_math', target_module: 'MAX-MATH' }))!;
    const raw = { ...envelope(), sourceLayer: 'deterministic_and_quantum_solvers' as const, statusTag: 'verified' as const, verifiedBySolver: true };
    const response = handler.executeWithFallback({ decision: solverDecision, scopeKey: 'universe:earth', input: {}, timeoutMs: 10, dispatch: async () => raw });
    await vi.advanceTimersByTimeAsync(10);
    expect(await response).toMatchObject({ fallbackReason: 'timeout', envelope: null });
    finish(true);
    await vi.runAllTimersAsync();
    expect(store.setVerified).not.toHaveBeenCalled();
  });
  it('falls back when snapshot recording stalls after successful verification', async () => {
    vi.useFakeTimers();
    const { handler, store } = setup();
    await handler.verifyAndRecord(envelope(), { value: 1 }, 'previous');
    vi.mocked(store.setVerified).mockImplementation(() => new Promise(() => {}));
    const solverDecision = toExecutionDecision(classifyRoutingRequest({ ingress: 'Portal-OS1', intent_type: 'solve_math', target_module: 'MAX-MATH' }))!;
    const raw = { ...envelope(), sourceLayer: 'deterministic_and_quantum_solvers' as const, statusTag: 'verified' as const, verifiedBySolver: true, payload: { value: 42 } };
    const response = handler.executeWithFallback({ decision: solverDecision, scopeKey: 'universe:earth', input: {}, timeoutMs: 10, dispatch: async () => raw });
    await vi.advanceTimersByTimeAsync(10);
    expect(await response).toMatchObject({ fallbackReason: 'timeout', envelope: { packetId: 'previous', payload: { value: 1 } } });
  });
  it('serves only the matching verified snapshot on an unwired service or error', async () => {
    const { handler, entries, store } = setup();
    await handler.verifyAndRecord(envelope(), { value: 2 }, 'p2');
    const run = (dispatch: () => Promise<any>, scopeKey = 'universe:earth') => handler.executeWithFallback({ decision: decision(), scopeKey, input: {}, timeoutMs: 50, dispatch });
    expect(await run(async () => null)).toMatchObject({ servedFromFallback: true, fallbackReason: 'unwired_service', activeLayer: 'beemax_fast_router', envelope: { payload: { value: 2 } } });
    expect(await run(async () => { throw Error('timed out in provider'); })).toMatchObject({ fallbackReason: 'execution_error' });
    expect(await run(async () => null, 'other')).toMatchObject({ envelope: null });
    entries.get('universe:earth').envelope.sourceLayer = 'max_llm';
    expect(await run(async () => null)).toMatchObject({ envelope: null });
    const noSnapshot = decision(); noSnapshot.timeoutBehavior.serveLastVerifiedSnapshot = false;
    vi.mocked(store.getVerified).mockClear();
    expect(await handler.executeWithFallback({ decision: noSnapshot, scopeKey: 'universe:earth', input: {}, timeoutMs: 50, dispatch: async () => null })).toMatchObject({ envelope: null });
    expect(store.getVerified).not.toHaveBeenCalled();
  });
  it('aborts a timed out dispatch and bounds an unavailable snapshot store', async () => {
    vi.useFakeTimers();
    const { handler, store } = setup();
    vi.mocked(store.getVerified).mockImplementation(() => new Promise(() => {}));
    let signal: AbortSignal | undefined;
    const result = handler.executeWithFallback({ decision: decision(), scopeKey: 'universe:earth', input: {}, timeoutMs: 10, dispatch: async (_d, _i, s) => { signal = s; return new Promise(() => {}); } });
    await vi.advanceTimersByTimeAsync(10);
    expect(signal?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(10);
    expect(await result).toMatchObject({ fallbackReason: 'timeout', shellResponsive: true, envelope: null });
  });
  it('returns an empty fallback when the store fails and rejects invalid timeouts', async () => {
    const { handler, store } = setup();
    vi.mocked(store.getVerified).mockRejectedValue(Error('offline'));
    expect(await handler.executeWithFallback({ decision: decision(), scopeKey: 'universe:earth', input: {}, timeoutMs: 10, dispatch: async () => null })).toMatchObject({ fallbackReason: 'unwired_service', envelope: null });
    await expect(handler.executeWithFallback({ decision: decision(), scopeKey: 'universe:earth', input: {}, timeoutMs: 0, dispatch: async () => null })).rejects.toThrow();
  });
});
