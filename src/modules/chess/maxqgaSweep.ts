/** User-supplied sweep summary. Underlying search logs have not been verified. */
export const MAXQGA_REPORTED_SWEEP = Object.freeze({
  sweepId: 'D50_SWEEP_V1',
  registryId: 'MAXQGA_FENREGISTRY_V1_20261016',
  searchDepth: 50,
  averageStabilityScore: 79.1,
  refutationRatePercent: 2.8,
  tierVerdict: 'TIER_B_STRONG_CANDIDATE',
  nodes: Object.freeze([
    Object.freeze({ nodeId: 'MX-EV-001', stability: 81.4, verdict: 'SURVIVES_DYNAMIC' }),
    Object.freeze({ nodeId: 'MX-EV-002', stability: 79.8, verdict: 'SURVIVES_DYNAMIC' }),
    Object.freeze({ nodeId: 'MX-EV-003', stability: 78.6, verdict: 'SURVIVES_DYNAMIC' }),
    Object.freeze({ nodeId: 'MX-EV-004', stability: 77.2, verdict: 'SURVIVES_SPECULATIVE' }),
    Object.freeze({ nodeId: 'MX-EV-005', stability: 78.5, verdict: 'SURVIVES_DYNAMIC' }),
  ]),
} as const);
