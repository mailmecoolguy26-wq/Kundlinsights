'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifySiderealLongitude,
  normalizeSiderealLongitude,
  classifyLayer1Bodies,
  RASHI_DEFINITIONS,
  NAKSHATRA_DEFINITIONS,
  PADA_DEFINITIONS,
  NAKSHATRA_LORD_SEQUENCE,
  RASHI_SPAN_DEGREES,
  NAKSHATRA_SPAN_DEGREES,
  PADA_SPAN_DEGREES
} = require('../../src/jyotish');

const {
  AstronomicalEngine,
  AstronomyEngineProvider
} = require('../../src/astronomy');

const EPSILON = 1e-10;

test('maps all 12 exact Rashi boundaries, including 360 degrees', () => {
  RASHI_DEFINITIONS.forEach((rashi) => {
    const result = classifySiderealLongitude(rashi.startDegrees);

    assert.equal(result.rashi.rashiIndex, rashi.rashiIndex);
    assert.equal(result.rashi.sanskritName, rashi.sanskritName);
  });

  const zero = classifySiderealLongitude(0);
  const threeSixty = classifySiderealLongitude(360);

  assert.equal(zero.rashi.sanskritName, 'Mesha');
  assert.equal(threeSixty.normalizedLongitudeDegrees, 0);
  assert.equal(threeSixty.rashi.sanskritName, 'Mesha');
});

test('classifies immediately below, exactly at, and above every Rashi boundary', () => {
  RASHI_DEFINITIONS.forEach((rashi, index) => {
    const boundary = rashi.startDegrees;

    const at = classifySiderealLongitude(boundary);
    const below = classifySiderealLongitude(boundary - EPSILON);
    const above = classifySiderealLongitude(boundary + EPSILON);

    assert.equal(at.rashi.rashiIndex, index + 1);
    assert.equal(above.rashi.rashiIndex, index + 1);
    assert.equal(
      below.rashi.rashiIndex,
      index === 0 ? 12 : index
    );
  });
});

test('classifies every Nakshatra and Pada boundary with deterministic half-open intervals', () => {
  NAKSHATRA_DEFINITIONS.forEach((nakshatra, index) => {
    const boundary = nakshatra.startDegrees;

    const at = classifySiderealLongitude(boundary);
    const below = classifySiderealLongitude(boundary - EPSILON);
    const above = classifySiderealLongitude(boundary + EPSILON);

    assert.equal(at.nakshatra.nakshatraIndex, index + 1);
    assert.equal(above.nakshatra.nakshatraIndex, index + 1);
    assert.equal(
      below.nakshatra.nakshatraIndex,
      index === 0 ? 27 : index
    );
  });

  PADA_DEFINITIONS.forEach((pada, index) => {
    const boundary = pada.startDegrees;

    const at = classifySiderealLongitude(boundary);
    const below = classifySiderealLongitude(boundary - EPSILON);
    const above = classifySiderealLongitude(boundary + EPSILON);

    assert.equal(at.pada.pada, pada.pada);
    assert.equal(above.pada.pada, pada.pada);
    assert.equal(
      below.pada.pada,
      index === 0 ? 4 : PADA_DEFINITIONS[index - 1].pada
    );
  });
});

test('normalizes negative, 360-degree, and oversized longitude inputs', () => {
  assert.equal(normalizeSiderealLongitude(-1), 359);
  assert.equal(normalizeSiderealLongitude(360), 0);
  assert.equal(normalizeSiderealLongitude(721.25), 1.25);

  assert.equal(classifySiderealLongitude(-1).rashi.rashiIndex, 12);
  assert.equal(classifySiderealLongitude(720).nakshatra.nakshatraIndex, 1);
});

test('uses the complete standard Rashi, Nakshatra, lord, and Pada reference data', () => {
  assert.deepEqual(
    RASHI_DEFINITIONS.map((item) => item.sanskritName),
    [
      'Mesha',
      'Vrishabha',
      'Mithuna',
      'Karka',
      'Simha',
      'Kanya',
      'Tula',
      'Vrishchika',
      'Dhanu',
      'Makara',
      'Kumbha',
      'Meena'
    ]
  );

  assert.equal(NAKSHATRA_DEFINITIONS.length, 27);
  assert.equal(PADA_DEFINITIONS.length, 108);

  NAKSHATRA_DEFINITIONS.forEach((nakshatra, index) => {
    assert.deepEqual(
      nakshatra.lord,
      NAKSHATRA_LORD_SEQUENCE[index % 9]
    );
  });

  assert.deepEqual(
    NAKSHATRA_DEFINITIONS.slice(0, 9).map((item) => item.lord.name),
    [
      'Ketu',
      'Venus',
      'Sun',
      'Moon',
      'Mars',
      'Rahu',
      'Jupiter',
      'Saturn',
      'Mercury'
    ]
  );
});

test('proves span, sequence, and uniqueness invariants', () => {
  assert.equal(27 * NAKSHATRA_SPAN_DEGREES, 360);
  assert.equal(108 * PADA_SPAN_DEGREES, 360);

  RASHI_DEFINITIONS.forEach((item, index) => {
    assert.equal(
      item.endDegrees - item.startDegrees,
      RASHI_SPAN_DEGREES
    );

    assert.equal(
      item.startDegrees,
      index === 0
        ? 0
        : RASHI_DEFINITIONS[index - 1].endDegrees
    );
  });

  NAKSHATRA_DEFINITIONS.forEach((item, index) => {
    assert.ok(
      Math.abs(
        (item.endDegrees - item.startDegrees) -
          NAKSHATRA_SPAN_DEGREES
      ) < 1e-12
    );

    assert.equal(
      item.startDegrees,
      index === 0
        ? 0
        : NAKSHATRA_DEFINITIONS[index - 1].endDegrees
    );

    assert.equal(
      PADA_DEFINITIONS.filter(
        (pada) => pada.nakshatraIndex === item.nakshatraIndex
      ).length,
      4
    );
  });

  PADA_DEFINITIONS.forEach((item, index) => {
    assert.ok(
      Math.abs(
        (item.endDegrees - item.startDegrees) -
          PADA_SPAN_DEGREES
      ) < 1e-12
    );

    assert.equal(
      item.startDegrees,
      index === 0
        ? 0
        : PADA_DEFINITIONS[index - 1].endDegrees
    );
  });

  for (
    let longitude = -720;
    longitude <= 720;
    longitude += 0.125
  ) {
    const result = classifySiderealLongitude(longitude);

    assert.ok(
      result.rashi.rashiIndex >= 1 &&
      result.rashi.rashiIndex <= 12
    );

    assert.ok(
      result.nakshatra.nakshatraIndex >= 1 &&
      result.nakshatra.nakshatraIndex <= 27
    );

    assert.ok(
      result.pada.pada >= 1 &&
      result.pada.pada <= 4
    );
  }
});

test('adapts Layer 1 sidereal values without observing provider-specific data', () => {
  const layer1 = new AstronomicalEngine(
    new AstronomyEngineProvider()
  ).calculate({
    date: '1990-08-15',
    time: '14:30:00',
    timezone: 'Asia/Kolkata',
    latitude: 28.6139,
    longitude: 77.209
  });

  const classified = classifyLayer1Bodies(layer1);

  assert.equal(
    classified.Sun.jyotishCoordinates.normalizedLongitudeDegrees,
    layer1.bodies.Sun.siderealLongitudeDegrees
  );

  assert.equal(
    classified.Sun.jyotishCoordinates.rashi.sanskritName,
    'Karka'
  );

  assert.equal(
    classified.Sun.jyotishCoordinates.nakshatra.name,
    'Ashlesha'
  );

  assert.equal(
    Object.hasOwn(
      classified.Sun.jyotishCoordinates,
      'provider'
    ),
    false
  );
});
