# Layer 5C — Graha association foundation

Layer 5C provides immutable, provider-independent natal facts under the ruleset `jyotish-natal-same-rashi-association-v1`.

## Scope

Two supported Grahas are associated only when their canonical sidereal longitudes classify into the same Layer 2 Rashi. The layer emits positive unordered pairs only. It preserves the pair's Rashi and its factual minimum circular longitude separation.

Supported participants are Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, and Ketu. Ascendant is deliberately excluded. Rahu and Ketu have no special treatment or meaning in this factual layer.

## Coordinates and boundaries

Layer 5C consumes canonical sidereal longitude and reuses Layer 2 classification and normalization. Rashi intervals are half-open: `[start, end)`. Therefore 360° normalizes to 0°, and a body just below 30° is not associated with one at exactly 30°. Circular distance still treats 359° and 1° as 2°, but those positions are in different Rashis and emit no pair.

## Boundaries

This ruleset performs no astronomy, ayanamsha conversion, provider call, house calculation, Dasha calculation, Gochar calculation, event scanning, or interpretation. Distance is metadata only: there is no orb, closeness threshold, applying/separating state, strength, combustion reuse, or Graha Yuddha logic.

Same-Rashi association is not asserted to be equivalent to BPHS yuti, `gurusaṃyute`, or any classical conjunction requirement. It is not consumed by Layer 12B3 in this increment.
