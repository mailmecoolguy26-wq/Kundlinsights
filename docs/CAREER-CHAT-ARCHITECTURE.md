# Career Chat architecture (Phase 14A)

Career Chat is Career-only and grounded: message → constrained intent → existing sanitized Career Reading evidence → deterministic answer contract → future LLM wording. The LLM is not an astrology calculator or evidence/ranking authority.

`src/application/career-chat` defines the intent taxonomy, evidence allow-list, answerability contract, request-level conversation context, and an unconfigured provider-neutral `CareerChatLanguageModel` interface. There is no route, LLM network call, persistence, UI, or automatic Career History write in this phase.

Every packet requires `birthProfileId`; future orchestration must authenticate and resolve the owned active profile before loading the existing secure Career Reading. The safe source is its public/sanitized `insights` and `technicalContext`, rather than decrypting or exposing internal rule/provenance data.

Timing answers may describe existing timing boundaries, never guaranteed jobs, promotions, salary changes, exact outcome dates, employers, probabilities, or planet-caused workplace politics. Workplace-pressure answers may acknowledge pressure and offer timing/job-switch follow-ups, but cannot claim astrology proves politics. Business-vs-job is unsupported until an audited deterministic rule exists.

English and Roman Hinglish are presentation metadata for a future renderer; no Devanagari is required. Recommended V1 entitlement: require existing Career Premium before personalized answers, reusing the existing profile-scoped Career access resolver. No billing change is made here.

Phase 14B: authenticated profile-scoped orchestrator that loads a public Career Reading, applies this policy, and returns the deterministic packet/answer contract. Only after that should a schema-constrained LLM adapter and chat UI be considered.
