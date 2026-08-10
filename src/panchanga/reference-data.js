'use strict';

const RULESET_IDS = Object.freeze({
  tithi: 'panchanga-tithi-elongation-v1', paksha: 'panchanga-paksha-elongation-v1', lunarPhaseState: 'panchanga-lunar-phase-state-v1', karana: 'panchanga-karana-elongation-v1', nityaYoga: 'panchanga-nitya-yoga-nirayana-sum-v1'
});
const TITHI_NAMES = Object.freeze(['Pratipada', 'Dvitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dvadashi', 'Trayodashi', 'Chaturdashi', 'Purnima', 'Pratipada', 'Dvitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dvadashi', 'Trayodashi', 'Chaturdashi', 'Amavasya']);
const NITYA_YOGA_NAMES = Object.freeze(['Vishkambha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda', 'Sukarma', 'Dhriti', 'Shula', 'Ganda', 'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Variyan', 'Parigha', 'Shiva', 'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma', 'Indra', 'Vaidhriti']);
const MOVABLE_KARANAS = Object.freeze(['Bava', 'Balava', 'Kaulava', 'Taitila', 'Garaja', 'Vanija', 'Vishti']);
const KARANA_ALIASES = Object.freeze({ Garaja: Object.freeze(['Gara']), Vishti: Object.freeze(['Bhadra']) });
module.exports = { RULESET_IDS, TITHI_NAMES, NITYA_YOGA_NAMES, MOVABLE_KARANAS, KARANA_ALIASES };
