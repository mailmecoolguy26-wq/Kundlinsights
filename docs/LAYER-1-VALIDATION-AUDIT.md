# Layer 1 Validation Audit

Audit date: 2026-08-09. Scope is limited to the Layer 1 astronomical foundation.

## Result summary

The data contract was hardened after this audit: raw `tropicalLongitudeDegrees` and transformed `siderealLongitudeDegrees` are now separate fields, and interim sidereal values are explicitly `PROVISIONAL`.

| Area | Result | Readiness |
| --- | --- | --- |
| Provider abstraction and metadata | Stable interface; provider identity/version/mode are returned | A — production-ready architecture |
| UTC normalization and validation | Validated with UTC, Asia/Kolkata, DST gaps/overlaps, and a historical Asia/Kolkata offset | A — production-ready, with runtime TZ-data caveat |
| Geocentric planetary coordinates | 35 comparisons against NASA/JPL Horizons; maximum 0.003063831° (11.03 arcsec) | B — temporary development implementation |
| Mean Rahu / derived Ketu | Correct invariant implementation | B — temporary until Swiss cross-validation |
| Precision / normalization | Full JavaScript double precision; no rounding in the calculation pipeline | A — production-ready policy/implementation |
| Lahiri / Chitrapaksha conversion | Unsourced linear approximation; not Swiss Lahiri mode | C — requires Swiss Ephemeris validation |
| Swiss production provider | Intentionally license-gated and unimplemented | C — requires Swiss Ephemeris validation and commercial-license completion |
| Historical civil-time source | Uses host ICU/IANA timezone data without a pinned tzdata release | D — requires architectural change for reproducible long-term historical results |

## Lahiri / Chitrapaksha audit

The current provider calculates sidereal longitude as:

```
sidereal = normalize(apparent geocentric true-ecliptic-of-date longitude - A)
A = 22.46047222222222° + (decimalYear - 1900) × 50.2564 arcsec/year
```

The reference epoch is **1900.0**, inferred directly from the code. `decimalYear` is computed from UTC calendar-year duration. The formula's source, derivation, and intended precession model are **not documented in the repository or dependency**. It is a linear precession approximation only; it does not model the full precession-nutation transformation used by Swiss Ephemeris.

Astronomy Engine produces **apparent geocentric true ecliptic-of-date** coordinates: its ecliptic conversion includes precession and nutation. The provider then subtracts a scalar ayanamsha, so the output mixes a true-of-date longitude with an ayanamsha approximation whose mean/true reference treatment has not been established. Therefore it cannot be claimed to match Swiss Ephemeris `SE_SIDM_LAHIRI` / standard Lahiri mode. This is the principal Layer 1 discrepancy.

Swiss Ephemeris documents a native sidereal mode mechanism and Lahiri mode constants; it must become the authoritative implementation after commercial licensing. See the [Swiss Ephemeris programming documentation](https://www.astro.com/ftp/swisseph/doc/swephprg.2.10.htm).

## Independent planetary-longitude comparison

Reference: NASA/JPL Horizons, observer-centered geocentric **apparent ecliptic-of-date** longitude (quantity 31), airless, UTC, for five historical instants. Horizons describes this quantity as IAU76/80 ecliptic-of-date with light-time, gravitational deflection, and stellar aberration. Its documented plane is **mean** ecliptic-of-date, whereas Astronomy Engine uses **true** ecliptic-of-date; the differences below therefore include this frame/nutation mismatch. [Horizons quantity 31 documentation](https://ssd.jpl.nasa.gov/horizons/manual.html)

| Body | Maximum difference (degrees) | Maximum difference (arcsec) |
| --- | ---: | ---: |
| Sun | 0.000161682 | 0.582 |
| Moon | 0.000385095 | 1.386 |
| Mars | 0.001816309 | 6.539 |
| Mercury | 0.001324201 | 4.767 |
| Jupiter | 0.001198481 | 4.314 |
| Venus | 0.000735328 | 2.647 |
| Saturn | 0.003063831 | 11.030 |

The audited instants were 1975-06-15T12:00Z, 1988-11-22T03:00Z, 1990-08-15T09:00Z, 2001-01-01T00:00Z, and 2015-09-21T18:00Z. The reproducible, read-only query is `npm run audit:horizons`.

## Rahu / Ketu

Rahu is calculated from the mean ascending lunar node polynomial and converted using the same interim scalar ayanamsha. Ketu is `normalize(Rahu + 180)`. The tests establish the exact opposition invariant, `[0, 360)` normalization, and retrograde motion convention. The code marks both nodes retrograde; Rahu's sampled longitude speed is negative. Node ephemeris accuracy and the exact mean-node convention still require Swiss Ephemeris cross-validation before production.

## Time and coordinate audit

- Local time is parsed strictly, an IANA zone is required, and a unique UTC instant is resolved.
- DST spring gaps and autumn overlaps are rejected instead of guessed.
- UTC and Asia/Kolkata equivalent civil times resolve to the same instant.
- A 1900 Asia/Kolkata fixture resolves through the current runtime timezone database to `1900-01-01T06:38:50.000Z`. This proves the code handles second-level historical offsets, but is not a guarantee across OS/Node/ICU tzdata versions.
- Latitude/longitude are correctly validated and retained as WGS84 provenance but do not change geocentric positions. They will be relevant for a future topocentric option and any Ascendant/house work; neither is in Layer 1.

## Precision audit

All values remain JavaScript IEEE-754 doubles. Longitude is only normalized at the seam; no display rounding exists in the calculation code, and no formatted value is reused as an input. Display formatting remains a consumer responsibility.

## Regression coverage added by this audit

The suite now explicitly covers interim Lahiri conversion, historical timezone data, geocentric location invariance, alongside the existing wraparound, node opposition, retrograde, DST, UTC/non-UTC conversion, historical input, and angular-boundary tests.

## Required remediation before production Layer 1 approval

1. Procure and record the Swiss Ephemeris Professional License.
2. Implement the licensed provider behind the existing interface, using its native Lahiri mode.
3. Pin provider, ephemeris-data, and tzdata versions; add Swiss reference fixtures for all bodies and nodes.
4. Define the longitude coordinate-frame contract consistently (mean vs true ecliptic-of-date) and verify it against Swiss output.
