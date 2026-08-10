'use strict';

const YOGA_BUNDLE_ID = 'layer7-core-yoga-detection-v1';
const D1_CHART_ID = 'D1';
const LAYER_5A_HOUSE_SYSTEM_ID = 'parashari-rashi-house-v1';

// These definitions intentionally identify a small, auditable bundle. Their
// predicates remain explicit rather than being interpreted as a general rule DSL.
const YOGA_DEFINITIONS = Object.freeze([
  Object.freeze({
    yogaId: 'phaladeepika-gaja-kesari-kendra-from-moon-v1',
    yogaName: 'Gaja Kesari',
    kind: 'gajaKesari',
    sourceStatus: 'CLASSICAL_TRANSLATION',
    kendraOffsets: Object.freeze([0, 3, 6, 9])
  }),
  Object.freeze({ yogaId: 'ruchaka-mahapurusha-v1', yogaName: 'Ruchaka Mahapurusha', kind: 'mahaPurusha', planet: 'Mars', sourceStatus: 'CLASSICAL_TRANSLATION' }),
  Object.freeze({ yogaId: 'bhadra-mahapurusha-v1', yogaName: 'Bhadra Mahapurusha', kind: 'mahaPurusha', planet: 'Mercury', sourceStatus: 'CLASSICAL_TRANSLATION' }),
  Object.freeze({ yogaId: 'hamsa-mahapurusha-v1', yogaName: 'Hamsa Mahapurusha', kind: 'mahaPurusha', planet: 'Jupiter', sourceStatus: 'CLASSICAL_TRANSLATION' }),
  Object.freeze({ yogaId: 'malavya-mahapurusha-v1', yogaName: 'Malavya Mahapurusha', kind: 'mahaPurusha', planet: 'Venus', sourceStatus: 'CLASSICAL_TRANSLATION' }),
  Object.freeze({ yogaId: 'shasha-mahapurusha-v1', yogaName: 'Shasha Mahapurusha', kind: 'mahaPurusha', planet: 'Saturn', sourceStatus: 'CLASSICAL_TRANSLATION' }),
  Object.freeze({ yogaId: 'phaladeepika-harsha-vipareeta-v1', yogaName: 'Harsha Vipareeta', kind: 'vipareeta', sourceHouse: 6, sourceStatus: 'CLASSICAL_TRANSLATION' }),
  Object.freeze({ yogaId: 'phaladeepika-sarala-vipareeta-v1', yogaName: 'Sarala Vipareeta', kind: 'vipareeta', sourceHouse: 8, sourceStatus: 'CLASSICAL_TRANSLATION' }),
  Object.freeze({ yogaId: 'phaladeepika-vimala-vipareeta-v1', yogaName: 'Vimala Vipareeta', kind: 'vipareeta', sourceHouse: 12, sourceStatus: 'CLASSICAL_TRANSLATION' })
]);

const KENDRA_HOUSES = Object.freeze([1, 4, 7, 10]);
const DUSTHANA_HOUSES = Object.freeze([6, 8, 12]);
const MAHAPURUSHA_PLANETS = Object.freeze(['Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']);

module.exports = {
  YOGA_BUNDLE_ID,
  D1_CHART_ID,
  LAYER_5A_HOUSE_SYSTEM_ID,
  YOGA_DEFINITIONS,
  KENDRA_HOUSES,
  DUSTHANA_HOUSES,
  MAHAPURUSHA_PLANETS
};
