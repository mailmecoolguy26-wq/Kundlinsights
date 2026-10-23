'use strict';

const { emptyFixture } = require('./golden-fixture-template');

// These are deliberately input-free, fully shaped placeholders. Birth data
// and independently verified values are entered in a secure local fixture,
// never inferred or committed by this framework.
const GOLDEN_FIXTURES = Object.freeze([
  emptyFixture({ fixtureId: 'current-production-profile', name: 'Current production profile', scenario: 'production-profile' }),
  emptyFixture({ fixtureId: 'near-sign-boundary', name: 'Planet near a Rashi boundary', scenario: 'sign-boundary' }),
  emptyFixture({ fixtureId: 'near-nakshatra-pada-boundary', name: 'Moon near a Nakshatra/Pada boundary', scenario: 'nakshatra-pada-boundary' }),
  emptyFixture({ fixtureId: 'varga-boundary', name: 'Divisional-chart boundary', scenario: 'varga-boundary' }),
  emptyFixture({ fixtureId: 'ordinary-control', name: 'Ordinary control chart', scenario: 'ordinary-control' }),
]);

module.exports = { GOLDEN_FIXTURES };
