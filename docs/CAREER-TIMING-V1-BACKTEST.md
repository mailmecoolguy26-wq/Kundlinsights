# TaraVerse Career Timing V1 backtest

Status: **Phase 2H — insufficient historical data for a methodology verdict.**
This is an internal audit artifact. Future Career projection remains disabled.

## Methodology

The backtest consumes only profile-scoped Career-event observations plus
already-calculated canonical D1 houses, Dasha intervals, and transit intervals.
Each `OFFER`, `JOINING`, or legacy `EVENT_DATE` is evaluated independently in a
bounded `[event - 90 days, event + 90 days)` scan. No title, note, free text,
or event outcome interpretation is used.

An event is `EXACT_MATCH` when its instant is in an eligible internal window;
`NEAR_MATCH` within 30 days of a boundary; `WEAK_NEAR_MATCH` within 31–60 days;
otherwise `MISS`. A transition is matched when at least one of its
observations is exact or near. These thresholds are fixed for this audit.

Candidate eligibility remains Phase 2G only: D1 relevance + chart-specific
Career Dasha + Jupiter/Saturn target activation. D10, Moon, SAV/BAV, and
recurrence cannot rescue a miss or create eligibility.

## Cohort and privacy boundary

No real owned Career-event cohort, complete historical Dasha intervals, or
180-day historical Jupiter/Saturn interval feed is checked into this repository.
The backtest runner deliberately does not read a database or bypass ownership.
Therefore no profile-level or aggregate production-history result is published
here. This avoids embedding user-entered dates or personal Career history in
source control.

| Measure | Result |
| --- | ---: |
| Historical profiles evaluated | 0 |
| Confirmed transitions | 0 |
| Historical observations | 0 |
| Exact / near / weak / miss | 0 / 0 / 0 / 0 |
| Controls | 0 |
| Control false positives | 0 |
| Coverage density | Not measurable |

## Deterministic contract fixtures

The automated fixture is intentionally non-personal and proves mechanics only:

- one transition with separate `OFFER` and `JOINING` observations;
- a second transition with a separate observation;
- supplied Career-active Dasha and Jupiter/H10 intervals at observation dates;
- a deterministic midpoint control at least 120 days from known observations.

Result: 3/3 exact fixture observations, 2/2 matched fixture transitions, 0/1
fixture control false positives. This is **not** evidence of real-world
accuracy, a calibration result, or a launch criterion.

## Control, density, and rule audit

For a supplied profile, controls are only midpoint dates between observations
where each side is at least 120 days away. The runner records candidate windows
in controls, total coverage density, and frequency/duration for H10 sign,
H10 lord, Jupiter, Saturn, dual activation, and multi-target activation.

The repository has no owned feed to populate these metrics. Consequently the
most/least discriminative rule, event/control rate, average duration, Dasha
granularity comparison, Gochar granularity comparison, and strong-convergence
event/control performance are **unmeasured**.

## Recurrence

The first pass always supplies `historicalRecurrence: null`. The runner can
later identify which already-eligible windows would be reinforced by a
separately supplied structural recurrence result, but recurrence never affects
primary eligibility and never turns a miss into a match.

## Required next controlled run

Run the internal adapter with a consented, profile-scoped cohort and complete
precomputed historical Dasha/Jupiter/Saturn intervals. Retain only safe
identifiers or aggregate results in any future checked-in artifact. Before any
methodology change, report: match counts, missed observations, control windows,
coverage density, rule frequency, Dasha/Gochar granularity, and convergence
rates. Do not tune predicates silently.

**FUTURE CAREER PROJECTION: DISABLED**
