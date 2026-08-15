'use strict';

const { BODIES } = require('../../gochar');

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function sign(rashi) {
  return freeze({
    rashiIndex: rashi.rashiIndex,
    sanskritName: rashi.sanskritName,
    englishName: rashi.englishName,
  });
}

function planet(snapshotBody) {
  return freeze({
    planet: snapshotBody.body,
    longitude: snapshotBody.transitCanonicalSiderealLongitudeDegrees,
    sign: sign(snapshotBody.transitRashi),
    degreeWithinSign: snapshotBody.transitDegreeWithinRashi,
    natalHouse: snapshotBody.transitNatalHouseNumber,
    motion: snapshotBody.motion,
    retrograde: snapshotBody.motion === 'retrograde',
  });
}

function sadeSati(snapshot) {
  const value = snapshot.transitBodies.Saturn.sadeSati;
  return freeze({
    active: value.detected,
    phase: value.phase,
    houseFromNatalMoon: value.houseFromNatalMoon,
  });
}

function toTransitSnapshotDto({ birthProfileId, snapshot }) {
  if (!birthProfileId || !snapshot || !snapshot.transitBodies) {
    throw new TypeError('Transit snapshot DTO requires an owned profile and Gochar snapshot.');
  }
  return freeze({
    birthProfileId,
    at: snapshot.snapshotInstant,
    planets: BODIES.map((body) => planet(snapshot.transitBodies[body])),
    sadeSati: sadeSati(snapshot),
  });
}

module.exports = { toTransitSnapshotDto };
