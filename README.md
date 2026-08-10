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

Layers 1–11C are implemented. Layer 11A calculates raw Parashari Ashtakavarga; Layer 11B applies Trikona and Ekapadhipatya Shodhana to individual BAVs; Layer 11C calculates versioned, non-interpretive Rashi, Graha, and total/Yoga Pinda from Shodhita planetary BAVs. See [LAYER-11A-ASHTAKAVARGA-FOUNDATION.md](docs/LAYER-11A-ASHTAKAVARGA-FOUNDATION.md), [LAYER-11B-ASHTAKAVARGA-SHODHANA.md](docs/LAYER-11B-ASHTAKAVARGA-SHODHANA.md), and [LAYER-11C-ASHTAKAVARGA-PINDA.md](docs/LAYER-11C-ASHTAKAVARGA-PINDA.md).

See [ARCHITECTURE.md](docs/ARCHITECTURE.md), [ASTROLOGY-STANDARDS.md](docs/ASTROLOGY-STANDARDS.md), and [DEVELOPMENT-PLAN.md](docs/DEVELOPMENT-PLAN.md).
