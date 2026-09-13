# Career Chat architecture (Phase 14A)

Career Chat is Career-only and grounded: message → constrained intent → existing sanitized Career Reading evidence → deterministic answer contract → future LLM wording. The LLM is not an astrology calculator or evidence/ranking authority.

`src/application/career-chat` defines the intent taxonomy, evidence allow-list, answerability contract, request-level conversation context, and an unconfigured provider-neutral `CareerChatLanguageModel` interface. There is no route, LLM network call, persistence, UI, or automatic Career History write in this phase.

Every packet requires `birthProfileId`; future orchestration must authenticate and resolve the owned active profile before loading the existing secure Career Reading. The safe source is its public/sanitized `insights` and `technicalContext`, rather than decrypting or exposing internal rule/provenance data.

Timing answers may describe existing timing boundaries, never guaranteed jobs, promotions, salary changes, exact outcome dates, employers, probabilities, or planet-caused workplace politics. Workplace-pressure answers may acknowledge pressure and offer timing/job-switch follow-ups, but cannot claim astrology proves politics. Business-vs-job is unsupported until an audited deterministic rule exists.

English and Roman Hinglish are presentation metadata for a future renderer; no Devanagari is required. Recommended V1 entitlement: require existing Career Premium before personalized answers, reusing the existing profile-scoped Career access resolver. No billing change is made here.

Phase 14B: authenticated profile-scoped orchestrator that loads a public Career Reading, applies this policy, and returns the deterministic packet/answer contract. Only after that should a schema-constrained LLM adapter and chat UI be considered.

## Phase 14F production guardrails

Career Chat may optionally use an OpenAI Responses renderer only after the deterministic contract has been created. It is enabled exclusively with `CAREER_CHAT_LLM_ENABLED=true`, `CAREER_CHAT_OPENAI_API_KEY`, and `CAREER_CHAT_OPENAI_MODEL` in development; production uses the backend-only `OPENAI_API_KEY` plus `CAREER_CHAT_OPENAI_MODEL`. With the flag disabled, no Chat provider client is constructed and no provider call occurs. The prompt version is `career-chat-renderer-v2`; its strict JSON output is `{message, followUpLabels}`.

Provider failures (including 429 and 5xx), network errors, timeout, malformed schemas, and semantic-safety failures fall back to the deterministic response without failing the Chat request. The renderer cannot add dates, guarantees, probabilities, employer identity, new astrology, or planet-caused workplace-politics claims. No prompt or user text is logged; no messages are persisted or streamed. Mobile uses `renderedAnswer` only when it validates, otherwise its deterministic presentation mapper remains authoritative.

### Latency, size, and cost envelope

The V1 target is under 3 seconds when the provider is healthy; 3–5 seconds is acceptable; the hard renderer timeout remains 8 seconds (`CAREER_CHAT_LLM_TIMEOUT_MS`, bounded to 100–15,000 ms). On timeout, the deterministic answer is returned immediately after that bounded wait. Mobile shows neutral, non-streaming “Checking your Career evidence…” / “Aapki Career evidence check ho rahi hai…” copy while one request is active; its composer disables duplicate sends.

The renderer receives only a bounded, public packet: a 1,000-character current question; the latest 8 user/assistant turns capped at 320 characters each; 4 timing windows with only date/current fields; 4 evidence items; 4 caveats; 4 follow-ups; and 12 prohibited-claim identifiers. It never receives raw technical context, profile IDs, encrypted reading content, tokens, payment data, or calibration notes. Output is limited to 900 characters and 320 provider output tokens (one to three concise sentences). The deterministic API boundary continues to accept a 2,000-character message and 8 × 1,000-character context entries; the tighter limits apply only to optional provider wording.

At those caps, a typical request is roughly 700–1,800 input tokens plus up to 320 output tokens; a worst-case bounded packet is roughly 3,500 input tokens plus 320 output tokens. Exact currency cost depends on the configured model and its current provider price, so pricing is not embedded in production code. For launch planning, multiply the current provider input/output rates by 10, 50, or 100 messages per user per month using those token envelopes.

There is no shared in-process rate-limiter in the backend. Launch behind a gateway/WAF rule scoped to authenticated Career Chat requests: recommended initial policy is 10 requests per minute per authenticated subject, burst 3, and one concurrent request per subject. This is deliberate: a distributed limiter belongs at the deployment boundary rather than in a per-process memory map. OpenAI availability must not affect `/ready`, because deterministic Chat remains usable.

### Rollback, configuration, and launch smoke

Set `CAREER_CHAT_LLM_ENABLED=false` and restart/roll the backend to disable provider wording immediately; the authenticated, profile-scoped deterministic Chat route remains available. When enabled, startup rejects a missing Chat model or required OpenAI credential rather than running partially configured. In this repository, `OPENAI_API_KEY` and `OPENAI_CAREER_MODEL` are also required by the existing Career Reading generation provider independently of the Chat flag.

Production backend checklist: database, Supabase verifier issuer/JWKS/audience, KMS, required Razorpay configuration, `CAREER_CHAT_LLM_ENABLED`, backend-only OpenAI key, `CAREER_CHAT_OPENAI_MODEL`, and optional bounded `CAREER_CHAT_LLM_TIMEOUT_MS`. Mobile checklist: `API_BASE_URL`, `SUPABASE_URL`, and the Supabase publishable key. Never place an OpenAI key in mobile configuration.

Launch smoke: login; open Career Chat; ask job-loss, promotion, workplace-pressure, and unsupported-domain questions; repeat with the provider disabled; verify a backend-network Retry; switch profiles; and verify an entitlement-required profile. Record only request ID, intent, answerability, provider/fallback category, latency, and optional token counts—never message text, prompt, reading evidence, birth data, or secrets.

For an opt-in synthetic provider check, run `node scripts/career-chat-renderer-smoke.js insufficient` or `node scripts/career-chat-renderer-smoke.js supported` with the enabled development configuration. It prints only fixture name, boolean provider result, latency, and validated rendered output; it does not load a profile or reading.
