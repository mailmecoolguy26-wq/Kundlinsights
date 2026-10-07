# TaraVerse Astronomy Conventions

This document fixes the conventions used by new TaraVerse readings. It does
not recalculate or alter persisted reading snapshots.

## Canonical calculation policy

| Concern | TaraVerse convention |
| --- | --- |
| Ayanamsha | Lahiri / Chitrapaksha (`SE_SIDM_LAHIRI` for Swiss authority) |
| Nodes | Mean Rahu; Ketu is `normalize(Rahu + 180°)` |
| Coordinates | Geocentric grahas and nodes; WGS84 observer-aware Ascendant |
| Houses | Parashari whole-sign Rashi houses |
| Transit mapping | Transit Rashi mapped to the natal whole-sign house ring |
| Drishti | Seven-graha Parashari rules; Rahu/Ketu do not cast |
| Time | Canonical UTC instants and half-open `[start, end)` intervals |
| Transit boundaries | Layer 10 refined Rashi ingress, one-second tolerance; no merging across retrograde exit/re-entry |
| New-reading Dasha | V2 solar-return Lahiri grid with integer UTC-millisecond boundaries |

## Authority modes

`ASTRONOMY_PRODUCTION_AUTHORITY=provisional` is the present default. It uses
the explicitly tagged provisional Astronomy Engine path and always records
`productionAuthority: false`.

`ASTRONOMY_PRODUCTION_AUTHORITY=swiss` requires a Swiss Ephemeris Professional
License deployment gate, the pinned binding/library, a verified ephemeris data
manifest, SWIEPH returned flags, Lahiri, Mean Node, and a Swiss Ascendant. It
fails startup rather than falling back to provisional astronomy.

## Scope limits

Panchanga values are instantaneous Sun/Moon states. TaraVerse makes no
calendar-date or sunrise-based Tithi claim until a separate sunrise convention
is approved. Rahu/Ketu remain Career support/context only. Jupiter/Saturn
Career Gochar remains provisional timing context and is not a production job
or favourable-period predicate.
