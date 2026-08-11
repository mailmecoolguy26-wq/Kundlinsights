# Layer 12B3 — Career-status predicate evidence

Layer 12B3 is a bounded, immutable extension of the Layer 12B Career overlay. It selects supplied natal facts and records narrowly scoped structural relations needed by the completed Career-status source audit. It does not evaluate a predicate, produce a conclusion, calculate timing, or generate interpretation.

## Source-audit basis and identifiers

The two stable source-predicate identifiers identify audited source components only:

- `bphs-h10-honour-natal-v1`: *Brihat Parashara Hora Shastra*, Chapter 21, verses 8–10; `CLASSICAL_RULE`.
- `bphs-venus-saturn-professional-loss-natal-v1`: *Brihat Parashara Hora Shastra*, Chapter 60, Venus Dasha / Saturn Antardasha, verses 55–57; `CLASSICAL_RULE`.

Those source-result words occur only in the stable source-predicate identity and provenance. They are not evaluated fields or conclusions. The Layer 13 boundary remains responsible for any future, separately approved rule evaluation.

## Supplied factual evidence

For the Chapter 21 predicate, this layer preserves the supplied H9 lord identity through `CAREER_STATUS_H9_LORD`, its supplied placement through `CAREER_STATUS_H9_LORD_PLACEMENT`, and an H9-lord placement in H10 through `CAREER_STATUS_H9_LORD_H10_CONNECTION`. H9 is not a general Career house in this ruleset; it is selected only for this audited source predicate. The existing `CAREER_HOUSE_LORD_STATE` relation remains the sole traceable Layer 5B state relation for the H10 lord, including its factual `suppliedStateFlags.exalted` value.

Layer 6 supplies sign-based Graha Drishti, not a conjunction FACT. Layer 7 also explicitly defers conjunction/orb semantics. Therefore Layer 12B3 neither treats same-Rashi placement as conjunction nor calculates an orb from longitude. It records neutral missing data at `H10Lord.Jupiter.conjunction` until a future upstream structural conjunction contract exists.

For the Chapter 60 natal component, `CAREER_STATUS_SATURN_NATAL_HOUSE` is emitted only when the supplied Layer 5A Saturn placement is in House 8, 11, or 12. `CAREER_STATUS_SATURN_FROM_VENUS` is emitted only when supplied Layer 5A Rashi facts place Saturn 8th, 11th, or 12th from Venus. The latter uses the existing whole-sign convention:

`((saturnRashiIndex - venusRashiIndex + 12) % 12) + 1`

It consumes only supplied Rashi facts. There is no longitude calculation, provider access, temporal Dasha selection, or combination with an active Venus Mahadasha / Saturn Antardasha in this layer.

## Data guarantees and boundaries

Missing H9, H9-lord placement, H10-lord state, conjunction, Saturn placement, Venus Rashi, or relative Rashi facts are neutral `notProvided` records. Conflicting supplied H9 lord, Saturn, or Venus facts reject according to the established Career overlay contract. Equivalent upstream facts deduplicate through stable relation identity; outputs are lexically ordered and deeply frozen, and frozen input is accepted without mutation.

H2 and H11 remain the neutral Layer 12B2 contexts. H6 is excluded. Houses 8 and 12 appear only in the Saturn source-predicate component; no general house semantics are added. D10, Ashtakavarga, Gochar, transit events, Dasha activation, scoring, prediction, and natural-language interpretation are unchanged and outside Layer 12B3. The implementation imports no astronomy provider, ayanamsha, ephemeris, or transit-calculation code.
