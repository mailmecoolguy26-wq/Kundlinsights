# Career V2 SHADOW operations

Career V2 remains `OFF` by default. The approved operational sink for aggregate SHADOW diagnostics is the existing structured application-log stream collected by Railway and, in the documented AWS runtime, CloudWatch.

## Configuration

- Production default: `CAREER_TIMING_V2_MODE=OFF`
- Staging SHADOW: `CAREER_TIMING_V2_MODE=SHADOW`
- Aggregate sink: `CAREER_TIMING_V2_TELEMETRY_PROVIDER=STRUCTURED_LOG` (default)
- Telemetry-only rollback: `CAREER_TIMING_V2_TELEMETRY_PROVIDER=OFF`
- Career rollback: `CAREER_TIMING_V2_MODE=OFF`

No API key or telemetry secret is required. Do not enable `ON` as part of SHADOW validation.

## Events

`career_timing_v2_shadow` is the summarized calculation event. `career_timing_consumer_shadow` is the bounded consumer comparison event. Events contain only scalar allowlisted properties: rollout/status fields, durations, counts, booleans, coarse comparison categories, safe error codes, and timing contract/ruleset versions.

Birth/profile/user/reading identifiers, birth inputs, coordinates, contact data, company/salary/priorities, user text, dates/ranges, Career events, raw periods, D1/D10, Dasha/transit evidence, prompts, exceptions, stacks, and certification data are prohibited. The adapter adds only `observedAt`, log level, category, and event name. It does not attach request, network, device, cookie, or identity data.

## Staging verification

1. Set `CAREER_TIMING_V2_MODE=SHADOW` and retain `CAREER_TIMING_V2_TELEMETRY_PROVIDER=STRUCTURED_LOG`.
2. Generate one new Career reading.
3. Confirm the response and Flutter remain legacy-authoritative while the encrypted snapshot contains additive `authority=SHADOW` timing.
4. Filter structured logs on `category=aggregate_analytics` and `event=career_timing_v2_shadow`.
5. Confirm the properties match the event allowlist and contain no identifiers or dates.
6. Temporarily disable the sink in a staging-equivalent runtime and confirm reading generation still succeeds.
7. Roll back with `CAREER_TIMING_V2_MODE=OFF`.

The event stream supports counts, success/failure/fallback ratios, duration percentiles, mismatch-category ratios, missing-current/next rates, and parent/refinement distributions. Alert dimensions may cover stopped delivery, provider errors, and increased failure/fallback; thresholds require operational policy and are intentionally unspecified.
