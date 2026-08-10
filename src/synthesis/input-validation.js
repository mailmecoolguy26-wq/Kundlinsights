'use strict';

function rashiIndex(value) {
  const rashi = value && (value.rashi || (value.jyotishCoordinates && value.jyotishCoordinates.rashi));
  return rashi && Number.isInteger(rashi.rashiIndex) ? rashi.rashiIndex : null;
}
function validateNatalConsistency({ layer2Bodies, houses } = {}) {
  if (!layer2Bodies || !houses || !Array.isArray(houses.planetaryAssignments)) return;
  for (const assignment of houses.planetaryAssignments) {
    const layer2 = layer2Bodies[assignment.body];
    const classifiedRashi = rashiIndex(layer2);
    if (classifiedRashi !== null && assignment.rashi && classifiedRashi !== assignment.rashi.rashiIndex) throw new RangeError(`Upstream contradiction for ${assignment.body}: Layer 2 and Layer 5A Rashis differ.`);
  }
}
module.exports = { rashiIndex, validateNatalConsistency };
