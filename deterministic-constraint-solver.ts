import { DeterministicSolverClient } from "./beemax-provider-adapters";

export type ConstraintRule =
  | { kind: "finite"; field: string; label?: string }
  | { kind: "nonNegative"; field: string; label?: string }
  | { kind: "min"; field: string; min: number; inclusive?: boolean; label?: string }
  | { kind: "max"; field: string; max: number; inclusive?: boolean; label?: string }
  | { kind: "range"; field: string; min: number; max: number; label?: string }
  | { kind: "maxSum"; fields: string[]; limit: number; label?: string }
  | {
      kind: "conservation";
      beforeFields: string[];
      afterFields: string[];
      tolerance?: number;
      label?: string;
    };

export interface SolverProblemInput {
  variables?: Record<string, number>;
  expression?: string;
  expectedValue?: number;
  tolerance?: number;
  derivativeCheck?: {
    expression: string;
    variable: string;
    at: number;
    expectedDerivative?: number;
    stepSize?: number;
    tolerance?: number;
  };
  metrics?: Record<string, number>;
  constraints?: ConstraintRule[];
}

export interface ConstraintCheckResult {
  ruleKind: ConstraintRule["kind"];
  label: string;
  passed: boolean;
  actual: number | string;
  detail: string;
}

export interface SolverVerificationReport {
  verified: boolean;
  evaluatedAt: string;
  expressionResult?: {
    expression: string;
    value: number;
    expected?: number;
    withinTolerance?: boolean;
  };
  derivativeResult?: {
    expression: string;
    variable: string;
    at: number;
    approximateDerivative: number;
    expectedDerivative?: number;
    withinTolerance?: boolean;
  };
  checks: ConstraintCheckResult[];
  failures: string[];
}

function evaluateMathExpression(expr: string, vars: Record<string, number>): number {
  const input = expr.replace(/\s+/g, "");
  let pos = 0;

  const peek = () => input[pos];
  const consume = () => input[pos++];

  function parseExpression(): number {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = consume();
      const rhs = parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  function parseTerm(): number {
    let value = parsePower();
    while (peek() === "*" || peek() === "/") {
      const op = consume();
      const rhs = parsePower();
      if (op === "/" && rhs === 0) {
        throw new Error("Division by zero in mathematical expression.");
      }
      value = op === "*" ? value * rhs : value / rhs;
    }
    return value;
  }

  function parsePower(): number {
    const base = parseUnary();
    if (peek() === "^") {
      consume();
      return Math.pow(base, parsePower());
    }
    return base;
  }

  function parseUnary(): number {
    const ch = peek();
    if (ch === "+") {
      consume();
      return parseUnary();
    }
    if (ch === "-") {
      consume();
      return -parseUnary();
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    const ch = peek();
    if (!ch) throw new Error("Unexpected end of expression.");

    if (ch === "(") {
      consume();
      const val = parseExpression();
      if (consume() !== ")") {
        throw new Error("Missing closing parenthesis ')'.");
      }
      return val;
    }

    if ((ch >= "0" && ch <= "9") || ch === ".") {
      const start = pos;
      let hasDot = ch === ".";
      consume();
      while (peek() !== undefined) {
        const next = peek()!;
        if (next >= "0" && next <= "9") {
          consume();
        } else if (next === "." && !hasDot) {
          hasDot = true;
          consume();
        } else if (
          (next === "e" || next === "E") &&
          (input[pos + 1] === "+" ||
            input[pos + 1] === "-" ||
            (input[pos + 1] >= "0" && input[pos + 1] <= "9"))
        ) {
          consume();
          if (peek() === "+" || peek() === "-") consume();
        } else {
          break;
        }
      }
      const parsed = Number(input.slice(start, pos));
      if (!Number.isFinite(parsed)) {
        throw new Error(`Invalid numeric literal "${input.slice(start, pos)}".`);
      }
      return parsed;
    }

    if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_") {
      const start = pos;
      while (
        peek() !== undefined &&
        ((peek()! >= "a" && peek()! <= "z") ||
          (peek()! >= "A" && peek()! <= "Z") ||
          (peek()! >= "0" && peek()! <= "9") ||
          peek() === "_")
      ) {
        consume();
      }
      const ident = input.slice(start, pos);

      if (peek() === "(") {
        consume();
        const arg = parseExpression();
        if (consume() !== ")") {
          throw new Error(`Missing closing parenthesis after function "${ident}".`);
        }
        switch (ident) {
          case "sin":
            return Math.sin(arg);
          case "cos":
            return Math.cos(arg);
          case "tan":
            return Math.tan(arg);
          case "sqrt":
            if (arg < 0) throw new Error("Square root of negative number.");
            return Math.sqrt(arg);
          case "abs":
            return Math.abs(arg);
          case "exp":
            return Math.exp(arg);
          case "log":
            if (arg <= 0) throw new Error("Natural log of non-positive number.");
            return Math.log(arg);
          default:
            throw new Error(`Unsupported math function "${ident}".`);
        }
      }

      if (ident === "PI") return Math.PI;
      if (ident === "E") return Math.E;

      if (Object.prototype.hasOwnProperty.call(vars, ident)) {
        const val = vars[ident];
        if (!Number.isFinite(val)) {
          throw new Error(`Variable "${ident}" is not a finite number.`);
        }
        return val;
      }

      throw new Error(`Unknown variable or identifier "${ident}".`);
    }

    throw new Error(`Unexpected character "${ch}" at position ${pos}.`);
  }

  const result = parseExpression();
  if (pos !== input.length) {
    throw new Error(`Unexpected trailing token starting at "${input.slice(pos)}".`);
  }
  if (!Number.isFinite(result)) {
    throw new Error("Expression evaluated to a non-finite value.");
  }
  return result;
}

function evaluateConstraint(
  rule: ConstraintRule,
  metrics: Record<string, number>
): ConstraintCheckResult {
  const label = rule.label ?? rule.kind;

  switch (rule.kind) {
    case "finite": {
      const actual = metrics[rule.field];
      const passed = typeof actual === "number" && Number.isFinite(actual);
      return {
        ruleKind: rule.kind,
        label,
        passed,
        actual: passed ? actual : String(actual),
        detail: passed ? `${rule.field} = ${actual} is finite` : `${rule.field} not finite`,
      };
    }
    case "nonNegative": {
      const actual = metrics[rule.field];
      const passed = typeof actual === "number" && Number.isFinite(actual) && actual >= 0;
      return {
        ruleKind: rule.kind,
        label,
        passed,
        actual: Number.isFinite(actual) ? actual : String(actual),
        detail: passed ? `${rule.field} = ${actual} >= 0` : `${rule.field} (${actual}) < 0`,
      };
    }
    case "min": {
      const actual = metrics[rule.field];
      const inclusive = rule.inclusive ?? true;
      const passed =
        typeof actual === "number" &&
        Number.isFinite(actual) &&
        (inclusive ? actual >= rule.min : actual > rule.min);
      return {
        ruleKind: rule.kind,
        label,
        passed,
        actual: Number.isFinite(actual) ? actual : String(actual),
        detail: passed
          ? `${rule.field} = ${actual} ${inclusive ? ">=" : ">"} ${rule.min}`
          : `${rule.field} (${actual}) failed min ${rule.min}`,
      };
    }
    case "max": {
      const actual = metrics[rule.field];
      const inclusive = rule.inclusive ?? true;
      const passed =
        typeof actual === "number" &&
        Number.isFinite(actual) &&
        (inclusive ? actual <= rule.max : actual < rule.max);
      return {
        ruleKind: rule.kind,
        label,
        passed,
        actual: Number.isFinite(actual) ? actual : String(actual),
        detail: passed
          ? `${rule.field} = ${actual} ${inclusive ? "<=" : "<"} ${rule.max}`
          : `${rule.field} (${actual}) failed max ${rule.max}`,
      };
    }
    case "range": {
      const actual = metrics[rule.field];
      const passed =
        typeof actual === "number" &&
        Number.isFinite(actual) &&
        actual >= rule.min &&
        actual <= rule.max;
      return {
        ruleKind: rule.kind,
        label,
        passed,
        actual: Number.isFinite(actual) ? actual : String(actual),
        detail: passed
          ? `${rule.field} = ${actual} in [${rule.min}, ${rule.max}]`
          : `${rule.field} (${actual}) out of [${rule.min}, ${rule.max}]`,
      };
    }
    case "maxSum": {
      const sum = rule.fields.reduce((acc, key) => acc + (metrics[key] ?? 0), 0);
      const passed = Number.isFinite(sum) && sum <= rule.limit;
      return {
        ruleKind: rule.kind,
        label,
        passed,
        actual: sum,
        detail: passed
          ? `sum(${rule.fields.join("+")}) = ${sum} <= ${rule.limit}`
          : `sum(${rule.fields.join("+")}) = ${sum} > ${rule.limit}`,
      };
    }
    case "conservation": {
      const tol = rule.tolerance ?? 1e-6;
      const beforeSum = rule.beforeFields.reduce((acc, k) => acc + (metrics[k] ?? 0), 0);
      const afterSum = rule.afterFields.reduce((acc, k) => acc + (metrics[k] ?? 0), 0);
      const diff = Math.abs(afterSum - beforeSum);
      const passed = Number.isFinite(diff) && diff <= tol;
      return {
        ruleKind: rule.kind,
        label,
        passed,
        actual: diff,
        detail: passed
          ? `conserved within tol=${tol} (diff=${diff})`
          : `drift ${diff} > tol=${tol}`,
      };
    }
  }
}

export class DeterministicConstraintSolverClient
  implements DeterministicSolverClient<SolverProblemInput, SolverVerificationReport>
{
  async solveAndVerify(params: {
    input: SolverProblemInput;
    scopeKey: string;
    signal?: AbortSignal;
  }): Promise<SolverVerificationReport> {
    if (params.signal?.aborted) {
      throw new Error("Solver execution aborted by signal.");
    }

    const { input } = params;
    const vars = input.variables ?? {};
    const metrics: Record<string, number> = { ...vars, ...(input.metrics ?? {}) };
    const checks: ConstraintCheckResult[] = [];
    const failures: string[] = [];

    let expressionResult: SolverVerificationReport["expressionResult"];
    if (input.expression !== undefined) {
      try {
        const value = evaluateMathExpression(input.expression, vars);
        let withinTolerance: boolean | undefined;
        if (input.expectedValue !== undefined) {
          const tol = input.tolerance ?? 1e-6;
          withinTolerance = Math.abs(value - input.expectedValue) <= tol;
          checks.push({
            ruleKind: "finite",
            label: "expression_expected_value",
            passed: withinTolerance,
            actual: value,
            detail: `|${value} - ${input.expectedValue}| <= ${tol}: ${withinTolerance}`,
          });
          if (!withinTolerance) {
            failures.push(
              `Expression "${input.expression}" = ${value}, expected ${input.expectedValue}`
            );
          }
        }
        metrics["__expression_result"] = value;
        expressionResult = {
          expression: input.expression,
          value,
          expected: input.expectedValue,
          withinTolerance,
        };
      } catch (err) {
        failures.push(
          `Expression evaluation failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    let derivativeResult: SolverVerificationReport["derivativeResult"];
    if (input.derivativeCheck !== undefined) {
      const dc = input.derivativeCheck;
      const h = dc.stepSize ?? 1e-5;
      try {
        const fPlus = evaluateMathExpression(dc.expression, {
          ...vars,
          [dc.variable]: dc.at + h,
        });
        const fMinus = evaluateMathExpression(dc.expression, {
          ...vars,
          [dc.variable]: dc.at - h,
        });
        const approxDeriv = (fPlus - fMinus) / (2 * h);

        let withinTolerance: boolean | undefined;
        if (dc.expectedDerivative !== undefined) {
          const tol = dc.tolerance ?? 1e-4;
          withinTolerance = Math.abs(approxDeriv - dc.expectedDerivative) <= tol;
          checks.push({
            ruleKind: "finite",
            label: "derivative_check",
            passed: withinTolerance,
            actual: approxDeriv,
            detail: `d/d${dc.variable}(${dc.at}) = ${approxDeriv} vs ${dc.expectedDerivative}`,
          });
          if (!withinTolerance) {
            failures.push(
              `Derivative at ${dc.at} = ${approxDeriv}, expected ${dc.expectedDerivative}`
            );
          }
        }

        derivativeResult = {
          expression: dc.expression,
          variable: dc.variable,
          at: dc.at,
          approximateDerivative: approxDeriv,
          expectedDerivative: dc.expectedDerivative,
          withinTolerance,
        };
      } catch (err) {
        failures.push(
          `Derivative check failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    for (const rule of input.constraints ?? []) {
      const check = evaluateConstraint(rule, metrics);
      checks.push(check);
      if (!check.passed) failures.push(check.detail);
    }

    if (failures.length > 0) {
      throw new Error(
        `Deterministic verification failed for "${params.scopeKey}": ${failures.join(" | ")}`
      );
    }

    return {
      verified: true,
      evaluatedAt: new Date().toISOString(),
      expressionResult,
      derivativeResult,
      checks,
      failures: [],
    };
  }
}
