import { describe, expect, it } from 'vitest';
import { FROZEN_DISTORTION_WEIGHTS, scoreDistortionState } from '../distortionMetrics';

describe('supplied MAX-QGA distortion formula', () => {
  it('retains the specified frozen weights and gives a minimum branching factor', () => {
    expect(Object.isFrozen(FROZEN_DISTORTION_WEIGHTS)).toBe(true);
    expect(FROZEN_DISTORTION_WEIGHTS).toEqual({ gFileThrust: 1.35, f5WedgeClamp: 1.4, b4SpaceClamp: 1.25, speculativeBreak: 1.3 });
    expect(scoreDistortionState('terminal', 0, 1, 120)).toEqual({ nodeId: 'terminal', distortionIndex: 0.88, decisionLoadIndex: 0.1, branchingFactor: 1, primaryVector: 'MINIMAL' });
  });
  it('uses the rounded score at vector boundaries', () => {
    expect(scoreDistortionState('a', 10, 1.6, 120)).toMatchObject({ distortionIndex: 1.41, primaryVector: 'STRATEGIC' });
    expect(scoreDistortionState('a', 10, 2.5, 120)).toMatchObject({ distortionIndex: 2.2, primaryVector: 'TACTICAL' });
    expect(scoreDistortionState('a', 10, 2.73, 119)).toMatchObject({ distortionIndex: 2.4, primaryVector: 'TEMPORAL' });
  });
  it('classifies the supplied thresholds and computes the time factor at 120 seconds', () => {
    expect(scoreDistortionState('a', 20, 2, 120)).toMatchObject({ distortionIndex: 1.76, decisionLoadIndex: 4.05, primaryVector: 'STRATEGIC' });
    expect(scoreDistortionState('a', 20, 3, 120)).toMatchObject({ distortionIndex: 2.64, decisionLoadIndex: 6.07, primaryVector: 'TACTICAL' });
    expect(scoreDistortionState('a', 20, 3, 119)).toMatchObject({ distortionIndex: 2.64, decisionLoadIndex: 8.71, primaryVector: 'TEMPORAL' });
    expect(scoreDistortionState('a', 20, 0, 119)).toMatchObject({ distortionIndex: 0, decisionLoadIndex: 0, primaryVector: 'MINIMAL' });
  });
});
