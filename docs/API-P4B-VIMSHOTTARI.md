# API-P4B — Authenticated Vimshottari State and Timeline

API-P4B adds two authenticated, read-only endpoints for an owned birth profile:

- `GET /v1/birth-profiles/:id/vimshottari?at=<UTC RFC3339>`
- `GET /v1/birth-profiles/:id/vimshottari/timeline?from=<UTC RFC3339>&to=<UTC RFC3339>&level=md|ad|pd`

The existing secure profile boundary verifies the principal, enforces profile ownership, decrypts stored authoritative birth data, and supplies it to the configured production Vimshottari engine. Flutter sends no raw birth data, user identity, Moon/Sun values, or ruleset selection.

All query instants are required RFC3339 UTC strings ending in `Z`. Periods use the existing Layer 4 half-open interval convention `[start, end)`: a period overlaps a requested timeline window when its start is before `to` and its end is after `from`. Timeline windows are capped at 1,827 civil days (five years), and return only the requested flat level in chronological order. AD entries include their Mahadasha lord; PD entries include both Mahadasha and Antardasha lords.

The production ruleset is server-authoritative `vimshottari-longitude-proportional-solar-return-v1`; it reuses the configured canonical sidereal Sun sampler and accepts no public Savana/Solar selector. Savana remains internal for legacy replay. DTOs expose only period lords, UTC boundaries, safe ruleset/provenance identifiers, and requested profile ID. They never expose birth data, encrypted material, identities, astronomy provider internals, or the complete nested 819-node tree.

Both endpoints are calculation-only: they create no reading, consume no entitlement, persist no Dasha, and write no cache. They are intended for a later Flutter current-period card and bounded timeline; interpretation remains outside API-P4B.

The current Layer 4 authority constructs its immutable nested timeline before API-P4B selects the active period or filters the requested flat level. API-P4B deliberately adds no cache or alternate calculation path; the five-year public window bounds response size, not the existing authoritative calculation work.
