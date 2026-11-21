export interface DistortionMetrics {
  nodeId: string;
  distortionIndex: number;
  decisionLoadIndex: number;
  branchingFactor: number;
  primaryVector: 'TACTICAL' | 'TEMPORAL' | 'STRATEGIC' | 'MINIMAL';
}

export const FROZEN_DISTORTION_WEIGHTS = Object.freeze({
  gFileThrust: 1.35,
  f5WedgeClamp: 1.4,
  b4SpaceClamp: 1.25,
  speculativeBreak: 1.3,
} as const);

export function scoreDistortionState(nodeId: string, legalMovesCount: number, asymmetricTensionCount: number, clockRemainingSec: number): DistortionMetrics {
  const safeMoves = Math.max(1, legalMovesCount);
  const distortionIndex = Number((asymmetricTensionCount * (FROZEN_DISTORTION_WEIGHTS.gFileThrust + FROZEN_DISTORTION_WEIGHTS.f5WedgeClamp) * 0.32).toFixed(2));
  const timeFactor = clockRemainingSec < 120 ? 1.65 : 1.15;
  const decisionLoadIndex = Number((((safeMoves * distortionIndex) / 10) * timeFactor).toFixed(2));
  let primaryVector: DistortionMetrics['primaryVector'] = 'MINIMAL';
  if (distortionIndex >= 2.4 && clockRemainingSec < 120) primaryVector = 'TEMPORAL';
  else if (distortionIndex >= 2.2) primaryVector = 'TACTICAL';
  else if (distortionIndex >= 1.4) primaryVector = 'STRATEGIC';
  return { nodeId, distortionIndex, decisionLoadIndex, branchingFactor: safeMoves, primaryVector };
}
