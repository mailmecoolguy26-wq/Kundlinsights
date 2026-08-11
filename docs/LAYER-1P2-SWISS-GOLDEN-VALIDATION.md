# Layer 1P2 — Independent Swiss Golden Validation

Four immutable fixtures were generated externally with official Swiss Ephemeris C `swetest` 2.10.03, using `-eswe`, `-sid1`, `-speed`, and Mean Node. Ascendants were independently generated through `swetest -house<longitude>,<latitude>,W`; Swiss cusp output is not used by KundlInsights.

The reference data files are identified in fixture provenance by byte length and SHA-256. No executable or ephemeris data is committed. Golden provider tests run only when `KUNDLINSIGHTS_SWISS_REFERENCE_EPHEMERIS_PATH` points to an approved local data directory.

Tolerance is evidence-based: reference output is printed to seven decimals and uses `-utc`, matching the provider's official UTC/JD conversion. Longitude and Ascendant tolerance are `1e-7°`; speed tolerance is `2e-6°/day`, allowing only the seven-decimal printed-speed precision. Provider status remains `LICENSE_GATED_VALIDATION`; numerical agreement does not activate commercial production authority.
