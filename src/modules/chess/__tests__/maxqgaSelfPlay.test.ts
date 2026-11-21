import { describe, expect, it } from 'vitest';
import { MAXQGA_REPORTED_SELF_PLAY as batch } from '../maxqgaSelfPlay';

describe('reported self-play batch', () => {
  it('retains the supplied totals and internally consistent aggregate rates', () => {
    expect(batch).toMatchObject({ batch_id: 'SP500_BATCH_002', total_games: 500, baseline_games: 100, batch_games: 400, results: { wins: 204, draws: 187, losses: 109, win_rate_percent: 40.8, draw_rate_percent: 37.4, loss_rate_percent: 21.8, combined_non_loss_percent: 78.2 } });
    const { wins, draws, losses, win_rate_percent, draw_rate_percent, loss_rate_percent, combined_non_loss_percent } = batch.results;
    expect(batch.baseline_games + batch.batch_games).toBe(batch.total_games);
    expect(wins + draws + losses).toBe(batch.total_games);
    expect(wins / batch.total_games * 100).toBeCloseTo(win_rate_percent);
    expect(draws / batch.total_games * 100).toBeCloseTo(draw_rate_percent);
    expect(losses / batch.total_games * 100).toBeCloseTo(loss_rate_percent);
    expect((wins + draws) / batch.total_games * 100).toBeCloseTo(combined_non_loss_percent);
  });
  it('preserves each reported behavioral observation', () => {
    expect(batch.behavioral_tiers).toEqual({
      '1600_1900': { collapse_vector: 'EARLY_TACTICAL_BLUNDER', effectiveness: 'CRITICAL', win_draw_rate_percent: 92 },
      '1900_2200': { collapse_vector: 'CLOCK_EXHAUSTION_LT_2MIN', effectiveness: 'HIGH', distortion_rate_percent: 84 },
      '2200_2400_plus': { collapse_vector: 'POSITIONAL_OVER_EXTENSION', effectiveness: 'STRONG', state: 'DYNAMIC_BALANCE' },
      super_gm_engine: { collapse_vector: 'PRECISE_DEFENSIVE_RESOURCE', effectiveness: 'STABLE', equivalence: 'TIER_B' },
    });
    expect(Object.isFrozen(batch) && Object.isFrozen(batch.results) && Object.isFrozen(batch.behavioral_tiers) && Object.values(batch.behavioral_tiers).every(Object.isFrozen)).toBe(true);
  });
});
