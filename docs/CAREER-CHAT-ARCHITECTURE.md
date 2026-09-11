# Career Chat architecture (Phase 14A)

Career Chat is Career-only and grounded: message → constrained intent → existing sanitized Career Reading evidence → deterministic answer contract → future LLM wording. The LLM is not an astrology calculator or evidence/ranking authority.

`src/application/career-chat` defines the intent taxonomy, evidence allow-list, answerability contract, request-level conversation context, and an unconfigured provider-neutral `CareerChatLanguageModel` interface. There is no route, LLM network call, persistence, UI, or automatic Career History write in this phase.

Every packet requires `birthProfileId`; future orchestration must authenticate and resolve the owned active profile before loading the existing secure Career Reading. The safe source is its public/sanitized `insights` and `technicalContext`, rather than decrypting or exposing internal rule/provenance data.

Timing answers may describe existing timing boundaries, never guaranteed jobs, promotions, salary changes, exact outcome dates, employers, probabilities, or planet-caused workplace politics. Workplace-pressure answers may acknowledge pressure and offer timing/job-switch follow-ups, but cannot claim astrology proves politics. Business-vs-job is unsupported until an audited deterministic rule exists.

English and Roman Hinglish are presentation metadata for a future renderer; no Devanagari is required. Recommended V1 entitlement: require existing Career Premium before personalized answers, reusing the existing profile-scoped Career access resolver. No billing change is made here.

Phase 14B: authenticated profile-scoped orchestrator that loads a public Career Reading, applies this policy, and returns the deterministic packet/answer contract. Only after that should a schema-constrained LLM adapter and chat UI be considered.

## Phase 14D renderer

Career Chat may optionally use an OpenAI Responses renderer only after the deterministic contract has been created. It is enabled exclusively with `CAREER_CHAT_LLM_ENABLED=true`, `CAREER_CHAT_OPENAI_API_KEY`, and `CAREER_CHAT_OPENAI_MODEL`; otherwise no provider call occurs. The prompt version is `career-chat-renderer-v1`; its strict JSON output is `{message, followUpLabels}`. The provider receives bounded public answer fields, at most eight visible turns, and hidden prohibited-claim constraints—never encrypted readings, technical context, IDs, payment data, or tokens.

Provider failures, timeouts, malformed schemas, and semantic-safety failures fall back to the deterministic response without failing the request. The renderer cannot add dates, guarantees, probabilities, employer identity, new astrology, or planet-caused workplace-politics claims. No prompt or user text is logged; no messages are persisted or streamed. Mobile uses `renderedAnswer` only when it validates, otherwise its deterministic presentation mapper remains authoritative.

Use `CAREER_CHAT_LLM_ENABLED=false` to roll back instantly to deterministic rendering. A live smoke test is opt-in and must use synthetic fixtures only; it must never send a real profile or reading. Allowed human-readable dates must match an existing deterministic timing-window boundary. Provider input is capped to a 2,000-character user message, eight 1,000-character visible turns, four timing windows, four evidence/caveat items, and four follow-ups. Future launch work should add rate/cost monitoring outside the chat persistence model.

For an opt-in synthetic provider check, run `node scripts/career-chat-renderer-smoke.js insufficient` or `node scripts/career-chat-renderer-smoke.js supported` with the enabled development configuration. It prints only fixture name, boolean provider result, latency, and validated rendered output; it does not load a profile or reading.
