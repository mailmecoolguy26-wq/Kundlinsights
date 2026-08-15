# API-P5A — Authenticated Current Transits / Gochar Snapshot

## Endpoint

`GET /v1/birth-profiles/:id/transits?at=<RFC3339 UTC timestamp>` returns an on-demand, factual Gochar snapshot for an owned active birth profile. The `at` parameter is required and must be a canonical UTC RFC3339 timestamp ending in `Z`; local wall-clock times, timezone names, and server-time defaults are not accepted.

The route authenticates the request and resolves the profile server-side through the existing encrypted birth-profile ownership boundary. Flutter supplies neither birth data nor a user identifier. The backend decrypts the authoritative stored profile, calculates the natal Rashi-house context and arbitrary-instant astronomical positions, then reuses the existing Gochar engine. It performs no persistence, reading creation, entitlement consumption, payment action, or event scan.

## Public DTO

The `transitSnapshot` response contains the requested UTC instant, the owned profile identifier, and exactly nine Grahas in stable order: Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, and Ketu. Each factual planet entry exposes its canonical sidereal longitude, authoritative Rashi, authoritative degree within that Rashi, authoritative natal-house placement, provider motion state, and a retrograde boolean derived only from that motion state.

It also exposes a minimal factual Saturn Sade Sati status: whether it is active, the existing engine phase (`rising`, `peak`, `setting`, or `none`), and Saturn's house from the natal Moon. No beneficial/adverse interpretation is attached.

The public DTO intentionally omits same-Rashi associations and transit Graha Drishti for this first mobile surface, although both remain available to internal engine consumers. It omits transit-event scanning entirely: ingress, station, re-entry, association, Drishti, and Sade Sati event timelines require separate range, cost, and API-policy design.

The DTO exposes no raw birth data, encrypted payload, key material, authenticated subject, database internals, provider debug objects, filesystem information, or engine trace.

## Intended Flutter usage

Flutter may call this endpoint with an explicit current UTC instant to render a factual Current Transits view. Flutter remains presentation-only: it must not calculate Rashi, degree within sign, natal house, motion, retrograde state, Sade Sati, or any interpretation.

Snapshot calculation is a moderate-cost on-demand operation. API-P5A intentionally introduces no cache or database persistence.
