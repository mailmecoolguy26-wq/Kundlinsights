# Application Engine Profiles and Reading Replay

This module is a storage-agnostic application boundary. It creates immutable reading records, deterministic SHA-256 integrity digests, and trusted replay. It does not select a database, add network access, invoke Mapbox, or modify Layer 4 chronology or Layer 15A semantics.

## Immutable calculation profiles

`kundlinsights-vedic-engine-profile-v1` permanently selects `vimshottari-longitude-proportional-savana-360-v1`. `kundlinsights-vedic-engine-profile-v2` permanently selects `vimshottari-longitude-proportional-solar-return-v1`, `solar-return-lahiri-bisection-v1`, and `solar-return-grid-linear-time-interpolation-v1`.

Both lock the shared Lahiri, Mean Rahu, derived-Ketu, canonical-provider, Ascendant, whole-sign house, declared-Varga, Gochar, reading, and interpretation calculation policies. The profiles contain only semantic identifiers—never data paths, secrets, manifests, or native handles. Unknown profiles fail closed; replay never resolves a current default.

A calculation-semantic change requires a new profile ID. A renderer copy/layout-only change uses a renderer ruleset/version and does not itself require a new engine profile. An interpretation change that alters structured conclusions must use a new interpretation ruleset and may require a profile revision when it changes replay semantics.

## Record and integrity contract

`createReadingRecord()` requires an opaque application reading ID, canonical local/UTC resolved birth input, reading instant/range, a generated Layer 15B result, and a creation timestamp. It preserves minimized structured and historical rendered output plus allowlisted provenance.

Calculation identity is SHA-256 over the engine profile, canonical birth UTC, coordinates, timezone resolution identifiers, reading instant/range, and calculation provenance. It deliberately excludes the reading ID, generation time, display label, UI state, and renderer-only presentation. Output integrity separately covers the structured reading and its semantic reading provenance; rendered output has its own digest.

Canonical serialization sorts object keys, preserves array order, canonicalizes valid UTC strings to millisecond ISO form, rejects undefined/non-finite/function/native-handle values, and rejects cycles.

## Replay

`replayPersistedReading()` is a trusted application boundary. It resolves the record’s exact profile, reconstructs a local immutable `ResolvedBirthPlace` from persisted coordinates/timezone data, verifies the recorded UTC conversion, and invokes the existing Layer 15B orchestrator with the profile’s trusted Dasha configuration. It does not call Mapbox, geocode, resolve a timezone, use network access, or accept profile/provider/sampler values from an ordinary user request.

Solar replay requires a trusted canonical sidereal Sun sampler and fails closed if absent. Savana replay requires no Solar sampler. Provider values are checked where comparable, without binding machine paths or native handles. Calculation or output digest differences fail closed.

Records predating profile persistence are `UNKNOWN_LEGACY_PROFILE` until existing provenance conclusively establishes a profile. They must never be guessed from dates, defaults, or displayed Dasha periods.

## Timezone, Mapbox, privacy, and storage

Persist both local birth input and canonical UTC plus timezone resolver version/checksum. UTC disagreement during replay is `TIMEZONE_REPLAY_DRIFT`; historical local time is never silently reinterpreted.

Replay needs only persisted coordinates/timezone, not Mapbox. Optional display labels and provider IDs are presentation/audit data outside calculation identity. The existing Mapbox permanent-geocoding deployment gate remains a separate application/compliance decision.

Birth details are sensitive. Application storage should encrypt at rest when supported, redact raw birth data from logs/analytics, minimize retention, and avoid storing provider payloads or filesystem paths. Database selection, storage transport, and UI remain intentionally out of scope.
