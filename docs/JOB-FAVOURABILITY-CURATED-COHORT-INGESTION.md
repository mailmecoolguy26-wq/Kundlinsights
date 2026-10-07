# Private curated Career-history ingestion

This is an offline research intake for the Job Favourability study. It does
not call production APIs, change Career Answers, enable projection, select a
rule, or produce a customer period, probability, offer, joining, or job
forecast.

Copy the fictional private template before adding any owner-authorized data:

```sh
cp tmp/private-backtest/JOB-FAVOURABILITY-CURATED-COHORT.template.json \
  tmp/private-backtest/JOB-FAVOURABILITY-CURATED-COHORT.json
node scripts/research/run-job-favourability-private-cohort.js \
  tmp/private-backtest/JOB-FAVOURABILITY-CURATED-COHORT.json
```

Both input and output remain under `tmp/private-backtest/`, which is ignored by
Git. Do not place real birth data, source notes, or cohort input anywhere else.

## Input schema

The required top-level schema ID is
`taraverse-job-favourability-private-cohort-v1`. Use a private random
`cohortSalt`; it is used to generate output pseudonyms.

Each profile requires a curator-assigned `pseudonymousProfileId` and the birth
fields needed by the existing astrology engine:

```json
{
  "pseudonymousProfileId": "fictional-profile-a",
  "birth": {
    "localDate": "1992-03-14",
    "localTime": "09:45:00",
    "timezone": "Asia/Kolkata",
    "latitude": 28.6139,
    "longitude": 77.209
  }
}
```

`localDate`, exact `localTime`, IANA timezone, latitude, and longitude are all
required. In the normal calculated path, the runner derives factual natal D1,
solar-return Vimshottari MD/AD/PD, refined Jupiter/Saturn/Rahu/Ketu ingress
intervals, D10, Moon support facts, Ashtakavarga facts, and the existing
internal generic-Career-signal baseline. Provider/ruleset provenance and
calculation status are retained in the report.

For `MONTH` and `YEAR` observations, the supplied temporal coverage is kept as
a calendar interval. The runner never turns it into an exact event day; the
feature extractor marks PD-level feature use as `NOT_APPLICABLE` for those
precisions.

## Events and observations

Allowed event families are:

- Employment transitions: `FIRST_JOB`, `JOB_SWITCH`, `OFFER`, `JOINING`
- Career controls: `PROMOTION`, `ROLE_CHANGE`, `SALARY_GROWTH`,
  `BUSINESS_STARTED`, `CAREER_BREAKTHROUGH`, `CAREER_SETBACK`

Every observation requires an ID, type, precision, and matching date string:

| Precision | Required date form | Coverage retained |
| --- | --- | --- |
| `DAY` | `YYYY-MM-DD` | local calendar day |
| `MONTH` | `YYYY-MM` | local calendar month |
| `YEAR` | `YYYY` | local calendar year |

The validator rejects impossible calendar dates and rejects, for example, a
`DAY` observation supplied as `YYYY-MM`. It never fabricates a day from a
month or year.

Use `metadata.source` and `metadata.curationNote` for provenance notes. They
remain private intake metadata and are stripped before cohort construction and
feature extraction; they are never model features.

### Explicit OFFER/JOINING linkage

Do not link an OFFER and JOINING merely because their dates are near each
other. Each must have the same explicit `transitionId` and an explicit
`transitionFamily` of `FIRST_JOB` or `JOB_SWITCH`:

```json
{
  "eventId": "fictional-offer",
  "eventFamily": "OFFER",
  "transitionId": "fictional-switch-2018",
  "transitionFamily": "JOB_SWITCH",
  "observations": [{
    "observationId": "fictional-offer-date",
    "type": "OFFER",
    "precision": "DAY",
    "date": "2018-03-12",
    "metadata": { "source": "FICTIONAL_EXAMPLE" }
  }]
}
```

The matching JOINING record uses the same two linkage values. The intake
validator combines them into one canonical transition unit and rejects
duplicate observations or conflicting transition families.

## Optional factual research inputs

`factualInputs` is an optional test-fixture/override path and may contain only
already-computed, language-neutral factual
records accepted by the existing extractor, such as `dashaIntervals`,
`transitIntervals`, `transitEvents`, `planetaryStateFacts`,
`h6BeneficOccupancyFacts`, `d10Facts`, `moonSupportFacts`,
`ashtakavargaFacts`, `genericCareerSignals`, `recurrenceEvidence`, and
astronomy provenance. If any factual override is supplied, it must include
`"mode": "SUPPLIED_OVERRIDE"`. Overrides are used as one isolated provenance
bundle: calculated facts are not silently mixed into missing override fields.

For calculated profiles, an individual family failure becomes `UNAVAILABLE`
with a safe diagnostic reason in calculation coverage; it is never changed to
false or replaced by another provider/ruleset. The extractor records
`UNAVAILABLE` or `NOT_APPLICABLE`; it does not invent support facts. Historical
recurrence remains strictly prior, same-profile only; where no compatible prior
comparison exists it remains `UNAVAILABLE`, not negative evidence. This runner
does not create new astrology methodology from intake data.

## Output

The command validates the cohort, creates positive/control/temporal-control
units, runs all pre-registered horizons, extracts factual rows, and writes a
private report plus feature-row and cohort-summary JSON files. It is labelled
`CURATED_COHORT_RESEARCH_ONLY`.

The runner has no favourable-period output or rule-selection step. Its report
conclusion is research status only and is never a production decision.
