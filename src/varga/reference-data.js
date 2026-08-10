'use strict';

const { RASHI_DEFINITIONS } = require('../jyotish/reference-data');

const SIGN_CLASSIFICATIONS = Object.freeze({
  movable: Object.freeze([1, 4, 7, 10]),
  fixed: Object.freeze([2, 5, 8, 11]),
  dual: Object.freeze([3, 6, 9, 12]),
  odd: Object.freeze([1, 3, 5, 7, 9, 11]),
  even: Object.freeze([2, 4, 6, 8, 10, 12]),
  fire: Object.freeze([1, 5, 9]), earth: Object.freeze([2, 6, 10]), air: Object.freeze([3, 7, 11]), water: Object.freeze([4, 8, 12])
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
const D60_NAMES = Object.freeze(['Ghora', 'Rakshasa', 'Deva', 'Kubera', 'Yaksha', 'Kinnara', 'Bhrashta', 'Kulaghna', 'Garala', 'Vahni', 'Maya', 'Purishaka', 'Apampati', 'Marutwan', 'Kala', 'Sarpa', 'Amrita', 'Indu', 'Mridu', 'Komala', 'Heramba', 'Brahma', 'Vishnu', 'Maheswara', 'Deva', 'Ardra', 'Kalinasa', 'Kshiteesa', 'Kamalakara', 'Gulika', 'Mrithyu', 'Kaala', 'Davagni', 'Ghora', 'Yama', 'Kantaka', 'Sudha', 'Amrita', 'Poornachandra', 'Vishadagdha', 'Kulanasa', 'Vamsakshaya', 'Utpata', 'Kaala', 'Saumya', 'Komala', 'Seetala', 'Karala Damshtra', 'Chandra-mukhi', 'Praveena', 'Kalapavaka', 'Dandayudha', 'Nirmala', 'Saumya', 'Kroora', 'Atiseetala', 'Amrita', 'Payodhi', 'Bhramana', 'Chandrarekha']);

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
  }),
  D2: Object.freeze({ id: 'D2', name: 'Hora', divisor: 2, mappingStrategy: 'explicit-part-mapping-table', partTableByParity: Object.freeze({ odd: Object.freeze([{ rashiIndex: 5, lord: 'Sun' }, { rashiIndex: 4, lord: 'Moon' }]), even: Object.freeze([{ rashiIndex: 4, lord: 'Moon' }, { rashiIndex: 5, lord: 'Sun' }]) }), rulesetVersion: 'parashari-hora-v1' }),
  D3: Object.freeze({ id: 'D3', name: 'Drekkana', divisor: 3, mappingStrategy: 'equal-ordinal-offset-table', offsets: Object.freeze([0, 4, 8]), rulesetVersion: 'parashari-drekkana-v1' }),
  D4: Object.freeze({ id: 'D4', name: 'Chaturthamsha', divisor: 4, mappingStrategy: 'equal-ordinal-offset-table', offsets: Object.freeze([0, 3, 6, 9]), rulesetVersion: 'parashari-chaturthamsha-v1' }),
  D7: Object.freeze({ id: 'D7', name: 'Saptamsha', divisor: 7, mappingStrategy: 'equal-sequential-from-natal', startOffsetByParity: Object.freeze({ odd: 0, even: 6 }), rulesetVersion: 'parashari-saptamsha-v1' }),
  D12: Object.freeze({ id: 'D12', name: 'Dwadashamsha', divisor: 12, mappingStrategy: 'equal-sequential-from-natal', rulesetVersion: 'parashari-dwadashamsha-v1' }),
  D16: Object.freeze({ id: 'D16', name: 'Shodashamsha', divisor: 16, mappingStrategy: 'equal-absolute-anchor-by-modality', anchorByModality: Object.freeze({ movable: 1, fixed: 5, dual: 9 }), rulesetVersion: 'parashari-shodashamsha-v1' }),
  D20: Object.freeze({ id: 'D20', name: 'Vimshamsha', divisor: 20, mappingStrategy: 'equal-absolute-anchor-by-modality', anchorByModality: Object.freeze({ movable: 1, fixed: 9, dual: 5 }), rulesetVersion: 'parashari-vimshamsha-v1' }),
  D24: Object.freeze({ id: 'D24', name: 'Chaturvimshamsha / Siddhamsha', divisor: 24, mappingStrategy: 'equal-absolute-anchor-by-parity', anchorByParity: Object.freeze({ odd: 5, even: 4 }), rulesetVersion: 'parashari-siddhamsha-d24-v1' }),
  D27: Object.freeze({ id: 'D27', name: 'Saptavimshamsha / Bhamsa', divisor: 27, mappingStrategy: 'equal-absolute-anchor-by-element', anchorByElement: Object.freeze({ fire: 1, earth: 4, air: 7, water: 10 }), rulesetVersion: 'parashari-bhamsa-elemental-v1' }),
  D30: Object.freeze({ id: 'D30', name: 'Trimshamsha', divisor: 30, mappingStrategy: 'irregular-range-table', rulesetVersion: 'parashari-trimshamsha-projection-v1', partTableByParity: Object.freeze({ odd: Object.freeze([{ start: 0, end: 5, lord: 'Mars', deity: 'Agni', rashiIndex: 1 }, { start: 5, end: 10, lord: 'Saturn', deity: 'Vayu', rashiIndex: 11 }, { start: 10, end: 18, lord: 'Jupiter', deity: 'Indra', rashiIndex: 9 }, { start: 18, end: 25, lord: 'Mercury', deity: 'Kubera', rashiIndex: 3 }, { start: 25, end: 30, lord: 'Venus', deity: 'Varuna', rashiIndex: 7 }]), even: Object.freeze([{ start: 0, end: 5, lord: 'Venus', deity: 'Varuna', rashiIndex: 2 }, { start: 5, end: 12, lord: 'Mercury', deity: 'Kubera', rashiIndex: 6 }, { start: 12, end: 20, lord: 'Jupiter', deity: 'Indra', rashiIndex: 12 }, { start: 20, end: 25, lord: 'Saturn', deity: 'Vayu', rashiIndex: 10 }, { start: 25, end: 30, lord: 'Mars', deity: 'Agni', rashiIndex: 8 }]) }) }),
  D40: Object.freeze({ id: 'D40', name: 'Khavedamsha', divisor: 40, mappingStrategy: 'equal-absolute-anchor-by-parity', anchorByParity: Object.freeze({ odd: 1, even: 7 }), rulesetVersion: 'parashari-khavedamsha-v1' }),
  D45: Object.freeze({ id: 'D45', name: 'Akshavedamsha', divisor: 45, mappingStrategy: 'equal-absolute-anchor-by-modality', anchorByModality: Object.freeze({ movable: 1, fixed: 5, dual: 9 }), rulesetVersion: 'parashari-akshavedamsha-v1' }),
  D60: Object.freeze({ id: 'D60', name: 'Shashtiamsha', divisor: 60, mappingStrategy: 'versioned-custom-strategy', rulesetVersion: 'santhanam-natal-count-d60-v1', deitySequenceVersion: 'bphs-d60-names-v1', deitySequence: D60_NAMES })
});

const D60_RULESETS = Object.freeze({ 'santhanam-natal-count-d60-v1': Object.freeze({ default: true }), 'bphs-remainder-absolute-rashi-v1': Object.freeze({ default: false }) });
module.exports = { RASHI_DEFINITIONS, SIGN_CLASSIFICATIONS, VARGA_DEFINITIONS, ENGINE_COORDINATE_PROVENANCE, D60_RULESETS, D60_NAMES };
