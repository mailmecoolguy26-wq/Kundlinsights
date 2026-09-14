# Career Ashtakavarga Interpretation Policy — Phase 16C

Status: **research and product policy only.** This document adds no production
predicate, score, ranking, timing rule, API field, UI behaviour, or Career Chat
behaviour. It governs any future interpretation of the fact-only D1
`careerAshtakavargaStructure` added in Phase 16B.

## 1. Scope and invariant

Phase 16B exposes five facts, calculated from raw D1 Sarvashtakavarga (SAV):

1. H10 SAV;
2. H10 lord, its D1 house, and that house's SAV;
3. H7 SAV;
4. H7 lord, its D1 house, and that house's SAV;
5. the inclusively counted tenth house from the H10 lord's D1 placement, and
   that house's SAV.

These facts are supplementary evidence. They are **not** a Career prediction
engine. A Career conclusion must never be generated from this evidence family
alone. The architectural boundary remains:

```text
D1 Career structure + optional SAV corroboration + independent Dasha/Gochar
activation + historical calibration -> Career insight
```

Each family must retain its own semantics. In particular, a static natal SAV
fact must not create an activation date, a timing window, a probability, or an
employment outcome.

## 2. Evidence hierarchy and source register

| ID | Source | Type / tier | Relevant support | Material limitation |
|---|---|---|---|---|
| S1 | [BPHS English translation, chapter 11 and chapter 72](https://www.astrosumitbajaj.com/wp-content/uploads/2020/04/Brihat-Parasara-Hora-Shastra.pdf) | Classical text translation / A | Chapter 11 identifies Karm/H10 with profession/livelihood and Yuvati/H7 with trade. Chapter 72 describes aggregate-SAV bands for rashis/bhavas. | Translation and edition are not a modern empirical validation; chapter 72 is not a Career-only recipe. |
| S2 | [BPHS chapter 72 Sanskrit/English presentation](https://vedicpupil.in/library/brihat-parashara-hora-shastra-book-by-parashara/samudayashtakavarg-ch72) | Independent public translation/presentation / A-adjacent | Preserves the same `>30`, `25–30`, `<25` aggregate-SAV wording and its bhava framing. | Web presentation; future production source notes must pin a reviewed edition/translation. |
| S3 | [BPHS chapter catalogue](https://vedicspace.com/bphs) | Secondary navigation aid / C | Separates Ashtakavarga, its results, aggregate Ashtakavarga, and ray chapters. | It is not an interpretation authority and cannot transfer ray claims to SAV. |
| S4 | C.S. Patel, *Ashtakavarga* (lead retained in Phase 16A) | Modern technical commentary / B lead | May support future, page-pinned research on planet-specific methods. | Not independently page/edition-verified for any rule below; not a sole approval source. |

Excluded as production authority: practitioner videos, blogs, social posts,
unsourced threshold tables, and “career SAV score” conventions. They may
identify a question to research but cannot establish a rule.

### Source concepts relied upon

- S1 chapter 11: H10 is a profession/livelihood domain; H7 includes trade.
- S1/S2 chapter 72: aggregate SAV is read across rashis/bhavas; the cited
  translation states **more than 30** rekhas gives favourable effects,
  **25–30** medium effects, and **less than 25** adverse/damaged effects.
- S1/S2 do **not** state that SAV at a lord's occupied house, H7-lord's
  occupied house, or tenth-from-H10-lord produces a Career outcome.
- The chapter-72 statement about H11 having more rekhas than H10 is a specific
  comparison in a multi-condition wealth passage. It is not a general licence
  to rank arbitrary Career houses or create a relative-Career score.

## 3. Classification vocabulary

| Classification | Meaning in this policy |
|---|---|
| **SUPPORTED** | A deterministic statement directly supported by the reviewed source and bounded to its actual scope. No Phase 16C candidate is approved as a standalone Career outcome rule. |
| **CONTEXTUAL** | May be mentioned only beside an independently established D1 Career observation; it adds non-timing structural context and must state its limitation. |
| **FACT_ONLY** | Displayable as a verified calculation, but no interpretive Career prose may be attached. |
| **PROHIBITED** | Must not be inferred from these facts because it exceeds source support or creates prediction/false precision. |

## 4. Rule-by-rule audit

| ID | Candidate | Classification | Evidence and bounded conclusion | Production boundary |
|---|---|---|---|---|
| CAV-I01 | H10 SAV | **CONTEXTUAL** | H10 is a profession/livelihood bhava (S1); chapter 72 gives aggregate-SAV bhava doctrine (S1/S2). Together, this permits only source-bounded structural context for an already-established H10 Career observation. | Do not convert a raw number into a Career result. No standalone “strong/weak career,” promotion, job-security, or timing claim. |
| CAV-I02 | H10 SAV plus natal Career evidence | **CONTEXTUAL** | The two source concepts can be presented together without claiming that SAV independently proves the Career conclusion. | Requires a separate, validated D1 Career signal. The SAV sentence must be removable without changing the conclusion. |
| CAV-I03 | SAV at H10 lord's placement house | **FACT_ONLY** | The H10 lord's placement is a legitimate natal fact, but no reviewed source ties the SAV of that occupied house to a Career interpretation. | Show the planet, house, and raw SAV only; no “supports the lord,” “strengthens Career,” or adverse/favourable claim. |
| CAV-I04 | H7 SAV | **CONTEXTUAL** only for explicit business/trade or public-dealing context | H7 includes trade (S1), while chapter 72 supplies general bhava-SAV doctrine (S1/S2). This does not make H7 a universal employment factor. | Only alongside an independently supported business/trade/public-dealing signal. Never apply it to all jobs, Career success, salary, or partnership outcome. |
| CAV-I05 | SAV at H7 lord's placement house | **FACT_ONLY** | No reviewed source combines this lookup with a business or Career conclusion. | No support/strength, partnership, employment, or business-success prose. |
| CAV-I06 | Tenth from the H10 lord placement | **FACT_ONLY** | Inclusive counting is deterministic. No reviewed source identifies this exact compound as an SAV Career construct. It must not be substituted for H7/“10th from 10th,” Bhavat Bhavam, a karaka construct, or a varga rule. | Retain as labelled structural data only. No Career explanation. |
| CAV-I07 | Relative versus absolute SAV | **FACT_ONLY** for descriptive comparison; no interpretive comparison policy | A within-chart comparison is mathematically valid. S1 has a particular H11-vs-H10 statement with additional conditions, not a general ranking theorem for H10/H7/lord-placement values. | Do not say “comparatively stronger/weaker” in production until an exact, reviewed comparator doctrine is approved. Never rank, percentile, top-three, or average-score. |
| CAV-I08 | Threshold policy: 28, `>30`, 25–30, `<25` | **PROHIBITED** as a Career threshold policy | `337 / 12` is a mathematical mean, not a Career cutoff. S1/S2 support a general `>30` (not `30+`) / 25–30 / <25 formulation, but do not establish a Career threshold, scoring scale, or UI band policy. | **NO THRESHOLD POLICY remains in force.** Do not label users, score factors, or use bands to generate Career prose. |
| CAV-I09 | SAV as corroboration | **CONTEXTUAL** only under the wording policy below | “Corroboration” accurately means supplementary, non-decisive context. “Support” is allowed only when it refers to the existence of the factual aggregate-SAV observation beside an independent D1 observation. | No activation, prediction, confidence, or causal language. SAV cannot turn an unsupported Career inference into a supported one. |
| CAV-I10 | Outcome and precision claims | **PROHIBITED** | Neither the reviewed aggregate-SAV doctrine nor the Phase 16B facts supplies these outcomes. | See the explicit prohibited list below. |

## 5. Deterministic wording policy

### Allowed only for CAV-I01/I02, with another D1 Career signal present

Use one bounded sentence, after the primary D1 statement:

- “The 10th Bhav's Ashtakavarga value is included here as additional natal
  context for the Career structure already visible in your Janam Kundli.”
- “This Ashtakavarga detail corroborates the structural Career picture; it
  does not by itself predict a job change or promotion.”
- “The 10th Bhav carries **[raw SAV]** SAV bindus in this D1 chart.”

The first two examples require the independently validated D1 signal. The
third is factual display and is safe without it.

### Allowed only for CAV-I04, with a supported business/trade/public-dealing signal

- “The 7th Bhav is being shown as business/trade context in this chart; its
  SAV value is supplementary rather than a result on its own.”
- “This is contextual information for business or public-dealing themes, not
  a general employment conclusion.”

### Fact-only patterns for CAV-I03/I05/I06/I07

- “10th lord: **[planet]**, placed in the **[house]** Bhav; that Bhav has
  **[raw SAV]** SAV bindus.”
- “10th from the 10th lord's placement: **[house]** Bhav; **[raw SAV]** SAV
  bindus.”
- “The displayed values are D1 structural facts; no SAV ranking or threshold
  is applied.”

### Disallowed terms unless a later policy approves their exact use

Do not use `strong`, `weak`, `favourable`, `unfavourable`, `high`, `low`,
`better`, `worse`, `supportive`, `limiting`, `activation`, or `strengthens` as
labels for a user's SAV value. S1/S2 use broad translated terms, but Phase 16C
does not authorise their conversion into a product Career classification.

## 6. Explicitly prohibited claims

The following must never be inferred from any Phase 16B fact alone, including
when a raw SAV is above/below an average or a classical band:

- guaranteed Career success, promotion, a new job, job loss/unemployment,
  salary or income growth;
- leadership, managerial authority, subordinates, entrepreneurship success,
  work scale, or foreign opportunity;
- timing, an activation window, transit outcome, recurrence, a date, or
  “soon”; 
- a probability, confidence, score, rank, percentage, majority vote, or
  positive-minus-negative total;
- a conclusion about a lord merely because its occupied house has a SAV value;
- a conclusion about H7 for ordinary employment rather than the narrowly
  qualified business/trade/public-dealing context.

## 7. Threshold and relative-comparison policy

### Thresholds

**No threshold is authorised for Career production use.**

- `28` is an arithmetic reference from a fixed SAV total, not a doctrinal
  Career cutoff.
- The reviewed translation's language is `more than 30`, not `30+`; changing
  it changes the boundary at 30.
- The general chapter-72 bands cannot be silently promoted into a Career
  outcome, badge, score, rank, or deterministic template.
- No combination of the five facts may use a majority, weighted score, or
  threshold count.

### Relative comparisons

Within-chart differences may be calculated for research, but they remain
**FACT_ONLY** in production. The narrow H11-versus-H10 wording in chapter 72
is a specified multi-condition wealth statement, not authority for generic
H10-vs-H7, lord-house-vs-source-house, average, median, percentile, or
top-N comparisons. A future comparator policy requires a separately reviewed,
exact source and an outcome-safety audit.

## 8. Interaction policy for other evidence families

| Family | Allowed relationship | Not allowed |
|---|---|---|
| D1 Career structure | Primary source of any Career structural conclusion. CAV-I01/I02 may supply bounded corroborating context. | Let SAV create or override a D1 conclusion. |
| D10 | Independently corroborating Career chart context only. Phase 16B has D1 SAV, not D10 SAV. | Transfer D1 SAV to D10 or claim D10 SAV. |
| Dasha | Independent time-state evidence. | Derive a Dasha result/date from static SAV. |
| Gochar | Independent transit evidence under its own audited rules. | Treat raw SAV as a Career transit trigger or activation rule. |
| Historical calibration | Independent, profile-scoped corroboration of existing Career presentation. | Treat events as validation of a static SAV threshold or prediction rule. |

## 9. Recommended Phase 16D subset

Only the following would be safe to implement after copy and test review:

1. Keep the existing fact-only section unchanged by default.
2. Where a separate production D1 Career insight is already valid, add at most
   one optional CAV-I02 sentence from the allowed wording list.
3. Require the rendered sentence to include the non-predictive limitation, or
   render no interpretation.
4. For explicitly business/trade/public-dealing insight context, permit the
   narrow CAV-I04 caveat only when that primary context already exists.
5. Leave CAV-I03/I05/I06/I07 as labelled facts, and preserve no-threshold
   behaviour for every value.

This is a presentation addition only: no new calculation, API schema,
synthesis ranking, Career Chat intent, Dasha/Gochar rule, persistence change,
or entitlement effect.

## 10. Explicit non-goals

Phase 16C does not:

- validate astrology empirically or establish causal prediction;
- add thresholds, scores, rankings, confidence/probability, or timing;
- infer events from H10/H7/lord-location values;
- interpret nodes as sign lords;
- calculate SAV for D10 or create a transit SAV rule;
- change Phase 16B's immutable reading snapshots or public DTO.

## 11. Review triggers

Re-open this policy only with one of the following:

1. a pinned primary/translation source that directly addresses an omitted
   compound construct;
2. a separate, reviewed technical-source audit for a specific planet-BAV,
   Pinda, Kakshya, and transit reference frame; or
3. a privacy-reviewed, sufficiently powered outcome-validation study that is
   expressly authorised as a new product-research phase.

Until then, ambiguity resolves to fact-only display or omission.
