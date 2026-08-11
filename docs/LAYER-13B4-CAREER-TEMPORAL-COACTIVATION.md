# Layer 13B4 — Career temporal co-activation policy

Layer 13B4 is a deterministic evidence-architecture policy. It consumes existing Layer 12B/12B2 Career relations, Layer 12C temporal activation relations, Layer 12D independence analysis, and the existing Layer 13B2/B3 structural conclusions. It performs no astronomical, Dasha, Gochar, transit-event, D10, Ashtakavarga, Yoga, Karaka, or Maitri calculation.

The sole production rule is `career-temporal-coactivation-v1`, classified as `ENGINE_CONVENTION`. It may state only that a supplied Dasha mechanism and supplied Gochar snapshot or transit-event mechanism independently activate the same supplied Career subject.

## Qualification policy

- One or more MD/AD/PD relations for the same subject and Dasha conclusion form one `DASHA` mechanism family.
- A supplied Layer 9 snapshot is `GOCHAR_SNAPSHOT`; a supplied Layer 10 event is `TRANSIT_EVENT`.
- The Layer 12D pairwise classification between the selected temporal nodes must be `INDEPENDENT`.
- `IDENTICAL`, `FULLY_DEPENDENT`, and `PARTIALLY_OVERLAPPING` do not qualify in v1.
- The supplied Gochar/event instant must fall in every retained supplied Dasha interval using Layer 4's `[start, end)` boundary.
- Explicit Layer 12D contradictions yield `CONTRADICTED`; a missing required temporal family yields `INSUFFICIENT_EVIDENCE`; supplied families with no qualifying same-subject pair yield `NOT_APPLICABLE`.

The engine preserves Dasha intervals, Gochar snapshot instants, and Layer 10 event identities. It never fabricates a co-activation interval or Career event window.

## Exclusions

H2 remains resource context and H11 gains context only. Neither means salary or promotion. This layer emits no job-change, promotion, job-loss, pressure, obstruction, success, failure, score, probability, confidence, recommendation, remedy, or outcome conclusion.
