import { z } from 'zod';

// This classifier accepts normalized metadata. It does not inspect payloads or
// grant permission to execute a decision or commit state.
const text = z.string().trim().min(1).max(100);
export const routingRequest = z.object({
  ingress: z.enum(['Portal-OS1', 'MAX-INTERNET', 'MAX TELECOMMUNICATIONS']),
  intent_type: text,
  requires_compute: z.boolean().optional(),
  ambiguous: z.boolean().optional(),
  payload_type: text.optional(),
  multi_module_coordination: z.boolean().optional(),
  target_module: text.optional(),
  contains: z.array(z.enum(['equations', 'physics_parameters', 'financial_valuations', 'simulation_steps'])).max(4).optional(),
}).strict();

type RoutingRequest = z.infer<typeof routingRequest>;
const instantIntents = ['navigate', 'toggle_panel', 'camera_move', 'status_check', 'quick_lookup'];
const tensorIntents = ['embed', 'classify_signal', 'detect_anomaly', 'forecast_series', 'annotate_scene'];
const tensorPayloads = ['tensor', 'telemetry_stream', 'spatial_frame', 'market_tick'];
const reasoningIntents = ['synthesize', 'plan_workflow', 'translate_schema', 'explain', 'draft_spec'];
const solverIntents = ['solve_math', 'integrate_dynamics', 'enforce_physics', 'optimize_qubo', 'simulate_quantum', 'step_twin'];
const solverModules = ['MAX-MATH', 'MAX-CALCULUS', 'MAX PHYSICS', 'MAX-BRUTEFORCE', 'MAX QUANTUM', 'BLUE QUANTUM SOFTWARE STACK', 'QUANTUM ERROR AND NOISE SUITE', 'MAX SIM'];

const common = { policy_version: '1.1.0', orchestrator: 'BEEMAX', normalizer: 'MAX-ROSETTA', execution: 'not_dispatched' } as const;
function reasoningDecision(input: RoutingRequest, escalated: boolean) {
  return {
    ...common, status: 'matched', rule_id: 'R3_DEEP_REASONING_AND_SYNTHESIS', route_to: 'max_llm',
    commit_authority: 'proposed_plans_and_schemas', downstream_consumers: ['MAX-ROSETTA', 'MAX INSTITUTE', 'SIMUNIVERSITY', 'MAX-SOVEREIGN ECONOMIC ECOSYSTEM'],
    escalated_from: escalated ? 'R1_INSTANT_UI_AND_VIEWPORT' : null,
    verification: input.contains === undefined ? 'unknown' : input.contains.length ? 'required' : 'not_indicated',
    verification_signals: [...(input.contains ?? [])],
    verification_target: 'deterministic_and_quantum_solvers',
  } as const;
}

export function classifyRoutingRequest(input: RoutingRequest) {
  if (instantIntents.includes(input.intent_type)) {
    if (input.ambiguous || input.requires_compute === undefined) return reasoningDecision(input, true);
    if (input.requires_compute === false) return { ...common, status: 'matched', rule_id: 'R1_INSTANT_UI_AND_VIEWPORT', route_to: 'beemax_fast_router', commit_authority: 'ui_and_viewport_only' } as const;
  }
  if (tensorIntents.includes(input.intent_type) && input.payload_type && tensorPayloads.includes(input.payload_type)) {
    return { ...common, status: 'matched', rule_id: 'R2_TENSOR_PATTERN_AND_PERCEPTION', route_to: 'max_deep_neural_network', commit_authority: 'advisory_priors_and_overlays', downstream_consumers: ['HIEL — HIDDEN INFORMATION EXTRACTION SUITE', 'MAX-RENDER', 'MAX-MARKETS', 'MAX-BRUTEFORCE'] } as const;
  }
  if (reasoningIntents.includes(input.intent_type) && input.multi_module_coordination === true) return reasoningDecision(input, false);
  if (solverIntents.includes(input.intent_type) && input.target_module && solverModules.includes(input.target_module)) {
    return { ...common, status: 'matched', rule_id: 'R4_EXACT_COMPUTE_AND_STATE_COMMIT', route_to: 'deterministic_and_quantum_solvers', commit_authority: 'verified_twin_and_ledger_state', publish_to: ['INSTANT DIGITAL MAX SPACE / MAX UNIVERSE', 'MAX-RENDER', 'MAXSPACE'] } as const;
  }
  return { ...common, status: 'unmatched' } as const;
}
