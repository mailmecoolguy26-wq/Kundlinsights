# Layer 12A: Generic Evidence Infrastructure

Layer 12A creates an immutable, provider-independent natal evidence graph from already-computed upstream facts. It performs no astronomical, coordinate, house, Varga, Dasha, transit, Ashtakavarga, interpretive, or predictive calculation.

## Boundary

The graph has three node kinds:

- `FACT`: preserves an upstream structured fact without prose conversion.
- `DERIVED_RELATION`: records a generic relation and the IDs of every input node.
- `MISSING_DATA`: records neutral `notProvided`, `notComputed`, `notApplicable`, or `unresolvedByRuleset` state.

Layer 12A is natal/static only: `domain` and `temporalContextId` are always `null`.

## Provenance and identity

The infrastructure ruleset is `parashari-evidence-infrastructure-v1`. Each fact identity derives deterministically from its source layer, source ruleset, canonical subject, and source identity/path. Each derived relation identity derives from its relation type, subject, sorted input IDs, and relation ruleset. The built graph sorts nodes and edges lexicographically by stable ID, so caller insertion order cannot affect output.

Source strength is provenance only: `DIRECT_CLASSICAL`, `CLASSICAL_TRANSLATION`, `COMMENTARY`, `LATER_CONVENTION`, `ENGINE_CONVENTION`, or `UNRESOLVED`. It is never a score, prediction confidence, favorable result, or outcome.

## Upstream adapters

The generic natal assembler can represent supplied Layer 2 classifications, Layer 5A houses, Layer 5B state, Layer 6 Drishti, Layer 7 Yogas, Layer 11 Ashtakavarga, and supplied Varga facts. It does not recalculate or assign domain relevance. Optional input is represented as neutral missing data; contradictory Layer 2/5A placement data is rejected.

## Explicit exclusions

Layer 12A rejects temporal context and interpretive fields such as prediction, probability, score, favorable/unfavorable labels, recommendations, remedies, outcomes, and severity. It does not implement Career or another life domain.

Layer 12B will add audited domain views. Layer 12C will add temporal activation overlays using already-resolved Dasha, Gochar, and transit-event outputs.
