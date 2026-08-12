# Layer 15B — Birth-to-Career One-Call Orchestration

## Scope

Layer 15B is an adapter-only development/validation API. `BirthCareerReadingOrchestrator` accepts resolved birth details, an explicit reading instant, and an injected Layer 1 `AstronomicalEngine`; it delegates Career evidence, interpretation, reading construction, and rendering to the existing Layer 15A `buildCareerReading` API.

It adds no astrology rules, provider configuration, timezone lookup, house rule, Dasha rule, Career rule, template, network call, or model/LLM integration.

## Public contract

```js
new BirthCareerReadingOrchestrator({ astronomicalEngine }).generate({
  birth: { date: '1990-11-26', time: '13:40:00', place: resolvedBirthPlace },
  readingInstant: '2024-06-01T00:00:00.000Z',
  transitScanRange: undefined, // or { startInstant, endInstant }
  locale: 'en-IN'
});
```

`place` must be an existing immutable `ResolvedBirthPlace`. The orchestrator uses only its latitude, longitude, and IANA timezone; it does not geocode, call Mapbox, or resolve a timezone again. Birth date/time validation and local-to-UTC conversion reuse Layer 1's `localDateTimeToUtc` policy, including historical IANA offsets and fatal DST gap/overlap errors.

`readingInstant` is required, valid UTC, and ends in `Z`; there is no current-time default. A supplied transit range must have valid UTC start/end values with start before end. When absent, no transit scan is fabricated.

## Pipeline

```text
ResolvedBirthPlace + local birth input
  -> injected Layer 1 birth snapshot
  -> Layer 2 classification (native sidereal consumed once)
  -> Layer 5A whole-sign D1 houses
  -> Layer 4 Vimshottari Dasha
  -> injected Layer 1 reading snapshot
  -> Layer 9 Gochar
  -> optional explicit Layer 10 event scan
  -> Layer 12A natal graph
  -> Layer 15A (Layers 12B–14)
  -> minimized Career output
```

Swiss-native Lahiri coordinates retain `siderealMetadata`; no interim Lahiri conversion is performed by Layer 15B. Layer 5A remains the house authority; Swiss cusp output is never used. The standard request includes Gochar. Optional Varga, D10, Yoga, Panchanga, association, and Ashtakavarga modules are intentionally not calculated in v1; Layer 12A's existing neutral missing-data behavior applies.

## Dependency and authority boundary

The astronomical engine is injected. Layer 15B never constructs a Swiss provider, hard-codes an ephemeris path, accepts a manifest in public input, or changes a license gate. With the current Swiss provider, output provenance retains `LICENSE_GATED_VALIDATION` and `productionAuthority: false`.

The minimized output contains only domain, locale, Layer 14A reading, rendered reading, and safe provenance. It excludes raw birth data, coordinates, longitudes, provider payloads, evidence graphs, and filesystem paths. Results are deeply frozen.

## Failure and determinism

Invalid input, invalid resolved place/timezone, local-time ambiguity/nonexistence, provider failures, Layer 2/house/Dasha/Gochar failures, and Layer 15A failures are fatal. Missing transit range is neutral. Given the same request, injected provider/data version, and rulesets, no current time, randomness, network call, or model output affects results.

## Readiness

**DEVELOPMENT/VALIDATION READY.** A local, configured validation provider and already-resolved place are required.

**COMMERCIAL PRODUCTION AUTHORITY: NO.** Swiss Professional License and the separate production-authority gate remain required. Mapbox's deployment/persistence policy remains separate and unchanged.
