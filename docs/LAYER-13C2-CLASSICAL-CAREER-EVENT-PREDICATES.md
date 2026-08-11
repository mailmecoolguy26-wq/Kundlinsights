# Layer 13C2 — Classical Career event predicates

Layer 13C2 evaluates one narrow, source-audited classical predicate from already supplied evidence. It does not calculate astronomy, longitude, houses, Vargas, Dasha periods, Gochar, transit events, or any new natal relationship.

## Implemented rule

`career-venus-md-saturn-ad-professional-loss-predicate-v1` is a production `CLASSICAL_RULE` under `parashari-career-classical-event-predicates-v1`.

It consumes Layer 12B3 source predicate `bphs-venus-saturn-professional-loss-natal-v1`, whose recorded source provenance is *Brihat Parashara Hora Shastra*, Chapter 60, Venus Dasha / Saturn Antardasha, verses 55–57. Layer 13C2 retains that upstream identity and provenance; it does not replace or reinterpret the source reference.

The only positive topic is `CAREER_CLASSICAL_PROFESSIONAL_LOSS_PREDICATE_PRESENT`. `SUPPORTED` means that the source-defined natal and temporal requirements are represented by traceable supplied evidence and no relevant Layer 12D contradiction exists. It means predicate satisfaction only. It does not assert that any professional loss will occur, nor does it mean termination, firing, unemployment, salary loss, business failure, financial loss, demotion, pressure, instability, probability, or a recommendation.

## Required evidence

One Layer 12B3 natal relationship is required:

- `CAREER_STATUS_SATURN_NATAL_HOUSE`, emitted upstream only for Saturn in natal H8, H11, or H12; or
- `CAREER_STATUS_SATURN_FROM_VENUS`, emitted upstream only for Saturn eighth, eleventh, or twelfth from Venus by the existing whole-sign relationship.

The branches are alternatives. If both are supplied, they yield one conclusion, without scoring, strengthening, or duplicate outcomes.

Layer 12C must supply a Venus Mahadasha node and a Saturn Antardasha node, with the Saturn AD interval contained in the Venus MD interval. The supplied temporal instant is evaluated as `[start, end)`: the exact AD start qualifies and the exact AD end does not. Layer 13C2 consumes the supplied period nodes and temporal activation relations; it never infers missing hierarchy or recalculates periods.

Pratyantardasha is optional traceability context only. It does not change the conclusion. Gochar, transit events, and Layer 13B4 co-activation are neither required nor consumed.

## Status and contradiction policy

- `SUPPORTED`: all explicit natal and Dasha predicates are supplied, traceable through Layer 12D, temporally compatible, and not contradicted.
- `CONTRADICTED`: Layer 12D reports a contradiction touching selected natal or required Dasha evidence. Contradiction IDs are preserved; no ranking or resolution occurs.
- `INSUFFICIENT_EVIDENCE`: a required source component, Dasha hierarchy, or Layer 12D traceability is absent.
- `NOT_APPLICABLE`: supplied complete evidence does not match, such as Venus MD with another AD, another MD with Saturn AD, a supplied but nonqualifying Saturn configuration, or a time at the exclusive Dasha end.

Absence is never negative evidence.

## Explicit exclusions

Layer 13C2 does not consume Layer 5C same-Rashi association and does not map it to `yuti`, `saṃyuta`, conjunction, or `gurusaṃyute`. Therefore the Layer 12B3 H10 honour source predicate remains unavailable. No other Career event family, H6 Career semantics, D10 event reading, Yoga/Karaka/Maitri, Ashtakavarga/Pinda timing, prediction, natural-language rendering, score, probability, confidence, or outcome field is added.
