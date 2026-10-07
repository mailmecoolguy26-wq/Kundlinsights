# Job favourability multi-signal convergence research protocol

Status: **offline research only.** This protocol does not enable
`JOB_FAVOURABILITY_TIMING`, change Career Answers, create a customer period, or
authorize an employment, offer, joining, or date prediction.

## Objective

Evaluate whether factual, independently computed signals are more concentrated
around known employment-transition history than around other Career history or
deterministic no-known-event controls. A repeated association is a research
finding, not an astrology rule.

## Cohorts

Positive transition units are `FIRST_JOB`, `JOB_SWITCH`, and a stored
OFFER/JOINING transition. OFFER and JOINING may retain separate factual anchors
but are one evaluation unit.

Career-event controls are `PROMOTION`, `ROLE_CHANGE`, `SALARY_GROWTH`,
`BUSINESS_STARTED`, `CAREER_BREAKTHROUGH`, and `CAREER_SETBACK`. `JOB_LOSS` and
`TERMINATION` are context only. Temporal controls are deterministically chosen
only outside a 90-day exclusion zone around every known observation.

## Pre-registered horizons

`PRE_30`, `PRE_60`, `PRE_90`, `POST_30`, `SYMMETRIC_30`, `SYMMETRIC_60`, and
`SYMMETRIC_90` are all reported. DAY, MONTH, and YEAR source precision are
retained; no exact date is fabricated from a month or year.

## Feature roles

Rows are language-neutral factual records with astronomy provenance, MD/AD/PD,
D1 H10/H6-lord context, major-planet and node natal-house states, refined
transit events, D10 facts, Moon facts, SAV/BAV facts, generic Career-signal
state, and leakage-safe historical-recurrence state.

H6 is an employment/service semantic **research** context only. D10, Moon,
Ashtakavarga, recurrence, and Rahu/Ketu remain contextual/support dimensions.
Jupiter/Saturn transit facts remain provisional research dimensions. None can
create a Career or employment conclusion.

## Candidate registry

Discovery is limited to order-two, pre-registered interactions:

1. Career-linked Dasha × H6-lord Dasha context.
2. Career-linked Dasha × Jupiter/Saturn house context.
3. Generic Career signal × H6 context.
4. Career-linked Dasha × work-related transit-house context.

The registry is not an exhaustive search across arbitrary planets, houses, or
horizons. No composite astrology score is created.

## Leakage controls

- All units for a profile share one deterministic train/validation/holdout
  partition.
- Historical recurrence can reference only completed same-profile transitions
  strictly before the evaluated anchor.
- OFFER/JOINING is evaluated once as a transition unit.
- Free text, notes, identity, later outcomes, and future observations are never
  features.
- Candidate discovery and evaluation must use profile-disjoint partitions.

## Outputs and interpretation limits

Reports include raw numerator/denominator, prevalence, risk difference, odds
ratio, recall, false-positive rates, precision/recall versus the generic Career
baseline, PRE-vs-POST prevalence, density/duration, missingness, provenance,
and per-profile results.

The only allowed conclusion values are:

- `NO_DISCRIMINATIVE_PATTERN`
- `RESEARCH_SIGNAL_ONLY`
- `CANDIDATE_FOR_SOURCE_AUDIT_AND_REPLICATION`

The latter requires an explicit replication review flag; the runner does not
promote a candidate automatically. Private artifacts are written only under
`tmp/private-backtest/`, which is gitignored.

## Operational milestones

These are research-planning milestones, not production-validation guarantees:

| Stage | Employment-transition units | Profiles |
| --- | ---: | ---: |
| Feasibility | 30 | 15 |
| Preliminary research | 75 | 30 |
| Stronger replication target | 150 | 60+ |
