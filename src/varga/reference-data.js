'use strict';

const { RASHI_DEFINITIONS } = require('../jyotish/reference-data');

const SIGN_CLASSIFICATIONS = Object.freeze({
  movable: Object.freeze([1, 4, 7, 10]),
  fixed: Object.freeze([2, 5, 8, 11]),
  dual: Object.freeze([3, 6, 9, 12]),
  odd: Object.freeze([1, 3, 5, 7, 9, 11]),
  even: Object.freeze([2, 4, 6, 8, 10, 12])
});

const CLASSICAL_MAPPING_PROVENANCE = Object.freeze({
  source: 'Brihat Parashara Hora Shastra, Chapter 6',
  sourceUrl: 'https://enjoylearningsanskrit.com/scriptures/parashara/chapter-6/',
  rulesetVersion: 'bphs-chapter-6-v1'
});

const ENGINE_COORDINATE_PROVENANCE = Object.freeze({
  source: 'KundlInsights engine coordinate convention',
  rulesetVersion: 'kundlinsights-varga-coordinate-v1',
  formula: 'degreesWithinResultingRashi = (degreesWithinNatalRashi - subdivisionStartDegreesWithinNatalRashi) * divisor',
  scope: 'Represents precise position within a resulting Varga Rashi; not a BPHS classical mapping claim.'
});

const VARGA_DEFINITIONS = Object.freeze({
  D1: Object.freeze({
    id: 'D1',
    name: 'Rashi',
    divisor: 1,
    mappingStrategy: 'identity',
    classicalMapping: Object.freeze({
      ...CLASSICAL_MAPPING_PROVENANCE,
      verse: 'Chapter 6, verse 3',
      rule: 'Kshetra/Rashi is the identity chart.'
    })
  }),
  D9: Object.freeze({
    id: 'D9',
    name: 'Navamsha',
    divisor: 9,
    mappingStrategy: 'equal-by-sign-modality',
    startOffsetByModality: Object.freeze({ movable: 0, fixed: 8, dual: 4 }),
    classicalMapping: Object.freeze({
      ...CLASSICAL_MAPPING_PROVENANCE,
      verse: 'Chapter 6, verse 12',
      sourceUrl: 'https://enjoylearningsanskrit.com/scriptures/parashara/chapter-6/verse-12/',
      rule: 'Movable signs start from themselves, fixed signs from the ninth, and dual signs from the fifth.'
    })
  }),
  D10: Object.freeze({
    id: 'D10',
    name: 'Dashamsha',
    divisor: 10,
    mappingStrategy: 'equal-by-sign-parity',
    startOffsetByParity: Object.freeze({ odd: 0, even: 8 }),
    classicalMapping: Object.freeze({
      ...CLASSICAL_MAPPING_PROVENANCE,
      verse: 'Chapter 6, verses 13-14',
      rule: 'Odd signs start from themselves and even signs from the ninth; resulting Rashis proceed in zodiacal order. Directional-deity reversal for even signs is outside this placement API.'
    })
  })
});

module.exports = { RASHI_DEFINITIONS, SIGN_CLASSIFICATIONS, VARGA_DEFINITIONS, ENGINE_COORDINATE_PROVENANCE };
