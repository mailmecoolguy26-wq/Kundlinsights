# Property calculation validation harness

`PropertyValidationHarness` is a development/test-only diagnostic. It is not
registered as an API route and does not participate in Property answers.

It accepts injected canonical astronomy and solar-Dasha dependencies and emits
a machine-readable report for one already-authorized birth profile. The report
contains no local birth date, time, place, notes, or plaintext chart payload.
It separates internal invariants from external verification gaps across these
layers: Astronomy, Derived Chart Facts, Dasha, Varga, Transit, Ashtakavarga,
Property Evidence, and Property Classification.

## Golden-fixture shape

```json
{
  "name": "externally-validated-reference",
  "input": { "birthProfile": "fixture-reference" },
  "expected": {
    "astronomy": {}, "d1": {}, "d4": {}, "d9": {}, "d10": {},
    "d16": {}, "dasha": {}, "transits": {}, "ashtakavarga": {}
  },
  "tolerances": { "longitudeDegrees": null, "timestampSeconds": null }
}
```

Expected fields are deliberately optional until independently verified. The
runtime calculation never reads them.

## External golden-data certification

`compareGoldenFixture({ fixture, report })` compares a harness report to one or
more independent sources. It returns a result per field with `PASS`, `FAIL`,
or `NOT_VERIFIED`; differing non-empty values from two sources return
`EXTERNAL_SOURCE_CONFLICT` instead of selecting a winner.

Each source records `sourceName`, `sourceVersion`, `ephemeris`, `ayanamsa`,
`zodiac`, `nodeType`, `nodeTypeObserved`, `nodeTypeUiSetting`,
`provenanceConflict`, `yearConvention`, `location`, `verifiedAt`, and `notes`. These are
evidence, not compatibility switches: an ayanamsa, mean/true-node, or Dasha
year-convention difference remains visible and is never normalized away.

When a source UI setting conflicts with its displayed node longitude, record
both the UI setting and observed convention. `classifyNodeConventionEvidence`
then compares TaraVerse against the matching true-node evidence and the other
source against matching mean-node evidence separately; it never treats a
mean-vs-true mismatch as a generic astronomy failure.

Longitude comparison accepts `longitudeArcseconds` or `longitudeDegrees`.
Timestamp comparison accepts `timestampSeconds` or `timestampMinutes`.
If a source only displays a calendar date, set
`comparisonGranularity.dasha` to `DATE`; the runner then compares the UTC
calendar date only and never fabricates a timestamp.
For a three-way review, `classifyThreeWay` reports `MATCH_ALL_THREE`,
`TARAVERSE_DRIK_MATCH`, `TARAVERSE_SOURCE_B_MATCH`,
`DRIK_SOURCE_B_MATCH`, `ALL_DIFFER`, or `NOT_VERIFIED`. It compares at the
least precise supplied resolution, while preserving each source's provenance.
Rashi, house, Nakshatra, Pada, and Varga placement fields are exact unless a
separate boundary policy is explicitly added to a fixture.

Certification procedure:

1. Enter the exact birth input locally.
2. Capture the TaraVerse harness report.
3. Capture raw output from source A.
4. Capture raw output from source B.
5. Normalize timezone display and units only.
6. Compare raw values and provenance.
7. Investigate the first mismatch.
8. Lock accepted independently verified values into the local golden fixture.

Required external values are Sun/Moon/Mars/Mercury/Jupiter/Venus/Saturn/Rahu/
Ketu/Ascendant longitudes; Moon Nakshatra/Pada; current MD/AD/PD boundaries;
D4/D9/D10/D16 Ascendant and planetary placements; Jupiter/Saturn/Rahu/Ketu
ingresses; all SAV signs; and every BAV value that the Property review needs.

## Failure format

Each invariant is returned in `checks` using:

```json
{
  "layer": "DASHA",
  "check": "PD_PARENT_PARTITION",
  "status": "FAIL",
  "expected": "[start,end) children fully partition parent",
  "actual": "…",
  "context": { "lord": "mercury", "start": "…", "end": "…" }
}
```

External verification remains required for planetary and Ascendant longitudes,
Moon Nakshatra/Pada, Dasha boundaries, D4/D9/D10/D16 placements, major ingress
timestamps, and SAV/BAV values.
