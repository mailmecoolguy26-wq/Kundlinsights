# Career Timing V1 multi-cohort validation methodology

## Status

This document defines an experimental validation process. It does not enable
Career timing projection or modify any production eligibility rule.

## Frozen candidate contracts

- **Candidate A — same subject:** a direct Career Dasha factor is active and a
  major Gochar activates that same natal Career factor.
- **Candidate B — direct factor plus core axis:** a direct Career Dasha factor
  is active and a major Gochar activates D1 H10 or the D1 H10 lord.
- **Candidate C — H10-lord structural:** the D1 H10 lord is active in Dasha
  and a major Gochar activates D1 H10 or the D1 H10 lord.

Direct Career factors are limited to the D1 H10 lord, planets occupying D1
H10, and planets conjunct the D1 H10 lord. H10 aspectors, H10-lord aspectors,
and other indirect relationships remain context only.

Each candidate is measured independently at MD, AD, PD, MD-or-AD, AD-or-PD,
any-level, and two-level Dasha depths. Jupiter and Saturn are timing planets,
not universal natal Career owners.

## Inputs and privacy

The validation harness accepts only explicitly authorized local cohorts,
anonymized fixtures, or manually supplied published/example charts. It must
not inspect, decrypt, enumerate, or infer consent for customer profiles.

Each profile supplies its own birth input and confirmed transitions. The
harness reconstructs that profile's D1, MD/AD/PD, and historical Jupiter and
Saturn intervals independently. It never reuses another profile's natal
factors. Observations retain DAY, MONTH, or APPROXIMATE precision and are never
silently converted to invented dates.

Synthetic fixtures test software correctness only and are excluded from
predictive-quality metrics.

## Measurements

For every profile and candidate/depth combination report:

- observations and transitions evaluated;
- observation and transition coverage;
- deterministic control false positives;
- eligible-window coverage density.

Aggregate results report both:

- **micro averages:** all observations combined;
- **macro averages:** arithmetic average of per-profile results.

Profile consistency is the number of separate authorized profiles with the
reported condition, never a count inflated by one high-observation profile.
No success threshold, winner selection, or production promotion is defined at
this stage.

## Support layers

D10, factual SAV/BAV, Moon Gochar, and historical recurrence are assessed only
after a candidate already has an eligible experimental window. They cannot
create or rescue eligibility. Historical recurrence is profile-specific and
requires at least two confirmed transitions.

For each eligible event and deterministic control window, the local harness
reconstructs D10 and factual H10 SAV/BAV from that profile's birth data using
the production deterministic calculators. D10 confirmation is recorded only
when the existing D10 contract also receives independently approved D1 themes;
the harness fails closed rather than manufacturing those inputs. SAV/BAV is
reported as factual distributions only, without thresholds or labels.

Historical recurrence is a later-event-only annotation: a window at time `T`
may compare only confirmed transition observations strictly before `T`. It may
not use later transitions, later observations from the same transition, or
future chart state. Until that structural comparator is connected, recurrence
is reported as unavailable rather than inferred.

The support roles are fixed: D10 is **structural confirmation/refinement**;
Moon is **secondary support**; SAV/BAV is **factual support context**; and
historical recurrence is **profile-specific personalization/structural
resemblance**. None creates a timing-eligibility window.

On the frozen single-owner validation cohort, recurrence was present for every
recurrence-available eligible event and control under Candidates A and B. It is
therefore not discriminative on that cohort. This is a factual audit result,
not a reason to tune recurrence or add thresholds.

The owner cohort is frozen for validation. It may remain one authorized profile
in later multi-cohort analysis, but must not be used for further universal-rule
optimization unless the owner explicitly reopens that methodology decision.

## Authorized local cohort ingestion

Additional cohorts are private files under `tmp/private-backtest/cohorts/`.
Each file has an `OWNER_PROVIDED` authorization declaration and a `profiles`
array. Every profile must use the existing private-cohort schema: a local
anonymized profile identifier, complete birth calculation input, nonempty
transition identifiers/types, and one or more DAY, MONTH, or explicit bounded
APPROXIMATE observations. The runner rejects incomplete birth input, invalid
precision/ranges, duplicate transition identifiers, and malformed observations;
it never silently repairs dates.

The local runner accepts the original owner cohort plus every explicitly added
authorized cohort file. It reconstructs each profile independently and keeps
detailed facts, charts, dates, and recurrence details exclusively under `tmp/`.

## Output handling

Detailed cohort data and metrics remain in untracked local files under
`tmp/private-backtest/`. Versioned documentation must not contain birth data,
profile identifiers, event dates, or other private cohort details.

Future Career projection remains disabled until separately approved after
multi-cohort validation.
