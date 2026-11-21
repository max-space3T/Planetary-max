import {
  MeshManifoldContext,
  StructuralNamespace,
} from "./beemax-mesh-manifold-substrates";
import { SubstrateClass } from "./substrate-fallback-policy";

export interface ParsedScopeKey {
  namespace: StructuralNamespace;
  substrateClass: SubstrateClass;
  targetId: string;
  canonicalScopeKey: string;
}

export type ScopeDomain = "icv" | "mesh" | "manifold";

export interface StrictParsedScopeKey {
  domain: ScopeDomain;
  substrateClass: SubstrateClass;
  remainder: string;
  raw: string;
}

const VALID_NAMESPACES = new Set<string>(["ICV", "MESH", "MANIFOLD"]);
const VALID_DOMAINS = new Set<string>(["icv", "mesh", "manifold"]);
const VALID_SUBSTRATES = new Set<string>(["class_b", "class_c"]);

export function encodeScopeKey(params: {
  domain: ScopeDomain;
  substrateClass: SubstrateClass;
  remainder: string;
}): string {
  const cleanRemainder = params.remainder.trim().replace(/^:+|:+$/g, "");
  return `${params.domain}:${params.substrateClass}:${cleanRemainder}`;
}

export function parseStrictScopeKey(scopeKey: string): StrictParsedScopeKey {
  const parts = scopeKey.split(":");
  if (parts.length < 3) {
    throw new Error(`Invalid scopeKey "${scopeKey}": expected <domain>:<substrate>:<remainder>.`);
  }

  const [domainRaw, substrateRaw, ...rest] = parts;
  if (!VALID_DOMAINS.has(domainRaw)) {
    throw new Error(`Invalid scope domain "${domainRaw}" in "${scopeKey}".`);
  }
  if (!VALID_SUBSTRATES.has(substrateRaw)) {
    throw new Error(`Invalid substrate class "${substrateRaw}" in "${scopeKey}".`);
  }

  const remainder = rest.join(":");
  if (!remainder) {
    throw new Error(`Missing scope remainder in "${scopeKey}".`);
  }

  return {
    domain: domainRaw as ScopeDomain,
    substrateClass: substrateRaw as SubstrateClass,
    remainder,
    raw: scopeKey,
  };
}

export function formatScopeKey(params: {
  namespace: StructuralNamespace;
  substrateClass: SubstrateClass;
  targetId: string;
}): string {
  const cleanTarget = params.targetId.trim() || "default";
  return `${params.namespace.toLowerCase()}:${params.substrateClass}:${cleanTarget}`;
}

export function formatScopeKeyFromContext(context: MeshManifoldContext): string {
  return formatScopeKey({
    namespace: context.namespace,
    substrateClass: context.substrateClass,
    targetId: context.manifoldCoordKey ?? context.meshNodeId ?? "default",
  });
}

export function parseScopeKey(scopeKey: string): ParsedScopeKey | null {
  const parts = scopeKey.split(":");
  if (parts.length < 3) {
    return null;
  }

  const nsUpper = parts[0].toUpperCase();
  const subLower = parts[1].toLowerCase();
  const targetId = parts.slice(2).join(":").trim();

  if (!VALID_NAMESPACES.has(nsUpper) || !VALID_SUBSTRATES.has(subLower) || !targetId) {
    return null;
  }

  const namespace = nsUpper as StructuralNamespace;
  const substrateClass = subLower as SubstrateClass;

  return {
    namespace,
    substrateClass,
    targetId,
    canonicalScopeKey: formatScopeKey({ namespace, substrateClass, targetId }),
  };
}
