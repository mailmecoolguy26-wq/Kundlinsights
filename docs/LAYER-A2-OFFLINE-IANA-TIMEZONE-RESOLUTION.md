# Layer A2 — Offline IANA Timezone Resolution

Layer A2 maps coordinates to an IANA zone using only approved offline GeoJSON geometry. It is a `TimezoneResolver` for Layer A1 and contains no astronomy/network code. It validates a Time Zone Boundary Builder 1970 manifest, builds an immutable bounding-box prefilter once, and resolves Polygon/MultiPolygon geometry including holes.

Points on a border raise `AMBIGUOUS_TIMEZONE_BOUNDARY`; ocean/uncovered coordinates raise `UNRESOLVED_TIMEZONE`. No offset or longitude heuristic is used. The full approved TBB 1970 GeoJSON artifact, explicit release version, and SHA-256 manifest remain required before real-dataset activation; synthetic test geometry is `TEST_FIXTURE_ONLY`.
