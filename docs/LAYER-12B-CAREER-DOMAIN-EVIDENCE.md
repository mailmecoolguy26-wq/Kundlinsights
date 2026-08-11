# Layer 12B — Career-domain evidence

Layer 12B is a deterministic, immutable Career overlay over a completed Layer 12A natal evidence graph. Its ruleset is `parashari-career-domain-evidence-v1`; its only domain identifier is `CAREER`.

## Scope and boundary

The overlay selects supplied natal facts and creates traceable derived relationships. It performs no astronomy, coordinate, house, state, Drishti, Varga, Ashtakavarga, Dasha, Gochar, or transit calculation. It does not score, rank, predict, or interpret.

H10 remains the sole primary Career house. Layer 12B2 additionally selects H2 as a neutral resource context and H11 as a neutral gains/acquisition context. Layer 12B3 adds only the narrowly audited H9 and Saturn/Venus source-predicate facts documented in [LAYER-12B3-CAREER-STATUS-PREDICATE-EVIDENCE.md](LAYER-12B3-CAREER-STATUS-PREDICATE-EVIDENCE.md). H6 remains explicitly deferred: this overlay does not encode service, employment, obstruction, or any outcome. The H10 lord and H10 occupants are read only from Layer 5A FACT nodes; the overlay never recalculates sign ownership or house placement.

## Input and output

`buildCareerEvidence({ natalGraph })` requires a completed Layer 12A natal graph. It rejects domain/temporal nodes and any temporal activation input. The return value contains source graph and evidence-node IDs, immutable Career derived relations, neutral missing-data records, and provenance.

Every relation references its source Layer 12A node IDs. Relations have a source-strength label describing source provenance only, never an outcome significance.

## Supported neutral relationships

- `CAREER_PRIMARY_HOUSE`: supplied H10 relates to `CAREER`.
- `CAREER_HOUSE_LORD`: supplied Layer 5A H10 lord.
- `CAREER_HOUSE_OCCUPANT`: each supplied Layer 5A H10 assignment.
- state relations: supplied Layer 5B dignity, combustion, and motion facts for the H10 lord or occupants. The state flags are preserved as facts, not evaluated.
- aspect relations: supplied Layer 6 sign-based Graha Drishti targeting H10, and separately any supplied target-body Drishti targeting the H10 lord.
- `CAREER_D10_PLACEMENT`: supplied Layer 3 D10 Rashi facts for the H10 lord and occupants. No D10 houses, Lagna mapping, or D10 dignity is created.
- `CAREER_ASHTAKAVARGA_CONTEXT`: supplied raw H10-Rashi SAV, H10-lord BAV at the lord’s supplied natal Rashi, supplied Shodhita BAV, and supplied target-body Pinda. Values remain raw, neutral structural metadata with no threshold or ranking.

Layer 12B2 adds only these H2/H11 relations:

- `CAREER_RESOURCE_HOUSE` and `CAREER_GAIN_HOUSE` preserve the respective supplied Layer 5A house facts and distinguish the classical house signification from the Career-domain selection convention.
- `CAREER_CONTEXT_HOUSE_LORD` and `CAREER_CONTEXT_HOUSE_OCCUPANT` identify only supplied lordship and Rashi-house assignments.
- `CAREER_CONTEXT_HOUSE_LORD_STATE`, `CAREER_CONTEXT_OCCUPANT_STATE`, `CAREER_CONTEXT_HOUSE_ASPECT`, and `CAREER_CONTEXT_HOUSE_LORD_ASPECT` preserve supplied Layer 5B/6 facts without evaluation.
- `CAREER_HOUSE_DOMAIN_CONNECTION` records only a supplied placement of an approved selected-house lord in another selected Career-domain house.

These relations never mean salary, compensation, promotion, advancement, income from employment, success, failure, or an outcome. Limited D10 Rashi and Ashtakavarga/Pinda context remains H10-only.

Layer 12B3 preserves H9-lord identity and a supplied H9-lord placement in H10 only for its audited source predicate. It reuses the existing factual H10-lord state relation, records only the listed supplied Saturn natal-house and Saturn-from-Venus whole-sign relationships, and leaves the currently unavailable Jupiter-conjunction component as neutral missing data. It does not infer conjunction from sign co-location or Graha Drishti.

Yoga and natural-Karaka Career mappings are deferred because no audited mapping is encoded in this ruleset. Optional missing Layer 5B, Layer 6, D10, or Layer 11 data is reported as `notProvided`; absence is not negative evidence. Missing H2/H11 facts create no Career-context relation and never imply an empty house.

## Non-goals

Layer 12B does not attach Mahadasha, Antardasha, Pratyantardasha, Gochar, Sade Sati, ingress, station, transit Drishti, events, predictions, strength scores, probabilities, or prose interpretation. Those boundaries remain for later approved layers.
