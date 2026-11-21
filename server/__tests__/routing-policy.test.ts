import { describe, expect, it } from 'vitest';
import { classifyRoutingRequest, routingRequest } from '../routing-policy';

const base = { ingress: 'Portal-OS1' as const };

describe('routing policy 1.1.0', () => {
  it.each(['navigate', 'toggle_panel', 'camera_move', 'status_check', 'quick_lookup'])('routes non-compute %s to the fast router', intent_type => {
    expect(classifyRoutingRequest({ ...base, intent_type, requires_compute: false })).toMatchObject({ rule_id: 'R1_INSTANT_UI_AND_VIEWPORT', route_to: 'beemax_fast_router', commit_authority: 'ui_and_viewport_only', execution: 'not_dispatched' });
  });
  it('escalates ambiguous instant intents and does not route known compute to R1', () => {
    expect(classifyRoutingRequest({ ...base, intent_type: 'navigate' })).toMatchObject({ rule_id: 'R3_DEEP_REASONING_AND_SYNTHESIS', escalated_from: 'R1_INSTANT_UI_AND_VIEWPORT', verification: 'unknown' });
    expect(classifyRoutingRequest({ ...base, intent_type: 'navigate', requires_compute: false, ambiguous: true })).toMatchObject({ route_to: 'max_llm' });
    expect(classifyRoutingRequest({ ...base, intent_type: 'navigate', requires_compute: true })).toMatchObject({ status: 'unmatched' });
  });
  it.each(['embed', 'classify_signal', 'detect_anomaly', 'forecast_series', 'annotate_scene'])('requires a supported payload for %s', intent_type => {
    for (const payload_type of ['tensor', 'telemetry_stream', 'spatial_frame', 'market_tick']) expect(classifyRoutingRequest({ ...base, intent_type, payload_type })).toMatchObject({ rule_id: 'R2_TENSOR_PATTERN_AND_PERCEPTION', route_to: 'max_deep_neural_network', commit_authority: 'advisory_priors_and_overlays' });
    expect(classifyRoutingRequest({ ...base, intent_type, payload_type: 'text' })).toMatchObject({ status: 'unmatched' });
  });
  it.each(['synthesize', 'plan_workflow', 'translate_schema', 'explain', 'draft_spec'])('requires coordination for %s', intent_type => {
    expect(classifyRoutingRequest({ ...base, intent_type })).toMatchObject({ status: 'unmatched' });
    expect(classifyRoutingRequest({ ...base, intent_type, multi_module_coordination: true, contains: [] })).toMatchObject({ rule_id: 'R3_DEEP_REASONING_AND_SYNTHESIS', verification: 'not_indicated', commit_authority: 'proposed_plans_and_schemas' });
  });
  it.each(['equations', 'physics_parameters', 'financial_valuations', 'simulation_steps'] as const)('requires solver verification for %s', item => {
    expect(classifyRoutingRequest({ ...base, intent_type: 'synthesize', multi_module_coordination: true, contains: [item] })).toMatchObject({ verification: 'required', verification_target: 'deterministic_and_quantum_solvers' });
  });
  it.each(['solve_math', 'integrate_dynamics', 'enforce_physics', 'optimize_qubo', 'simulate_quantum', 'step_twin'])('requires a supported module for %s', intent_type => {
    for (const target_module of ['MAX-MATH', 'MAX-CALCULUS', 'MAX PHYSICS', 'MAX-BRUTEFORCE', 'MAX QUANTUM', 'BLUE QUANTUM SOFTWARE STACK', 'QUANTUM ERROR AND NOISE SUITE', 'MAX SIM']) expect(classifyRoutingRequest({ ...base, intent_type, target_module })).toMatchObject({ rule_id: 'R4_EXACT_COMPUTE_AND_STATE_COMMIT', route_to: 'deterministic_and_quantum_solvers', execution: 'not_dispatched' });
    expect(classifyRoutingRequest({ ...base, intent_type, target_module: 'OTHER' })).toMatchObject({ status: 'unmatched' });
  });
  it('rejects unsupported ingress and unexpected metadata', () => {
    expect(routingRequest.safeParse({ ingress: 'unknown', intent_type: 'navigate', requires_compute: false }).success).toBe(false);
    expect(routingRequest.safeParse({ ...base, intent_type: 'navigate', verified: true }).success).toBe(false);
    expect(classifyRoutingRequest({ ...base, intent_type: 'unknown' })).toMatchObject({ status: 'unmatched' });
  });
});

