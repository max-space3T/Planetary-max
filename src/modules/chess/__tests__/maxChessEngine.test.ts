import { describe, expect, it } from 'vitest';
import { MaxChessEngine } from '../maxChessEngine';

const fen = 'r2qkb1r/1b4pp/p3pn2/3p1pp1/1pPP4/2N2N2/PP2PPPP/R2QKB1R w KQkq - 0 13';
describe('MAX-QGA practical edge estimator', () => {
  const engine = new MaxChessEngine();
  it('matches the supplied example while retaining the input position and score', () => {
    expect(engine.evaluatePosition(fen, 'MX-EV-003', 25, { maxDepth: 50, clockRemainingSec: 95 })).toEqual({ fen, nodeId: 'MX-EV-003', centipawnEval: 25, distortion: { nodeId: 'MX-EV-003', distortionIndex: 4.4, decisionLoadIndex: 4.36, branchingFactor: 6, primaryVector: 'TEMPORAL' }, practicalEdgeScore: 0.6 });
  });
  it('uses candidate count, default clock, and capped depth proxy', () => {
    const result = engine.evaluatePosition(fen, 'node', -50, { maxDepth: 100, candidateMoves: ['a', 'b', 'c'] });
    expect(result).toMatchObject({ centipawnEval: -50, distortion: { distortionIndex: 4.4, decisionLoadIndex: 1.52, branchingFactor: 3, primaryVector: 'TACTICAL' }, practicalEdgeScore: -0.38 });
    expect(engine.evaluatePosition(fen, 'node', 0, { maxDepth: 1, candidateMoves: [] }).distortion).toMatchObject({ distortionIndex: 0.88, branchingFactor: 1, primaryVector: 'MINIMAL' });
  });
});
