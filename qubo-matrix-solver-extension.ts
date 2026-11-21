import {
  ConstraintCheckResult,
  DeterministicConstraintSolverClient,
  SolverProblemInput,
  SolverVerificationReport,
} from "./deterministic-constraint-solver";

export interface MatrixAndQuboInput extends SolverProblemInput {
  /** Optional named vectors for dot-product checks */
  vectors?: Record<string, number[]>;
  dotProductCheck?: {
    vectorA: string;
    vectorB: string;
    expected?: number;
    tolerance?: number;
  };
  /** Optional QUBO quadratic evaluation: objective = x^T * Q * x */
  quboCheck?: {
    /** Binary or real state vector x */
    x: number[];
    /** Square matrix Q (n x n) */
    qMatrix: number[][];
    /** Optional upper bound or target objective value */
    maxObjective?: number;
    expectedObjective?: number;
    tolerance?: number;
  };
}

export interface ExtendedSolverReport extends SolverVerificationReport {
  dotProductResult?: {
    vectorA: string;
    vectorB: string;
    dotProduct: number;
    expected?: number;
    withinTolerance?: boolean;
  };
  quboResult?: {
    objectiveValue: number;
    maxObjective?: number;
    expectedObjective?: number;
    passed: boolean;
  };
}

export function computeDotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    if (!Number.isFinite(a[i]) || !Number.isFinite(b[i])) {
      throw new Error("Non-finite element in vector dot product.");
    }
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Evaluates QUBO energy x^T Q x for state vector x and square matrix Q.
 */
export function evaluateQuboObjective(x: number[], qMatrix: number[][]): number {
  const n = x.length;
  if (qMatrix.length !== n) {
    throw new Error(`QUBO matrix row count (${qMatrix.length}) must match x length (${n}).`);
  }
  let total = 0;
  for (let i = 0; i < n; i++) {
    const row = qMatrix[i];
    if (!row || row.length !== n) {
      throw new Error(`QUBO matrix row ${i} must have length ${n}.`);
    }
    if (!Number.isFinite(x[i])) {
      throw new Error(`Non-finite state entry x[${i}].`);
    }
    for (let j = 0; j < n; j++) {
      if (!Number.isFinite(row[j])) {
        throw new Error(`Non-finite QUBO entry Q[${i}][${j}].`);
      }
      total += x[i] * row[j] * x[j];
    }
  }
  if (!Number.isFinite(total)) {
    throw new Error("QUBO objective overflowed to non-finite value.");
  }
  return total;
}

export class MatrixAndQuboSolverClient extends DeterministicConstraintSolverClient {
  async solveAndVerifyExtended(params: {
    input: MatrixAndQuboInput;
    scopeKey: string;
    signal?: AbortSignal;
  }): Promise<ExtendedSolverReport> {
    const baseReport = await super.solveAndVerify({
      input: params.input,
      scopeKey: params.scopeKey,
      signal: params.signal,
    });

    const extraChecks: ConstraintCheckResult[] = [...baseReport.checks];
    const failures: string[] = [];

    let dotProductResult: ExtendedSolverReport["dotProductResult"];
    if (params.input.dotProductCheck) {
      const { vectorA, vectorB, expected, tolerance = 1e-6 } =
        params.input.dotProductCheck;
      const a = params.input.vectors?.[vectorA];
      const b = params.input.vectors?.[vectorB];
      if (!a || !b) {
        failures.push(`Missing vectors "${vectorA}" or "${vectorB}" for dotProductCheck.`);
      } else {
        const dotProduct = computeDotProduct(a, b);
        const withinTolerance =
          expected !== undefined ? Math.abs(dotProduct - expected) <= tolerance : true;
        extraChecks.push({
          ruleKind: "finite",
          label: "dot_product_check",
          passed: withinTolerance,
          actual: dotProduct,
          detail:
            expected !== undefined
              ? `dot(${vectorA}, ${vectorB}) = ${dotProduct} vs ${expected}`
              : `dot(${vectorA}, ${vectorB}) = ${dotProduct} is finite`,
        });
        if (!withinTolerance) {
          failures.push(
            `Dot product ${dotProduct} outside tolerance ±${tolerance} of ${expected}`
          );
        }
        dotProductResult = {
          vectorA,
          vectorB,
          dotProduct,
          expected,
          withinTolerance,
        };
      }
    }

    let quboResult: ExtendedSolverReport["quboResult"];
    if (params.input.quboCheck) {
      const { x, qMatrix, maxObjective, expectedObjective, tolerance = 1e-6 } =
        params.input.quboCheck;
      const objectiveValue = evaluateQuboObjective(x, qMatrix);
      let passed = true;

      if (maxObjective !== undefined && objectiveValue > maxObjective + tolerance) {
        passed = false;
        failures.push(`QUBO objective ${objectiveValue} exceeded maxObjective ${maxObjective}`);
      }
      if (
        expectedObjective !== undefined &&
        Math.abs(objectiveValue - expectedObjective) > tolerance
      ) {
        passed = false;
        failures.push(
          `QUBO objective ${objectiveValue} did not match expectedObjective ${expectedObjective}`
        );
      }

      extraChecks.push({
        ruleKind: "finite",
        label: "qubo_objective_check",
        passed,
        actual: objectiveValue,
        detail: `x^T Q x = ${objectiveValue} (passed=${passed})`,
      });

      quboResult = {
        objectiveValue,
        maxObjective,
        expectedObjective,
        passed,
      };
    }

    if (failures.length > 0) {
      throw new Error(
        `Extended solver verification failed for "${params.scopeKey}": ${failures.join(" | ")}`
      );
    }

    return {
      ...baseReport,
      checks: extraChecks,
      dotProductResult,
      quboResult,
    };
  }
}
