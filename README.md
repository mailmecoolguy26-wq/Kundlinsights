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

Layers 1–6 are implemented. Layer 6 is the D1-only, provider-independent full positional Graha Drishti engine documented in [LAYER-6-PARASHARI-GRAHA-DRISHTI.md](docs/LAYER-6-PARASHARI-GRAHA-DRISHTI.md). Layer 2 remains the pure Vedic sidereal coordinate classifier; Layer 1 remains a provisional provider-backed foundation with its licensing gate and contract documented in [EPHEMERIS-DECISION.md](docs/EPHEMERIS-DECISION.md) and [LAYER-1-ASTRONOMICAL-ENGINE.md](docs/LAYER-1-ASTRONOMICAL-ENGINE.md).

See [ARCHITECTURE.md](docs/ARCHITECTURE.md), [ASTROLOGY-STANDARDS.md](docs/ASTROLOGY-STANDARDS.md), and [DEVELOPMENT-PLAN.md](docs/DEVELOPMENT-PLAN.md).
