# Layer 15A — Career reading orchestrator

`buildCareerReading({ natal, temporal, locale })` is the single Layer 15A public entry point. `natal` must be a completed Layer 12A natal graph. `temporal` is a Layer 12C-compatible supplied object containing `instant` and optional `dasha`, `gochar`, and `transitEvents`. The default locale is `en-IN`; Layer 14B validates it.

The orchestrator composes existing public APIs only: Layer 12B3 Career evidence, Layer 12C temporal evidence, Layer 12D analysis, the approved Layer 13 Career conclusion engines, Layer 14A `buildReading`, and Layer 14B `renderReading`. It returns only the reading, rendered reading, and safe IDs/provenance. It does not expose intermediate graphs or raw provider data.

No astronomy, house, Dasha, Gochar, transit, dignity, Yoga, Varga, or association calculation occurs here. Layer 12D remains authoritative for contradiction and independence status. Conclusions are canonically deduplicated by existing conclusion ID without status changes, ranking, scoring, or synthesis.

H10 remains structural context, H2 resource context, and H11 gains context. Dasha intervals and supplied temporal evidence retain their existing half-open semantics. Layer 13C2 remains predicate-only. H10 honour remains unavailable, and Layer 5C same-Rashi facts are never converted to yuti/conjunction evidence.

Future work deliberately deferred: provider orchestration, birth-input handling, debug APIs, additional domains/locales, UI, advice, predictions, LLMs, and network/model integration.
