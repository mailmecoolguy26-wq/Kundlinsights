# Layer 14A — Deterministic Reading Contract

Layer 14A is a deterministic presentation boundary from Layer 13 structured conclusions to future renderer/UI work. Its public API is `buildReading({ domain: 'CAREER', conclusions })`. It consumes conclusions only; it performs no astronomical, house, Varga, Dasha, Gochar, transit, or interpretation calculation.

## Scope and display policy

Only `CAREER` is supported in v1. All non-duplicate supplied conclusions are included, including `NOT_APPLICABLE`, `INSUFFICIENT_EVIDENCE`, and `CONTRADICTED` items. A future UI may choose visibility, but this contract always retains their status and references.

Sections have fixed order:

1. `CAREER_STRUCTURE`
2. `CURRENT_DASHA_CONTEXT`
3. `GOCHAR_CONTEXT`
4. `TEMPORAL_COACTIVATION`
5. `CLASSICAL_EVENT_PREDICATES`
6. `DISCLOSURES`

Within a section, items order by temporal identity, then topic, then deterministic reading-item ID. One Layer 13 conclusion maps to one reading item; duplicate conclusions deduplicate.

## Reading item contract

Every item contains controlled IDs and data only: section, topic, copied status, template key, optional supplied subject, exact temporal context, rule/source references, evidence references, contradiction references, missing-data references, disclosures, and provenance. `readingItemId` derives from domain, section, conclusion ID, and template key.

`templateKey` is the existing Layer 13 topic. It is not generated prose and cannot strengthen conclusion semantics. Layer 14A composes the existing Layer 13 `createRendererInput` contract rather than replacing it.

## Semantic guardrails

Layer 13 statuses are copied exactly. `SUPPORTED` is never converted to likelihood, certainty, a favorable assessment, or a predicted outcome. Layer 13B1 remains structural; H2 stays resource context, H10 stays Career structure, and H11 stays gain context. Layer 13B2 Dasha, Layer 13B3 Gochar/timing, and Layer 13B4 co-activation remain supplied temporal context only.

For `CAREER_CLASSICAL_PROFESSIONAL_LOSS_PREDICATE_PRESENT`, `CLASSICAL_PREDICATE_NOT_EVENT_CERTAINTY` is mandatory. It denotes only that the audited classical predicate is satisfied for the supplied period; it does not assert professional loss, job loss, termination, unemployment, business failure, or any event certainty.

The controlled disclosure vocabulary is:

- `STRUCTURAL_CONTEXT_ONLY`
- `TEMPORAL_CONTEXT_ONLY`
- `CLASSICAL_PREDICATE_NOT_EVENT_CERTAINTY`
- `MISSING_DATA_NEUTRAL`
- `CONTRADICTION_PRESENT`
- `NO_PROBABILITY_ASSESSMENT`
- `NO_OUTCOME_GUARANTEE`

Contradiction and missing-data identifiers remain visible without resolution, averaging, or adverse inference. Dasha intervals and points are copied exactly, including Layer 13’s `[start, end)` semantics; no windows, extensions, or dates are fabricated.

## Exclusions and future work

The contract excludes raw provider data, astronomy metadata, longitude internals, observer data, scoring, confidence, probability, overall Career summaries, recommendations, remedies, and free-form text. It does not consume Layer 5C as a yuti adapter; the H10 honour predicate remains unavailable.

Layer 14B may later add separately approved tone, prose rendering, multilingual output, or LLM integration. Layer 14A adds none of those capabilities.
