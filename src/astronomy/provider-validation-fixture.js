'use strict';

const REQUIRED_BODIES = Object.freeze(['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu', 'Ascendant']);

function assertFiniteNumber(value, description) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${description} must be a finite number.`);
}

function validateProviderValidationFixture(fixture) {
  if (!fixture || typeof fixture !== 'object') throw new TypeError('A provider validation fixture object is required.');
  if (!['experimental-poc', 'production-authoritative'].includes(fixture.authority)) throw new TypeError('Fixture authority must be experimental-poc or production-authoritative.');
  if (!fixture.input || !fixture.expected || !fixture.provenance) throw new TypeError('Fixture requires input, expected, and provenance objects.');
  for (const field of ['date', 'time', 'timezone', 'utcInstant']) if (typeof fixture.input[field] !== 'string') throw new TypeError(`Fixture input.${field} must be a string.`);
  assertFiniteNumber(fixture.input.latitude, 'Fixture input.latitude');
  assertFiniteNumber(fixture.input.longitude, 'Fixture input.longitude');
  for (const field of ['provider', 'providerVersion', 'siderealMode', 'nodeModel']) if (typeof fixture.provenance[field] !== 'string') throw new TypeError(`Fixture provenance.${field} must be a string.`);
  assertFiniteNumber(fixture.provenance.ayanamshaDegrees, 'Fixture provenance.ayanamshaDegrees');
  for (const body of REQUIRED_BODIES) {
    const result = fixture.expected[body];
    if (!result || typeof result !== 'object') throw new TypeError(`Fixture expected.${body} is required.`);
    assertFiniteNumber(result.siderealLongitudeDegrees, `Fixture expected.${body}.siderealLongitudeDegrees`);
    if (body !== 'Ascendant') {
      assertFiniteNumber(result.longitudeSpeedDegreesPerDay, `Fixture expected.${body}.longitudeSpeedDegreesPerDay`);
      if (!['direct', 'retrograde', 'stationary'].includes(result.motion)) throw new TypeError(`Fixture expected.${body}.motion is invalid.`);
    }
  }
  return Object.freeze(fixture);
}

module.exports = { REQUIRED_BODIES, validateProviderValidationFixture };
