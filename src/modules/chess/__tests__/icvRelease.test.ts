import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MAXQGA_ANCHORS, MAXQGA_REGISTRY_EXPECTED_COUNT, MAXQGA_REGISTRY_ID } from '../maxqgaRegistry';
import { MAXQGA_REPORTED_SELF_PLAY as selfPlay } from '../maxqgaSelfPlay';
import { MAXQGA_REPORTED_SWEEP as sweep } from '../maxqgaSweep';
import { MaxChessEngine } from '../maxChessEngine';

const read = (path: string) => readFileSync(path, 'utf8');
describe('ICV release records', () => {
  it('binds the release settings and provided FENs to the frozen reference', () => {
    const config = JSON.parse(read('config/icv_release.json'));
    const positions = read('registry/positions_mx_ev.fen');
    const engine = new MaxChessEngine();
    expect(config).toMatchObject({ release_version: `v${engine.version}`, THEORY_STATUS: 'FROZEN', registry_id: MAXQGA_REGISTRY_ID, expected_anchor_count: MAXQGA_REGISTRY_EXPECTED_COUNT, supplied_anchor_count: MAXQGA_ANCHORS.length });
    expect(engine.theoryFrozen).toBe(true);
    expect(config.frozen_anchors_sha256).toBe(createHash('sha256').update(positions).digest('hex'));
    expect(positions.trimEnd().split('\n')).toEqual(MAXQGA_ANCHORS.map(anchor => `${anchor.id} | ${anchor.fen}`));
  });
  it('keeps the reported sweep summary aligned with the display and numeric thresholds', () => {
    const report = JSON.parse(read('validation/d50_sweep_results.json'));
    expect(report).toMatchObject({ sweep_id: sweep.sweepId, registry_id: sweep.registryId, search_depth: sweep.searchDepth, average_stability_score: sweep.averageStabilityScore, refutation_rate_percent: sweep.refutationRatePercent, tier_verdict: sweep.tierVerdict });
    expect(report.nodes).toEqual(sweep.nodes.map(node => ({ node_id: node.nodeId, stability: node.stability, verdict: node.verdict })));
    expect(report.average_stability_score).toBeGreaterThanOrEqual(75);
    expect(report.refutation_rate_percent).toBeLessThanOrEqual(5);
  });
  it('reconciles the reported self-play summary with the displayed data', () => {
    const report = JSON.parse(read('validation/sp500_aggregate_audit.json'));
    expect(report).toEqual(selfPlay);
    expect(report.baseline_games + report.batch_games).toBe(report.total_games);
    expect(report.results.wins + report.results.draws + report.results.losses).toBe(report.total_games);
    expect(report.results.combined_non_loss_percent).toBeCloseTo((report.results.wins + report.results.draws) / report.total_games * 100);
  });
});
