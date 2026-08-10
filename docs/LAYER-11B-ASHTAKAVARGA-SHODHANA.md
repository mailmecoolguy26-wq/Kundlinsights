# Layer 11B: Parashari Ashtakavarga Shodhana

Layer 11B is a pure, deterministic post-processing layer for Layer 11A raw Bhinnashtakavarga (BAV) results. It performs no astronomy, ayanamsha, longitude, house, Varga, Dasha, transit, Pinda, interpretation, or prediction calculation.

## Boundary

Layer 11A supplies immutable raw BAV for Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, and Lagna, plus a separate raw seven-planet SAV. Layer 11B processes each of the eight BAVs independently:

```text
raw BAV → Trikona Shodhana → Ekapadhipatya Shodhana → Shodhita BAV
```

Raw SAV remains exactly the Layer 11A aggregate. Layer 11B neither modifies, recomputes, nor produces a “corrected SAV.”

## Rulesets and provenance

- `parashari-trikona-shodhana-santhanam-v1`: `CLASSICAL_TRANSLATION`
- `parashari-ekadhipatya-shodhana-santhanam-v1`: `CLASSICAL_TRANSLATION`
- `parashari-ashtakavarga-shodhana-santhanam-v1`: ordered Layer 11B composition
- `parashari-ekadhipatya-occupancy-seven-graha-v1`: `ENGINE_CONVENTION`

The occupancy convention counts Sun, Moon, Mars, Mercury, Jupiter, Venus, and Saturn. It expressly excludes Ascendant/Lagna, Rahu, and Ketu. This body-set choice is recorded as an engine convention and is not represented as a direct BPHS statement.

## Trikona Shodhana

The fixed groups are Mesha/Simha/Dhanus, Vrishabha/Kanya/Makara, Mithuna/Tula/Kumbha, and Karka/Vrischika/Meena. For every BAV and group:

- a group containing zero is unchanged;
- a positive equal group becomes `0/0/0`;
- otherwise its minimum is subtracted from all three values.

## Ekapadhipatya Shodhana

After Trikona Shodhana only, Layer 11B considers the Mars, Mercury, Jupiter, Venus, and Saturn dual-sign ownership pairs. A pair containing zero is unchanged. Two occupied signs are unchanged; two empty equal signs become zero; two empty unequal signs both become the lesser value. With exactly one occupied sign, that sign remains unchanged and the empty sign is reduced by it when larger, otherwise becomes zero. Sun and Moon have no dual-sign pair.

## Deferred Layer 11C

Rashi Pinda, Graha Pinda, Yoga Pinda, Shodhya Pinda, Kakshya, transit Ashtakavarga, scoring, interpretation, and prediction are not implemented. Layer 11C remains blocked pending authoritative resolution of the Graha-multiplier conflict.
