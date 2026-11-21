<!-- coderabbit-ai-generated:v1 -->

# BEEMAX routing policy 1.1.0

`POST /api/admin/beemax/route` classifies normalized metadata under the supplied policy. It requires the existing administrator session and same-origin protections. For example:

```json
{"ingress":"Portal-OS1","intent_type":"synthesize","multi_module_coordination":true,"contains":["equations"]}
```

The caller provides normalized intent and, as applicable, `requires_compute`, `ambiguous`, `payload_type`, `multi_module_coordination`, `target_module`, and `contains`. The classifier applies the listed matches in priority order. An instant intent with unknown compute requirement or `ambiguous: true` escalates to R3; a known compute requirement does not qualify for R1. Other unmatched combinations return `status: unmatched`. Unknown fields and unsupported ingress values are rejected. `contains` lists the policy's four verification categories. If omitted, verification is `unknown`; an empty list returns `not_indicated`. These are caller declarations, not inspection of the request or generated output.

A decision reports `execution: not_dispatched`: it does not call MAX-ROSETTA, a model, a solver, consumers or publishers. R2 and R3 describe authority for proposed results; this endpoint emits no result or state tag. R4 describes the authority reserved for verified state, but this endpoint cannot verify or commit it. The existing BEEMAX chat remains conversation only.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:12056eab0bd5ccd23c356214ad705259b8cd74fc3e1465d355d992380c50566a -->

## Fallback integration

`server/beemax-rosetta-fallback.ts` provides an adapter from matched classifier decisions and a fallback handler for server-side integrations. The existing HTTP endpoint remains classification only. Unknown verification is treated conservatively as required; `not_required` in the adapter means no category was declared, not that output was inspected. <!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:2f81e7ac877698a0b8112190c33e451c769e5174b2b2a6eef6bd6944ae246de2 -->

The adapter uses the signals returned by the classifier.

<!-- /coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:7e1568af4753c9bb5816dcb6c343ced48a98b513ecc21ff9577fa2b00e63c10b -->

Envelope creation produces proposed state only. `verifyAndRecord` requires an injected trusted solver verifier to check the exact envelope and payload before storing a verified snapshot. Verified payloads may differ in type from their source. Promotion records the source packet and layer in metadata and defaults the new packet ID to the source ID with `_verified` appended. Metadata may contain nested structured-cloneable values; integrations must handle serialization for their transport and snapshot store.

<!-- /coderabbit-ai-generated:v1 --> <!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:0504a02e8d055c00a5868d8873a432cd9b2829554947ebc7dd9a80d11ab61012 -->

A solver-routed dispatch may return a verified result; the handler independently checks it with the trusted verifier before recording or returning it. A dispatch response cannot certify itself.

<!-- /coderabbit-ai-generated:v1 --> The snapshot store is also a trusted server-side dependency: it must protect entries from untrusted writes and atomically retain the latest recorded entry per scope. The handler checks version, scope and verified solver fields before returning a stored entry; those fields alone are not proof of verification. A snapshot failure returns an empty fallback.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:151a0657a6da93a7476ac68454ef721633bdcc432be0def153f49855f04752a2 -->

Dispatch, verification and snapshot recording share one timeout; fallback snapshot lookup has a separate timeout. A timed-out dispatch or verifier receives an abort signal and late verification cannot start a snapshot write. An already-started store write or a service ignoring the signal may continue; the store must enforce the ordering rule and integrators must prevent late work from committing state.

<!-- /coderabbit-ai-generated:v1 --> <!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:f7e2d3893446d6006360e2dc97c529bc0007ebc6e3b9d84e682e04be150aae1a -->

`activeLayer` identifies the selected fallback layer; the handler does not invoke the fast router. Shell responsiveness is a policy setting, not a measured UI guarantee.

<!-- /coderabbit-ai-generated:v1 --> The handler does not publish, commit state, inspect output for verification categories, or configure persistence. A trusted solver and snapshot store, authenticated service interfaces, real normalization, and output inspection are still required before live execution can use this handler. No production solver or snapshot store is configured here.

<!-- /coderabbit-ai-generated:v1 -->
