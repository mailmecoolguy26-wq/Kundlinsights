# Architecture

## Purpose

KundlInsights will be a layered Vedic/Jyotish system. Each layer consumes stable, versioned outputs from the layer below it. The calculation core must remain deterministic, independently testable, and separate from interpretation, UI, and subscription concerns.

## Logical architecture

```
Mobile applications
        |
Application API / orchestration
        |
Interpretation, Q&A, prediction, and event services
        |
Vedic domain engines
        |
Astronomical calculation engine
        |
Ephemeris and time/location reference data
```

## Layer boundaries

1. **Astronomical calculation engine** — normalizes birth/transit input and produces provider-tagged canonical sidereal coordinates for planets, nodes, and Ascendant.
2. **Jyotish coordinate system** — pure classification of Layer 1 `siderealLongitudeDegrees` into Rashi, Nakshatra, lord, and Pada facts. It does not calculate houses or interpretations.
3. **Divisional charts** — derives Varga charts from canonical sidereal longitudes using explicit Vedic rules.
4. **Vimshottari dasha** — derives MD → AD → PD timelines from the Moon’s nakshatra position.
5. **Planetary dignity and state** — derives provider-independent dignities, Maitri, combustion, and motion facts from canonical sidereal coordinates.
6. **Parashari Graha Drishti** — derives directional, full positional D1 aspect facts from canonical sidereal Rashis.
7. **Core yoga detection** — evaluates versioned D1 yoga predicates from precomputed houses and planetary-state facts, without interpretation.
8. **Panchanga and lunar state** — derives pure instantaneous Tithi, Paksha, lunar-state, Karana, and Nitya Yoga facts from canonical Sun/Moon coordinates.
9. **Gochar transit foundation** — evaluates provider-independent transit snapshot relationships against natal D1 facts without interpretation or event scanning.
10. **Transit event scanner** — detects factual state transitions across time from Layer 1 and Layer 9 snapshots.
11. **Ashtakavarga foundation, Shodhana, and Pinda** — Layer 11A derives immutable raw seven-planet BAV/SAV and separate Lagna BAV solely from natal D1 Rashi facts. Layer 11B applies immutable Trikona then Ekapadhipatya Shodhana to every BAV, including Lagna; raw SAV remains untouched. Layer 11C calculates versioned Rashi, Graha, and total/Yoga Pinda for seven planetary Shodhita BAVs only.
12. **Evidence synthesis foundation** — Layer 12A provides generic immutable natal evidence nodes, edges, neutral missing-data records, traceable derived relationships, and adapters for existing Layer 2–11 facts. Layer 12B adds an immutable Career-only overlay; Layer 12C adds supplied temporal activation; Layer 12D analyzes root lineage, overlap, evidence families, mechanism families, and contradictions without recalculation, scoring, interpretation, or prediction.
13. **Interpretation infrastructure** — Layer 13A provides controlled structured conclusions, test-only rule-registry infrastructure, Layer 12D traceability consumption, and renderer input contracts. It has no substantive Career rules or natural-language generation.
13B1. **Natal Career structural conclusions** — fixed allowlisted rules expose only H10 scope, H10-lord connection, and supplied H10-occupant connection; no outcome, temporal, D10, or rendering interpretation is included.
13B2. **Career Dasha activation** — fixed allowlisted neutral Dasha activation context preserves supplied MD/AD/PD hierarchy as one mechanism family.
11. **Historical event backtesting** — compares calculated cycles and transits with user-supplied dated events.
12. **Personal event signature** — identifies repeatable chart and timing correlations for one person.
13. **Future event prediction** — produces evidence-linked, uncertainty-aware forecasts from lower-layer facts.
14. **AI interpretation and Kundli Q&A** — converts only structured, traceable Vedic facts into user-facing explanations.
15. **Mobile application** — delivers the experience on iOS and Android.
16. **Payments, subscriptions, and entitlements** — manages access independently of astrology calculations.

## Core design rules

- A calculation result is immutable and includes the standard/version used to create it. Tropical provider coordinates and sidereal transformations are separate, explicitly named values.
- Domain engines return structured facts and provenance; they do not generate prose or call AI models.
- Interpretation receives structured facts only and must cite their calculation provenance internally.
- Time, place, time-zone resolution, coordinate precision, ephemeris version, and ayanamsha are first-class calculation inputs.
- All sidereal values use the Lahiri / Chitrapaksha ayanamsha unless a future explicitly versioned standard says otherwise. Temporary calculations are explicitly `PROVISIONAL`; Swiss Ephemeris `SE_SIDM_LAHIRI` is the intended production authority.
- The provider boundary is explicit: Birth Input → Astronomical Provider → Canonical Sidereal Coordinates → Layer 2 Jyotish Classification → Layer 3 Vargas. Layers 2 and 3 consume only canonical sidereal longitude and are never provider-aware.
- No Western astrology abstractions are introduced as defaults, compatibility modes, or fallback logic.
- Pure calculations are deterministic and tested against approved reference charts and edge cases.
- User identity, billing, and sensitive birth data are kept outside reusable calculation primitives.

## Initial physical structure

```
src/
  astronomy/  Layer 1 provider-neutral astronomical calculation engine
  jyotish/    Layer 2 pure sidereal longitude classification
tests/
  astronomy/  Layer 1 deterministic and boundary-condition tests
docs/
  ARCHITECTURE.md
  ASTROLOGY-STANDARDS.md
  DEVELOPMENT-PLAN.md
```

The source directory is intentionally unopinionated until the team selects the mobile, backend, and calculation-runtime technology stack.
