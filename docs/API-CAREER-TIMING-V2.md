# Career Reading timing compatibility contract

Career reading detail is returned by `GET /v1/readings/:id`. Reading creation at
`POST /v1/readings` returns a summary only; clients reopen the persisted reading
through the detail route. Reading-list responses remain summary-only.

`careerTimingPeriods` is the legacy timing contract and remains available during
the compatibility period. `careerTiming` is an additive, optional snapshot with
`contractVersion: career-timing-production-v1` and half-open `[start, end)`
intervals. It is omitted for legacy/OFF readings and whenever a stored canonical
snapshot is malformed or has an unsupported contract version.

The canonical `authority` value must be interpreted explicitly:

- `SHADOW`: internal comparison data; continue using `careerTimingPeriods`.
- `CANONICAL`: canonical authority when the server rollout mode is ON.

Clients must never infer authority merely from field presence. `current`, `next`,
and `strongestWindow` use `null` when no selection exists. Dates and selections
are persisted point-in-time values and are not recalculated by list, detail, or
reopen operations.

The public canonical object is strictly projected to version metadata, periods,
product-safe labels, safe reason/evidence summaries, current/next selections,
and the explanation policy. Raw chart, birth, planetary, historical-event,
certification, debug, exception, and persistence metadata are never included.
