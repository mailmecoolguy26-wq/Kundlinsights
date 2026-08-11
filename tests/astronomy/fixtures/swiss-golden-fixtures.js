'use strict';

/*
 * Schema only. Numeric values must be generated independently by official Swiss
 * C tooling after licensed ephemeris data is available; no mock values here are
 * astronomical authority.
 */
const SWISS_AUTHORITY_GOLDEN_FIXTURE_SCHEMA = Object.freeze({
  fixtureStatus: 'LICENSE_AND_DATA_GATED',
  source: 'official-swiss-c-or-swetest',
  required: Object.freeze(['utc', 'jdUt', 'observer', 'swissVersion', 'bindingVersion', 'siderealMode', 'nodeModel', 'requestedFlags', 'returnedFlagsByBody', 'ephemerisManifest', 'bodies'])
});

module.exports = { SWISS_AUTHORITY_GOLDEN_FIXTURE_SCHEMA };
