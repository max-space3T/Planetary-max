import { evaluateQuboObjective } from "./qubo-matrix-solver-extension";

export interface QuboSearchCandidate {
  x: number[];
  objectiveValue: number;
}

export interface QuboSearchResult {
  dimension: number;
  evaluatedCount: number;
  totalExhaustiveSpace: number;
  truncatedByBudget: boolean;
  bestCandidate: QuboSearchCandidate | null;
  topCandidates: QuboSearchCandidate[];
}

export interface QuboSearchConfig {
  numVariables: number;
  qMatrix: number[][];
  maxCandidates?: number;
  seed?: number;
}

export interface QuboCandidateScore {
  bitstring: number[];
  energy: number;
}

export interface SeededQuboSearchResult {
  evaluatedCount: number;
  best: QuboCandidateScore;
  topCandidates: QuboCandidateScore[];
}

interface ExhaustiveQuboSearchConfig {
  dimension: number;
  qMatrix: number[][];
  maxCandidates?: number;
  topK?: number;
}

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function searchSeededQuboBitstrings(config: QuboSearchConfig): SeededQuboSearchResult {
  const { numVariables, qMatrix, maxCandidates = 256, seed = 42 } = config;
  if (numVariables <= 0) {
    throw new Error("numVariables must be positive.");
  }
  if (maxCandidates <= 0) {
    throw new Error("maxCandidates must be positive.");
  }

  const totalExact = numVariables <= 30 ? 2 ** numVariables : Number.POSITIVE_INFINITY;
  const budget = Math.min(maxCandidates, totalExact);
  const rng = createSeededRng(seed);
  const seen = new Set<string>();
  const scored: QuboCandidateScore[] = [];

  for (let attempt = 0; attempt < budget * 4 && scored.length < budget; attempt++) {
    let bitstring: number[];
    if (scored.length < totalExact && attempt < totalExact && numVariables <= 16) {
      const idx = attempt;
      bitstring = Array.from({ length: numVariables }, (_, b) => (idx >> b) & 1);
    } else {
      bitstring = Array.from({ length: numVariables }, () => (rng() >= 0.5 ? 1 : 0));
    }

    const key = bitstring.join("");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const energy = evaluateQuboObjective(bitstring, qMatrix);
    scored.push({ bitstring, energy });
  }

  scored.sort((a, b) => a.energy - b.energy);

  return {
    evaluatedCount: scored.length,
    best: scored[0],
    topCandidates: scored.slice(0, Math.min(10, scored.length)),
  };
}

export function searchBoundedQuboBitstrings(config: QuboSearchConfig): SeededQuboSearchResult;
export function searchBoundedQuboBitstrings(params: ExhaustiveQuboSearchConfig): QuboSearchResult;
export function searchBoundedQuboBitstrings(
  params: QuboSearchConfig | ExhaustiveQuboSearchConfig
): SeededQuboSearchResult | QuboSearchResult {
  if ("numVariables" in params) {
    return searchSeededQuboBitstrings(params);
  }

  const { dimension, qMatrix } = params;
  const maxCandidates = Math.max(1, params.maxCandidates ?? 4096);
  const topK = Math.max(1, params.topK ?? 5);

  if (!Number.isInteger(dimension) || dimension < 1 || dimension > 30) {
    throw new Error(
      `Unsupported QUBO dimension ${dimension}; expected integer between 1 and 30.`
    );
  }

  const totalExhaustiveSpace = 2 ** dimension;
  const limit = Math.min(totalExhaustiveSpace, maxCandidates);
  const candidates: QuboSearchCandidate[] = [];

  for (let mask = 0; mask < limit; mask++) {
    const x: number[] = [];
    for (let bit = dimension - 1; bit >= 0; bit--) {
      x.push((mask >> bit) & 1);
    }
    const objectiveValue = evaluateQuboObjective(x, qMatrix);
    candidates.push({ x, objectiveValue });
  }

  candidates.sort((a, b) => a.objectiveValue - b.objectiveValue);

  return {
    dimension,
    evaluatedCount: candidates.length,
    totalExhaustiveSpace,
    truncatedByBudget: totalExhaustiveSpace > maxCandidates,
    bestCandidate: candidates[0] ?? null,
    topCandidates: candidates.slice(0, topK),
  };
}
