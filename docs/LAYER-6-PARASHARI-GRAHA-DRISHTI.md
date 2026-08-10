# Layer 6 — Parashari Graha Drishti

`parashari-seven-graha-drishti-v1` is a D1-only, provider-independent engine for full positional Graha Drishti. It consumes canonical sidereal coordinates and reuses Layer 2 for Rashi classification. A full edge is determined solely by the approved inclusive aspect number and Rashi offset; exact longitude separation is metadata only.

## Casting and targets

Sun, Moon, Mars, Mercury, Jupiter, Venus, and Saturn cast aspects. All seven cast a full seventh aspect; Mars additionally casts fourth and eighth, Jupiter fifth and ninth, and Saturn third and tenth. Rahu, Ketu, and Ascendant may be targets but do not cast under this ruleset. The aspect result is directional.

The primary fact is Graha-to-Rashi. Bodies in the target Rashi expand that fact to Graha-to-Graha targets. A valid, externally supplied Layer 5A D1 Rashi-house result may decorate the target with `targetHouseNumber`; Layer 6 never calculates houses.

## Boundaries and exclusions

Canonical longitude normalizes under the existing `[0°, 360°)` Layer 2 convention. Exact sign boundaries belong to the new Rashi. No rounding, orbs, Western geometry, degree tolerance, percentage scoring, astronomy calculation, ayanamsha calculation, or Varga calculation occurs here.

Fractional Drishti, Sphuta Drishti, Drig Bala, Rashi Drishti, all node casting traditions, and Varga Drishti are intentionally excluded and require separately versioned future work.
