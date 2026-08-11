# Layer A2P1 — Real Timezone Dataset Activation

Layer A2P1 pins the external Time Zone Boundary Builder `2026c` “same since 1970” release from the official `evansiroky/timezone-boundary-builder` project. The selected source artifact is `timezones-1970.geojson.zip`, not the ocean-inclusive variant, so uncovered ocean coordinates retain Layer A2's `UNRESOLVED_TIMEZONE` behavior.

The ZIP is external deployment data and is not committed. Its verified source identity is SHA-256 `c1bd0839c15a94ace5107e84694915fca3ab74907dee7b2ed4e3e5e01acc8f16` and 44,962,094 bytes. Its extracted `combined-1970.json` geometry is 149,581,087 bytes with SHA-256 `3ccc7784a2ec07b132db7e27e837a156bc7e100ab93d9fa062bd74f79f9a40bb`.

The extracted data is a GeoJSON `FeatureCollection` with 301 `Polygon`/`MultiPolygon` features, holes, and official `tzid` properties. Configure the extracted geometry path only through `KUNDLINSIGHTS_TZ_DATASET_PATH` for the real integration test; canonical output never includes that path. Startup verifies the extracted filename, byte length, and checksum, while result provenance reports the verified source ZIP identity.

The external artifact is loaded locally with Node filesystem APIs and performs no network request at runtime. The real gated suite covers India, London, New York, Los Angeles, Sydney, Kathmandu, Dubai, deterministic outputs, immutable outputs, checksum/family rejection, and mock-Mapbox A1 integration. The Mapbox permanent-storage gate remains separate and inactive.

## Performance and production readiness

Functional validation against the approved TBB 2026c dataset PASSED, including the real IANA timezone golden tests. The measured dataset has 301 features, with load/index time of 3151.565 ms, representative Hyderabad lookup time of 20.214 ms, and peak RSS of approximately 1.36 GiB.

The current full-dataset pure-JS in-memory representation is NOT approved for production deployment because of its measured memory profile. Memory optimization is intentionally deferred to Layer A2P2. A2P1 proves correctness and deterministic offline resolution only; it does not claim production memory efficiency. No network timezone API is required, and the approved TBB dataset remains external to the repository.
