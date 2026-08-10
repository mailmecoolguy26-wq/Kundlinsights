'use strict';

const Astronomy = require('astronomy-engine');
const { normalizeLongitude } = require('./sidereal-calculator');

const DEGREES_TO_RADIANS = Math.PI / 180;

function eclipticDirection(longitudeDegrees, instant) {
  const longitudeRadians = longitudeDegrees * DEGREES_TO_RADIANS;
  return new Astronomy.Vector(Math.cos(longitudeRadians), Math.sin(longitudeRadians), 0, instant);
}

function horizontalEclipticDirection(longitudeDegrees, instant, observer, ectToEqd, eqdToHor) {
  const equatorial = Astronomy.RotateVector(ectToEqd, eclipticDirection(longitudeDegrees, instant));
  return Astronomy.RotateVector(eqdToHor, equatorial);
}

function zeroCrossingLongitude(startDegrees, endDegrees, altitudeAtLongitude) {
  let low = startDegrees;
  let high = endDegrees;
  let lowAltitude = altitudeAtLongitude(low);
  for (let iteration = 0; iteration < 64; iteration += 1) {
    const middle = (low + high) / 2;
    const middleAltitude = altitudeAtLongitude(middle);
    if (Math.sign(lowAltitude) === Math.sign(middleAltitude)) {
      low = middle;
      lowAltitude = middleAltitude;
    } else {
      high = middle;
    }
  }
  return normalizeLongitude((low + high) / 2);
}

/**
 * Finds the eastern intersection of the true ecliptic of date with an observer's
 * geometric horizon. This is a development-only Ascendant calculation because
 * Astronomy Engine and the interim Lahiri transform are both provisional here.
 */
function calculateProvisionalTropicalAscendant(instant, { latitude, longitude }) {
  const observer = new Astronomy.Observer(latitude, longitude, 0);
  const ectToEqd = Astronomy.Rotation_ECT_EQD(instant);
  const eqdToHor = Astronomy.Rotation_EQD_HOR(instant, observer);
  const altitudeAtLongitude = (longitudeDegrees) => horizontalEclipticDirection(longitudeDegrees, instant, observer, ectToEqd, eqdToHor).z;
  const crossings = [];
  let previousLongitude = 0;
  let previousAltitude = altitudeAtLongitude(previousLongitude);
  for (let longitudeDegrees = 1; longitudeDegrees <= 360; longitudeDegrees += 1) {
    const altitude = altitudeAtLongitude(longitudeDegrees);
    if (previousAltitude === 0 || altitude === 0 || Math.sign(previousAltitude) !== Math.sign(altitude)) {
      crossings.push(zeroCrossingLongitude(previousLongitude, longitudeDegrees, altitudeAtLongitude));
    }
    previousLongitude = longitudeDegrees;
    previousAltitude = altitude;
  }
  const eastern = crossings.find((longitudeDegrees) => horizontalEclipticDirection(longitudeDegrees, instant, observer, ectToEqd, eqdToHor).y < 0);
  if (typeof eastern !== 'number') throw new Error('Unable to determine the eastern ecliptic/horizon intersection for Ascendant calculation.');
  return eastern;
}

module.exports = { calculateProvisionalTropicalAscendant };
