# Layer 1P1 — Swiss Ephemeris Provider

## Scope

`SwissEphemerisProvider` is the Layer 1 production-provider implementation boundary. It supplies canonical native Lahiri sidereal coordinates to the unchanged `AstronomicalEngine`; Layers 2–15 consume the same canonical-body contract and remain provider-independent.

## Binding and license state

The pinned binding is `sweph@2.10.3-7`, using Swiss Ephemeris `2.10.03` through Node-API. The provider is implemented for engineering validation only. Its calculation status is always `LICENSE_GATED_VALIDATION` in this repository. Swiss calculations do not become production authority merely by succeeding.

Commercial activation requires a separately recorded Swiss Ephemeris Professional License, approved deployment configuration, verified data manifest, and all production-authority predicate gates. No license credential, production ephemeris file, private binary, or compliance ID belongs in this repository.

The production bootstrap reads `SWISS_EPHEMERIS_LICENSE_CONFIRMED=true`, an absolute `SWISS_EPHEMERIS_PATH`, and a JSON `SWISS_EPHEMERIS_MANIFEST`. It builds one shared `SwissNativeAdapter` for both `SwissEphemerisProvider` and `SwissCanonicalSiderealSunSampler`; it never falls back to Astronomy Engine. Missing license confirmation, malformed manifest, missing data, checksum mismatch, native initialization failure, or a failed authority sample prevents the process from listening.

## Native policy

The native adapter initializes one immutable process-wide policy:

- absolute local ephemeris path;
- manifest containing `sepl_18.se1` and `semo_18.se1` filename, byte length, SHA-256, release ID, and manifest ID;
- `SE_SIDM_LAHIRI`;
- Mean Node only;
- Swiss version `2.10.03`.

It calls `set_ephe_path()` and `set_sid_mode()` once and rejects later reconfiguration. There is no network download and no automatic provider fallback.

## Coordinates

Sun through Saturn and Mean Rahu use `calc_ut()` with exactly `SEFLG_SWIEPH | SEFLG_SPEED | SEFLG_SIDEREAL`. Returned flags must contain all three bits; Moshier and JPL return modes are rejected. Longitude speed remains degrees per day. `direct`, `retrograde`, and `stationary` retain the existing KundlInsights engine convention: stationary only when `abs(speed) < 1e-7`.

Ketu is not independently calculated: it is normalized Mean Rahu plus 180 degrees, retaining Rahu's longitude derivative and motion.

The Ascendant uses `houses_ex2(jdUt, SEFLG_SIDEREAL, latitude, longitude, 'W')` after Lahiri initialization. Only the Ascendant point is retained; Swiss cusps are discarded. Layer 5A remains the sole authority for whole-sign Rashi houses.

Native sidereal longitudes carry `siderealMetadata`, so `AstronomicalEngine` does not invoke the interim Lahiri calculator or subtract ayanamsha a second time. Tropical longitude is nullable because it is not required to represent native sidereal output.

## Golden tests and authority

Normal `npm test` uses mocked native-adapter fixtures and does not require private Swiss data. These are unit tests, not astronomical authority golden data. Future golden values must be produced independently by official Swiss C tooling such as `swetest`, then tested in secured, licensed CI.

`isProductionAstronomicalAuthority()` requires the approved provider/binding/library versions, verified manifest, deployment license gate, Lahiri, Mean Node, returned SWIEPH flags for all planets, and a Swiss `houses_ex2` Ascendant. It rejects provisional and license-gated validation results.
