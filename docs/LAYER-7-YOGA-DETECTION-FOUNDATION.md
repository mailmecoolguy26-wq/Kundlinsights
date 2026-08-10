# Layer 7: Core Yoga Detection Foundation

## Scope

Layer 7 is a D1-only, provider-independent detection layer. It consumes canonical sidereal body placements plus precomputed Layer 5A Rashi houses and Layer 5B planetary-state facts. It returns structured, immutable evidence for a deliberately small, versioned set of yoga definitions. It does not interpret, rank, score, time, predict, or label outcomes.

The implemented bundle is `layer7-core-yoga-detection-v1`.

## Boundary

```
Layer 1 canonical sidereal coordinates
        ↓
Layer 2 Rashi classification ───────────┐
Layer 5A D1 Rashi houses ───────────────┼──→ Layer 7 yoga detection
Layer 5B dignity / state ───────────────┘
```

Layer 7 does not calculate or alter astronomy, ayanamsha, Ascendant, houses, dignity, aspects, Vargas, or Dasha. It checks that supplied upstream facts agree with canonical sidereal coordinates and rejects contradictions rather than repairing them. Layer 6 Graha Drishti is not an input to this bundle.

## Definitions

All definitions apply only to D1 and have `sourceStatus: CLASSICAL_TRANSLATION` in their provenance.

| Ruleset ID | Detection condition |
| --- | --- |
| `phaladeepika-gaja-kesari-kendra-from-moon-v1` | Jupiter is 1st, 4th, 7th, or 10th from Moon by inclusive Rashi offset: `0`, `3`, `6`, or `9`. |
| `ruchaka-mahapurusha-v1` | Mars is own-sign or exalted according to Layer 5B and occupies D1 H1/H4/H7/H10. |
| `bhadra-mahapurusha-v1` | The same base condition for Mercury. |
| `hamsa-mahapurusha-v1` | The same base condition for Jupiter. |
| `malavya-mahapurusha-v1` | The same base condition for Venus. |
| `shasha-mahapurusha-v1` | The same base condition for Saturn. |
| `phaladeepika-harsha-vipareeta-v1` | The Layer 5A D1 lord of H6 occupies H6/H8/H12. |
| `phaladeepika-sarala-vipareeta-v1` | The Layer 5A D1 lord of H8 occupies H6/H8/H12. |
| `phaladeepika-vimala-vipareeta-v1` | The Layer 5A D1 lord of H12 occupies H6/H8/H12. |

Moolatrikona adds no separate condition: qualifying Layer 5B Moolatrikona regions are already own-sign regions. Functional lordship is not flattened. Each Vipareeta evaluation identifies its specific source house and retains every D1 house lordship of that planet in evidence.

## Output and modifiers

Every definition is returned, in definition order, whether detected or not. An evaluation contains `yogaId`, `yogaName`, `detected`, `evidence`, `modifiers`, and provenance. Evidence records the exact factors tested. There are no interpretation, strength, score, rank, prediction, effect, result, activation-period, or good/bad fields.

For the five Mahapurusha definitions, existing Layer 5B combustion, retrograde, and debilitation facts are exposed as modifiers when present; unavailable facts are `null`. They never cancel or otherwise alter base detection. Gaja Kesari and Vipareeta have no modifier conditions in this bundle.

## Provider and node policy

The coordinate authority is canonical sidereal longitude. No provider, ephemeris, tropical coordinate, ayanamsha, or calculation-specific assumption appears in a yoga predicate. Rahu and Ketu are normal body placements upstream but have no yoga role in this nine-definition bundle. Optional node dignity is not required.

## Explicitly deferred

This layer does not implement Neecha Bhanga (including Raja Yoga), general Kendra-Trikona Raja Yoga, Dhana Yoga, node-based yogas, association or conjunction/orb semantics, waxing/waning, benefic/malefic classification, scoring, interpretation, activation timing, prediction, or Varga yoga. These require independently versioned specifications.

## Provisional coordinate fixture

The 26-Nov-1990 provisional coordinate fixture is regression evidence only, not a production astronomical authority. Its D1 facts are Meena Ascendant; Sun/Mercury/Venus in Vrishchika H9; Moon in Kumbha H12; Mars in Vrishabha H3; Jupiter/Ketu in Karka H5; Saturn in Dhanu H10; and Rahu in Makara H11. Jupiter is exalted, Venus is combust, and Mars is retrograde upstream. Under this narrow bundle each of the nine base detections is false: in particular Hamsa is false because Jupiter is H5, and Shasha is false because Saturn is neither own-sign nor exalted.
