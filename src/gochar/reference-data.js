'use strict';
const { FULL_ASPECTS_BY_GRAHA } = require('../drishti/reference-data');
const BODIES=Object.freeze(['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn','Rahu','Ketu']);
const CASTERS=Object.freeze(['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn']);
const RULESETS=Object.freeze({transitHouse:'gochar-natal-rashi-house-v1',fromNatalMoon:'gochar-from-janma-rashi-v1',sameRashiAssociation:'same-rashi-transit-association-v1',transitDrishti:'parashari-transit-to-natal-graha-drishti-v1',sadeSati:'sade-sati-rashi-phase-v1'});
module.exports={BODIES,CASTERS,RULESETS,FULL_ASPECTS_BY_GRAHA};
