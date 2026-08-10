# Astrology Standards

## Scope

This document is the normative domain standard for KundlInsights. It applies to every calculation, stored result, test fixture, interpretation, and user-facing explanation.

## Required standard

| Domain | KundlInsights standard |
| --- | --- |
| Tradition | Vedic / Jyotish |
| Primary framework | Parashari |
| Zodiac | Sidereal |
| Ayanamsha | Lahiri / Chitrapaksha |
| Lunar mansions | 27 Nakshatras |
| Dasha | Vimshottari Dasha |
| Aspects | Vedic Drishti |
| Ashtakavarga | SAV/BAV |
| Charts | Vedic divisional (Varga) charts |
| Lunar nodes | Mean ascending node for Rahu; derived descending node for Ketu |

## Explicit exclusions

The system must not calculate, display, infer from, or fall back to:

- Tropical zodiac
- Western astrology
- Western house systems
- Western aspects
- Western interpretation rules

## Canonical calculation contract

Every astrology calculation must record or be reproducible from:

- input instant, including original local time and resolved time zone
- birth or transit coordinates and location source/precision
- time-standard handling (UTC and any relevant astronomical time conversion)
- ephemeris and reference-data version
- sidereal conversion and Lahiri / Chitrapaksha ayanamsha version/value
- calculation-engine and ruleset version

Longitudes are represented at full precision internally. Display rounding is a presentation concern and must never be reused as calculation input.

## Longitude and sidereal contract

Layer 1 must expose raw provider coordinates as `tropicalLongitudeDegrees` and transformed values as `siderealLongitudeDegrees`; it must never expose an unqualified longitude field. The raw coordinate system, sidereal calculator, ayanamsha metadata, calculation instant, and approval status are mandatory provenance.

Astronomy Engine is a temporary development/reference provider. Its Lahiri transformation is marked `PROVISIONAL` with implementation `interim-linear`. The intended production authority is Swiss Ephemeris using native `SE_SIDM_LAHIRI`, enabled only after commercial-license approval.

## Lunar-node convention

Layer 1 uses the **mean lunar ascending node** as Rahu. Ketu is not independently calculated: it is exactly 180° opposite Rahu, normalized into the half-open range `[0°, 360°)`. This convention is deliberate and versioned; a future switch to true node is a standards change, not a presentation option.

## Precision and presentation

Calculation values are retained as IEEE 754 double-precision values from the provider through every downstream engine. A longitude is normalized only at the `0°/360°` seam and is otherwise never rounded by the calculation engine. User interfaces may format degrees to six decimal places by default; formatted values are display-only and must never become calculation inputs.

## Terminology

- **D1 / Rashi:** the natal or transit zodiacal chart derived from sidereal planetary positions.
- **Nakshatra:** one of the 27 equal lunar mansions; a pada is one of its four subdivisions.
- **Varga:** a Vedic divisional chart derived by a documented transformation of sidereal longitude.
- **Vimshottari:** the nakshatra-based dasha system producing Mahadasha, Antardasha, and Pratyantardasha timelines.
- **Vedic Drishti:** Parashari graha aspect rules; it is not a geometric Western aspect system.
- **BAV/SAV:** Bhinnashtakavarga and Sarvashtakavarga bindu calculations.

## Change control

Any change to a rule, reference table, ayanamsha implementation, or source of ephemeris data requires:

1. an explicit version increment;
2. documented rationale and migration impact;
3. reference-chart regression tests; and
4. a decision on whether historic user results remain pinned to their original ruleset.
