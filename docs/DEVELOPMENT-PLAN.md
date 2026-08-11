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
| 5A | Parashari Rashi houses | D1 whole-sign house assignments from canonical Ascendant and body coordinates. |
| 5B | Planetary dignity and state | Provider-independent dignity, Maitri, combustion, and preserved motion facts. |
| 5C | Graha association foundation | Factual natal same-Rashi Graha pairs with circular-distance metadata only; no orb, Graha Yuddha, interpretation, or classical conjunction equivalence. |
| 6 | Parashari Graha Drishti | D1-only seven-graha full positional aspect facts, independent of provider and house calculation. |
| 7 | Core yoga detection | Versioned D1 yoga detection from precomputed houses and planetary-state facts, with immutable evidence and no interpretation. |
| 8 | Panchanga and lunar state | Pure instantaneous Tithi, Paksha, lunar state, Karana, and Nitya Yoga from canonical Sun/Moon coordinates. |
| 9 | Gochar transit foundation | Provider-independent transit snapshot relationships against natal D1 facts, without interpretation or event scanning. |
| 10 | Transit event scanner | Detects factual transit state transitions through bounded Layer 1/Layer 9 snapshot scanning. |
| 11A | Raw Ashtakavarga foundation | Computes raw Rekha-based planetary BAV, separate Lagna BAV, and seven-planet raw SAV. |
| 11B | Ashtakavarga Shodhana | Applies immutable Trikona then Ekapadhipatya Shodhana to each BAV, including Lagna; raw SAV remains untouched. |
| 11C | Ashtakavarga Pinda | Calculates versioned Rashi, Graha, and total/Yoga Pinda from seven planetary Shodhita BAVs; Lagna and node Pinda remain deferred. |
| 12A | Generic evidence infrastructure | Builds a provider-independent immutable natal evidence graph from supplied upstream facts, with no domains, temporal activation, scoring, or interpretation. |
| 12B | Career domain evidence | Immutable source-audited, H10-primary Career evidence overlay over Layer 12A facts; no timing, scoring, or interpretation. |
| 12B2 | Expanded Career domain evidence | Static neutral H2 resource and H11 gains contexts, with supplied lord/occupant/state/Drishti facts and no H6, D10, or Ashtakavarga expansion. |
| 12B3 | Career-status predicate evidence | Audited factual H9 and Saturn/Venus source-predicate components only; no conclusion evaluation, timing combination, or inferred conjunction. |
| 12C | Temporal activation overlay | Immutable supplied Dasha, Gochar, and transit-event activation context over Layer 12A/12B static evidence, without prediction or scoring. |
| 12D | Evidence independence and consistency gate | Deterministic root-lineage, duplication, mechanism, and contradiction analysis over supplied Layer 12 evidence. |
| 13A | Interpretation infrastructure | Controlled conclusion, trace, test-only rule-registry, and renderer-input infrastructure; substantive source-audited rules deferred to 13B. |
| 13B1 | Natal Career structural conclusions | Fixed allowlisted H10, H10-lord, and H10-occupant structural conclusions only. |
| 13B2 | Career Dasha activation | Fixed allowlisted neutral activation context for active Dasha lords connected to Career evidence. |
| 13B3 | Career Gochar and timing context | Fixed allowlisted supplied Gochar and Layer 10 timing-context conclusions only. |
| 13B4 | Career temporal co-activation | Layer 12D-independent supplied Dasha plus Gochar/transit structural co-activation on the same Career subject; no event or outcome inference. |
| 13C2 | Classical Career event predicate | Evaluates only the audited Venus MD / Saturn AD source predicate from supplied Layer 12B3/12C/12D evidence; predicate satisfaction is not a guaranteed outcome. |
| 14A | Deterministic reading contract | Converts Layer 13 CAREER conclusions into ordered immutable renderer-safe items with controlled template keys and disclosures; no prose, LLM, or prediction. |
| 14B | Constrained deterministic renderer | Renders Layer 14A CAREER items as fixed `en-IN` template sentences with disclosure and status wording; no LLM, free-form generation, or new interpretation. |
| 15A | Career reading orchestrator | Composes existing Layer 12–14 public APIs into a deterministic CAREER reading from supplied precomputed natal and temporal evidence. |
| 11 | Historical event backtesting | Secure event ingestion and reproducible comparison reports. |
| 12 | Personal event signature | Explainable, evidence-scored personal correlations. |
| 13 | Future event prediction | Forecasts with confidence, timing windows, and factor provenance. |
| 14 | AI interpretation and Kundli Q&A | Grounded explanations sourced only from structured Vedic facts. |
| 15 | Mobile application | Production iOS and Android workflows, privacy controls, and observability. |
| 16 | Payments/subscription/entitlement | Platform-compliant entitlement management separated from domain calculations. |

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
# Layer 1P1

Swiss Ephemeris provider support is implemented behind the existing Layer 1 provider abstraction with native Lahiri, Mean Rahu/derived Ketu, fail-closed returned flags, a Swiss sidereal Ascendant, and manifest/license authority gates. Engineering validation is complete; commercial production activation remains license-gated.
