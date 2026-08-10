'use strict';

const TOTAL_DEGREES = 360;
const RASHI_SPAN_DEGREES = 30;
const NAKSHATRA_SPAN_DEGREES = TOTAL_DEGREES / 27;
const PADA_SPAN_DEGREES = TOTAL_DEGREES / 108;

const NAKSHATRA_LORD_SEQUENCE = Object.freeze([
  Object.freeze({ id: 'ketu', name: 'Ketu' }), Object.freeze({ id: 'venus', name: 'Venus' }), Object.freeze({ id: 'sun', name: 'Sun' }),
  Object.freeze({ id: 'moon', name: 'Moon' }), Object.freeze({ id: 'mars', name: 'Mars' }), Object.freeze({ id: 'rahu', name: 'Rahu' }),
  Object.freeze({ id: 'jupiter', name: 'Jupiter' }), Object.freeze({ id: 'saturn', name: 'Saturn' }), Object.freeze({ id: 'mercury', name: 'Mercury' })
]);

const RASHI_NAMES = [
  ['Mesha', 'Aries'], ['Vrishabha', 'Taurus'], ['Mithuna', 'Gemini'], ['Karka', 'Cancer'], ['Simha', 'Leo'], ['Kanya', 'Virgo'],
  ['Tula', 'Libra'], ['Vrishchika', 'Scorpio'], ['Dhanu', 'Sagittarius'], ['Makara', 'Capricorn'], ['Kumbha', 'Aquarius'], ['Meena', 'Pisces']
];

const NAKSHATRA_NAMES = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishtha', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'
];

const RASHI_DEFINITIONS = Object.freeze(RASHI_NAMES.map(([sanskritName, englishName], zeroIndex) => Object.freeze({ rashiIndex: zeroIndex + 1, sanskritName, englishName, startDegrees: zeroIndex * RASHI_SPAN_DEGREES, endDegrees: (zeroIndex + 1) * RASHI_SPAN_DEGREES })));
const NAKSHATRA_DEFINITIONS = Object.freeze(NAKSHATRA_NAMES.map((name, zeroIndex) => Object.freeze({ nakshatraIndex: zeroIndex + 1, name, lord: NAKSHATRA_LORD_SEQUENCE[zeroIndex % NAKSHATRA_LORD_SEQUENCE.length], startDegrees: zeroIndex * NAKSHATRA_SPAN_DEGREES, endDegrees: (zeroIndex + 1) * NAKSHATRA_SPAN_DEGREES })));
const PADA_DEFINITIONS = Object.freeze(Array.from({ length: 108 }, (_, zeroIndex) => Object.freeze({ globalPadaIndex: zeroIndex + 1, nakshatraIndex: Math.floor(zeroIndex / 4) + 1, pada: (zeroIndex % 4) + 1, startDegrees: zeroIndex * PADA_SPAN_DEGREES, endDegrees: (zeroIndex + 1) * PADA_SPAN_DEGREES })));

module.exports = { TOTAL_DEGREES, RASHI_SPAN_DEGREES, NAKSHATRA_SPAN_DEGREES, PADA_SPAN_DEGREES, NAKSHATRA_LORD_SEQUENCE, RASHI_DEFINITIONS, NAKSHATRA_DEFINITIONS, PADA_DEFINITIONS };
