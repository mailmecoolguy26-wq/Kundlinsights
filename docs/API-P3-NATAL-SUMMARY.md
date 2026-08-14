# API-P3 — Authenticated Natal Summary

`GET /v1/birth-profiles/:id/natal-summary` is an authenticated, read-only natal-summary boundary for Flutter P5.

The request contains only the owned birth-profile ID. The server verifies the Supabase principal through the existing application-user and RLS-backed birth-profile boundary, decrypts the authoritative stored birth data, and calculates the summary on demand. It neither creates a reading nor persists a chart.

The response contains the Ascendant separately, an ordered twelve-entry `houses` mapping (`house` and authoritative Rashi `sign` only), and the nine Grahas (`Sun`, `Moon`, `Mars`, `Mercury`, `Jupiter`, `Venus`, `Saturn`, `Rahu`, `Ketu`). Each Graha provides canonical sidereal longitude, Rashi, degree within Rashi, Parashari Rashi-house number, Nakshatra, Pada, longitude speed, provider motion, and a direct retrograde flag. The summary repeats only the consumer-facing Ascendant, Moon Rashi/Nakshatra/Pada, and Sun Rashi fields.

Calculation authority remains server-side: the injected Layer 1 provider supplies the canonical sidereal coordinates; Layer 2 supplies Rashi/Nakshatra/Pada; and the existing `parashari-rashi-house-v1` mapping supplies both house placement and the ordered house-sign assignments. The API does not apply an ayanamsha conversion or derive a Rashi sequence at the public boundary. Safe metadata reports the existing Lahiri/Chitrapaksha sidereal identity, sidereal mode, node model, and calculation status when provided by the engine.

Rahu/Ketu retain the configured Layer 1 node semantics (currently Mean Node authority, with Ketu derived by existing engine semantics). No D9/D10 or other Vargas, Dasha, gochar/transits, Ashtakavarga, aspects, conjunctions, conditions, or Career reading text is exposed by this endpoint.

The DTO intentionally excludes decrypted birth data, coordinates, UTC/timezone provenance, encrypted payloads, KMS/DEK material, database data, auth subject/application-user identifiers, provider credentials, and operational or filesystem metadata. A cross-user request returns the existing non-enumerating not-found/forbidden response.

Repeated chart reads calculate on demand. Cache or persistence policy is intentionally deferred to a later operational milestone.
