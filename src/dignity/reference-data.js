'use strict';

const { RASHI_DEFINITIONS } = require('../jyotish/reference-data');

const SEVEN_GRAHA_DIGNITY_RULESET_ID = 'parashari-seven-graha-dignity-v1';
const NODE_DIGNITY_RULESET_ID = 'bphs-santhanam-node-dignity-v1';
const NATURAL_MAITRI_RULESET_ID = 'parashari-natural-maitri-v1';
const TEMPORARY_MAITRI_RULESET_ID = 'parashari-temporary-maitri-v1';
const PANCHADHA_MAITRI_RULESET_ID = 'parashari-panchadha-maitri-v1';
const COMBUSTION_RULESET_ID = 'surya-siddhanta-santhanam-combustion-v1';

const SEVEN_CLASSICAL_BODIES = Object.freeze(['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']);
const NODE_BODIES = Object.freeze(['Rahu', 'Ketu']);
const RASHI_LORDS = Object.freeze({
  1: 'Mars', 2: 'Venus', 3: 'Mercury', 4: 'Moon', 5: 'Sun', 6: 'Mercury',
  7: 'Venus', 8: 'Mars', 9: 'Jupiter', 10: 'Saturn', 11: 'Saturn', 12: 'Jupiter'
});

function dignityDefinition({ ownRashis, moolatrikona, exaltationRashiIndex, exaltationPointDegreesWithinRashi, debilitationRashiIndex, debilitationPointDegreesWithinRashi }) {
  return Object.freeze({
    ownRashis: Object.freeze(ownRashis),
    moolatrikona: moolatrikona && Object.freeze({ ...moolatrikona }),
    exaltationRashiIndex,
    exaltationPointDegreesWithinRashi,
    debilitationRashiIndex,
    debilitationPointDegreesWithinRashi
  });
}

const SEVEN_GRAHA_DIGNITIES = Object.freeze({
  Sun: dignityDefinition({ ownRashis: [5], moolatrikona: { rashiIndex: 5, startDegrees: 0, endDegrees: 20 }, exaltationRashiIndex: 1, exaltationPointDegreesWithinRashi: 10, debilitationRashiIndex: 7, debilitationPointDegreesWithinRashi: 10 }),
  Moon: dignityDefinition({ ownRashis: [4], moolatrikona: { rashiIndex: 2, startDegrees: 3, endDegrees: 30 }, exaltationRashiIndex: 2, exaltationPointDegreesWithinRashi: 3, debilitationRashiIndex: 8, debilitationPointDegreesWithinRashi: 3 }),
  Mars: dignityDefinition({ ownRashis: [1, 8], moolatrikona: { rashiIndex: 1, startDegrees: 0, endDegrees: 12 }, exaltationRashiIndex: 10, exaltationPointDegreesWithinRashi: 28, debilitationRashiIndex: 4, debilitationPointDegreesWithinRashi: 28 }),
  Mercury: dignityDefinition({ ownRashis: [3, 6], moolatrikona: { rashiIndex: 6, startDegrees: 15, endDegrees: 20 }, exaltationRashiIndex: 6, exaltationPointDegreesWithinRashi: 15, debilitationRashiIndex: 12, debilitationPointDegreesWithinRashi: 15 }),
  Jupiter: dignityDefinition({ ownRashis: [9, 12], moolatrikona: { rashiIndex: 9, startDegrees: 0, endDegrees: 10 }, exaltationRashiIndex: 4, exaltationPointDegreesWithinRashi: 5, debilitationRashiIndex: 10, debilitationPointDegreesWithinRashi: 5 }),
  Venus: dignityDefinition({ ownRashis: [2, 7], moolatrikona: { rashiIndex: 7, startDegrees: 0, endDegrees: 15 }, exaltationRashiIndex: 12, exaltationPointDegreesWithinRashi: 27, debilitationRashiIndex: 6, debilitationPointDegreesWithinRashi: 27 }),
  Saturn: dignityDefinition({ ownRashis: [10, 11], moolatrikona: { rashiIndex: 11, startDegrees: 0, endDegrees: 20 }, exaltationRashiIndex: 7, exaltationPointDegreesWithinRashi: 20, debilitationRashiIndex: 1, debilitationPointDegreesWithinRashi: 20 })
});

const NODE_DIGNITIES = Object.freeze({
  Rahu: dignityDefinition({ ownRashis: [11], moolatrikona: { rashiIndex: 3, startDegrees: 0, endDegrees: 30 }, exaltationRashiIndex: 2, exaltationPointDegreesWithinRashi: null, debilitationRashiIndex: 8, debilitationPointDegreesWithinRashi: null }),
  Ketu: dignityDefinition({ ownRashis: [8], moolatrikona: { rashiIndex: 9, startDegrees: 0, endDegrees: 30 }, exaltationRashiIndex: 8, exaltationPointDegreesWithinRashi: null, debilitationRashiIndex: 2, debilitationPointDegreesWithinRashi: null })
});

const NATURAL_MAITRI = Object.freeze({
  Sun: Object.freeze({ friends: Object.freeze(['Moon', 'Mars', 'Jupiter']), neutrals: Object.freeze(['Mercury']), enemies: Object.freeze(['Venus', 'Saturn']) }),
  Moon: Object.freeze({ friends: Object.freeze(['Sun', 'Mercury']), neutrals: Object.freeze(['Mars', 'Jupiter', 'Venus', 'Saturn']), enemies: Object.freeze([]) }),
  Mars: Object.freeze({ friends: Object.freeze(['Sun', 'Moon', 'Jupiter']), neutrals: Object.freeze(['Venus', 'Saturn']), enemies: Object.freeze(['Mercury']) }),
  Mercury: Object.freeze({ friends: Object.freeze(['Sun', 'Venus']), neutrals: Object.freeze(['Mars', 'Jupiter', 'Saturn']), enemies: Object.freeze(['Moon']) }),
  Jupiter: Object.freeze({ friends: Object.freeze(['Sun', 'Moon', 'Mars']), neutrals: Object.freeze(['Saturn']), enemies: Object.freeze(['Mercury', 'Venus']) }),
  Venus: Object.freeze({ friends: Object.freeze(['Mercury', 'Saturn']), neutrals: Object.freeze(['Mars', 'Jupiter']), enemies: Object.freeze(['Sun', 'Moon']) }),
  Saturn: Object.freeze({ friends: Object.freeze(['Mercury', 'Venus']), neutrals: Object.freeze(['Jupiter']), enemies: Object.freeze(['Sun', 'Moon', 'Mars']) })
});

const TEMPORARY_FRIEND_OFFSETS = Object.freeze([1, 2, 3, 9, 10, 11]);
const COMBUSTION_THRESHOLDS = Object.freeze({
  Moon: Object.freeze({ direct: 12, retrograde: 12 }),
  Mars: Object.freeze({ direct: 17, retrograde: 8 }),
  Mercury: Object.freeze({ direct: 14, retrograde: 12 }),
  Jupiter: Object.freeze({ direct: 11, retrograde: 11 }),
  Venus: Object.freeze({ direct: 10, retrograde: 8 }),
  Saturn: Object.freeze({ direct: 16, retrograde: 16 })
});

function rashiByIndex(rashiIndex) {
  const rashi = RASHI_DEFINITIONS[rashiIndex - 1];
  if (!rashi) throw new RangeError(`Invalid Rashi index: ${rashiIndex}`);
  return rashi;
}

module.exports = {
  SEVEN_GRAHA_DIGNITY_RULESET_ID, NODE_DIGNITY_RULESET_ID, NATURAL_MAITRI_RULESET_ID,
  TEMPORARY_MAITRI_RULESET_ID, PANCHADHA_MAITRI_RULESET_ID, COMBUSTION_RULESET_ID,
  SEVEN_CLASSICAL_BODIES, NODE_BODIES, RASHI_LORDS, SEVEN_GRAHA_DIGNITIES, NODE_DIGNITIES,
  NATURAL_MAITRI, TEMPORARY_FRIEND_OFFSETS, COMBUSTION_THRESHOLDS, rashiByIndex
};
