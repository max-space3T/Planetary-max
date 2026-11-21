import {
  ConstraintRule,
  SolverProblemInput,
} from "./deterministic-constraint-solver";
import {
  ExtendedSolverReport,
  MatrixAndQuboSolverClient,
} from "./qubo-matrix-solver-extension";
import {
  QuboSearchConfig,
  QuboSearchResult,
  SeededQuboSearchResult,
  searchBoundedQuboBitstrings,
} from "./qubo-bitstring-search";

export interface QuboSolveRequest {
  scopeKey: string;
  searchConfig: QuboSearchConfig;
  maxObjective?: number;
  expectedObjective?: number;
  tolerance?: number;
  signal?: AbortSignal;
}

export interface QuboSolveResponse {
  search: SeededQuboSearchResult;
  verification: ExtendedSolverReport;
}

export interface QuboSearchAndVerifyParams {
  scopeKey: string;
  dimension: number;
  qMatrix: number[][];
  maxCandidates?: number;
  topK?: number;
  maxObjectiveBound?: number;
  extraBaseInput?: Omit<SolverProblemInput, "quboCheck">;
  extraConstraints?: ConstraintRule[];
  signal?: AbortSignal;
}

export interface QuboSearchAndVerifyResult {
  search: QuboSearchResult;
  verification: ExtendedSolverReport | null;
}

export class QuboSolverService {
  constructor(
    private readonly solverClient: MatrixAndQuboSolverClient = new MatrixAndQuboSolverClient()
  ) {}

  async solve(request: QuboSolveRequest): Promise<QuboSolveResponse> {
    const search = searchBoundedQuboBitstrings(request.searchConfig);
    const verification = await this.solverClient.solveAndVerifyExtended({
      scopeKey: request.scopeKey,
      signal: request.signal,
      input: {
        quboCheck: {
          x: search.best.bitstring,
          qMatrix: request.searchConfig.qMatrix,
          maxObjective: request.maxObjective,
          expectedObjective: request.expectedObjective,
          tolerance: request.tolerance,
        },
      },
    });

    return { search, verification };
  }

  async searchAndVerifyBest(
    params: QuboSearchAndVerifyParams
  ): Promise<QuboSearchAndVerifyResult> {
    const search = searchBoundedQuboBitstrings({
      dimension: params.dimension,
      qMatrix: params.qMatrix,
      maxCandidates: params.maxCandidates,
      topK: params.topK,
    });

    if (!search.bestCandidate) {
      return { search, verification: null };
    }

    const best = search.bestCandidate;
    const verification = await this.solverClient.solveAndVerifyExtended({
      scopeKey: params.scopeKey,
      signal: params.signal,
      input: {
        ...(params.extraBaseInput ?? {}),
        metrics: {
          ...(params.extraBaseInput?.metrics ?? {}),
          qubo_objective: best.objectiveValue,
        },
        constraints: [
          ...(params.extraBaseInput?.constraints ?? []),
          ...(params.extraConstraints ?? []),
        ],
        quboCheck: {
          x: best.x,
          qMatrix: params.qMatrix,
          maxObjective: params.maxObjectiveBound,
          expectedObjective: best.objectiveValue,
        },
      },
    });

    return { search, verification };
  }
}
