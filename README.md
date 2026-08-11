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

Layers 1–13C2 are implemented. Layer 5C adds provider-independent factual natal same-Rashi Graha associations, without asserting a classical conjunction equivalence. Layer 12B3 adds audited, factual Career-status predicate evidence for narrowly scoped H9 and Saturn/Venus relationships. Layer 13C2 evaluates exactly one traceable BPHS Venus-Mahadasha/Saturn-Antardasha classical predicate; `SUPPORTED` means predicate satisfaction, never a guaranteed professional outcome. H10 honour remains unavailable because no source-audited Parashari yuti adapter exists. See [LAYER-5C-GRAHA-ASSOCIATION.md](docs/LAYER-5C-GRAHA-ASSOCIATION.md), [LAYER-12B3-CAREER-STATUS-PREDICATE-EVIDENCE.md](docs/LAYER-12B3-CAREER-STATUS-PREDICATE-EVIDENCE.md), and [LAYER-13C2-CLASSICAL-CAREER-EVENT-PREDICATES.md](docs/LAYER-13C2-CLASSICAL-CAREER-EVENT-PREDICATES.md).

See [ARCHITECTURE.md](docs/ARCHITECTURE.md), [ASTROLOGY-STANDARDS.md](docs/ASTROLOGY-STANDARDS.md), and [DEVELOPMENT-PLAN.md](docs/DEVELOPMENT-PLAN.md).
