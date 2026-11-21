import {
  ClassificationDecision,
  FallbackExecutionResult,
  IngressSource,
  RosettaEnvelope,
} from "./beemax-rosetta-fallback";
import { BeemaxUnifiedRuntime, UnifiedDispatchResult } from "./beemax-unified-runtime";
import { runSolverVerification } from "./qubo-runtime-integration";
import {
  ExtendedSolverReport,
  MatrixAndQuboInput,
} from "./qubo-matrix-solver-extension";
import { SubstrateClass } from "./substrate-fallback-policy";

export type MaxMathOperation =
  | "expression_and_derivative"
  | "vector_dot_product"
  | "qubo_objective"
  | "constraint_audit";

export interface MaxMathRequest {
  requestId: string;
  operation: MaxMathOperation;
  ingress: IngressSource;
  scopeKey: string;
  substrateClass?: SubstrateClass;
  proposalNote?: string;
  solverInput: MatrixAndQuboInput;
}

export interface MaxMathResponse {
  module: "MAX-MATH";
  requestId: string;
  operation: MaxMathOperation;
  substrateClass: SubstrateClass;
  proposedEnvelope: RosettaEnvelope<unknown> | null | undefined;
  verifiedResult: FallbackExecutionResult<ExtendedSolverReport>;
}

export class MaxMathDispatcher {
  constructor(private readonly runtime: BeemaxUnifiedRuntime) {}

  async dispatch(request: MaxMathRequest): Promise<MaxMathResponse> {
    const decision: ClassificationDecision = {
      ruleId: "R3_DEEP_REASONING_AND_SYNTHESIS",
      routeTo: "max_llm",
      downstreamConsumers: ["MAXSPACE", "Portal-OS1"],
      verification: {
        required: true,
        mode: "solver_gate",
      },
    };

    const outcome = await this.runtime.execute<
      {
        module: "MAX-MATH";
        operation: MaxMathOperation;
        proposalNote: string;
      },
      ExtendedSolverReport
    >({
      decision,
      ingress: request.ingress,
      scopeKey: request.scopeKey,
      substrateClass: request.substrateClass,
      correlationId: request.requestId,
      input: {
        module: "MAX-MATH",
        operation: request.operation,
        proposalNote:
          request.proposalNote ??
          `Proposed MAX-MATH ${request.operation} plan pending deterministic verification`,
      },
      solverInput: request.solverInput,
    });

    return {
      module: "MAX-MATH",
      requestId: request.requestId,
      operation: request.operation,
      substrateClass: outcome.substrateClass,
      proposedEnvelope: outcome.proposedEnvelope,
      verifiedResult: outcome.finalResult,
    };
  }
}

export interface MaxMathDispatchRequest {
  domain?: "icv" | "mesh" | "manifold";
  topic: string;
  ingress?: IngressSource;
  substrateClass?: SubstrateClass;
  solverInput: MatrixAndQuboInput;
  correlationId?: string;
}

export function buildMaxMathScopeKey(
  domain: "icv" | "mesh" | "manifold",
  substrateClass: SubstrateClass,
  topic: string
): string {
  const normalizedTopic = topic.trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, "-");
  return `${domain}:${substrateClass}:max-math:${normalizedTopic}`;
}

export async function dispatchMaxMath(
  runtime: BeemaxUnifiedRuntime,
  request: MaxMathDispatchRequest
): Promise<UnifiedDispatchResult<ExtendedSolverReport>> {
  const domain = request.domain ?? "manifold";
  const substrateClass = request.substrateClass ?? "class_c";
  const scopeKey = buildMaxMathScopeKey(domain, substrateClass, request.topic);

  return runSolverVerification({
    runtime,
    ingress: request.ingress ?? "max_math_dispatcher",
    scopeKey,
    solverInput: request.solverInput,
    substrateClass,
    correlationId: request.correlationId,
  });
}
