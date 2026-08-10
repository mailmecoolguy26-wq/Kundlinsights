# Layer 4 — Vimshottari Dasha

Layer 4 produces deterministic Vimshottari Mahadasha (MD), Antardasha (AD), and Pratyantardasha (PD) timelines. It consumes a canonical sidereal Moon longitude and Layer 2's Jyotish coordinate reference data. It does not know, or depend on, the astronomical provider that produced the longitude.

## Classical basis and computational ruleset

BPHS Chapters 46 and 51 provide the repeating nine-lord sequence, the 120-year weight total, the birth-balance relationship, and the proportional AD/PD arithmetic. BPHS describes birth balance through bhayata/bhabhoga: Moon's elapsed stay in the Janma Nakshatra relative to its total stay there. See [the Sanskrit Chapter 46 text](https://sanskritdocuments.org/doc_z_misc_sociology_astrology/par4650.pdf) and [an English BPHS edition, Chapters 46 and 51](https://vedic-astro.s3.amazonaws.com/books/bhrihat_parasara_hora_shastra.pdf).

The initial KundlInsights ruleset is `vimshottari-longitude-proportional-savana-360-v1`:

- `balanceMethodId`: `longitude-proportional-balance-v1`
- `timeConventionId`: `savana-360-day-v1`
- `sequenceVersion`: `vimshottari-120-v1`

`longitude-proportional-balance-v1` is a deterministic KundlInsights computational implementation derived from the Moon's canonical sidereal longitude within its Janma Nakshatra. It is **not** represented as an exact transcription of BPHS bhayata/bhabhoga transit-time calculation.

The future, unimplemented `bphs-transit-time-bhayat-v1` ruleset will require provenance-bearing Moon Nakshatra entry/exit transit data supplied upstream. The future, unimplemented `phaladeepika-solar-return-v1` ruleset will require a provider-independent solar-return calendar schedule supplied to Layer 4. Neither is implemented here.

## Sequence and Nakshatra mapping

The sequence is Ketu (7), Venus (20), Sun (6), Moon (10), Mars (7), Rahu (18), Jupiter (16), Saturn (19), Mercury (17): 120 Vimshottari years in total. The 27 Nakshatras reuse the Layer 2 definitions and their repeating nine-lord mapping; Layer 4 does not duplicate another Nakshatra catalogue.

## Birth balance and boundaries

For the initial balance method:

```text
elapsedRatio = degreesWithinNakshatra / (360 / 27)
remainingRatio = 1 - elapsedRatio
remainingMD = lordYears × remainingRatio
```

Layer 2 normalizes canonical longitude to `[0°, 360°)` and applies half-open Nakshatra intervals `[start, end)`. Thus `360°` is `0°`; an exact Nakshatra boundary belongs to the next Nakshatra and receives its full MD balance. No longitude is rounded before classification or balance calculation.

## MD, AD, and PD arithmetic

For lord weights `Yx`, `Yy`, and `Yz`:

```text
MD(X)       = Yx
AD(X, Y)    = Yx × Yy / 120
PD(X, Y, Z) = Yx × Yy × Yz / 120²
```

An MD's AD order starts with its own lord and continues cyclically. An AD's PD order starts with the AD lord and continues cyclically.

Duration relationships are exposed as exact rational `durationExact` metadata. For timestamps, `savana-360-day-v1` means exactly 360 × 24-hour civil days per Vimshottari year. Boundaries use integer milliseconds. Each child group is partitioned from cumulative integer boundaries and its final child's end is forced to the parent end; there are no gaps, overlaps, or cumulative rounding drift.

## Provenance and scope

Every result exposes its ruleset and identifies the longitude-proportional and 360-day conventions. Layer 4 has no imports of Layer 1 providers, Astronomy Engine, Swiss Ephemeris, or provider-specific provenance. It does not calculate Moon entries/exits, solar returns, houses, predictions, interpretations, Sookshma/Prana periods, or other Dasha systems.
