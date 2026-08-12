'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { SwissNativeAdapter, SwissCanonicalSiderealSunSampler } = require('../../../src/astronomy');
const { solveSolarReturn } = require('../../../src/dasha');
const { SWISS_GOLDEN_PROVENANCE } = require('../../astronomy/fixtures/swiss-golden-fixtures');

const ephemerisPath = process.env.KUNDLINSIGHTS_SWISS_REFERENCE_EPHEMERIS_PATH;
const EXPECTED = ['1991-11-26T14:21:08.782Z', '1992-11-25T20:27:22.863Z', '1993-11-26T02:30:58.428Z'];

test('Swiss Hyderabad solar-return values retain explicit non-authoritative PROTOTYPE_PARITY status', { skip: !ephemerisPath }, () => {
  const sampler = new SwissCanonicalSiderealSunSampler({ nativeAdapter: new SwissNativeAdapter({ ephemerisPath, manifest: SWISS_GOLDEN_PROVENANCE.manifest }) });
  let prior = '1990-11-26T08:10:00.000Z';
  for (const expected of EXPECTED) {
    const result = solveSolarReturn({ sampler, priorInstantUtc: prior, targetLongitude: 220.07412509999472 });
    assert.ok(Math.abs(new Date(result.instantUtc).getTime() - new Date(expected).getTime()) <= 1, 'PROTOTYPE_PARITY only');
    assert.equal(result.provenance.sampler.calculationStatus, 'LICENSE_GATED_VALIDATION');
    prior = result.instantUtc;
  }
});
