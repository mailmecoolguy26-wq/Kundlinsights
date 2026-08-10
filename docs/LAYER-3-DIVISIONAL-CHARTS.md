# Layer 3: Divisional Charts (Varga)

## Scope

Layer 3 is a pure, deterministic Vedic/Jyotish Varga engine. It converts a
canonical sidereal longitude into a divisional-chart placement. It consumes
`siderealLongitudeDegrees` already produced by Layer 1 or the corresponding
normalized value classified by Layer 2. It never calculates an ayanamsha,
observes an ephemeris provider, accepts a tropical longitude, rounds a value,
or performs interpretation.

The initial ruleset implements only D1/Rashi, D9/Navamsha, and D10/Dashamsha.
The architecture permits later, separately documented rulesets for D2, D3,
D4, D7, D12, D16, D20, D24, D27, D30, D40, D45, and D60. D30 must use an
irregular-range strategy rather than an equal-division assumption.

## Contract and precision

The input is a finite canonical sidereal longitude. It is normalized to the
half-open range `[0°, 360°)`; `360°` is therefore `0°`. Natal Rashis and
subdivisions are also half-open intervals: an exact boundary belongs to the
following interval. JavaScript floating-point values are preserved without
rounding.

The result records two distinct forms of provenance:

- **Classical mapping provenance** identifies the rule that assigns a selected
  subdivision to a resulting Rashi.
- **Engine coordinate provenance** identifies KundlInsights' representation of
  a precise position within that already-selected resulting Rashi.

The engine-coordinate rule is:

```
degreesWithinResultingRashi =
  (degreesWithinNatalRashi - subdivisionStartDegreesWithinNatalRashi) × divisor
```

This maps the relative position inside a selected equal subdivision onto the
resulting Rashi's `[0°, 30°)` coordinate range. It is a KundlInsights engine
coordinate convention; it is not attributed to BPHS as a classical mapping
rule.

## Classical mappings in the initial ruleset

### D1 / Rashi

D1 is the identity transform: one 30° subdivision maps to its natal Rashi and
retains the natal-Rashi degree. BPHS lists `kshetra` (sign/Rashi) among the
Vargas in Chapter 6, verse 3.

### D9 / Navamsha

Each Rashi has nine equal subdivisions of `30 / 9 = 3°20′`.

- Movable Rashis (Mesha, Karka, Tula, Makara) start from themselves.
- Fixed Rashis (Vrishabha, Simha, Vrishchika, Kumbha) start from their ninth
  Rashi, counted inclusively.
- Dual Rashis (Mithuna, Kanya, Dhanu, Meena) start from their fifth Rashi,
  counted inclusively.
- Each following subdivision advances one Rashi in normal zodiacal order.

This is the mapping rule stated in *Brihat Parashara Hora Shastra*, Chapter 6,
verse 12. Source: https://enjoylearningsanskrit.com/scriptures/parashara/chapter-6/verse-12/

### D10 / Dashamsha

Each Rashi has ten equal subdivisions of `30 / 10 = 3°`.

- Odd Rashis start from themselves.
- Even Rashis start from their ninth Rashi, counted inclusively.
- Each following subdivision advances one Rashi in normal zodiacal order.

This is the Rashi mapping stated in *Brihat Parashara Hora Shastra*, Chapter
6, verse 13. Verse 14 reverses the directional-deity ordering for even signs;
that separate deity assignment is not returned by this initial Rashi-placement
API and is not treated as a reversal of the Rashi sequence. Sources:
https://enjoylearningsanskrit.com/scriptures/parashara/chapter-6/ and
https://enjoylearningsanskrit.com/scriptures/parashara/chapter-6/verse-12/

## Extensibility

`reference-data.js` declares each Varga's divisor, strategy identifier,
selector data, and classical provenance. The engine dispatches by strategy:

- `identity` for D1;
- `equal-by-sign-modality` for D9;
- `equal-by-sign-parity` for D10;
- future `equal-sequential`, `explicit-part-table`, and
  `irregular-range-table` strategies.

No later Varga may be added by assuming that D1, D9, or D10's mapping applies
to it. Its own sourced reference definition is required.
