# Layer 5B — Planetary Dignity and State

Layer 5B is a provider-independent, deterministic fact engine. It consumes canonical sidereal longitude and Layer 1 motion metadata. It does not calculate astronomical positions, ayanamsha, houses, Vargas, Dashas, strength scores, aspects, yogas, or interpretation.

## Rulesets

- `parashari-seven-graha-dignity-v1` covers Sun through Saturn: sign lordship, own sign, Moolatrikona, exaltation, debilitation, exact deep points, and circular distances from those points.
- `bphs-santhanam-node-dignity-v1` is the default optional node ruleset. It is separate from seven-graha dignity and has no node deep-degree facts.
- `parashari-natural-maitri-v1`, `parashari-temporary-maitri-v1`, and `parashari-panchadha-maitri-v1` apply only to the seven classical planets.
- `surya-siddhanta-santhanam-combustion-v1` applies the approved numerical table as transmitted by Santhanam's attribution to Surya Siddhanta. It is not labelled generic BPHS combustion.

The combustion thresholds are Moon 12°; Mars 17° direct / 8° retrograde; Mercury 14° / 12°; Jupiter 11° / 11°; Venus 10° / 8°; and Saturn 16° / 16°. Sun, Ascendant, Rahu, and Ketu are not applicable.

The optional default node ruleset gives Rahu Taurus exaltation, Scorpio debilitation, Gemini Moolatrikona, and Aquarius ownership; Ketu Scorpio exaltation, Taurus debilitation, Sagittarius Moolatrikona, and Scorpio ownership. Node exact deep points and Maitri facts are `notDefinedByRuleset`.

## Coordinate authority and boundaries

`canonicalSiderealLongitudeDegrees` is authoritative. Layer 5B reuses Layer 2's pure sidereal classifier to derive normalized longitude, Rashi, and degrees within Rashi. Any supplied Rashi metadata that conflicts with the longitude is rejected.

Moolatrikona intervals are half-open. Exact deep points use unrounded normalized coordinates. Combustion uses minimum circular zodiacal separation and is true when distance is less than or equal to its threshold. The equality behavior and stationary-as-direct behavior are KundlInsights engine conventions.

When provider motion is unknown, a differing direct/retrograde combustion threshold produces `indeterminateUnknownMotion`; equal thresholds remain determinable. No motion is calculated in Layer 5B.

## Exclusions

Sun, Ascendant, Rahu, and Ketu are not combustible. Nodes have no Maitri facts under the default rulesets. Waxing/waning Moon, Shadbala, Cheshta Bala, Graha Yuddha, scoring, and interpretation are deferred.
