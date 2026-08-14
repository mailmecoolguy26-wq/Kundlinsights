# API-P4A — Authenticated D9 and D10 Divisional Charts

API-P4A adds two authenticated, read-only chart endpoints:

- `GET /v1/birth-profiles/:id/divisional-charts/d9`
- `GET /v1/birth-profiles/:id/divisional-charts/d10`

The request contains only an owned `birthProfileId`. The existing API-P3 secure birth-profile boundary verifies the authenticated principal, resolves the application user, enforces ownership, decrypts the stored authoritative birth data, and supplies it to the injected astronomical provider. Flutter does not send raw birth data, coordinates, timezone data, settings, or user identifiers.

The service reuses Layer 3's authoritative D9/D10 Varga results for the Ascendant and nine Grahas. It then reuses the existing `parashari-rashi-house-v1` authority against the resulting Varga coordinates to materialize the ordered 12-house sign map and each Graha's Varga house. Flutter receives these values and must not derive either signs or houses.

Each safe DTO contains the chart type, a separate Ascendant, ordered `houses`, and the nine Grahas. A Graha exposes its authoritative resulting-Rashi sign, `degreeWithinSign`, and house. That degree is the KundlInsights Varga engine coordinate within the derived resulting Rashi; it is not a natal longitude. Nakshatra/Pada, retrograde/motion, natal longitudes, raw birth data, encryption/KMS data, provider internals, IDs other than the requested profile ID, and interpretation are deliberately omitted.

The endpoints have no side effects: they create no reading, consume no entitlement, persist no chart, and make no payment or cache write. Foreign profiles return the existing non-enumerating ownership response. D11 and all other Vargas remain unsupported by this public API. These DTOs are intended only for future Flutter D9/D10 North Indian chart rendering; Dasha and interpretation remain outside API-P4A.
