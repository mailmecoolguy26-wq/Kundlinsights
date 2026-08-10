'use strict';

const GRAHA_DRISHTI_RULESET_ID = 'parashari-seven-graha-drishti-v1';
const D1_CHART_ID = 'D1';
const LAYER_5A_HOUSE_SYSTEM_ID = 'parashari-rashi-house-v1';

const CASTING_GRAHAS = Object.freeze(['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']);
const FULL_ASPECTS_BY_GRAHA = Object.freeze({
  Sun: Object.freeze([{ aspectNumber: 7, rashiOffset: 6, aspectType: 'generalFull' }]),
  Moon: Object.freeze([{ aspectNumber: 7, rashiOffset: 6, aspectType: 'generalFull' }]),
  Mars: Object.freeze([{ aspectNumber: 4, rashiOffset: 3, aspectType: 'specialFull' }, { aspectNumber: 7, rashiOffset: 6, aspectType: 'generalFull' }, { aspectNumber: 8, rashiOffset: 7, aspectType: 'specialFull' }]),
  Mercury: Object.freeze([{ aspectNumber: 7, rashiOffset: 6, aspectType: 'generalFull' }]),
  Jupiter: Object.freeze([{ aspectNumber: 5, rashiOffset: 4, aspectType: 'specialFull' }, { aspectNumber: 7, rashiOffset: 6, aspectType: 'generalFull' }, { aspectNumber: 9, rashiOffset: 8, aspectType: 'specialFull' }]),
  Venus: Object.freeze([{ aspectNumber: 7, rashiOffset: 6, aspectType: 'generalFull' }]),
  Saturn: Object.freeze([{ aspectNumber: 3, rashiOffset: 2, aspectType: 'specialFull' }, { aspectNumber: 7, rashiOffset: 6, aspectType: 'generalFull' }, { aspectNumber: 10, rashiOffset: 9, aspectType: 'specialFull' }])
});

module.exports = { GRAHA_DRISHTI_RULESET_ID, D1_CHART_ID, LAYER_5A_HOUSE_SYSTEM_ID, CASTING_GRAHAS, FULL_ASPECTS_BY_GRAHA };
