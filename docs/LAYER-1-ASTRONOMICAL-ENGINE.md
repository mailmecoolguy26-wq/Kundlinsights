# Layer 1: Astronomical Calculation Engine

## Scope

This layer turns a validated civil birth/transit time and WGS84 location into deterministic, provider-tagged tropical astronomical coordinates plus an explicitly separate, provisional sidereal transformation. It deliberately does not calculate houses, rashis, nakshatras, padas, dashas, yogas, Vargas, predictions, interpretation, or UI data.

## Public contract

`AstronomicalEngine.calculate(input)` accepts:

```js
{
  date: '1990-08-15',            // Gregorian YYYY-MM-DD
  time: '14:30:00.000',          // exact local HH:mm:ss[.SSS]
  timezone: 'Asia/Kolkata',      // IANA identifier; UTC is accepted
  latitude: 28.6139,             // WGS84, -90 through +90
  longitude: 77.209              // WGS84, -180 through +180
}
```

Every body contains mandatory `siderealLongitudeDegrees`; the ambiguous field `longitudeDegrees` is prohibited. `tropicalLongitudeDegrees` is present when supplied by the provider but may be absent for a future provider-native canonical sidereal result. `longitudeProvenance` states whether tropical and sidereal values are provider-native, derived from tropical, or not provided. Each sidereal value has metadata recording system, implementation, reference, ayanamsha value where available, instant, provisional flag, and status.

The DST policy is explicit: invalid local times in a forward clock gap and duplicated local times in a backward overlap are rejected. The caller must provide an unambiguous local time rather than silently receiving an arbitrary instant.

## Provider boundary

```
AstronomicalEngine
  -> EphemerisProvider
       -> AstronomyEngineProvider (temporary development/reference provider)
       -> SwissEphemerisProvider (production target; license-gated)
  -> SiderealCalculator
       -> InterimLahiriSiderealCalculator (temporary development-only)
       -> Swiss native Lahiri mode (future: SE_SIDM_LAHIRI)
```

`SwissEphemerisProvider` throws a `ProductionLicenseGateError` by design. No Swiss Ephemeris AGPL package or data is present. See `EPHEMERIS-DECISION.md` for the Professional License release gate.

## Provider contract

An `EphemerisProvider` receives a UTC `instant` and an immutable WGS84 `observer` object. It returns tagged bodies for Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu, and Ascendant plus provider provenance. A development provider can return tropical coordinates and let `AstronomicalEngine` perform the canonical sidereal transform once. A future production provider can return canonical sidereal values natively, with `siderealMetadata`; Layer 1 then preserves those values without another Lahiri transform. Layer 2 and Layer 3 remain consumers of canonical longitude only.

## Ascendant

Ascendant is a first-class `bodies.Ascendant` result, not a house API. The current Astronomy Engine implementation finds the eastern intersection of the true ecliptic of date and the observer's geometric horizon using the UTC instant, WGS84 latitude, and WGS84 longitude. It reports a tropical result and the existing interim Lahiri canonical sidereal result. Both are explicitly `PROVISIONAL`; no house cusps, house interpretation, refraction, or topocentric planetary conversion is included.

## Future Swiss boundary

The license-gated future provider is expected to use a licensed, current Swiss Ephemeris distribution with `SE_SIDM_LAHIRI`, geocentric planetary calculations, Mean Rahu, Ketu normalized exactly opposite Rahu, native sidereal coordinates, an extended-ayanamsha API equivalent, recorded returned flags, and an observer-aware Ascendant. No Swiss source, data, AGPL package, or POC binding is included in this repository.

## Provider validation fixtures

Provider-independent fixtures carry an `authority` field: `experimental-poc` or `production-authoritative`. Experimental POC values are documentation/compatibility evidence only and must never establish production golden-reference tolerances. Fixtures store civil input, resolved UTC, observer coordinates, provider/version, sidereal mode, node model, ayanamsha, flags/provenance, canonical sidereal longitudes, speeds/motions, and Ascendant.

## Sidereal and node methodology

- The provider supplies raw tropical longitudes as apparent geocentric true-ecliptic-of-date coordinates. Sidereal values are not labelled as true-ecliptic-of-date coordinates.
- The sidereal contract is Lahiri / Chitrapaksha. The current `interim-linear` calculator is **PROVISIONAL** and therefore cannot be the production accuracy standard.
- Swiss Ephemeris with native `SE_SIDM_LAHIRI` is the intended production authority after commercial licensing.
- Rahu is the **mean ascending lunar node**. Ketu is derived as `normalize(Rahu + 180°)` and never independently calculated.
- Longitude is normalized to `[0°, 360°)`. No sign or nakshatra is inferred at this layer.

## Precision policy

The calculation pipeline keeps provider values as IEEE-754 doubles. It does not round internal values, including at boundaries and for downstream input. Presentation code may format degrees to six decimal places, but that output is display-only.

## Current limitation

Astronomy Engine is MIT-licensed and enables commercial development, but its stated typical accuracy is ±1 arcminute and it lacks native Swiss/Lahiri configuration. It is suitable only for development/reference contract work. Production releases must replace it with the commercially licensed Swiss provider and add authoritative cross-provider fixtures.
