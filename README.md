# KundlInsights

KundlInsights is a production-grade iOS and Android application for **Vedic / Jyotish astrology**.

It is intentionally being built in layers, beginning with a deterministic astronomical calculation foundation and progressing through charting, dashas, transits, Ashtakavarga, event analysis, prediction, interpretation, mobile delivery, and subscriptions.

## Astrology commitment

KundlInsights uses only the following astrology standard:

- Vedic / Jyotish, with Parashari as the primary framework
- Sidereal zodiac using Lahiri / Chitrapaksha ayanamsha
- 27 Nakshatras, Vimshottari Dasha, Vedic Drishti, SAV/BAV Ashtakavarga, and Vedic divisional charts

It does not use tropical zodiac, Western house systems, Western aspects, or Western interpretation rules.

The authoritative technical and domain decisions are documented in [docs](docs/).

## Repository layout

```
docs/   Architecture, astrology standards, and phased delivery plan
src/    Application and domain source code (not implemented yet)
tests/  Automated test suites and reference fixtures (not implemented yet)
```

## Current status

Layers 1–11B are implemented. Layer 10 scans Layer 1/Layer 9 transit snapshots for factual state transitions with bounded refinement; Layer 11A calculates raw, sign-based Parashari Ashtakavarga; Layer 11B applies pure Trikona and Ekapadhipatya Shodhana to individual BAVs without modifying raw SAV or adding interpretation. See [LAYER-10-TRANSIT-EVENT-SCANNER.md](docs/LAYER-10-TRANSIT-EVENT-SCANNER.md), [LAYER-11A-ASHTAKAVARGA-FOUNDATION.md](docs/LAYER-11A-ASHTAKAVARGA-FOUNDATION.md), and [LAYER-11B-ASHTAKAVARGA-SHODHANA.md](docs/LAYER-11B-ASHTAKAVARGA-SHODHANA.md).

See [ARCHITECTURE.md](docs/ARCHITECTURE.md), [ASTROLOGY-STANDARDS.md](docs/ASTROLOGY-STANDARDS.md), and [DEVELOPMENT-PLAN.md](docs/DEVELOPMENT-PLAN.md).
