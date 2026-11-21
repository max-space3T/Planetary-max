import { scoreDistortionState, type DistortionMetrics } from './distortionMetrics';

export interface EngineEvaluation {
  fen: string;
  nodeId: string;
  centipawnEval: number;
  distortion: DistortionMetrics;
  practicalEdgeScore: number;
}

export interface SearchOptions {
  maxDepth: number;
  clockRemainingSec?: number;
  candidateMoves?: string[];
}

/** Evaluates supplied inputs; this class does not run a search or verify a FEN. */
export class MaxChessEngine {
  public readonly name = 'MAX-QGA * MAX Chess Engine';
  public readonly version = '1.1.0-tier-b-release';
  public readonly theoryFrozen = true;

  public evaluatePosition(fen: string, nodeId: string, baseCentipawns: number, options: SearchOptions): EngineEvaluation {
    // The fallback list is part of the supplied formula, not a legal move generator.
    const moves = options.candidateMoves ?? ['e4', 'd4', 'Nf3', 'c4', 'h3', 'Bb5'];
    const clock = options.clockRemainingSec ?? 180;
    const distortion = scoreDistortionState(nodeId, moves.length, Math.min(5, Math.max(1, Math.floor(options.maxDepth / 10))), clock);
    const practicalEdgeScore = Number((baseCentipawns / 100 + distortion.decisionLoadIndex * 0.08).toFixed(2));
    return { fen, nodeId, centipawnEval: baseCentipawns, distortion, practicalEdgeScore };
  }
}
