# TaraVerse generalized Career-factor and Gochar activation engine

Status: **Phase 2G internal/backtest contract. Future Career projection is
disabled.** This owner-approved architecture does not revise Phase 2F’s source
audit: the transit aspect mechanics are source-backed, while the composition
gate below is an `OWNER_APPROVED_TARAVERSE_V1_RULE`. It is not wired to Career
Readings, Career Chat, mobile UI, payment, or any production prediction.

## Locked V1 evidence hierarchy

```text
D1 Career structure
  -> Career-active MD/AD/PD
  -> Jupiter/Saturn activation of chart-specific Career factors
  -> D10 confirmation/refinement
  -> Moon-relative support
  -> SAV/BAV factual support
  -> historical structural recurrence personalization
```

Only the first three terms can form an internal candidate window. D10, Moon,
SAV/BAV, and recurrence may reinforce an already eligible candidate; none can
create one. No term labels a Career event, outcome, probability, confidence,
or guarantee.

## Deterministic contracts

`resolveCareerNatalFactors()` accepts canonical D1 rashi houses and derives:

- D1 H10 sign and its canonical lord;
- the lord’s natal sign and house;
- H10 occupants and full aspectors;
- H10-lord same-sign connections and full aspectors; and
- a finite, traceable set of relevant planets/signs.

The resolver uses the chart’s H10 lord. Jupiter and Saturn are not universal
natal Career owners: the canonical fixtures demonstrate Sagittarius/Jupiter,
Gemini/Mercury, Aries/Mars, and Capricorn/Saturn.

`evaluateCareerDashaActivation()` only retains MD, AD, or PD lords already in
that chart’s `CareerNatalFactors` set. An otherwise unrelated Mercury, Jupiter,
or Saturn period therefore cannot become Career-active by planet name alone.

`evaluateCareerGocharActivations()` requires both independently supplied D1
Career relevance and a Career-active Dasha. It uses supplied bounded transit
intervals to record only occupancy, existing full-sign Drishti, or same-sign
association with one of these dynamic targets:

1. D1 H10 sign;
2. natal D1 H10 lord; and
3. other approved Career-relevant natal planets.

The output keeps the natal target and transit planet separate. For example,
`Saturn -> Mercury` can mean transiting Saturn activates a Mercury H10 lord; it
never re-labels Saturn as the natal Career lord.

## Transit roles and internal eligibility

`Jupiter` and `Saturn` are the owner-approved **major-window transit planets**
because their supplied state intervals provide broad context. `Rahu`/`Ketu`
remain review-only; Sun, Mars, Mercury, and Venus are stored as short factual
context; Moon is fast secondary context. None of those classifications changes
natal ownership.

```text
CareerTimingEligible
  = D1CareerRelevance
  AND CareerDashaActivation
  AND (Jupiter OR Saturn activates a chart-specific target)
```

An overlapping Jupiter and Saturn activation produces
`STRONG_CONVERGENCE_WINDOW`. More than one target activated by the same major
transit records `multiTargetActivation`. Neither fact conveys probability.

## Secondary support and recurrence

Moon support is secondary only: Jupiter from natal Moon 2/5/7/9/11; Saturn
from natal Moon 3/6/11. The current D10 contract remains refinement-only.
SAV/BAV remains factual support-only without a threshold. Historical
calibration compares structural relationships only after eligibility (active
Career Dasha, transit planet, dynamic target, activation type, Moon support,
D10 and SAV/BAV context); it never creates eligibility by itself.

## Internal scanner and backtest boundary

`scanCareerTimingWindows()` takes already-calculated Dasha and transit
intervals, clips them to an explicitly supplied horizon, and intersects each
Career-active Dasha interval with Jupiter/Saturn transit intervals. It does not
calculate ephemerides, infer transit events, or expose outputs. Its result
retains `integrationGate.enabled: false` and is suitable only for deterministic
fixtures/backtest review.

Current synthetic fixture coverage records one eligible observation and one
control date without a major target activation. That is architecture coverage,
not a historical accuracy claim. No confirmed historical cohort has yet been
run through this new owner-approved contract, so matched/missed event counts,
false-positive candidates, and window-coverage rates are **not yet measured**.

## Provenance and invariant

- `parashari-seven-graha-drishti-v1` supplies full-aspect geometry (Jupiter
  5/7/9; Saturn 3/7/10).
- Canonical rashi-house computation supplies the H10 lord and natal placement.
- The three-part timing gate, major-transit classification, and reinforcement
  hierarchy are `OWNER_APPROVED_TARAVERSE_V1_RULE` decisions.

```text
NO D1 RELEVANCE + GOCHAR = NO WINDOW
NO CAREER DASHA + GOCHAR = NO WINDOW
CAREER DASHA + NO JUPITER/SATURN TARGET = NO V1 WINDOW
D10 ONLY = NO WINDOW
SAV/BAV ONLY = NO WINDOW
HISTORICAL MATCH ONLY = NO WINDOW
FUTURE CAREER PROJECTION: DISABLED
```
