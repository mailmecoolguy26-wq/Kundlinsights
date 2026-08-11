# Layer A1 — Birth Place Resolution

Layer A1 is an application boundary, not astrology. A Mapbox permanent-geocoding adapter (deployment-gated) normalizes a selected place; an injected offline Time Zone Boundary Builder resolver supplies its IANA timezone. The immutable `ResolvedBirthPlace` carries coordinates, timezone, provider place ID, and timezone-dataset provenance. Free text and numeric UTC offsets cannot enter deterministic astrology.

No timezone polygon dataset is bundled yet. Production must provide a pinned Time Zone Boundary Builder “1970” dataset, checksum, and backend point-in-polygon implementation. No Mapbox token or persistent-storage approval is committed; the adapter rejects resolution until explicitly configured.
