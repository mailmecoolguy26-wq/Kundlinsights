# Layer A2P2 — Offline Timezone Runtime Memory Optimization

## Purpose and scope

Layer A2P1 validated deterministic offline IANA timezone resolution against the approved Time Zone Boundary Builder (TBB) 2026c `timezones-1970.geojson.zip` dataset. Its pure-JavaScript GeoJSON implementation was correct, but loading and indexing the complete 301-feature, 149,581,087-byte extracted GeoJSON incurred approximately 1.36 GiB peak RSS. That memory profile was not approved for production deployment.

Layer A2P2 retains the same approved TBB authority and exact geometry semantics while changing only the runtime representation. It does not add a dependency, network timezone API, Mapbox behavior, Swiss integration, or changes to Layers 1–15.

## Source authority and externality

The authority remains the externally stored, verified TBB 2026c `1970` artifact:

- Provider: `timezone-boundary-builder`.
- Release/family: `2026c` / `1970`.
- ZIP SHA-256: `c1bd0839c15a94ace5107e84694915fca3ab74907dee7b2ed4e3e5e01acc8f16`.
- Extracted `combined-1970.json`: 149,581,087 bytes; SHA-256 `3ccc7784a2ec07b132db7e27e837a156bc7e100ab93d9fa062bd74f79f9a40bb`.
- Feature count: 301.

Neither the source GeoJSON nor the generated runtime binary is committed. The controlled builder accepts only that exact extracted source checksum and byte length, and writes its output to an explicit external directory.

## Runtime architecture

```text
verified TBB 2026c/1970 GeoJSON
  -> controlled external artifact builder
  -> Float64 binary geometry + small JSON manifest
  -> bbox candidate filtering
  -> positional range-read of each candidate chunk
  -> exact point-in-polygon / hole / boundary decision
  -> IANA timezone plus A1-compatible provenance
```

`scripts/build-timezone-runtime-artifact.js` creates two external files:

- `tbb-2026c-1970.bin`: each feature is independently addressable as `[polygon count][ring count][point count][longitude Float64][latitude Float64]` in little-endian order.
- `tbb-2026c-1970.manifest.json`: source identity, source checksums, binary checksum/size, and for each IANA `tzid`, its bbox, byte offset, and byte length.

The manifest is loaded and frozen. The resolver checks the binary filename, byte length, and SHA-256 before opening it. It never loads the complete binary geometry artifact into memory: a lookup first filters the 301 small manifest entries by bbox, then `readSync`s only each matching feature range. It evaluates rings directly from that range buffer, avoiding a nested coordinate-array decode allocation.

## Losslessness and topology

Coordinates use Node `Buffer.writeDoubleLE` / `readDoubleLE`, preserving IEEE-754 Float64 values from the source parser. Float32 is rejected because it loses coordinate precision; quantization and simplification are rejected because they can alter jurisdiction boundaries, holes, and exact-boundary behavior.

Both GeoJSON `Polygon` and `MultiPolygon` structures are preserved. Every ring is encoded, including holes. The legacy exact point-in-polygon predicate is retained semantically:

- A point on any ring is `AMBIGUOUS_TIMEZONE_BOUNDARY`.
- A point inside a hole is not inside its outer polygon.
- Multiple containing features are `AMBIGUOUS_TIMEZONE`.
- No containing feature, including ocean, is `UNRESOLVED_TIMEZONE`.

No public result contains an absolute local dataset or artifact path. Results and provenance are recursively frozen. Runtime provenance retains the A1-required `provider`, `datasetVersion`, and approved source ZIP `datasetChecksum`, while additionally identifying the runtime format and binary checksum.

## Validation

Synthetic deterministic tests cover Polygon, MultiPolygon, holes, overlapping bboxes, exact boundaries, uncovered coordinates, invalid coordinates/IANA names, malformed or unsupported manifests, wrong binary checksum/length, immutability, path non-leakage, repeated resolution, candidate-only range reads, and A1 integration.

The external-data-gated validation compares the new resolver with `OfflineIanaTimezoneResolver` using the real approved source for Hyderabad, Ludhiana, Delhi, Mumbai, Bengaluru, London, New York, Los Angeles, Sydney, Kathmandu, and Dubai. All results match; New York and Los Angeles differ; an ocean point remains unresolved. The Hyderabad mock Mapbox selection flows through the optimized resolver into immutable `ResolvedBirthPlace` with the required A1 provenance.

## Measured development benchmark

Measured on Node `v26.0.0`, macOS Darwin `25.3.0`, `arm64`, after the direct binary ring evaluator:

| Measurement | Value |
| --- | ---: |
| Runtime binary size | 107,182,308 bytes |
| Runtime binary SHA-256 | `be5803f425ee03403369204f3eda28289c7245d61900fd2fe68ae6197691e527` |
| Manifest size | 61,686 bytes |
| Manifest SHA-256 | `cbf17af13eb3640ab958eb974942b894ffd99a35075d6cf3e0079f0647d9827c` |
| Initialization time (includes streamed SHA-256 verification) | 112.689 ms |
| Idle RSS | 49.406 MiB |
| Resolver-loaded RSS | 66.250 MiB |
| Resolver-loaded RSS delta | 16.844 MiB |
| Hyderabad cold lookup | 24.307 ms |
| Hyderabad warm lookup | 9.124 ms |
| RSS after representative global lookups | 93.672 MiB |
| Measured peak RSS | 93.672 MiB |

The measured peak delta versus idle is 44.266 MiB. It is below both the `<150 MiB` production-memory target and the `<250 MiB` review ceiling, without reducing geometry precision or correctness. These are development-host measurements, not a universal service capacity guarantee; deployment monitoring remains appropriate.

## Deployment model

An operator supplies the external manifest and binary paths explicitly to `TimezoneRuntimeArtifactResolver`. The normal test suite does not require those files; real-data validation is environment-gated. No network timezone API is required, and the Mapbox permanent-storage deployment gate remains unchanged.
