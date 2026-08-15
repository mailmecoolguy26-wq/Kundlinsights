# API-P5B Ashtakavarga Summary

`GET /v1/birth-profiles/:id/ashtakavarga` is authenticated and resolves the owned encrypted birth profile server-side. Flutter supplies only the profile identifier. It is an on-demand, read-only calculation: no reading, entitlement use, persistence, cache, or payment action occurs.

The safe DTO exposes raw sign-oriented scores only: SAV has twelve canonical sign scores; BAV has exactly Sun, Moon, Mars, Mercury, Jupiter, Venus, and Saturn, each with twelve scores; Lagna BAV is separate and is not a planet. Rahu and Ketu BAV are not exposed because this authoritative engine ruleset does not define them.

Scores are factual raw Rekha counts. The API does not convert signs to houses or add strength labels, prediction, interpretation, Shodhana, Pinda, contributor matrices, evidence, or calculation traces. The future Flutter surface must render these backend-authoritative values without calculating or reinterpreting them.
