# Layer 11C: Versioned Ashtakavarga Pinda

Layer 11C is a pure calculation over a Layer 11B Shodhita BAV. It never recalculates Trikona or Ekapadhipatya Shodhana, consumes no astronomical or provider data, and has no interpretive or predictive output.

## Scope

```text
Layer 11B Shodhita planetary BAV
  → Rashi Pinda + Graha Pinda
  → totalPinda (classical primary name: Yoga Pinda)
```

Only the seven planetary BAV targets are supported: Sun through Saturn. Lagna BAV Pinda, Ascendant participation, Rahu/Ketu participation, Kakshya, transit Ashtakavarga, longevity/Ayus calculations, Pinda-based timing, Dasha or transit synthesis, scoring, interpretation, and prediction are deferred.

## Versioned rulesets

No universal Pinda table is implied. The default is `parashari-pinda-bphs-santhanam-chakra-v1`, because KundlInsights uses the BPHS/Parashari framework as primary.

| Rashi | BPHS/Santhanam | Phaladeepika |
| --- | ---: | ---: |
| Mesha | 7 | 7 |
| Vrishabha | 10 | 10 |
| Mithuna | 8 | 8 |
| Karka | 4 | 4 |
| Simha | 10 | 10 |
| Kanya | 6 | 5 |
| Tula | 7 | 7 |
| Vrishchika | 8 | 8 |
| Dhanu | 9 | 9 |
| Makara | 5 | 5 |
| Kumbha | 11 | 11 |
| Meena | 12 | 12 |

Both rulesets use the resolved Graha table: Sun 5, Moon 5, Mars 8, Mercury 5, Jupiter 10, Venus 7, Saturn 5. The BPHS/Santhanam prose contains a conflicting Graha statement; the engine deliberately uses its printed Planetman Chakra because Phaladeepika independently corroborates it.

## Formulae

```text
rashiPinda = Σ(shodhitaValue[rashi] × rashiMultiplier[rashi])

grahaPinda = Σ(shodhitaValue[natalRashiOf(graha)] × grahaMultiplier[graha])

totalPinda = rashiPinda + grahaPinda
```

The canonical engine field is `totalPinda`. Provenance records `Yoga Pinda` as the classical primary name and `Shodhya Pinda` and `Shuddha Pinda` as later aliases.
