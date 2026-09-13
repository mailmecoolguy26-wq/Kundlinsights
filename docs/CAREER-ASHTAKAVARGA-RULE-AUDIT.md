# Career Ashtakavarga Rule Audit — Phase 16A

Status: research/evidence audit only. This document adds no production Career
predicate, threshold, ranking, timing rule, API, or UI behavior.

## Decision

**Recommended next product option: B — IMPLEMENT FACT-ONLY STRUCTURE.**

The existing `NO THRESHOLD POLICY` remains in force for production conclusions,
scores, and outcome language. A classical translation provides a narrow
Samudaya-Ashtakavarga statement about house effects at **more than 30** Rekhas;
it is not a five-factor Career formula, is not `30+`, and does not support
employment, leadership, scope, or timing promises. It may justify a future,
separately reviewed *source-cited structural note* for D1 raw SAV, but not a
global Career threshold policy.

## Existing repository support and boundaries

- Layer 11A deterministically computes raw D1 planetary BAV, separate Lagna
  BAV, and raw SAV. Raw SAV has a fixed total of 337 and excludes Lagna BAV.
  Rahu/Ketu do not receive BAV under the selected ruleset.
- Layer 12B records H10 as the sole primary Career house, with H2/H11 only
  neutral context. Existing `CAREER_ASHTAKAVARGA_CONTEXT` preserves raw values
  and explicitly records `thresholdOrRanking: not-performed`.
- D10 is corroborating context only. No SAV is calculated for D10.
- Dasha and Gochar remain independent timing evidence. Calibration is
  corroboration, not an astrological predicate.
- The prior research-only audit (`scripts/research/ashtakavarga-career-audit.js`)
  found no outcome cohort and concluded `NO THRESHOLD POLICY`.

## Source-quality register

| ID | Source | Tier | What it can support | Limits |
|---|---|---|---|---|
| S1 | *Brihat Parashara Hora Shastra* (BPHS), public English translation, Ch. 11 | A translation | Karm/H10 includes profession/livelihood; Yuvati/H7 includes trade | House signification alone is not an SAV formula. |
| S2 | BPHS, Ch. 72, `Samudaya/aggregational Ashtakavarga` | A translation | aggregate Rekha bands: `>30`, `25–30`, `<25`; general bhava effects | No Career-only five-factor formula; terminology/edition must remain attached to any future use. |
| S3 | BPHS, Ch. 70 transit passages | A translation | planet-specific Ashtakavarga/Rekha transit doctrine and additional Pinda/Kakshya mechanics | Does not license generic SAV-only Career-transit timing. |
| S4 | C.S. Patel, *Ashtakavarga* | B lead | practitioner/scholarly commentary on planet-specific transit methods | Not used as sole approval; page/edition verification is still required. |
| S5 | Supplied practitioner video | C lead | candidate-rule origin only | Not production authority; no retained URL/transcript was available for independent quotation. |
| S6 | Generic current websites | D | terminology cross-check only | Not used for approval. |

The exact public translation used for S1–S3 is linked in the source notes. A
future production predicate must pin an edition, chapter/verse range, and
translation metadata rather than treating an unversioned web copy as immutable
authority.

## Candidate rule matrix

`Calculation` means a deterministic D1 fact. `Interpretation` is a source-bound
meaning. `Outcome` is a claim about employment, status, promotion, income, or
business result and is not implied by a calculation.

| Rule | Classification | Best tier | What evidence actually supports | Safe level | Recommendation |
|---|---|---:|---|---:|---|
| CAV-01 H10 SAV as Career structural factor | PARTIALLY_SUPPORTED | A | H10 signifies profession; Ch. 72 gives a general Samudaya-bhava rule | 2 | Future D1-only cited structural context; no outcome. |
| CAV-02 SAV at H10-lord’s occupied house | INSUFFICIENT_EVIDENCE | — | Lord placement is a factual natal relation; no located source combines this SAV lookup with Career | 0 | Retain only as audit fact. |
| CAV-03 H7 SAV as Career/business factor | PARTIALLY_SUPPORTED | A | H7 signifies trade; it is also mathematically 10th from H10 | 1 | Business/public-dealing context only, never universal Career strength. |
| CAV-04 SAV at H7-lord’s occupied house | INSUFFICIENT_EVIDENCE | — | H7 lord placement is factual; no located Career-SAV rule | 0 | Audit fact only. |
| CAV-05 SAV at 10th from H10-lord’s house | INSUFFICIENT_EVIDENCE | — | Counting is deterministic; no located source supports this compound Career-SAV predicate | 0 | Do not interpret. |
| CAV-06 28 as SAV average/reference | PARTIALLY_SUPPORTED | A / math | 337 ÷ 12 = 28.083… is an invariant-derived mean | 0 | Reference statistic only, not a universal threshold. |
| CAV-07 `30+` as stronger/very-good | PARTIALLY_SUPPORTED | A | Ch. 72 says **more than 30**, with 25–30 medium | 2 | Never rewrite as `30+`; no “very good” or Career outcome wording. |
| CAV-08 five-factor majority synthesis | UNSUPPORTED | — | No located text supports five-factor voting or plus/minus counting | 0 | Do not score, vote, or count. |
| CAV-09 transit through high-SAV Career houses | PARTIALLY_SUPPORTED | A | Transit doctrine uses planet-specific Ashtakavarga; aggregate context exists in a different passage | 0 | Research further; no Career timing behavior. |
| CAV-10 high H10 SAV means rarely unemployed | UNSUPPORTED | — | No located source establishes this employment outcome | 4 prohibited | Do not use. |
| CAV-11 30+ H10 SAV means leadership/people working under native | UNSUPPORTED | — | No located SAV rule; likely conflates different “rays” material with Rekhas | 4 prohibited | Do not use. |
| CAV-12 high SAV means larger business/work scope | UNSUPPORTED | — | No located SAV-to-scale rule | 4 prohibited | Do not use. |

## Findings by question

### CAV-01 — H10

S1 makes H10/Karm a profession/livelihood house. S2 says that, among the twelve
bhavas, a Samudaya total above 30 advances the effects of a bhava; 25–30 is
medium and below 25 damages them. Combining those propositions into “H10 SAV is
a Career structural factor” is a **source-bounded inference**, not an explicit
Career recipe. It cannot yield a claim such as job security, promotion, or
leadership.

### CAV-02, CAV-04, CAV-05 — lord-location compounds

The proposed values can be calculated precisely, but no located Tier A/B source
ties (a) the H10-lord’s occupied house SAV, (b) the H7-lord’s occupied house
SAV, or (c) the 10th counted from H10-lord’s location to a Career result. The
last is distinct from **10th from the 10th** (H7), Bhavat Bhavam, or a karaka
calculation. It must not be silently substituted for any of those doctrines.

### CAV-03 — H7 nuance

S1 assigns trade to Yuvati/H7. H7 is also 10th from H10 arithmetically. That
supports a narrow business/public-dealing framing, not a universal employment
or Career-strength factor. No source was located for an H7-SAV Career outcome.

### CAV-06 — 28

Raw SAV’s fixed total is 337, so the arithmetic mean over 12 signs is
**28.0833…**. This is a mathematically sound descriptive reference, but no
located primary source says that exactly 28 is a universal interpretive cutoff.
The sample below also shows that using 27/28/29/30 changes many classifications.

### CAV-07 — 30

S2 is material new evidence: it states `more than 30` Rekhas for a general
Samudaya bhava advances its effects, `25–30` is medium, and `<25` damages them.
Therefore the video’s `30+` formulation is not faithful: 30 itself belongs to
the middle band in that translation. The passage is general and cannot support
“very good Career,” promotion, managerial authority, or a score.

### CAV-08 — majority

No located Tier A/B authority supports summing five selected SAV values,
majority voting, `4/5`, a percentage, or a positive-minus-negative total. The
BPHS wording about majority of benefic/malefic influences in a different
Sudarshana context is not a transferable five-SAV aggregation rule.

### CAV-09 — transit and SAV versus BAV

S3’s transit procedures are **planet-specific**: they refer to the relevant
graha’s Ashtakavarga/Rekhas and in places use Yog Pinda/Kakshya mechanics. They
do not authorize “a slow planet through a high H10 SAV house means good Career
timing.” A future transit predicate would have to state: transiting planet,
its BAV, reference frame, house/sign, applicable Pinda/Kakshya rule, Dasha
context, and the exact domain mapping. Current recommendation: **RESEARCH
FURTHER**.

## Strong claims expressly rejected

Do not render or infer any of the following:

- high H10 SAV means the person will rarely/never be unemployed;
- `30+` H10 SAV means leadership, subordinates, or managerial authority;
- high SAV means larger business or work scope;
- high-SAV transit means a good Career result;
- low-SAV transit means a bad/slow Career result;
- any probability, confidence percentage, promotion guarantee, exact job date,
  or aggregate Career score.

The BPHS translation’s chapter on **rays** has separate numerical statements
about social standing. Those ray values are not Samudaya SAV Rekhas and must
never be transferred into SAV interpretation.

## Deterministic candidate-data contract (not production)

The minimum possible audit DTO is D1/raw-SAV fact collection only:

```text
careerAshtakavargaStructure
  source: D1_RAW_SAV
  h10Sav
  h10Lord
  h10LordHouse
  h10LordHouseSav
  h7Sav
  h7Lord
  h7LordHouse
  h7LordHouseSav
  tenthFromH10LordHouse
  tenthFromH10LordHouseSav
```

`tenthFromH10LordHouse` is counted inclusively (lord house = first; add nine
houses with wrap-around). Null/missing input remains null. The DTO contains no
band, polarity, majority count, recommendation, timing state, or outcome.

## Evidence and future UX boundary

If a later phase ships the fact DTO, map every row to **neutral evidence**.
Do not create supportive/limiting evidence until a distinct audited predicate
exists. A safe future section title is `Career Ashtakavarga Structure`, with
factual rows such as `10th Bhav — 31 SAV bindus`. Do not include a synthesis,
history CTA, D10 SAV, or transit conclusion.

D1 remains primary. D10 can corroborate independently supplied Career context
but must not receive raw-SAV treatment without its own source audit. Dasha may
later co-exist as separate temporal evidence but must not be modified by this
static structure. Transit+SAV is not safe now.

## Descriptive distribution audit

The research-only script generated 250 deterministic non-PII fixtures through
the production Ashtakavarga service. It is not a user cohort and has no outcome
labels.

| Factor | Min | Median | Mean | Max |
|---|---:|---:|---:|---:|
| H10 SAV | 21 | 30 | 30.268 | 47 |
| H10-lord-house SAV | 16 | 26 | 26.524 | 39 |
| H7 SAV | 18 | 25 | 25.648 | 38 |
| H7-lord-house SAV | 16 | 26 | 26.808 | 42 |
| 10th-from-H10-lord-house SAV | 18 | 30 | 30.000 | 41 |

Threshold sensitivity for **H10 SAV** over the same 250 fixtures:

| Reference | Below | Equal | Above | At-or-above |
|---:|---:|---:|---:|---:|
| 27 | 44 | 26 | 180 | 206 |
| 28 | 70 | 22 | 158 | 180 |
| 29 | 92 | 22 | 136 | 158 |
| 30 | 114 | 35 | 101 | 136 |

Changing only the chosen reference substantially changes labels. The sample also
contains both an H10-high/other-factors-mixed fixture and an H10-low/
other-factors-mixed fixture. This demonstrates factor disagreement; it does not
validate majority synthesis or prediction.

## Phase 16B implementation status

Phase 16B implements the recommended **fact-only** snapshot structure for
newly generated Career Readings. It is D1/Lagna based and uses the existing
raw SAV plus canonical Rashi-house/lord data. The public contract contains
only the relevant house number, eligible sign lord, and raw SAV bindu values:

- H10 and H7 SAV;
- H10/H7 lord placement and the SAV of that placed Bhav;
- the inclusively counted tenth Bhav from the H10-lord placement and its SAV.

This remains supplementary reading detail: it does not enter Career Insight
ranking, timing, calibration, D10, Career Chat, or an entitlement decision.
Old immutable snapshots without this field remain unchanged. Missing factual
values are omitted rather than inferred.

No Phase 16A classification has been promoted into a product predicate. In
particular, the `28` reference and `>30` general aggregation band remain
research context only, not user-facing thresholds.

## Phase 16B boundary

1. Keep production behavior unchanged unless explicitly authorized.
2. If implementation is chosen, expose only the fact-only D1 raw-SAV contract
   above, behind the existing evidence boundary.
3. Do not add an interpretation, threshold, majority model, timing rule, D10
   SAV, score, probability, or outcome language.
4. Keep CAV-09 transit work in a separate source audit with BAV/Pinda/Kakshya
   and reference-frame requirements.
5. Pin and review a specific BPHS edition/translation before any Level 2 prose.

## Public source notes

- BPHS English translation, Ch. 11 house indications and Ch. 72 aggregational
  Ashtakavarga: <https://www.iswaryajyotisha.com/pages/library.php?book=Brihat+parspara+hora+sastra>
- Bharat Ephemeris overview of BPHS Ashtakavarga chapter structure (secondary
  navigation aid only): <https://bharatephemeris.com/learn/bphs/bphs-ashtakavarga>
- C.S. Patel *Ashtakavarga* scan (Tier B lead; edition/page verification still
  required): <https://storage.yandexcloud.net/j108/library/lww9wzia/C.S._Patel_-_Ashtakavarga.pdf>
