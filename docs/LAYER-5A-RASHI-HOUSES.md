# Layer 5A — Parashari Rashi Houses

Layer 5A provides the deterministic default house foundation, `parashari-rashi-house-v1`. It is a D1-only, provider-independent coordinate-to-house transformation. It consumes canonical sidereal Ascendant and body longitudes; it does not calculate positions, Ascendant, ayanamsha, or astronomical angles.

## Rashi, house, and Bhava

A Rashi is a fixed 30° sidereal sign. Under this ruleset, the Rashi containing the Ascendant is House 1 and subsequent Rashis are Houses 2 through 12 in zodiacal order. The result keeps `rashiHouseNumber` and `bhavaNumber` separately even though they are equal in Layer 5A. Future degree-based rulesets can make them differ.

This is the current default because it is deterministic, needs only the existing canonical Ascendant, and follows Lagna/Rashi counting. It is not represented as the only possible classical Bhava interpretation. The Layer 5A audit found that BPHS also acknowledges houses extending across two Rashis; degree-based Bhava construction remains a separately versioned future decision.

## Boundaries and lordship

Rashi intervals are half-open: Mesha is `[0°, 30°)`, through Meena `[330°, 360°)`. Canonical longitude is normalized to `[0°, 360°)`, so 360° is 0° and an exact sign boundary belongs to the new Rashi/house. Each house exposes the lord of its Rashi as `rashiHouseLord`.

`bhavaMadhyaLongitude` is `null`. A whole-sign beginning is not called a Bhava Madhya, and Layer 5A does not invent a Sripati Sandhi or a bare “cusp.”

## What never changes

An assignment adds house relationships only. It never changes a body's canonical sidereal longitude, Rashi, Nakshatra, Pada, D1, D2–D60 Varga coordinates, motion, speed, or provider provenance. Ascendant is represented separately as an `ascendant-angle`, not as a planetary occupant.

## Scope and future systems

Layer 5A applies only to D1. It does not calculate Bhava Chalit cusps for D9, D10, or other Vargas, and it does not reuse D1 houses in Vargas.

Future opt-in rulesets may include `equal-ascendant-start-v1`, `equal-ascendant-centered-v1`, and `sripati-madhya-quadrant-v1`. Sripati requires a provider-supplied canonical sidereal MC in addition to Ascendant. Layer 5 must not derive MC, RAMC, sidereal time, or horizon geometry itself.
