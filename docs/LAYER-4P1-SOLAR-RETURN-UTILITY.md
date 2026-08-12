# Layer 4P1 — Solar-Return Utility

## Purpose and boundary

Layer 4P1 adds isolated, deterministic infrastructure for a future solar-return Vimshottari timing convention. It does not alter the current Savana chronology, the default Dasha ruleset, `calculateVimshottariDasha`, any MD/AD/PD timestamp, or Layer 15B output.

CURRENT SAVANA DEFAULT UNCHANGED: YES

SOLAR-RETURN VIMSHOTTARI CHRONOLOGY ACTIVE: NO

PRODUCTION AUTHORITY CHANGED: NO

INDEPENDENT SWISS-C GOLDENS:
NOT YET ADDED

The source-policy background is the approved distinction between classical Udu-Dasha solar-return wording and KundlInsights timestamp representation. A chronology activation, independent authoritative Swiss C validation, and any default selection are deferred to P2/P3/P4.

## Canonical Sun sampler

`sampleCanonicalSiderealSun({ instantUtc })` accepts a canonical millisecond ISO UTC instant ending in `Z` and returns a deeply immutable canonical sidereal Sun longitude plus provenance. The sampler is geocentric and observer-free. Its output longitude must already be finite and in `[0, 360)`; malformed provider output is rejected rather than normalized. Provenance is required and deeply frozen.

The Swiss adapter uses the existing native Swiss boundary: `SE_SIDM_LAHIRI`, `SWIEPH`, `SIDEREAL`, and geocentric Sun. It does not calculate houses, Ascendant, or topocentric coordinates; it does not reconstruct tropical longitude or apply the interim Lahiri converter. Existing Swiss manifest/returned-flag policy remains the authority for rejection of Moshier or JPL fallback. Public sampler provenance exposes no filesystem path, remains `LICENSE_GATED_VALIDATION`, and never activates production authority.

## Solver and timestamp policy

`solar-return-lahiri-bisection-v1` finds the first target crossing strictly after a supplied prior UTC epoch. A supplied natal target is deterministically normalized to `[0, 360)` (`360 → 0`, `-1 → 359`). This normalization never applies to provider samples.

Its signed circular residual is:

```
normalize(sample - target + 180) - 180
```

with range `[-180, 180)`. The solver first evaluates the deterministic 350–380 civil-day window at daily boundaries. It requires one observed negative-to-zero-or-positive transition and rejects observed residual reversals or multiple crossings. It then bisects that one-day candidate segment using integer millisecond endpoints. The returned instant is the high endpoint: the first tested millisecond at or after the crossing. The bracket width is at most one millisecond.

One day requires `ceil(log2(86,400,000)) = 27` bisections. The fixed cap is 32, which also safely covers a full 30-day window and is never exceeded. Longitude residual magnitude is diagnostic only; timestamp-bracket width is the acceptance criterion.

## Grid and interpolation

An immutable grid starts at `R0`, the supplied reference/birth instant. `R1` is the first subsequent return and every later return uses the same original natal target. The grid has no global mutable cache and has an explicit ceiling of 121 annual intervals (`R0` through `R121`); larger requests fail closed.

`solar-return-grid-linear-time-interpolation-v1` maps index `n` and fraction `f ∈ [0,1]` to:

```
R_n + round((R_(n+1) - R_n) × f)
```

This is linear UTC-time interpolation between solved returns, not solar-longitude interpolation and not an active Vimshottari chronology.

## Errors, immutability, and validation

Stable error codes are `INVALID_SOLAR_RETURN_TARGET`, `INVALID_SUN_SAMPLE`, `SOLAR_RETURN_BRACKET_NOT_FOUND`, `SOLAR_RETURN_SOLVER_FAILED`, `SOLAR_RETURN_ITERATION_LIMIT`, `INVALID_SOLAR_YEAR_FRACTION`, and `UNSUPPORTED_SOLAR_RETURN_RULESET`. All public utility results, grid entries, provenance, and adapter samples are deeply frozen. Frozen caller input is accepted and not mutated.

Normal unit tests use synthetic samplers only and require neither network access nor Swiss data. The Hyderabad values for the natal target `220.07412509999472°` are an external-data-gated `PROTOTYPE_PARITY` check only: R1 `1991-11-26T14:21:08.782Z`, R2 `1992-11-25T20:27:22.863Z`, and R3 `1993-11-26T02:30:58.428Z`. They are not independent authoritative goldens.
