# TaraVerse Career Rulebook — Product Owner Decisions

Status: **Phase 2F decision pack, superseded for internal architecture by the
Phase 2G owner-approved generalized-factor contract.** Phase 2E approves only bounded D10 factual
refinement. No Gochar timing rule in this document is approved or executable.
The complete Phase 2F source boundary and backtest view are in
`CAREER-GOCHAR-TIMING-CONTRACT.md`. Future Career projection remains disabled.

## Phase 2G owner-approved internal architecture

Phase 2G authorizes an internal/backtest-only generic Career-factor evaluator:
resolve the chart-specific D1 H10 lord and other approved D1 H10 relations;
require an active MD/AD/PD lord connected to those factors; then require a
Jupiter or Saturn activation of a dynamic Career target. This is an owner
architecture decision, not a retrospective source claim for the rejected Phase
2F production predicates. D10, Moon-relative context, SAV/BAV, and recurrence
remain downstream support only. The detailed contract is
`CAREER-GENERALIZED-TIMING-ENGINE.md`; production future projection remains
disabled.

## Shared mechanics and non-negotiable boundaries

- D1 uses the existing whole-sign natal house map. `D1_H10` means house number
  10 in that map; `D1_H10_LORD` is that house's canonical sign lord.
- Existing full Graha Drishti geometry is
  `parashari-seven-graha-drishti-v1`: Jupiter casts 5th/7th/9th full aspects;
  Saturn casts 3rd/7th/10th full aspects. Nodes do not cast.
- Existing same-Rashi association is sign-only. It is **not** a degree-orb
  conjunction, so it must not be called a stronger “direct conjunction.”
- A future state interval must be bounded as `[from, to)`, beginning at the
  first eligible transit state and ending at its first non-eligible state.
  A Layer 10 event is a point, not a self-created interval.
- Where an owner wishes to treat occupancy/same-Rashi association as stronger
  than aspect, that is a new policy decision, not an existing source result.
- Every Gochar option below has prerequisite `SUPPORTED_D1_CAREER_RELEVANCE`
  **and** `SUPPORTED_DASHA_CAREER_ACTIVATION`; Gochar alone cannot create
  eligibility.

## 1. Gochar — D1 Career-axis options

All options have role `MANIFESTATION_SUPPORT` only. “Historical example” is
limited to existing deterministic fixtures and is never a validation cohort.

| ID / candidate | Exact deterministic predicate | Window / geometry | Would allow after prerequisites | Would not allow | Fixture status | Implementation risk | Owner decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G-D1-A — Jupiter transits D1 H10 | Jupiter `transitNatalHouseNumber === 10`. | Whole-sign occupancy `[entry, exit)`. | A traceable Jupiter-to-D1-H10 support fact. | Event, promotion, job date, guarantee. | Synthetic Jupiter/H10 pattern exists; no approved D1/Dasha prerequisite in fixture. | No source-backed Career interpretation. | APPROVE / REJECT / MODIFY |
| G-D1-B — Jupiter aspects D1 H10 | Jupiter full aspect target includes D1 H10. | Existing 5th/7th/9th Parashari full-aspect state `[entry, exit)`. | A traceable Jupiter aspect support fact. | Treating aspect as weaker/stronger than occupancy without owner policy. | Not exercised as a Career rule. | No audited Career-specific aspect source. | APPROVE / REJECT / MODIFY |
| G-D1-C — Jupiter transits natal 10L | Jupiter shares the D1 H10 lord's natal Rashi, or occupies that lord's D1 natal house; owner must choose one. | Same-Rashi association is sign-only; natal-house occupancy is whole-sign. | A precise chosen relation to the H10 lord. | Calling same-Rashi a degree conjunction. | Not exercised. | Candidate has two non-equivalent geometries. | APPROVE / REJECT / MODIFY |
| G-D1-D — Jupiter aspects natal 10L | Jupiter’s existing full aspect targets the natal body identified as D1 H10 lord. | 5th/7th/9th full-aspect state `[entry, exit)`. | A factual transit-to-H10-lord aspect. | A Career outcome. | Not exercised. | No source specifies this Career application. | APPROVE / REJECT / MODIFY |
| G-D1-E — Saturn transits D1 H10 | Saturn `transitNatalHouseNumber === 10`. | Whole-sign occupancy `[entry, exit)`. | A traceable Saturn-to-D1-H10 support fact. | Positive/negative Career label. | Not exercised. | No audited Career-specific source. | APPROVE / REJECT / MODIFY |
| G-D1-F — Saturn aspects D1 H10 | Saturn full aspect target includes D1 H10. | Existing 3rd/7th/10th full-aspect state `[entry, exit)`. | A factual Saturn aspect support fact. | A delay/pressure/loss claim. | Not exercised. | Transcript claims of delay are rejected. | APPROVE / REJECT / MODIFY |
| G-D1-G — Saturn transits natal 10L | Saturn shares H10 lord natal Rashi, or occupies H10 lord natal house; owner must choose one. | Sign-only association or whole-sign occupancy. | A precise chosen relation to H10 lord. | A direct conjunction claim or outcome. | Not exercised. | Ambiguous target geometry and no source. | APPROVE / REJECT / MODIFY |
| G-D1-H — Saturn aspects natal 10L | Saturn’s full aspect targets the natal H10-lord body. | 3rd/7th/10th full-aspect state `[entry, exit)`. | A factual Saturn-to-H10-lord aspect. | Career manifestation by itself. | Not exercised. | No audited Career-specific source. | APPROVE / REJECT / MODIFY |
| G-D1-I — Jupiter and Saturn co-activate axis | At least one owner-approved Jupiter option **and** one owner-approved Saturn option overlap in a non-empty bounded interval. | Intersection of two approved `[from,to)` states. | A dual-transit support fact, with each input retained. | A score, automatic eligibility, or an invented duration. | Not exercised. | Requires owner approval of two underlying rules first. | APPROVE / REJECT / MODIFY |
| G-D1-J — active Dasha lord transits/aspects a D1 Career factor | A current MD/AD/PD lord equals a transit body and has one owner-approved occupancy/aspect relation to H10, H10 lord, or supplied H10 occupant. | Chosen relation’s bounded state, preserving the MD/AD/PD interval. | A Dasha-lord transit support fact. | Treating any active Dasha lord as automatically Career-relevant. | Not exercised. | Needs exact target allowlist and source. | APPROVE / REJECT / MODIFY |

**Owner choices required before implementation:** choose the exact target form
for C/G; choose whether occupancy and aspect are equal or have a documented
priority; approve each applicable relation individually. None is currently
source-approved.

**Phase 2F resolution:** the exact candidate IDs
`GOCHAR_D1_JUPITER_H10_OCCUPY`, `GOCHAR_D1_JUPITER_H10_ASPECT`,
`GOCHAR_D1_JUPITER_H10L_OCCUPY`, `GOCHAR_D1_JUPITER_H10L_ASPECT`,
`GOCHAR_D1_SATURN_H10_OCCUPY`, `GOCHAR_D1_SATURN_H10_ASPECT`,
`GOCHAR_D1_SATURN_H10L_OCCUPY`, `GOCHAR_D1_SATURN_H10L_ASPECT`,
`GOCHAR_D1_JUPITER_SATURN_DUAL`, and
`GOCHAR_DASHA_LORD_CAREER_ACTIVATION` correspond to rows A–J above. Each is
**REJECTED for production timing** because no retained source gives it a
Career-specific predicate. This does not alter the underlying Gochar mechanics.

## 2. Gochar — Moon-relative review options

These are deliberately separate from D1 Career-axis options. They originate
from the retained single-translation research audit, not from the D1-targeted
product methodology.

| Candidate | Exact deterministic predicate | Source state / window | What it could allow after D1+Dasha prerequisite | What it cannot allow | Existing historical example | Owner role decision |
| --- | --- | --- | --- | --- | --- |
| G-M-1 — Jupiter tenth from Moon | Jupiter occupies the tenth house counted from natal Moon. | `[entry, exit)` Moon-relative occupancy; local audit: Phala Deepika Ch. 26 v20. | A sourced Moon-relative timing-support fact. | Position/property/children outcome, D1-H10 equivalence, guarantee. | No matching fixture. | PRIMARY_TIMING_SUPPORT / SECONDARY_TIMING_SUPPORT / CONTEXT_ONLY / REJECTED |
| G-M-2 — Saturn third from Moon | Saturn occupies third from natal Moon. | `[entry, exit)`; local audit: Ch. 26 v23. | A sourced Moon-relative timing-support fact. | Employment gain, job date, guarantee. | No matching fixture. | PRIMARY_TIMING_SUPPORT / SECONDARY_TIMING_SUPPORT / CONTEXT_ONLY / REJECTED |
| G-M-3 — Saturn tenth from Moon | Saturn occupies tenth from natal Moon. | `[entry, exit)`; local audit: Ch. 26 v23. | At most a source-reference fact. | Honour loss, illness, negative Career outcome. | No matching fixture. | PRIMARY_TIMING_SUPPORT / SECONDARY_TIMING_SUPPORT / CONTEXT_ONLY / REJECTED |
| G-M-4 — listed planets tenth from Moon | Sun, Mars, Jupiter, or Saturn occupies tenth from natal Moon. | `[entry, exit)`; local audit: Ch. 26 v33. | At most a source-reference fact. | Life/wealth/status loss or any prediction. | No matching fixture. | PRIMARY_TIMING_SUPPORT / SECONDARY_TIMING_SUPPORT / CONTEXT_ONLY / REJECTED |

Phase 2F classification: G-M-1 and G-M-2 are **CONTEXT_ONLY**; G-M-3 and
G-M-4 are **REJECTED**. None is primary or secondary Career timing support,
and none is equivalent to a D1 H10 condition. A second reviewed translation
and a permitted narrowly Career-specific conclusion remain necessary.

## 3. D10 confirmation/refinement options

All D10 options are `CONFIRMATION / REFINEMENT` only. Default absence behavior
is **do nothing**: D10 is not a hard false gate unless the owner explicitly
approves a later source-backed blocking/contradiction contract.

| ID / candidate | Exact predicate and required data | Could allow | Could not allow | Absence behavior | Owner decision |
| --- | --- | --- | --- | --- | --- |
| D10-A — relevant planet in/into D10 H10 | Valid D10 H10 plus a defined owner allowlist of “relevant Career planet”; planet is occupant or receives existing full aspect. | A factual D10 H10 factor beside supported D1/Dasha evidence. | Theme, profession, Career event, or timing without an approved factor mapping. | Do nothing / weaken / block |
| D10-B — D10 10L connected to active Dasha lord | Valid D10 10L, current MD/AD/PD lord, and owner-selected connection geometry: same Rashi, conjunction definition, or full aspect. | A traceable D10–Dasha refinement fact. | Confirmation score or automatic window. | Do nothing / weaken / block |
| D10-C — active Dasha lord occupies/aspects D10 H10 | Current Dasha lord equals a transit/natal body in D10 and is D10-H10 occupant or casts existing full aspect to it. | A D10 Career-house activation fact. | D10 transit timing or event production. | Do nothing / weaken / block |
| D10-D — active Dasha lord connects to D10 10L | Current Dasha lord and D10 10L have owner-selected same-Rashi/occupancy/full-aspect relationship. | A traceable D10-lord refinement fact. | A Career promise independent of D1. | Do nothing / weaken / block |
| D10-E — D10 Lagna/Lagnesh shares D1 theme | A supported D1 theme has an owner-approved, deterministic theme mapping also present in D10 Lagna or Lagnesh facts. | Explanatory theme refinement. | Profession/job/business verdict or a theme score. | Do nothing / weaken / block |
| D10-F — compatible D1/D10 theme repeats | A supported D1 factual Career relation and a D10 factual relation map to the same future owner-approved theme ID. | Factual cross-chart theme resemblance. | A repeated theme as prediction, eligibility, or probability. | Do nothing / weaken / block |

Phase 2E pins the raw D10 transcript and formalizes the bounded owner decision:
`D10_CONFIRM_PROPOSED_002`, `_003`, and `_004` are approved factual D10
evidence contracts. `_001` is approved only through the finite structural-theme
registry, and `_005` only through `OWN_SIGN`, `EXALTED`, and `DEBILITATED` for
an already relevant planet. D10-A through D10-F remain separate, unapproved
Dasha-to-D10 connection options: no Dasha connection geometry, numeric weight,
timing rule, blocking consequence, or contradiction rule is approved here.

All approved D10 evidence remains downstream of independently established D1
Career relevance. It cannot create eligibility, a future window, timing, a
probability, or a hard false result.

## 4. SAV/BAV owner decisions

Invariant: **SAV/BAV cannot create eligibility.** No threshold is proposed.

| Option | Deterministic boundary | What it would allow | What it would not allow | Owner decision |
| --- | --- | --- | --- | --- |
| S-1 — context only | Preserve existing raw D1 H10 SAV only beside supported D1 foundation. | Existing factual/contextual display. | Threshold, timing, ranking, or eligibility. | APPROVE / REJECT / MODIFY |
| S-2 — relative support after eligibility | Requires a future exact source-approved relative comparator; none exists. | A bounded post-eligibility modifier only if later sourced. | Window creation or a score now. | APPROVE / REJECT / MODIFY |
| S-3 — transit BAV/SAV ranking | Requires future exact planet, BAV reference, target, Pinda/Kakshya rule, and conclusion; none exists. | A bounded rank modifier only after all are approved. | Generic high-SAV transit timing or eligibility. | APPROVE / REJECT / MODIFY |

Default recommendation: **S-1 only**.

## 5. Historical recurrence owner decisions

Invariant: **historical recurrence cannot create eligibility or probability.**

| Option | Deterministic boundary | What it would allow | What it would not allow | Owner decision |
| --- | --- | --- | --- | --- |
| H-1 — increase ranking | Apply only after primary classical eligibility and only to profile-scoped compatible recurrence. | Ordering among already-valid candidates. | Creating eligibility or a probability. | APPROVE / REJECT / MODIFY |
| H-2 — strengthen explanation | Apply only after primary eligibility; retain matched/eligible counts and caveat. | “Resembles recorded observations” wording. | “Likely,” confidence, or an outcome statement. | APPROVE / REJECT / MODIFY |
| H-3 — break ties | Apply only after exact primary eligibility/timing comparison has tied. | Stable tie-break ordering. | Overriding classical eligibility. | APPROVE / REJECT / MODIFY |
| H-4 — identify resemblance | Preserve factual matching of Dasha/transit patterns to confirmed observations. | Existing factual recurrence presentation. | Universal rules or separate OFFER/JOINING signatures. | APPROVE / REJECT / MODIFY |

Default recommendation: **H-4 only** until the owner approves a bounded
post-eligibility use.

## 6. Eligibility architecture choices

| Choice | Contract | Behavioral consequence | D10 effect | SAV/BAV and recurrence effect |
| --- | --- | --- | --- | --- |
| Option 1 | `D1 + Dasha + approved Gochar = eligibility` | No candidate appears unless all three primary families qualify. | Confirmation/refinement after eligibility; no hard gate. | Support/ranking only after eligibility. |
| Option 2 | `D1 + Dasha = eligibility`; approved Gochar = timing strength | A D1/Dasha candidate could exist before a Gochar state; Gochar orders/explains timing. | Confirmation/refinement after primary eligibility; no hard gate. | Support/ranking only after primary eligibility. |

Option 1 is stricter and has fewer false-positive windows; Option 2 can expose
untimed D1/Dasha candidates. Neither option may be implemented until at least
one owner-approved, source-backed Gochar predicate exists. This is an
implementation-consistency observation, not an astrology-truth recommendation.

## 7. Acceptance examples using existing fixtures

| Fixture | Option 1 classification today | Option 2 classification today | Reason |
| --- | --- | --- | --- |
| OFFER 2024-02-01 with refined Jupiter ingress | Fails. | Fails. | The fixture proves a mechanical transit event and factual Dasha intervals, not approved D1 Career relevance + Dasha Career activation. |
| JOINING 2024-02-02 from the same transition | Fails. | Fails. | It is a separate observation without the prior ingress instant; it has no approved primary predicates. |
| Two synthetic PROMOTION-event pattern fixtures | Fails. | Fails. | Repeated Jupiter/H10 and raw-SAV patterns are factual recurrence, not approved D1/Dasha/Gochar eligibility. |
| Hypothetical future fixture with all Option 1 predicates owner-approved | Would qualify. | Would qualify. | D1 + Dasha + qualifying Gochar would be present; D10/SAV/recurrence remain non-creating modifiers. |
| Hypothetical future fixture with D1+Dasha but no approved Gochar | Fails. | Could be an untimed candidate. | This is the intended behavioral difference between architecture choices. |

## Decision summary

- **Gochar rules requiring owner decision:** G-D1-A through G-D1-J; G-M-1
  through G-M-4.
- **D10 rules requiring owner decision:** D10-A through D10-F, including
  their exact connection geometry and absence behavior.
- **SAV/BAV owner decision:** retain S-1 only, or explicitly authorise a later
  source-audited S-2/S-3 scope.
- **Recurrence owner decision:** retain H-4 only, or explicitly authorise a
  bounded post-eligibility H-1/H-2/H-3 use.
- **Eligibility architecture decision:** select Option 1 or Option 2 only
  after approving at least one exact Gochar predicate.

```text
FUTURE CAREER PROJECTION: DISABLED
CAREER RULEBOOK: WAITING FOR OWNER DECISIONS
```
