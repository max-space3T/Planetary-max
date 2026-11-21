import { describe, expect, it } from 'vitest';
import { MAXQGA_ANCHORS, MAXQGA_REGISTRY_ID } from '../maxqgaRegistry';
import { MAXQGA_REPORTED_SWEEP as sweep } from '../maxqgaSweep';

describe('reported MAX-QGA sweep', () => {
  it('preserves the supplied summary and node verdicts', () => {
    expect(sweep).toEqual({
      sweepId: 'D50_SWEEP_V1', registryId: 'MAXQGA_FENREGISTRY_V1_20261016', searchDepth: 50,
      averageStabilityScore: 79.1, refutationRatePercent: 2.8, tierVerdict: 'TIER_B_STRONG_CANDIDATE',
      nodes: [
        { nodeId: 'MX-EV-001', stability: 81.4, verdict: 'SURVIVES_DYNAMIC' },
        { nodeId: 'MX-EV-002', stability: 79.8, verdict: 'SURVIVES_DYNAMIC' },
        { nodeId: 'MX-EV-003', stability: 78.6, verdict: 'SURVIVES_DYNAMIC' },
        { nodeId: 'MX-EV-004', stability: 77.2, verdict: 'SURVIVES_SPECULATIVE' },
        { nodeId: 'MX-EV-005', stability: 78.5, verdict: 'SURVIVES_DYNAMIC' },
      ],
    });
    expect(sweep.registryId).toBe(MAXQGA_REGISTRY_ID);
    expect(sweep.nodes.every(node => MAXQGA_ANCHORS.some(anchor => anchor.id === node.nodeId))).toBe(true);
    expect(new Set(sweep.nodes.map(node => node.nodeId)).size).toBe(sweep.nodes.length);
    expect(Object.isFrozen(sweep) && Object.isFrozen(sweep.nodes) && sweep.nodes.every(Object.isFrozen)).toBe(true);
  });
});
