import {
  ClassificationDecision,
  createRosettaEnvelope,
  IngressSource,
  IntelligenceLayerId,
  RosettaEnvelope,
} from "./beemax-rosetta-fallback";

export type SubstrateClass = "class_b" | "class_c";
export type StructuralNamespace = "ICV" | "MESH" | "MANIFOLD";

export interface MeshManifoldContext {
  namespace: StructuralNamespace;
  substrateClass: SubstrateClass;
  meshNodeId?: string;
  manifoldCoordKey?: string;
}

export function wrapMeshManifoldPacket<TPayload>(params: {
  packetId: string;
  ingress: IngressSource;
  sourceLayer: IntelligenceLayerId;
  targetLayer: IntelligenceLayerId | "MAXSPACE" | "Portal-OS1";
  context: MeshManifoldContext;
  payload: TPayload;
  decision?: ClassificationDecision;
}): RosettaEnvelope<TPayload> {
  const { context } = params;
  const scopeKey = `${context.namespace.toLowerCase()}:${context.substrateClass}:${
    context.manifoldCoordKey ?? context.meshNodeId ?? "default"
  }`;

  return createRosettaEnvelope<TPayload>({
    packetId: params.packetId,
    ingress: params.ingress,
    sourceLayer: params.sourceLayer,
    targetLayer: params.targetLayer,
    scopeKey,
    payload: params.payload,
    statusTag: "proposed",
    metadata: {
      structuralNamespace: context.namespace,
      substrateClass: context.substrateClass,
      meshNodeId: context.meshNodeId ?? null,
      manifoldCoordKey: context.manifoldCoordKey ?? null,
    },
  });
}
