# Layer 9: Gochar Transit Foundation

Layer 9 evaluates one supplied transit snapshot against precomputed natal D1 facts. It consumes canonical transit coordinates, a Layer 5A natal whole-sign house result, and optional Layer 5B transit dignity facts. It performs no astronomy, ayanamsha, house calculation, Panchanga calculation, event scanning, interpretation, scoring, or prediction.

Implemented rulesets: `gochar-natal-rashi-house-v1`, `gochar-from-janma-rashi-v1`, `same-rashi-transit-association-v1`, `parashari-transit-to-natal-graha-drishti-v1`, and `sade-sati-rashi-phase-v1`.

For each of the nine standard transit bodies, Layer 9 classifies the authoritative canonical longitude using Layer 2, maps its Rashi to the existing natal house map, and counts its inclusive Rashi distance from natal Moon. Same-Rashi association is sign-only; longitude separation is metadata and never an orb decision. Full positional Drishti is directional from transit graha to natal Rashis/houses/bodies and reuses Layer 6’s caster table. Nodes are targets but never casters.

Sade Sati is an engine-level sign-phase detector: Saturn at H12/H1/H2 from natal Moon is respectively `rising`, `peak`, or `setting`; all other positions are `none`. The labels are KundlInsights conventions, not claimed classical terminology. Degree, Nakshatra, Pada, Vedha, Dhaiya, Ashtama Shani, and interpretation are deferred.
