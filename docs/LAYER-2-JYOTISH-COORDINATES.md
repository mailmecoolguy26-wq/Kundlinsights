# Layer 2: Jyotish Coordinate System

## Scope

Layer 2 is a pure deterministic classification of a sidereal longitude. It consumes `siderealLongitudeDegrees` from Layer 1 but has no dependency on ephemeris providers, time, place, network, database, or AI. It does not calculate houses, Ascendant, Bhava, Dashas, Yogas, Drishti, Ashtakavarga, Vargas, interpretations, or predictions.

## API

```js
classifySiderealLongitude(longitudeDegrees)
```

Returns `normalizedLongitudeDegrees`, plus structured `rashi`, `nakshatra`, and `pada` classifications. `classifyLayer1Bodies(layer1Result)` is a separate adapter that reads only each body's `siderealLongitudeDegrees` and adds `jyotishCoordinates` without modifying Layer 1 calculations.

## Rashi mathematics

The normalized range is `[0°, 360°)`. There are twelve half-open 30° intervals. Rashi index is `floor(longitude / 30) + 1`: 0° is Mesha, 30° is Vrishabha, and 360° normalizes to 0° and is Mesha. Each result supplies the Sanskrit and English name, exact interval endpoints, and full-precision degrees within Rashi.

## Nakshatra and lord mathematics

There are 27 consecutive half-open intervals, each `360 / 27` degrees (13°20′). Nakshatra index is `floor(longitude / (360 / 27)) + 1`. Definitions are in exact sidereal order from Ashwini through Revati. Lords use the structured repeating Vimshottari sequence: Ketu, Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury.

## Pada mathematics

There are 108 consecutive half-open intervals, each `360 / 108` degrees (3°20′). A Nakshatra contains four padas, and the returned `pada` value is 1–4 within its Nakshatra. The result also gives global sidereal start/end degrees and full-precision degrees within Pada.

## Boundary and precision policy

All intervals are `[start, end)`. Exact boundaries belong to the following interval; an exact 360° value first normalizes to 0°. The classifier uses JavaScript floating-point values directly and never rounds or formats before classification. Display formatting is outside this layer.

## Reference and provisional dependency

`src/jyotish/reference-data.js` is the sole authoritative source for Rashi, Nakshatra, structured lord, and Pada definitions. Layer 2 makes no claim about the accuracy of its input longitude. When fed an Astronomy Engine Layer 1 result, that longitude remains dependent on the provisional interim Lahiri transformation. Swiss Ephemeris `SE_SIDM_LAHIRI` remains the intended production authority for Layer 1.
