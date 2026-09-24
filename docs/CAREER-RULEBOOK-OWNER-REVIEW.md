# TaraVerse Career Rulebook — Owner Review Pack

Status: **Phase 2B source extraction only.** This pack inventories candidate
predicates from material already in this repository. It does not approve a
rule, change `APPROVED_RULES`, enable projection, or authorize a prediction.

## Review boundary

This review used repository documentation, source comments, tests, research
audits, and deterministic fixtures only. It did not use public-web research or
general astrology knowledge. A candidate is included because a repository
source records a relevant statement or mechanism; that is not evidence that the
candidate is astrologically true or ready for production.

The controlling constraints from `CAREER-RULEBOOK.md` remain unchanged:

```text
NO_VALID_PRIMARY_CAREER_ACTIVATION + HIGH_SAV_BAV = NO_CAREER_WINDOW
NO_PRIMARY_CLASSICAL_ELIGIBILITY + HIGH_HISTORICAL_MATCH = NO_STRONG_CAREER_WINDOW
FUTURE CAREER PROJECTION = DISABLED
```

## Source register

| ID | Repository source | What it establishes | What it does not establish |
| --- | --- | --- | --- |
| D10-S1 | `docs/D10-CAREER-RULE-AUDIT.md` | The transcript describes inspecting D1 and D10 together and D10 Lagna/H10/Shani facts. | A production D10 confirmation, profession, timing, or outcome predicate. |
| D10-S2 | `src/application/divisional-charts/career-d10-structure.js` and `career-d10-corroboration.js` | Deterministic D10 facts and the current guarded, contextual factor packet exist. | A classical source for a new confirmation/window rule. |
| G-S1 | `docs/LAYER-9-GOCHAR-TRANSIT-FOUNDATION.md` | Deterministic supplied Gochar mechanics. | Career manifestation meaning. |
| G-S2 | `docs/LAYER-10-TRANSIT-EVENT-SCANNER.md` | Refined ingress, station, association, Drishti, and Sade-Sati event mechanics. | Career event production. |
| G-S3 | `docs/LAYER-13B3-CAREER-GOCHAR-TIMING.md` and `scripts/research/career-gochar-rule-audit.js` | Existing Gochar conclusions are neutral context only; the audit has zero ready projection candidates. | A narrower Career planet/target/duration rule. |
| G-S4 | `docs/LAYER-13B4-CAREER-TEMPORAL-COACTIVATION.md` | Independent same-subject Dasha and supplied Gochar/transit mechanisms can be factual co-activation. | A Career event interval or outcome. |
| A-S1 | `docs/CAREER-ASHTAKAVARGA-RULE-AUDIT.md` | H10/H7 and raw SAV source inventory; no production Career threshold policy. | A five-factor score, generic Career threshold, or transit-SAV timing rule. |
| A-S2 | `docs/CAREER-ASHTAKAVARGA-INTERPRETATION-POLICY.md` | Narrow H10 SAV contextual wording beside independently supported D1 foundation. | Eligibility, activation, ranking, timing, or an outcome. |

## D10 owner-review candidates

### `D10_CAREER_PROPOSED_001` — D1-gated factual D10 corroboration

| Field | Extraction |
| --- | --- |
| Source | D10-S1, especially the “Safest possible future Phase 17B candidate” section; D10-S2. |
| Source statement | The source says to read D1 and D10 together, while keeping D1 authoritative and D10 as factual corroborative context. |
| Deterministic predicate | A supplied `CAREER_FOUNDATION` conclusion has `status: SUPPORTED`; a valid D10 factual structure supplies D10 Lagna, D10 H10, and/or Shani facts. |
| Inputs required | Supported D1 Career foundation; D10 Lagna/lord/occupants; D10 H10/lord/occupants; engine-approved Shani placement/aspects when present. |
| Potential output | A factual D10 context packet attached to the independently supported D1 foundation. |
| Allowed conclusion | “These D10 placements are additional factual Career context.” |
| Disallowed conclusion | Career change, profession/job/business verdict, promotion, foreign work, delay, income, timing, probability, or confirmation that an event will happen. |
| Confidence in source extraction | **HIGH** that the source permits only this factual, D1-gated display; **LOW** that it defines a Career-confirmation predicate. |
| Recommended owner decision | **NEEDS CLARIFICATION** — it is suitable as presentation context, not as the missing eligibility confirmation. |

### `D10_CAREER_PROPOSED_002` — D10 Lagna fact ordering

| Field | Extraction |
| --- | --- |
| Source | D10-S1, timestamps 00:11:42, 00:18:41, 00:18:48, and 00:18:56. |
| Source statement | Inspect D10 Lagna, sign, lord, and occupants; occupants take precedence for factual presentation order. |
| Deterministic predicate | Given valid D10 Lagna facts, list occupants deterministically, otherwise retain sign/lord facts. |
| Inputs required | D10 Lagna sign, lord placement, occupants. |
| Potential output | Ordered factual D10 Lagna rows. |
| Allowed conclusion | The listed placement facts only. |
| Disallowed conclusion | Any Career confirmation or inference from an occupant. |
| Confidence in source extraction | **HIGH** for fact ordering; **LOW** for a confirmation rule. |
| Recommended owner decision | **REJECT** as a rulebook eligibility predicate; retain only as factual UI/data ordering. |

### `D10_CAREER_PROPOSED_003` — D10 tenth-house fact packet

| Field | Extraction |
| --- | --- |
| Source | D10-S1, timestamp 00:29:42; D10-S2. |
| Source statement | Inspect the D10 tenth house, its occupants, and tenth-lord placement. |
| Deterministic predicate | Given valid D10 H10 facts, preserve its sign, lord placement, occupants, and received engine-approved aspects. |
| Inputs required | D10 H10, tenth lord, occupants, aspects. |
| Potential output | Factual D10 H10 rows. |
| Allowed conclusion | “Planet X is placed here” or “Planet Y aspects this Bhav,” where supplied by the engine. |
| Disallowed conclusion | A profession, Career outcome, timing, or event confirmation. |
| Confidence in source extraction | **HIGH** for factual inspection; **LOW** for a confirmation rule. |
| Recommended owner decision | **REJECT** as a missing confirmation predicate; retain fact-only structure. |

### `D10_CAREER_PROPOSED_004` — Shani relationship geometry

| Field | Extraction |
| --- | --- |
| Source | D10-S1, timestamps 00:12:42, 00:14:17, 00:23:00. |
| Source statement | The transcript discusses Shani placement, relative houses, and aspects; the audit permits engine-approved aspect geometry only as fact. |
| Deterministic predicate | Preserve engine-approved Shani house/sign/aspect facts without changing house mapping or interpreting them. |
| Inputs required | D10 Shani placement and the existing approved aspect engine output. |
| Potential output | Factual Shani relationship rows. |
| Allowed conclusion | The supplied geometry only. |
| Disallowed conclusion | Delay, pressure, retirement, Career result, or an event window. |
| Confidence in source extraction | **HIGH** for geometry; **LOW** for any Career confirmation. |
| Recommended owner decision | **REJECT** as a confirmation predicate. |

**D10 finding:** there are **zero source-backed deterministic D10 Career
confirmation predicates** in the repository. The four entries above are review
items, not executable confirmation rules.

## Gochar owner-review candidates

All entries below have role `MANIFESTATION_SUPPORT` for review only. None is
sufficient for a Career event, and none is eligible for `APPROVED_RULES`.

### `GOCHAR_CAREER_PROPOSED_001` — supplied structural Gochar context

| Field | Extraction |
| --- | --- |
| Source | G-S1 and `career-gochar-structural-connection-v1`. |
| Transiting planet / natal reference | **Unspecified**; current mechanism accepts supplied Gochar relations. |
| Predicate | A supplied Layer 9 Gochar snapshot is structurally linked to supplied Career evidence. |
| Career timing connection | No source connects it specifically to Career manifestation. |
| Role / duration | Neutral current context; no defined duration or event semantics. |
| Potential output | Factual structural connection. |
| Confidence | **HIGH** for the current neutral mechanism; **LOW** for manifestation support. |
| Recommended owner decision | **REJECT** as a missing Career-manifestation rule: its admissible planets, targets, and relations are unspecified. |

### `GOCHAR_CAREER_PROPOSED_002` — non-Sade-Sati Layer 10 event context

| Field | Extraction |
| --- | --- |
| Source | G-S2, G-S3, and `scripts/research/career-gochar-rule-audit.js` candidate `career-layer10-event-timing-context-existing-v1`. |
| Transiting planet / natal reference | All supported grahas; all existing Career relations. |
| Predicate | A non-Sade-Sati Layer 10 event has a supplied structural Career link. |
| Occupancy/aspect/conjunction | The scanner can detect ingress, station, same-Rashi association, and existing transit Drishti mechanics; no subset is approved as Career-specific. |
| Career timing connection | Timing *context* only; source explicitly says no outcome. |
| Role / duration | Point event; no sustained Career window. |
| Potential output | Factual refined event context. |
| Confidence | **HIGH** for scanner mechanics; **LOW** for Career manifestation. |
| Recommended owner decision | **NEEDS CLARIFICATION** — requires an exact source-backed planet/target/relation/window restriction. |

### `GOCHAR_CAREER_PROPOSED_003` — independent Dasha–Gochar co-activation

| Field | Extraction |
| --- | --- |
| Source | G-S4 and `career-temporal-coactivation-v1`. |
| Transiting planet / natal reference | Whatever supplied Gochar/transit relation and Dasha relation target the same Career subject; no planet subset. |
| Predicate | Independent Dasha and Gochar/transit mechanisms target the same supplied Career subject at an instant contained in every retained Dasha interval. |
| Career timing connection | Factual co-activation only. The policy explicitly forbids fabricating an interval or Career event window. |
| Role / duration | Instant containment; no new duration. |
| Potential output | A traceable factual co-activation record. |
| Confidence | **HIGH** for this architecture predicate; **LOW** as a Career manifestation rule. |
| Recommended owner decision | **REJECT** as standalone manifestation support until a separate approved Gochar rule gives the Gochar component Career-specific meaning. |

**Gochar finding:** there are **zero source-backed Career-specific Gochar
manifestation predicates**. The repository’s own Gochar audit reports
`readyForRulebook: []` and `decision: NOT_READY`.

## SAV/BAV owner-review candidates

All entries below have role `SUPPORT_MODIFIER` only. They can never create
Career eligibility or a Career window.

### `ASHTAKA_CAREER_PROPOSED_001` — H10 SAV beside supported D1 foundation

| Field | Extraction |
| --- | --- |
| Source | A-S1 CAV-01; A-S2 CAV-I01/I02/I09. |
| SAV/BAV / reference | Raw D1 H10 SAV; independently supported D1 H10 Career foundation. |
| Deterministic predicate | Supported D1 H10 Career conclusion and valid raw H10 SAV fact are both supplied. |
| Stated strength rule | No numeric threshold, average, comparison, or relative label. |
| Potential output | One contextual raw-H10-SAV sentence including the non-standalone limitation. |
| Allowed conclusion | Supplementary natal context for the already-established D1 Career structure. |
| Disallowed conclusion | Career strength, job security, promotion, timing, confidence, or eligibility. |
| Confidence | **HIGH** for the narrow contextual contract; **LOW** as a window modifier. |
| Recommended owner decision | **APPROVE** only as the already bounded contextual-support policy; **REJECT** if proposed as a future-window modifier. |

### `ASHTAKA_CAREER_PROPOSED_002` — H7 SAV for explicit business/trade context

| Field | Extraction |
| --- | --- |
| Source | A-S1 CAV-03; A-S2 CAV-I04. |
| SAV/BAV / reference | Raw D1 H7 SAV and an independently supported business/trade/public-dealing signal. |
| Deterministic predicate | A separately approved business/trade/public-dealing premise and valid H7 SAV fact are supplied. |
| Stated strength rule | No threshold or general employment rule. |
| Potential output | Supplementary business/trade-context sentence only. |
| Allowed conclusion | Narrow H7 contextual detail. |
| Disallowed conclusion | Employment strength, business success, partnership outcome, or timing. |
| Confidence | **MEDIUM** — H7 trade source exists, but the required upstream business/trade premise does not. |
| Recommended owner decision | **NEEDS CLARIFICATION**. |

### `ASHTAKA_CAREER_PROPOSED_003` — aggregate-SAV bands

| Field | Extraction |
| --- | --- |
| Source | A-S1 CAV-07; A-S2 CAV-I08. |
| SAV/BAV / reference | Aggregate SAV bands described as `>30`, `25–30`, and `<25` in the pinned audit source. |
| Deterministic predicate | A raw SAV value can be compared to those literal bands. |
| Stated strength rule | The source records a general bhava doctrine, not a Career formula; `30+` is explicitly not faithful to the wording. |
| Potential output | None in Career production under the current policy. |
| Allowed conclusion | Research comparison only. |
| Disallowed conclusion | A Career badge, score, “strong/weak,” timing, or eligibility result. |
| Confidence | **HIGH** for the extracted source wording; **LOW** for a Career application. |
| Recommended owner decision | **REJECT** as a Career-window modifier. |

### `ASHTAKA_CAREER_PROPOSED_004` — planet-specific transit BAV/Pinda/Kakshya

| Field | Extraction |
| --- | --- |
| Source | A-S1 CAV-09 and A-S2 section 11. |
| SAV/BAV / reference | A relevant transiting planet’s BAV/Rekhas, with applicable Pinda/Kakshya mechanics. |
| Deterministic predicate | Not specified in the repository: no complete transiting planet, BAV reference frame, target, Pinda/Kakshya rule, Dasha relationship, or Career mapping is pinned. |
| Stated strength rule | The sources distinguish planet-specific transit doctrine from aggregate SAV; they do not license generic high-SAV Career timing. |
| Potential output | None until the missing exact predicate is sourced and reviewed. |
| Allowed conclusion | Research question only. |
| Disallowed conclusion | Slow-planet/high-H10-SAV timing, activation, or outcome. |
| Confidence | **MEDIUM** that a different doctrine exists; **LOW** for an implementable rule. |
| Recommended owner decision | **NEEDS CLARIFICATION**. |

### `ASHTAKA_CAREER_PROPOSED_005` — lord-placement / tenth-from-lord SAV

| Field | Extraction |
| --- | --- |
| Source | A-S1 CAV-02/CAV-04/CAV-05; A-S2 CAV-I03/I05/I06. |
| SAV/BAV / reference | H10-lord placement SAV, H7-lord placement SAV, and tenth-from-H10-lord SAV. |
| Deterministic predicate | These values can be calculated and displayed factually. |
| Stated strength rule | No located source joins these values to a Career conclusion. |
| Potential output | Fact-only rows. |
| Allowed conclusion | Planet/house/raw-SAV fact only. |
| Disallowed conclusion | “Supports/strengthens” a lord, Career eligibility, business success, or timing. |
| Confidence | **HIGH** for the calculation; **HIGH** that no sourced interpretive rule was found. |
| Recommended owner decision | **REJECT** as a support modifier. |

## Historical example mapping

The repository contains deterministic fixtures, not outcome-validated user
cohorts. The mapping below is illustrative only: a historical match does not
make a candidate universal.

| Fixture/event | Candidate | Matched | Evidence | Ambiguity |
| --- | --- | --- | --- | --- |
| `tests/application/career-event-astrology-service.test.js`: OFFER, 2024-02-01 | `GOCHAR_CAREER_PROPOSED_002` | YES, mechanically | A refined Jupiter Rashi ingress occurs inside the OFFER observation’s temporal coverage. | It is a scanner event, not a source-backed Career manifestation rule; no D1/D10 target predicate is supplied. |
| Same transition: JOINING, 2024-02-02 | `GOCHAR_CAREER_PROPOSED_002` | NO for that ingress instant | JOINING is a separate next-day observation; the fixture only proves independent observation capture. | A non-match cannot imply absence of Career support. |
| `tests/application/career-pattern-comparison-service.test.js`: two synthetic PROMOTION events | `GOCHAR_CAREER_PROPOSED_002` | YES, mechanically | Both fixtures share a Jupiter-in-H10/Transit-Natal-House pattern. | Synthetic fixtures have no source-approved Career Gochar predicate and cannot validate a universal rule. |
| Same synthetic PROMOTION fixtures | `ASHTAKA_CAREER_PROPOSED_003` | OBSERVED_EXAMPLE_ONLY | Both fixtures carry the exact raw SAV value `28` in their constructed snapshot pattern. | `28` is a mathematical reference, not an authorised Career threshold. |
| Any fixture with supported D1 H10 conclusion and raw H10 SAV | `ASHTAKA_CAREER_PROPOSED_001` | CONDITIONAL | It would attach only the raw H10 SAV contextual packet. | It does not create a historical event match, eligibility, or a window. |
| Existing D10 fixtures | `D10_CAREER_PROPOSED_001` | CONDITIONAL | It would preserve D10 facts only after a supported D1 foundation. | No fixture/source establishes that this confirms a Career event. |

Historical event titles and notes are intentionally excluded from recurrence
selection, and observation dates remain anchors for inspection rather than
universal rules. This remains true for OFFER, JOINING, PROMOTION, JOB_SWITCH,
and every other event type.

## Owner review matrix

| Candidate ID | Family | Source | Predicate summary | Historical matches | Risk / ambiguity | Recommended owner decision |
| --- | --- | --- | --- | --- | --- | --- |
| D10_CAREER_PROPOSED_001 | D10 | D10-S1/S2 | Supported D1 foundation plus valid factual D10 packet. | Conditional only. | No D10 confirmation inference defined. | NEEDS CLARIFICATION |
| D10_CAREER_PROPOSED_002 | D10 | D10-S1 | Deterministic D10 Lagna fact ordering. | N/A. | Presentation fact, not confirmation. | REJECT |
| D10_CAREER_PROPOSED_003 | D10 | D10-S1/S2 | Deterministic D10 H10 fact packet. | N/A. | Fact, not confirmation. | REJECT |
| D10_CAREER_PROPOSED_004 | D10 | D10-S1 | Preserve Shani geometry. | N/A. | Transcript outcome claims are rejected. | REJECT |
| GOCHAR_CAREER_PROPOSED_001 | Gochar | G-S1/G-S3 | Generic supplied structural Gochar link. | Not Career-specific. | Planet/target/relation unspecified. | REJECT |
| GOCHAR_CAREER_PROPOSED_002 | Gochar | G-S2/G-S3 | Non-Sade-Sati refined event structurally linked to Career facts. | Jupiter ingress fixture only. | All bodies/relations allowed; no Career predicate/window. | NEEDS CLARIFICATION |
| GOCHAR_CAREER_PROPOSED_003 | Gochar | G-S4 | Independent same-subject Dasha + Gochar co-activation. | Conditional fact only. | No source grants event production. | REJECT |
| ASHTAKA_CAREER_PROPOSED_001 | SAV/BAV | A-S1/A-S2 | Raw H10 SAV beside supported D1 H10 foundation. | Conditional context only. | Must remain non-threshold/non-timing. | APPROVE only as contextual support |
| ASHTAKA_CAREER_PROPOSED_002 | SAV/BAV | A-S1/A-S2 | Raw H7 SAV beside separate business/trade premise. | No qualifying premise fixture. | Upstream business/trade signal absent. | NEEDS CLARIFICATION |
| ASHTAKA_CAREER_PROPOSED_003 | SAV/BAV | A-S1/A-S2 | Literal aggregate-SAV band comparison. | `28` observed in synthetic fixture. | General doctrine is not Career threshold. | REJECT |
| ASHTAKA_CAREER_PROPOSED_004 | SAV/BAV | A-S1/A-S2 | Planet-specific transit BAV/Pinda/Kakshya. | Not exercised. | Exact mechanics and Career mapping absent. | NEEDS CLARIFICATION |
| ASHTAKA_CAREER_PROPOSED_005 | SAV/BAV | A-S1/A-S2 | Lord-placement raw SAV lookup. | Fact-only fixture data. | No interpretation source. | REJECT |

## Unresolved gaps

1. No audited D10 predicate says which D10 fact confirms which D1 Career
   foundation, or what that confirmation can authorize.
2. No source states a Career-specific Gochar planet, natal/D10 target,
   occupancy/aspect relation, and duration/window together.
3. The Layer 10 scanner has precise mechanics but no Career manifestation
   semantics; source mechanics must not be confused with event causation.
4. SAV examples and raw values exist, but there is no authorised Career
   threshold, score, majority calculation, or generic transit-SAV rule.
5. A planet-specific BAV/Pinda/Kakshya rule would need a pinned source,
   reference frame, exact target, Dasha relationship, and bounded Career
   conclusion before review.
6. H7's trade wording is not an employment rule; a separate approved
   business/trade premise is missing.
7. Historical Career observations describe individual profiles. They are not
   a universal rule source or a validation cohort.
8. Transcript material mixes factual chart inspection with predictive and
   profession-specific assertions, so extraction must remain fact-only unless
   an exact predicate has an independent, approved source.

## Owner decision checklist

Before changing any candidate’s status, the owner should require a stable ID,
pinned source/edition or approved internal-policy basis, explicit inputs,
half-open time semantics where time is involved, allowed/disallowed wording,
and regression tests for false positives. Approval of a factual-display item
does not approve projection, a Career window, or a prediction.

## Final status

```text
FUTURE CAREER PROJECTION: DISABLED
CAREER RULEBOOK OWNER REVIEW: READY
```

---

# Phase 2C — Transcript-Grounded Career Timing Rules

Status: **methodology formalization and owner review only.** This section
re-audits the closest repository material against the locked product hierarchy.
It does not change the earlier candidate decisions, add an approved rule, or
enable future projection.

## Material re-audited

| Source | Relevance to Phase 2C | Material boundary |
| --- | --- | --- |
| `docs/D10-CAREER-RULE-AUDIT.md` and `tmp/d10-career-rule-audit.json` | The only retained practitioner-transcript audit for D10 Career material. | A single practitioner source; it supports factual D10 inspection, not a production confirmation/timing predicate. |
| `docs/LAYER-13B2-CAREER-DASHA-ACTIVATION.md` and `src/interpretation/career-dasha-engine.js` | Current Dasha activation of supplied H10 relations. | Dasha activation context only; no outcome. |
| `docs/LAYER-13B3-CAREER-GOCHAR-TIMING.md`, `docs/LAYER-13B4-CAREER-TEMPORAL-COACTIVATION.md`, and Gochar engines | Current neutral Gochar/transit context and independent co-activation. | No Career-specific manifestation source or window rule. |
| `scripts/research/external-career-gochar-source-audit.js` and its local JSON artifact | Pre-existing local audit of a single-translation Phala Deepika transit transcript. | This Phase 2C review reads the stored audit only; it did not perform a new web search. The audit itself says `MORE_RESEARCH_REQUIRED`. |
| `docs/CAREER-ASHTAKAVARGA-RULE-AUDIT.md` and `docs/CAREER-ASHTAKAVARGA-INTERPRETATION-POLICY.md` | Existing raw-SAV, BAV/Pinda/Kakshya, and no-threshold boundaries. | Support/context only; not a timing/eligibility source. |
| Career-event, pattern-comparison, and recurrence tests | Deterministic historical observation mechanics. | Synthetic/owned observation anchors; not universal astrology validation. |

## Locked methodology hierarchy

The product owner has locked the following intended roles. “Primary” describes
the proposed future architecture, not an already executable prediction rule.

| Layer | Family | Intended role | May independently create a Career window? | Current source-backed status |
| --- | --- | --- | --- | --- |
| A | D1 Career promise / structure | Primary natal Career relevance. | No; requires temporal activation. | Existing approved factual Career relations. |
| B | Dasha activation | Primary activation of supplied D1 Career relations. | No; current rule is context only. | Existing approved H10-linked Dasha activation. |
| C | D10 confirmation / refinement | Confirm/refine an already supported D1/Dasha Career theme. | **Never independently.** | Factual D10 structure only; no source-backed confirmation predicate. |
| D | Gochar manifestation / timing | Proposed timing support, primarily evaluated against natal/D1 Career factors when an exact source permits it. | **Never alone.** | Generic current context exists; no approved D1-targeted Career manifestation predicate. |
| E | SAV/BAV support | Static/planet-specific supplementary support. | **Never.** | Narrow D1 H10 contextual support only. |
| F | Historical recurrence support | Profile-scoped personalization/ranking of an otherwise valid candidate. | **Never.** | Existing factual recurrence only. |

The source material does **not** make D10 a hard false gate. It supports the
more limited position that D10 can refine factual Career context after D1. It
also does not establish that D10 transit is mandatory for Career timing.

## D10 confirmation/refinement candidates

### `D10_CAREER_TIMING_PROPOSED_001` — evidence accumulation, fact-only

| Field | Extraction |
| --- | --- |
| Source | `docs/D10-CAREER-RULE-AUDIT.md`, “Read D1 and D10 together” at 00:01:38/00:10:12, plus its stated Phase 17B boundary. |
| Source paraphrase | D1 remains authoritative for Career foundation; D10 can add factual Lagna/H10/Shani context. |
| Exact predicate | A supported D1 Career foundation and active Dasha Career relation are supplied; one or more valid factual D10 factors are present. Factors are retained separately, not counted or scored. |
| Role | `D10_CONFIRMATION` **candidate only**, implemented as factual refinement evidence rather than a binary gate. |
| Evidence produced | Stable D10 factor references: Lagna lord/occupants, tenth lord/occupants, and engine-approved Shani facts. |
| Allowed conclusion | “Additional factual D10 Career context is present beside the supplied D1/Dasha evidence.” |
| Disallowed conclusion | That D10 confirms an event, a profession/job/business result, timing, strength, probability, or a future window. |
| Source confidence | **MEDIUM** for non-binary factual refinement; **LOW** for a confirmation predicate. |
| Recommended owner action | **NEEDS CLARIFICATION** — define what “confirmation” may change, if anything, without creating a score or prediction. |

At the time of the original Phase 2C audit, no retained transcript-backed
predicate was found for active-Dasha/D10 links, D10 H10 evidence, or repeated
D1/D10 themes. That finding is superseded **only for owner review** by the
new-source addendum below; no candidate is promoted into `APPROVED_RULES`.

## Phase 2C D10 re-audit — latest transcript addendum

### Source traceability and limit

The immutable transcript is pinned verbatim at
[`docs/sources/career/d10/D10-Career-Masterclass-Transcript.txt`](sources/career/d10/D10-Career-Masterclass-Transcript.txt)
(`SHA-256 cf4c07f3ae1a1e4f5d5710bfe5ade15a857fa48dc73bde1f3254f3adfba58beb`).
Its title and YouTube URL are retained in its first two lines. The source is a
single practitioner transcript, not a primary text. Citations below preserve
its timestamps and paraphrase only its bounded structural method; outcome,
profession, location, wealth, age, and timing claims remain excluded.

The owner-provided statements establish this bounded methodology:

1. D1 gives broad Career promise/direction; D10 gives professional
   manifestation/execution/refinement.
2. A D1 Career theme should be checked in D10 using H10 sign/lord/occupants,
   aspects, H10-lord combinations and supported dignity facts.
3. D10 Lagna/Lagnesh is professional profile/image context; D10 H10 is
   professional execution context.
4. Repetition/compatibility of the same D1/D10 professional theme is described
   as confirmation.
5. Relevant D10 planetary dignity can refine an already relevant expression.
6. D10 does not establish timing.

### `D10_CONFIRM_PROPOSED_001` — D1/D10 thematic repetition

| Field | Contract |
| --- | --- |
| Source | `D10-Career-Masterclass-Transcript.txt` `00:10:12.640–00:10:20.720` (use D1 and D10), `00:30:20.799–00:30:32.240` (case-study repetition is called confirmation), and `00:38:03.359–00:38:14.320` (D1 action; D10/divisional result framing). |
| Exact predicate | An approved D1 Career theme ID is present **and** an independently calculated D10 H10/H10-lord/associated-planet factor maps to the same owner-approved theme ID. Both factor references are retained. |
| Inputs | Supported D1 Career theme; deterministic shared theme registry; valid D10 H10, H10 lord, occupants/aspects, and associated planet facts. |
| Evidence produced | `D10_THEME_CONFIRMATION` with D1 factor IDs, D10 factor IDs, shared theme ID, and transcript-source reference. |
| Role | `D10_CONFIRMATION`, downstream of D1 Career relevance. |
| Allowed conclusion | The same bounded professional theme is factually represented in both D1 and D10. |
| Disallowed conclusion | Career event, profession/job/business verdict, outcome, timing, probability, numeric score, or independent eligibility. |
| Source confidence | **HIGH** for thematic repetition as confirmation/refinement; **MEDIUM** for an automated predicate until the shared theme registry is owner-approved. |
| Recommended owner action | **APPROVED WITH MODIFICATION** — the Phase 2E finite structural-theme registry is pinned; D1 must independently supply the matching registry ID. |

### `D10_CONFIRM_PROPOSED_002` — D10 H10 professional-execution evidence

| Field | Contract |
| --- | --- |
| Source | `D10-Career-Masterclass-Transcript.txt` `00:36:44.320–00:37:00.000` (inspect the tenth house and its occupant/lord), with structural-method support at `00:13:30.720–00:14:24.399`. |
| Exact predicate | A valid D10 tenth house supplies its sign, canonical lord, occupants, and existing full aspects received. Each item remains a separate evidence fact. |
| Inputs | D10 house map, body placements, canonical H10 lord, and `parashari-seven-graha-drishti-v1` aspect facts. |
| Evidence produced | `D10_H10_EXECUTION_EVIDENCE` containing only separate factual components. |
| Role | `D10_CONFIRMATION / REFINEMENT`. |
| Allowed conclusion | The listed D10 H10 facts are professional-execution evidence to check beside D1. |
| Disallowed conclusion | A specific profession, Career result, timing, or window. |
| Source confidence | **HIGH** for the factual evidence inventory; **MEDIUM** for the label “execution” as contextual prose. |
| Recommended owner action | **APPROVE** as a traceable fact-evidence contract; it does not itself confirm eligibility. |

### `D10_CONFIRM_PROPOSED_003` — D10 H10-lord professional-execution/refinement evidence

| Field | Contract |
| --- | --- |
| Source | `D10-Career-Masterclass-Transcript.txt` `00:30:20.799–00:30:32.240` and `00:41:39.040–00:41:57.599` (D10 tenth lord placement in the case-study sequence). |
| Exact predicate | A valid D10 H10 lord supplies canonical identity, occupied house, same-house companions, existing full aspects sent/received where available, and separately supplied dignity state. No facts are summed. |
| Inputs | D10 H10 lord, its D10 house/sign, companion placements, existing full aspect model, and existing categorical dignity facts. |
| Evidence produced | `D10_H10_LORD_REFINEMENT_EVIDENCE` with each factual component and source reference. |
| Role | `D10_CONFIRMATION / REFINEMENT`. |
| Allowed conclusion | The listed H10-lord facts refine D10 professional-execution context. |
| Disallowed conclusion | A Career promise, result, recognition/fame result, timing, score, or a hard gate. |
| Source confidence | **HIGH** for factor selection; **MEDIUM** for any future interpretation beyond factual refinement. |
| Recommended owner action | **APPROVE** as a traceable fact-evidence contract. |

### `D10_CONFIRM_PROPOSED_004` — D10 Lagna professional-profile evidence

| Field | Contract |
| --- | --- |
| Source | `D10-Career-Masterclass-Transcript.txt` `00:11:17.600–00:12:00.640` and `00:18:41.520–00:18:56.720` (D10 first house/Lagna is inspected first, including occupants). |
| Exact predicate | A valid D10 Lagna supplies sign, Lagnesh and its placement, occupants, and existing full aspects received. |
| Inputs | D10 first house, Lagnesh, body placements, and existing full aspect facts. |
| Evidence produced | `D10_LAGNA_PROFESSIONAL_PROFILE_EVIDENCE` with separate factual factors. |
| Role | `D10_CONFIRMATION / REFINEMENT`. |
| Allowed conclusion | The listed D10 Lagna facts are professional-profile/image context. |
| Disallowed conclusion | Personality judgement, public-status outcome, profession, timing, or eligibility without D1. |
| Source confidence | **HIGH** for factor selection; **MEDIUM** for profile/image contextual wording. |
| Recommended owner action | **APPROVE** as a traceable fact-evidence contract. |

### `D10_CONFIRM_PROPOSED_005` — relevant-planet categorical dignity refinement

| Field | Contract |
| --- | --- |
| Source | `D10-Career-Masterclass-Transcript.txt` `00:25:15.039–00:25:30.880` (debilitated Venus example), `00:31:10.720–00:31:24.159` (exalted Jupiter example), and `00:40:49.520–00:41:03.040` (own-sign example). |
| Exact predicate | A planet is already relevant through `D10_CONFIRM_PROPOSED_001`, `_002`, `_003`, or `_004`, and an existing categorical D10 dignity/strength fact is supplied for that same planet. The evidence retains the exact category; no numeric weight is computed. |
| Inputs | Relevant D1/D10 theme factor, same planet’s existing D10 dignity state, and the source reference. |
| Evidence produced | `D10_RELEVANT_PLANET_DIGNITY_REFINEMENT` containing relevance and categorical dignity separately. |
| Role | `D10_CONFIRMATION / REFINEMENT` only. |
| Allowed conclusion | A relevant planet’s already-supplied dignity is contextual refinement of that specific professional expression. |
| Disallowed conclusion | Independent eligibility, numeric confidence, score, timing, generic “strong/weak Career,” or a recognition/fame promise. |
| Source confidence | **MEDIUM** — the transcript explicitly permits the concept, but a future implementation must enumerate exactly which existing dignity categories are admissible. |
| Recommended owner action | **APPROVED WITH MODIFICATION** — allowlist is exactly `OWN_SIGN`, `EXALTED`, and `DEBILITATED`; only an already relevant D10 planet can carry one of these fact labels. |

### Revised D10 conclusion

The earlier statement “zero source-backed deterministic D10
Career-confirmation predicates” is revised as follows:

- The pinned source is sufficient for `_001` through `_005` as bounded D10
  confirmation/refinement contracts. `_002`, `_003`, and `_004` are approved
  factual evidence contracts. `_001` is approved only through the Phase 2E
  finite structural-theme registry. `_005` is approved only through the
  explicit three-category dignity allowlist.
- None of `_001` through `_005` is wired into production eligibility, a timing
  predicate, a score, a hard false gate, or an independent Career-window creator.
- D10 transit, Gochar, and future projection remain outside this transcript’s
  authority.

## Gochar Career timing candidates

Phase 2F formalizes this audit in `CAREER-GOCHAR-TIMING-CONTRACT.md`. The
explicit D1-axis candidates are rejected for production timing because the
repository has no source-backed Career-specific transit predicate; that is a
source conclusion, not a change to existing occupancy, aspect, or event
mechanics.

The owner methodology prioritizes Jupiter and Saturn. The closest retained
source audit contains Jupiter/Saturn conditions **from natal Moon**, not from
the D1 H10/H10 lord. Consequently, these are review candidates, not evidence
for substituting Moon-relative targets with D1 Career targets.

### `GOCHAR_CAREER_TIMING_PROPOSED_001` — Jupiter in tenth from natal Moon

| Field | Extraction |
| --- | --- |
| Source | Local pre-existing `external-career-gochar-source-audit.js`: Phala Deepika Ch. 26, verse 20, one Kapoor translation transcript. |
| Transit planet / natal target / relation | Jupiter; tenth house from natal Moon; occupancy. |
| Window semantics | State interval while Jupiter occupies that Moon-relative house. |
| Prerequisite | Existing approved D1/Dasha Career activation would be required by product policy, but is not supplied by the source predicate. |
| Role | `MANIFESTATION_SUPPORT` candidate only. |
| Evidence produced | Jupiter Moon-relative-H10 occupancy interval, with source/translation provenance. |
| Allowed conclusion | A sourced transit state is present for owner review. |
| Disallowed conclusion | Position loss, any Career outcome, timing guarantee, or D1-H10 equivalence. |
| Source confidence | **LOW**: one translation; stated source outcome mixes property/children with position. |
| Recommended owner action | **NEEDS CLARIFICATION**. |

### `GOCHAR_CAREER_TIMING_PROPOSED_002` — Saturn in third from natal Moon

| Field | Extraction |
| --- | --- |
| Source | Local pre-existing `external-career-gochar-source-audit.js`: Phala Deepika Ch. 26, verse 23, one Kapoor translation transcript. |
| Transit planet / natal target / relation | Saturn; third house from natal Moon; occupancy. |
| Window semantics | State interval while Saturn occupies that Moon-relative house. |
| Prerequisite | Existing approved D1/Dasha Career activation would be required by product policy, but is not supplied by the source predicate. |
| Role | `MANIFESTATION_SUPPORT` candidate only. |
| Evidence produced | Saturn Moon-relative-H3 occupancy interval, with source/translation provenance. |
| Allowed conclusion | A precisely defined source transit state exists for further review. |
| Disallowed conclusion | Employment gain, a job date, guarantee, or D1-H10 manifestation. |
| Source confidence | **LOW**: strong employment wording exists, but only one translation and no product safety approval. |
| Recommended owner action | **NEEDS CLARIFICATION**. |

### `GOCHAR_CAREER_TIMING_PROPOSED_003` — Saturn in tenth from natal Moon

| Field | Extraction |
| --- | --- |
| Source | Local pre-existing `external-career-gochar-source-audit.js`: Phala Deepika Ch. 26, verse 23. |
| Transit planet / natal target / relation | Saturn; tenth from natal Moon; occupancy. |
| Window semantics | State interval. |
| Role | `MANIFESTATION_SUPPORT` review entry only. |
| Evidence produced | A source-referenced occupancy interval. |
| Allowed conclusion | None for user-facing Career output. |
| Disallowed conclusion | Honour/status loss, illness, blame, or any predictive negative Career result. |
| Source confidence | **LOW** for product use: wording combines non-Career/high-stakes claims. |
| Recommended owner action | **REJECT**. |

### `GOCHAR_CAREER_TIMING_PROPOSED_004` — listed planets in tenth from natal Moon

| Field | Extraction |
| --- | --- |
| Source | Local pre-existing audit: Phala Deepika Ch. 26, verse 33. |
| Transit planet / natal target / relation | Sun, Mars, Jupiter, or Saturn; tenth from natal Moon; occupancy. |
| Window semantics | State interval for each listed planet. |
| Role | `MANIFESTATION_SUPPORT` review entry only. |
| Evidence produced | Listed-planet Moon-relative-H10 intervals. |
| Allowed conclusion | None for Career output. |
| Disallowed conclusion | Fall from position, wealth/life outcome, or a future window. |
| Source confidence | **LOW**: high-stakes bundled outcome and overlapping individual rules. |
| Recommended owner action | **REJECT**. |

### `GOCHAR_CAREER_TIMING_PROPOSED_005` — Layer 10 event context

| Field | Extraction |
| --- | --- |
| Source | `docs/LAYER-10-TRANSIT-EVENT-SCANNER.md`, Layer 13B3, and existing `career-transit-event-timing-context-v1`. |
| Transit planet / natal target / relation | All current supported grahas; existing Career-derived relation; structurally linked event. |
| Window semantics | Refined point event, not an outcome window. |
| Role | `MANIFESTATION_SUPPORT` candidate only. |
| Evidence produced | Ingress/station/same-Rashi/Drishti event provenance where the existing engine supplies it. |
| Allowed conclusion | Factual timing context. |
| Disallowed conclusion | Career manifestation or a future window. |
| Source confidence | **HIGH** for mechanics; **LOW** for Career timing. |
| Recommended owner action | **NEEDS CLARIFICATION** — no Career-specific planet/target restriction exists. |

No repository source supports Jupiter/Saturn transiting or aspecting D1 H10,
D1 H10 lord, or D10 Career factors as a Career timing predicate. No source
supports treating a transit of an active Dasha lord over such a factor as a
Career predicate. Those exact requested shapes are gaps, not inferred rules.

## Dasha + Gochar co-activation candidate

### `CAREER_COACTIVATION_PROPOSED_001` — approved inputs, proposed relevance

| Field | Extraction |
| --- | --- |
| Source | `docs/LAYER-13B4-CAREER-TEMPORAL-COACTIVATION.md` and existing `career-temporal-coactivation-v1`. |
| Inputs | An approved Dasha Career activation; an owner-approved Gochar manifestation-support candidate; same supplied Career subject; independent mechanism lineages; Gochar instant contained in every relevant `[start, end)` Dasha interval. |
| Exact predicate | All listed inputs are present and the Layer 12D pairwise classification is `INDEPENDENT`. |
| Evidence produced | `temporalCoactivation: true` with retained Dasha intervals and Gochar/transit evidence references. |
| Allowed conclusion | Independently sourced temporal mechanisms are co-active at the supplied instant. |
| Disallowed conclusion | Probability, strength score, a duration invented by co-activation, or a Career event. |
| Source confidence | **HIGH** for factual co-activation mechanics; **LOW** for an increased Career-timing effect. |
| Recommended owner action | **NEEDS CLARIFICATION** — existing source supports traceability, not a new eligibility or ranking consequence. |

## SAV/BAV and historical recurrence

SAV/BAV remains `SUPPORT_ONLY` under the existing Phase 16C policy. The Phase
2C audit found no new source-backed threshold, relative ranking, or
Jupiter/Saturn transit-BAV rule. The retained aggregate values in fixtures are
`OBSERVED_EXAMPLE_ONLY`; they cannot be turned into an eligibility condition.

Historical recurrence remains profile-scoped personalization/ranking support
after a classically valid candidate exists. OFFER and JOINING remain separate
observation points in one transition; they do not create separate universal
offer/joining signatures. No source material establishes D10 recurrence as a
universal predictive rule.

```text
NO_D1_DASHA_GOCHAR_CAREER_ACTIVATION + HIGH_SAV_BAV = NO_CAREER_WINDOW
HISTORICAL_MATCH without PRIMARY_CLASSICAL_ELIGIBILITY = NO_STRONG_WINDOW
```

## Proposed Phase 3 eligibility contract — not implemented

The closest source-compatible contract is:

```text
PRIMARY_CAREER_ELIGIBILITY (future only)
  = approved D1 Career relevance
  AND approved Dasha Career activation
  AND owner-approved, Career-specific Gochar manifestation support

D10 confirmation/refinement
  = optional factual context beside primary eligibility
  = not a hard false gate unless a future exact source defines contradiction

SUPPORT_MODIFIERS
  = SAV/BAV contextual support
  + historical recurrence personalization
  = cannot create or rescue primary eligibility
```

This contract follows the owner’s locked hierarchy while respecting the audit:
the currently retained sources do not yet supply the required approved Gochar
predicate, and they supply no executable D10 confirmation effect. Therefore it
cannot be activated in Phase 2C.

## Historical-fixture walkthrough

| Fixture | D1 / Dasha | D10 candidate | Gochar candidate | SAV/BAV | Recurrence | Result |
| --- | --- | --- | --- | --- | --- | --- |
| OFFER 2024-02-01 in `career-event-astrology-service.test.js` | Snapshot preserves factual Dasha intervals; no rulebook eligibility verdict. | Not exercised as confirmation. | A Jupiter ingress is detected within OFFER coverage; only Layer 10 mechanical context. | Snapshot has raw facts where supplied. | Observation anchor only. | Does not qualify a Career window. |
| JOINING 2024-02-02 in the same fixture | Separate factual observation. | Not exercised. | The preceding Jupiter ingress is not inside its next-day interval. | No rule. | Observation anchor only. | Demonstrates why OFFER/JOINING must not become universal signatures. |
| Two synthetic PROMOTION events in `career-pattern-comparison-service.test.js` | Repeated synthetic Dasha and H10 transit facts are compared. | No D10 pattern is produced. | Shared Jupiter/H10 fixture pattern is a historical recurrence fact, not a source-approved Gochar predicate. | Raw SAV `28` is observed only. | Exact recurrence output remains factual. | The methodology does not turn recurrence into eligibility. |

The methodology is coherent as a separation of evidence roles, but the
fixtures cannot validate the missing Career-specific Gochar predicate or a D10
confirmation effect.

## Phase 2C unresolved questions for owner approval

1. Which exact source, edition, and translation can approve a Gochar predicate
   that targets D1 H10/H10 lord rather than only natal Moon-relative houses?
2. If a Moon-relative Jupiter/Saturn condition were approved, what limited
   user-facing conclusion is allowed without importing its classical outcome
   wording wholesale?
3. Can D10 refinement change only explanation richness, or may it affect a
   bounded, non-probabilistic eligibility status? No current source answers.
4. Is any D10 contradiction concept authorised? No current source defines one.
5. Which planet-specific BAV/Pinda/Kakshya source and exact reference frame
   would be reviewed before any transit-support implementation?
6. What evidence would be sufficient to move a historical recurrence from
   factual resemblance to a bounded ranking modifier after primary eligibility?

## Phase 2C status

```text
FUTURE CAREER PROJECTION: DISABLED
CAREER TIMING METHODOLOGY: INSUFFICIENT SOURCE MATERIAL
```
