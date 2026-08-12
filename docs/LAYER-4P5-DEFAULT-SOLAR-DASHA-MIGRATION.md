# Layer 4P5 — Default Solar-Return Vimshottari Migration

Layer 4P5 changes the default Dasha chronology for **new** Layer 15B one-call readings to `vimshottari-longitude-proportional-solar-return-v1`. The default engine profile is `kundlinsights-vedic-engine-profile-v2`.

## Migration boundary

This policy change affects only construction where no `dashaRulesetId` is supplied. A new default construction requires an injected canonical sidereal Sun sampler. Its absence fails closed with `MISSING_DEFAULT_SOLAR_DASHA_SAMPLER`; it never falls back to Savana.

`vimshottari-longitude-proportional-savana-360-v1` remains explicitly supported through `kundlinsights-vedic-engine-profile-v1`, requires no Sun sampler, and is the required replay policy for readings that carry that ruleset provenance. Persisted-reading storage is outside the current repository; applications must persist and replay `engineProfileId` and `dashaRulesetId` rather than applying a later default retroactively.

## Safe provenance

New default output records the engine profile, Dasha ruleset and time-convention IDs, Solar-return solver and interpolation IDs, calculation status, and `productionAuthority`. It does not expose solar longitudes, return grids, filesystem paths, manifests, or native handles.

## Hyderabad validation record

The independently validated Swiss-C solar chronology is:

- Mercury MD: `2026-07-21T01:33:54.601Z` to `2043-07-21T10:16:28.360Z`
- Mercury/Mercury: `2026-07-21T01:33:54.601Z` to `2028-12-16T17:23:56.383Z`
- Mercury/Mercury/Mercury: `2026-07-21T01:33:54.601Z` to `2026-11-22T16:24:29.853Z`

At `2026-08-12T00:00:00.000Z`, the default solar hierarchy is Mercury/Mercury/Mercury. The explicit Savana replay remains Mercury/Mercury/Venus with its unchanged Mercury MD interval `2026-01-14T16:24:20.789Z` to `2042-10-17T16:24:20.789Z`.

Observed JHora output under Lahiri, Drik Panchanga / modern astronomical method, and Mean Node matched the solar chronology at date precision: Rahu Jul 20 1973–Jul 21 1991; Jupiter Jul 21 1991–Jul 21 2007; Saturn Jul 21 2007–Jul 21 2026; Mercury Jul 21 2026–Jul 21 2043; Mercury/Mercury Jul 21 2026–Dec 16 2028; Mercury/Mercury/Mercury Jul 21 2026–Nov 22 2026. This is `PROFESSIONAL_SOFTWARE_DISPLAY_PARITY`, not independent astronomical authority; Swiss-C P3 remains the independent authority evidence.

Layer 4 chronology, natal astronomy, Gochar, transit events, Layers 12–15A, Swiss production-authority state, and network behavior are unchanged. Solar-return computation remains per request without caching.
