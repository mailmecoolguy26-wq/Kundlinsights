# Layer 12C — Temporal activation evidence

Layer 12C builds an immutable, deterministic temporal activation overlay from supplied Layer 4 Vimshottari periods, Layer 9 Gochar snapshots, Layer 10 transit events, a Layer 12A natal graph, and optionally a Layer 12B Career graph.

It is an assembler only. It performs no astronomical, ayanamsha, Dasha, Gochar, transit-scanning, natal-interpretation, or prediction calculation.

`buildTemporalEvidence({ natalGraph, domainGraph, dasha, gochar, transitEvents, instant })` requires a canonical UTC instant. Dasha periods use Layer 4 half-open intervals: `start <= instant < end`. Gochar snapshots must be for that instant. Transit-event nodes preserve each supplied canonical Layer 10 event type.

Temporal facts can structurally activate matching supplied natal or Career references. A neutral `TEMPORAL_CO_ACTIVATION` is created only when an active Dasha relation and a Gochar/event relation independently target the same static subject. It is not a score, weighting, probability, or prediction.

Layer 12A remains generic static evidence infrastructure. Layer 12B remains the H10-only Career static overlay. Layer 12C adds temporal evidence without adding H2/H6/H11, natural Karakas, Career Yoga interpretation, D10 houses, transit Ashtakavarga scoring, Pinda timing, remedies, recommendations, or natural-language readings.

Optional Dasha, Gochar, transit-event, and Career-domain inputs produce neutral `notProvided` missing-data facts. Contradictory active Dasha lords, contradictory Gochar body facts, conflicting event identities, and a Career graph from another natal graph are rejected.
