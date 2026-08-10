# Layer 8: Panchanga and Lunar State

Layer 8 is a pure, instantaneous, provider-independent Panchanga coordinate layer. It consumes only canonical sidereal Sun and Moon longitudes and returns Tithi, Paksha, lunar phase state, Karana, and Panchanga Nitya Yoga. It performs no astronomy, ayanamsha, sunrise, timezone, location, house, Varga, Dasha, Drishti, or chart-Yoga calculation.

Implemented rulesets are `panchanga-tithi-elongation-v1`, `panchanga-paksha-elongation-v1`, `panchanga-lunar-phase-state-v1`, `panchanga-karana-elongation-v1`, and `panchanga-nitya-yoga-nirayana-sum-v1`.

Tithi uses normalized Moon minus Sun elongation divided into thirty half-open 12-degree intervals. Paksha is Shukla for `[0,180)` and Krishna for `[180,360)`. Karana uses the same elongation in sixty half-open 6-degree intervals: Kimstughna; eight cycles of Bava, Balava, Kaulava, Taitila, Garaja (alias Gara), Vanija, Vishti (alias Bhadra); then Shakuni, Chatushpada, and Naga. Nitya Yoga is the normalized sum of canonical sidereal Sun and Moon longitudes divided into twenty-seven equal 13°20′ intervals.

Exact `0°` is represented as `newMoon`; exact `180°` as `fullMoon`; intervening states are `waxing` and `waning`. These exact state labels and all `[start,end)` interval handling are KundlInsights engine conventions. `360°` normalizes to `0°`; no display rounding participates in classification.

Panchanga Nitya Yoga is explicitly distinct from Layer 7 chart-yoga detection. Traditional sunrise-based Vara, civil weekday, sunrise/sunset, Muhurta, festivals, interpretation, benefic/malefic effects, and prediction are deferred.
