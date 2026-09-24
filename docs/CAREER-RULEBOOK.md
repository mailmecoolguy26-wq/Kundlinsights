# TaraVerse Career Rulebook

Status: **Phase 2 deterministic contract.** This document records the
currently approved Career rules and the explicit gaps that prevent a future
Career-window engine from being enabled. It does not authorize prediction.

## Vocabulary and hierarchy

- **FACT**: a deterministic chart, Dasha, Gochar, or historical observation.
- **RULE**: an allowlisted predicate with a stable machine ID and provenance.
- **SUPPORT**: contextual evidence that cannot independently create eligibility.
- **INTERPRETATION**: bounded presentation of an already matched rule.
- **PREDICTION**: a future Career event/window claim. It is disabled.

Primary evidence families are D1, D10, Dasha, and Gochar. SAV/BAV is secondary
support only. Historical recurrence is profile-scoped personalization only.
Neither secondary support nor historical recurrence can create a Career window.

## Approved executable rules

| Rule ID | Family | Provenance | Exact predicate | May conclude | Cannot conclude |
| --- | --- | --- | --- | --- | --- |
| `career-h10-signification-scope-v1` | D1 structure | BPHS tenth-house significations | Supplied Career evidence records H10 scope. | H10 is factual Career context. | A Career event or timing. |
| `career-h10-lord-natal-connection-v1` | D1 structure | BPHS tenth-house lord relationship | Supplied Career evidence records the H10 lord relation. | A factual natal relation. | Activation, growth, loss, service, or business. |
| `career-h10-occupant-connection-v1` | D1 structure | BPHS tenth-house significations | Supplied Career evidence records an H10 occupant relation. | A factual natal relation. | An outcome or a timing window. |
| `career-h10-connected-dasha-activation-v1` | Dasha activation | Existing Layer 13B2 rule | An active MD/AD/PD is structurally linked to supplied H10 Career evidence. | A factual Dasha activation context. | That a Career event will manifest. |
| `career-gochar-structural-connection-v1` | Gochar context | Existing Layer 13B3 rule | A supplied Gochar snapshot is linked to supplied Career evidence. | A factual current Gochar connection. | Career manifestation or a future scan. |
| `career-transit-event-timing-context-v1` | Gochar context | Existing Layer 13B3 engine convention | A non-Sade-Sati Layer 10 event is structurally linked to supplied Career evidence. | A factual transit-event context. | A predicted event or window. |
| `career-temporal-coactivation-v1` | Dasha + Gochar context | Layer 13B4 independent-lineage policy | Independent supplied Dasha and Gochar/transit mechanisms activate the same Career subject at the supplied instant. | Factual co-activation. | A Career outcome, probability, or duration invented by the rule. |
| `career-venus-md-saturn-ad-professional-loss-predicate-v1` | Audited classical predicate | BPHS Chapter 60, Venus Dasha/Saturn Antardasha, verses 55–57 | One audited Saturn natal branch, Saturn AD within Venus MD, and half-open temporal containment are supplied. | Source-defined predicate satisfaction only. | Termination, unemployment, loss, likelihood, or a future forecast. |

All rules retain their existing source IDs and traceable evidence IDs. The
Venus-MD/Saturn-AD predicate remains narrow and unchanged; PD is optional
traceability context only.

## D10 confirmation/refinement contract

D1 establishes Career relevance/theme. D10 supplies only downstream factual
confirmation/refinement. The approved evidence contracts are
`D10_CONFIRM_PROPOSED_002` (D10 H10), `_003` (D10 H10 lord), and `_004`
(D10 Lagna/profile). `D10_CONFIRM_PROPOSED_001` is allowed only where an
independently established D1 structural-theme ID exactly matches the finite
Phase 2E registry; `_005` allows only `OWN_SIGN`, `EXALTED`, or `DEBILITATED`
facts for an already relevant D10 planet.

D10 remains incapable of independently creating Career eligibility, timing,
a future window, a score, probability, or a hard false gate. Its absence does
not reject a D1/Dasha/Gochar candidate. The contract is deliberately not wired
into the disabled future-projection integration.

## SAV/BAV contract

Raw D1 Ashtakavarga facts are secondary, contextual or fact-only evidence under
the Phase 16C policy. There is no approved Career threshold, ranking, transit
SAV/BAV predicate, or score. Therefore:

```text
NO_VALID_PRIMARY_CAREER_ACTIVATION + HIGH_SAV_BAV = NO_CAREER_WINDOW
```

## Gochar timing contract

The Phase 2F audit is pinned in `CAREER-GOCHAR-TIMING-CONTRACT.md`. Current
Gochar rules provide only factual structural/current-event context. No retained
source approves Jupiter or Saturn occupancy/aspect of D1 H10/H10 lord, an
active-Dasha-lord transit relation, or Jupiter/Saturn dual activation as a
Career timing predicate. Moon-relative conditions are separate: Jupiter H10
from Moon and Saturn H3 from Moon are `CONTEXT_ONLY`; Saturn H10 from Moon and
the four-planet H10-from-Moon condition are `REJECTED`.

```text
GOCHAR WITHOUT D1 CAREER RELEVANCE = NO CAREER WINDOW
GOCHAR WITHOUT DASHA CAREER ACTIVATION = NO STRONG CAREER WINDOW
```

`career-temporal-coactivation-v1` may retain independently supplied same-subject
Dasha and Gochar/event evidence at one instant. It does not establish a Career
outcome, increase strength, or create a time window.

## Historical recurrence contract

Historical recurrence is reconstructed only from confirmed, profile-scoped
Career observations. It may later describe resemblance to a period that is
already classically eligible. It cannot supply classical authority or create a
window itself:

```text
NO_PRIMARY_CLASSICAL_ELIGIBILITY + HIGH_HISTORICAL_MATCH = NO_STRONG_CAREER_WINDOW
```

## Proposed rules and rulebook gaps

| Proposed ID | Source | Why not executable | Required before approval |
| --- | --- | --- | --- |
| `proposed-d10-career-confirmation-v1` | D10 Career transcript audit | Practitioner transcript claims are research only; existing D10 data is factual. | A source-audited, product-approved, non-outcome D10 confirmation predicate. |
| `proposed-gochar-career-manifestation-v1` | Existing dependency audit | Current Gochar rule has no approved Career-specific planet, target, or duration boundary. | An audited planet/target/relationship/window predicate and projection safety review. |
| `proposed-sav-bav-career-window-modifier-v1` | Phase 16C policy | No approved threshold, weighted score, or transit BAV/Pinda/Kakshya rule exists. | A separate exact source audit and product approval. |

H6 employment/service, H7 business/trade interpretation, profession labels,
job-versus-business verdicts, promotion, growth, loss beyond the one narrow
source predicate, pressure, salary, and timing outcomes are all rulebook gaps.

## Future candidate eligibility contract

The implemented `CareerClassicalEvaluation` is an explainable, disabled
contract. A future candidate may be eligible only when all of these are backed
by approved predicates:

```text
D1 Career relevance
AND approved D10 confirmation
AND approved Dasha activation
AND approved Gochar manifestation support
```

SAV/BAV and historical recurrence can only be listed separately after that
primary contract succeeds. Phase 2 has no approved D10 confirmation nor
Career-specific Gochar manifestation predicate, so `eligible` is intentionally
always `false` and the temporal projection integration gate remains disabled.
