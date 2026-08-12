# Layer 4P4 — Solar-Return Dasha Orchestration Opt-In

Layer 4P4 makes the independently validated solar-return Vimshottari chronology available to the Layer 15B birth-to-Career orchestrator as explicit application infrastructure. It does not change the product default.

## Configuration boundary

`BirthCareerReadingOrchestrator` accepts `astronomicalEngine`, optional `dashaRulesetId`, and optional `canonicalSiderealSunSampler` at construction. Omission of the ruleset preserves `vimshottari-longitude-proportional-savana-360-v1`. The solar ruleset is available only through the explicit `vimshottari-longitude-proportional-solar-return-v1` identifier and requires an injected sampler.

The ordinary `generate()` request remains birth data, reading instant, optional transit range, and locale. Runtime infrastructure fields, including Dasha ruleset, sampler, astronomical engine, Swiss configuration, ephemeris path, manifest, and ayanamsha are rejected.

## Coordinate and authority boundary

Solar chronology takes both Moon and Sun canonical sidereal longitudes from the existing birth Layer 1 snapshot. It does not recalculate the natal Sun or apply Lahiri conversion. The sampler is injected; Layer 15B neither constructs Swiss components nor accesses paths, manifests, bindings, licenses, or the network.

When shared provenance fields are present, Layer 15B fails closed for conflicts in provider identity, sidereal mode, calculation status, production-authority state, Swiss version, or coordinate provenance. The stable failure code is `INCOMPATIBLE_SOLAR_DASHA_PROVIDER_PROVENANCE`. Explicit solar configuration therefore means solar chronology or failure, never Savana fallback.

## Safe output provenance

The existing `dashaRulesetId` remains. `provenance.dashaTiming` adds the selected time-convention ID, Dasha calculation status, and sampler-consistency result; solar output also includes Layer 4’s solver and interpolation identifiers. It deliberately excludes natal Sun longitude, return grids, filesystem paths, manifests, handles, and provider payloads.

Current Swiss-backed solar work remains `LICENSE_GATED_VALIDATION` with `productionAuthority: false`; Layer 4P4 does not promote authority.

## Compatibility and operational policy

Layers 12C through 15A continue to consume supplied Dasha intervals without semantic changes. At 2026-08-12 for the validated Hyderabad fixture, Savana is Mercury/Mercury/Venus while the explicitly selected solar chronology is Mercury/Mercury/Mercury. Natal facts, Gochar, and transit events are independent of the selected chronology; only Dasha-dependent temporal evidence can differ.

Solar-return grid construction can require many Sun samples. Layer 4P4 intentionally does not cache results. A future performance change may use immutable, provenance-keyed birth-profile Dasha caching after separate review.
