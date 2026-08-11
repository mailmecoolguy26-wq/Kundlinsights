'use strict';

function minimumCircularLongitudeSeparationDegrees(firstLongitudeDegrees, secondLongitudeDegrees) {
  if (typeof firstLongitudeDegrees !== 'number' || !Number.isFinite(firstLongitudeDegrees) || typeof secondLongitudeDegrees !== 'number' || !Number.isFinite(secondLongitudeDegrees)) throw new TypeError('Circular longitude distance requires two finite degree values.');
  const difference = Math.abs(firstLongitudeDegrees - secondLongitudeDegrees) % 360;
  return Math.min(difference, 360 - difference);
}

module.exports = { minimumCircularLongitudeSeparationDegrees };
