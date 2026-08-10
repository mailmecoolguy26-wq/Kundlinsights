'use strict';
const {circularSeparation}=require('./rashi-distance');
function sameRashiNatalBodies(transit,natalBodies){return Object.values(natalBodies).filter(n=>n.body!=='Ascendant'&&n.rashi.rashiIndex===transit.rashi.rashiIndex).map(n=>({natalBody:n.body,natalRashi:n.rashi,natalCanonicalSiderealLongitudeDegrees:n.canonicalSiderealLongitudeDegrees,transitCanonicalSiderealLongitudeDegrees:transit.canonicalSiderealLongitudeDegrees,minimumCircularLongitudeSeparationDegrees:circularSeparation(n.normalizedCanonicalSiderealLongitudeDegrees,transit.normalizedCanonicalSiderealLongitudeDegrees)}));}
module.exports={sameRashiNatalBodies};
