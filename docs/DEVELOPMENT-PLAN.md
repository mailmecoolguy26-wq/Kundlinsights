# Development Plan

## Delivery principle

Complete and validate each layer’s contracts before building dependent features. Calculation correctness takes priority over UX, interpretation, and monetization speed.

## Phased plan

| Layer | Scope | Exit criteria |
| --- | --- | --- |
| 1 | Astronomical calculation engine | Deterministic sidereal planetary positions with time/location provenance and approved reference tests. |
| 2 | D1 / Rashi + Nakshatra | D1 signs, degrees, nakshatras, and padas derived from Layer 1 and regression-tested. |
| 3 | Divisional charts | Selected Varga charts derived through documented Vedic rules and validated fixtures. |
| 4 | Vimshottari MD → AD → PD | Exact dasha boundaries from Moon nakshatra balance, with boundary tests. |
| 5 | Vedic Gochar / transit | Vedic transit facts and Drishti evaluated against natal charts. |
| 6 | SAV/BAV | Per-graha BAV and aggregate SAV outputs, traceable to rule tables. |
| 7 | Historical event backtesting | Secure event ingestion and reproducible comparison reports. |
| 8 | Personal event signature | Explainable, evidence-scored personal correlations. |
| 9 | Future event prediction | Forecasts with confidence, timing windows, and factor provenance. |
| 10 | AI interpretation and Kundli Q&A | Grounded explanations sourced only from structured Vedic facts. |
| 11 | Mobile application | Production iOS and Android workflows, privacy controls, and observability. |
| 12 | Payments/subscription/entitlement | Platform-compliant entitlement management separated from domain calculations. |

## Layer 1 readiness checklist

Before implementation begins, decide and document:

- calculation runtime/language and deployment boundary;
- ephemeris provider/library and licensing model;
- supported grahas, nodes, and reference objects;
- birth-location geocoding and IANA time-zone resolution strategy;
- historical time-zone ambiguity and invalid-local-time policy;
- coordinate, time, and output precision policy;
- authoritative reference charts for regression testing; and
- data privacy, retention, and encryption requirements for birth information.

## Quality gates for every layer

- documented inputs, outputs, assumptions, and versioning;
- unit tests, reference fixtures, and boundary-condition tests;
- deterministic reruns of the same versioned inputs;
- review against `ASTROLOGY-STANDARDS.md`; and
- no introduction of excluded Western concepts.

## Not in scope yet

No calculations, ephemeris integration, chart rendering, interpretation, mobile screens, user accounts, or billing implementation is included in this repository foundation.
