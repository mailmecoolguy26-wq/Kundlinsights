# Layer 14B — Constrained Career rendering

Layer 14B renders only a Layer 14A `CAREER` reading contract through `renderReading({ reading, locale: 'en-IN' })`. It is a deterministic, template-driven English renderer; it does not access raw chart data, evidence graphs, astronomical providers, calculations, network services, or language models.

The immutable `kundlinsights-career-reading-en-in-v1` registry is allowlisted in source. Unknown template keys and locales reject. Every Layer 14A item maps to one short rendered item, preserving its item ID, topic, status, section order, and item order. Duplicate reading-item IDs produce one rendered item.

Templates state only the supplied structural or temporal context. Status-specific wording is neutral: contradiction, insufficiency, non-applicability, and mixed context remain explicit rather than being translated into probability or valence. H2 is resource context, H10 is Career structure, H11 is gains context, Dasha/Gochar/transit/co-activation remain supplied context, and no overall Career summary is generated.

The classical professional-loss predicate is rendered only as satisfaction of the audited BPHS Venus-Mahadasha/Saturn-Antardasha predicate. Its mandatory disclosures state that this does not establish an event or outcome and that no probability estimate is assigned. It does not state job loss, termination, unemployment, business failure, risk, or event certainty.

Temporal values are preserved as supplied ISO/interval data. Classical source attribution exposes a short title only when Layer 14A source references identify BPHS. No citation is invented.

Layer 14C remains deferred: no LLM, free-form generation, tone adaptation, multilingual rendering, external model/API integration, UI, advice, or remedies are present.
