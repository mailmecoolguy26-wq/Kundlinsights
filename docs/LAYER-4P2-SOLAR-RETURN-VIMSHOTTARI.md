# Layer 4P2 — Explicit Solar-Return Vimshottari Chronology

## Scope

Layer 4P2 adds `vimshottari-longitude-proportional-solar-return-v1` as an explicit Layer 4-only ruleset. It does not change Savana chronology, the default ruleset, Layers 5–15, Layer 15B, or Swiss production authority.

The Moon still determines Janma Nakshatra and longitude-proportional birth balance. Birth is solar-year coordinate zero. If elapsed birth-lord years are `e`, the theoretical birth MD begins at `-e`, birth occurs at `0`, and birth-MD end is at `N - e`. Each MD coordinate is resolved independently through an immutable bidirectional native-Lahiri solar-return grid using the original natal Sun target.

Actual MD timestamp intervals are subdivided into AD and PD using the existing cumulative integer-`BigInt` Vimshottari weights. They retain `[start,end)` semantics and each final child ends exactly at its parent end. Individual AD/PD boundaries are not separately solar-return solved.

The required sampler is injected. Its safe calculation status and authority flag are preserved in chronology provenance; Layer 4 never promotes authority. The current Swiss path remains `LICENSE_GATED_VALIDATION` with `productionAuthority: false`. No network or dependency is required.

## Validation status

Hyderabad MD/AD/PD values remain `PROTOTYPE_PARITY` until Layer 4P3 validates against independent official Swiss C data.

CURRENT SAVANA DEFAULT UNCHANGED: YES

SOLAR-RETURN VIMSHOTTARI CHRONOLOGY ACTIVE: EXPLICIT_LAYER_4_OPT_IN_ONLY

INDEPENDENT SOLAR-RETURN DASHA GOLDENS: NOT YET ADDED
