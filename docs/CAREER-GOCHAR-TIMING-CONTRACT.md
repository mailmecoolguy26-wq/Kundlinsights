# TaraVerse Career Gochar Timing Contract

Status: **Phase 2F research and owner-review contract. Not executable.** This
document uses only pinned/local repository material. It neither enables future
projection nor changes a reading, chat, payment, or mobile behaviour.

## Evidence boundaries

| Family | Role | May create a Career window now? |
| --- | --- | --- |
| D1 | Career promise/relevance | No — factual rulebook context only. |
| Dasha | Career activation | No — factual activation context only. |
| D10 | Confirmation/refinement | No. |
| Gochar | Manifestation/timing support | No approved Career-specific predicate exists. |
| SAV/BAV | Support only | No. |
| Historical recurrence | Profile-scoped personalization only | No. |

The source distinction is strict: a D1 Career-axis target is not interchangeable
with a house counted from natal Moon; a generic current Gochar event is not a
Career timing predicate.

## D1 Career-axis owner-review candidates

All entries require independently approved `SUPPORTED_D1_CAREER_RELEVANCE` and
`SUPPORTED_DASHA_CAREER_ACTIVATION`. Their role would be
`MANIFESTATION_SUPPORT`; none is currently source-backed as a Career timing
rule, so all are **REJECTED for production timing** pending a new audited source.

| ID | Exact geometry / existing engine fact | Source status | Window semantics | Owner decision |
| --- | --- | --- | --- | --- |
| `GOCHAR_D1_JUPITER_H10_OCCUPY` | Jupiter `transitNatalHouseNumber === 10`. | No local Career-specific source; local audit rejects natal H10 material as Gochar authority. | Whole-Rashi occupancy `[entry, exit)`; a retrograde re-entry is a separate interval. | REJECT |
| `GOCHAR_D1_JUPITER_H10_ASPECT` | Jupiter full 5th/7th/9th aspect targets D1 H10. | No local Career-specific source. | Existing sign/house Drishti state; no degree window is approved. | REJECT |
| `GOCHAR_D1_JUPITER_H10L_OCCUPY` | Jupiter occupies the natal D1 H10-lord's house/Rashi only after an owner selects one non-equivalent target. | No local source; same-Rashi and house occupancy are distinct geometries. | Selected whole-Rashi state only; no selection is approved. | REJECT |
| `GOCHAR_D1_JUPITER_H10L_ASPECT` | Jupiter full 5th/7th/9th aspect reaches the H10-lord body/house only after target form is selected. | No local Career-specific source. | Existing sign/house Drishti state only. | REJECT |
| `GOCHAR_D1_SATURN_H10_OCCUPY` | Saturn `transitNatalHouseNumber === 10`. | No local Career-specific source. | Whole-Rashi occupancy `[entry, exit)`; re-entry is separate. | REJECT |
| `GOCHAR_D1_SATURN_H10_ASPECT` | Saturn full 3rd/7th/10th aspect targets D1 H10. | No local Career-specific source. | Existing sign/house Drishti state only. | REJECT |
| `GOCHAR_D1_SATURN_H10L_OCCUPY` | Saturn occupies the natal D1 H10-lord's house/Rashi only after owner target selection. | No local source; target geometry is ambiguous. | Selected whole-Rashi state only. | REJECT |
| `GOCHAR_D1_SATURN_H10L_ASPECT` | Saturn full 3rd/7th/10th aspect reaches the H10-lord body/house only after target selection. | No local Career-specific source. | Existing sign/house Drishti state only. | REJECT |
| `GOCHAR_D1_JUPITER_SATURN_DUAL` | At least one independently approved Jupiter condition and one independently approved Saturn condition overlap. | No approved underlying D1-axis condition. | Intersection of approved bounded input intervals; no interval may be invented. | REJECT |
| `GOCHAR_DASHA_LORD_CAREER_ACTIVATION` | Active MD/AD/PD lord transits or aspects an approved D1 Career factor. | No local source defines this as a Career predicate. | Would require an owner-approved target and existing bounded relation state. | REJECT |

`parashari-seven-graha-drishti-v1` is the only aspect geometry listed above:
Jupiter 5th/7th/9th, Saturn 3rd/7th/10th, and nodes do not cast. It supplies
mechanics, not a Career timing meaning.

## Moon-relative material — separate classification

The local external audit is one reviewed translation and has no audited
Moon-relative interval adapter. These conditions cannot be substituted for D1
H10/H10-lord rules.

| Candidate | Local source | Classification | Reason |
| --- | --- | --- | --- |
| Jupiter tenth from natal Moon | Phala Deepika Ch. 26 v20, Kapoor transcript | `CONTEXT_ONLY` | Explicit occupancy but bundled non-Career outcomes; translation/product review remains required. |
| Saturn third from natal Moon | Phala Deepika Ch. 26 v23, Kapoor transcript | `CONTEXT_ONLY` | Employment wording exists but only one reviewed translation; no product conclusion is approved. |
| Saturn tenth from natal Moon | Phala Deepika Ch. 26 v23, Kapoor transcript | `REJECTED` | Honour/illness wording is high-risk and not an unambiguous Career rule. |
| Sun/Mars/Jupiter/Saturn tenth from natal Moon | Phala Deepika Ch. 26 v33, Kapoor transcript | `REJECTED` | Bundles high-stakes life/wealth/status claims and overlaps individual conditions. |

No Moon-relative candidate is `PRIMARY_TIMING_SUPPORT` or
`SECONDARY_TIMING_SUPPORT` in this phase.

## Generic Gochar context and co-activation

`career-gochar-structural-connection-v1` and
`career-transit-event-timing-context-v1` remain factual current/point-event
context only. They do not provide the missing Career-specific planet, target,
relation, or sustained-window predicate.

The existing `career-temporal-coactivation-v1` contract can produce
`careerTemporalCoactivation: true` only when a supplied Dasha mechanism and a
supplied Gochar snapshot or Layer 10 event independently activate the same
Career subject, the Layer 12D relation is `INDEPENDENT`, and the Gochar/event
instant lies in every retained Dasha `[start, end)` interval. It means only:
“Career activation and timing support are simultaneously present.” It does not
mean a job change is guaranteed, does not increase strength, and creates no
window. Jupiter/Saturn simultaneity has no strength/ranking effect.

## Historical-fixture view

| Fixture | D1/Dasha rulebook state | D1-axis Jupiter/Saturn conditions | Moon-relative conditions | Co-activation | Result |
| --- | --- | --- | --- | --- | --- |
| OFFER, 2024-02-01 | Factual snapshot only; no primary eligibility verdict. | A refined Jupiter ingress appears inside coverage, not a D1-axis predicate. | Not evaluated by an audited adapter. | No approved Dasha + Career-Gochar pair. | No Career window. |
| JOINING, 2024-02-02 | Separate factual observation. | Preceding ingress is outside next-day coverage. | Not evaluated by an audited adapter. | No approved pair. | No Career window. |
| Two synthetic PROMOTION fixtures | Repeated facts only. | Shared Jupiter/H10 pattern is recurrence, not a source-backed rule. | Not evaluated. | No approved pair. | No Career window. |

Historical coincidence is not universal validation.

## Proposed V1 dependency — disabled

```text
PRIMARY_CAREER_TIMING_ELIGIBILITY (future only)
  = approved D1 Career relevance
  AND approved Dasha Career activation
  AND at least one approved Career-specific Gochar manifestation condition

D10 = confirmation/refinement only
SAV/BAV = support only
Historical recurrence = personalization/ranking only
```

The first two terms have factual contracts. The third does not. Therefore this
logical dependency is a proposed architecture, not an executable V1 rule.

## Non-negotiable invariants

```text
GOCHAR WITHOUT D1 CAREER RELEVANCE = NO CAREER WINDOW
GOCHAR WITHOUT DASHA CAREER ACTIVATION = NO STRONG CAREER WINDOW
HIGH SAV/BAV WITHOUT PRIMARY ELIGIBILITY = NO CAREER WINDOW
HIGH HISTORICAL RECURRENCE WITHOUT PRIMARY ELIGIBILITY = NO CAREER WINDOW
D10 ALONE = NO CAREER WINDOW
FUTURE CAREER PROJECTION: DISABLED
```

## Remaining owner decisions

1. Supply an audited Career-specific D1-axis Gochar source with planet, target,
   relation, and allowed conclusion.
2. Choose H10-lord target geometry where a future source actually requires it.
3. Obtain a second established translation and product-language review before
   any Moon-relative rule advances beyond context-only.
4. Define a bounded consequence for a future approved Gochar predicate without
   introducing outcomes, probabilities, or negative D10 gates.
