'use strict';

const CANONICAL_PLANETS = Object.freeze({
  sun: 'Sun', moon: 'Moon', mars: 'Mars', mercury: 'Mercury',
  jupiter: 'Jupiter', venus: 'Venus', saturn: 'Saturn', rahu: 'Rahu', ketu: 'Ketu',
});

const HINGLISH_PLANETS = Object.freeze({
  Saturn: 'Shani Dev', Jupiter: 'Guru Dev', Mars: 'Mangal', Mercury: 'Budh',
  Venus: 'Shukra', Sun: 'Surya Dev', Moon: 'Chandra Dev', Rahu: 'Rahu', Ketu: 'Ketu',
});

function planet(value, locale) {
  if (typeof value !== 'string') return value;
  const canonical = CANONICAL_PLANETS[value.trim().toLowerCase()];
  if (!canonical) return value;
  return locale === 'hinglish' ? HINGLISH_PLANETS[canonical] : canonical;
}

function structuralSummary({ status, mahadashaLord, antardashaLord, pratyantarLord }) {
  const md = planet(mahadashaLord, 'english');
  const ad = planet(antardashaLord, 'english');
  const pd = planet(pratyantarLord, 'english');
  const hMd = planet(mahadashaLord, 'hinglish');
  const hAd = planet(antardashaLord, 'hinglish');
  const hPd = planet(pratyantarLord, 'hinglish');
  const verb = status === 'CURRENT' ? 'is currently active' : status === 'UPCOMING' ? 'begins' : 'occurred';
  const hinglishVerb = status === 'CURRENT' ? 'abhi active hai' : status === 'UPCOMING' ? 'shuru hoga' : 'ho chuka hai';
  return Object.freeze({
    english: `This ${pd} Pratyantar ${verb} within your ${ad} Antardasha and ${md} Mahadasha.`,
    hinglish: `Yeh ${hPd} Pratyantar aapki ${hAd} Antardasha aur ${hMd} Mahadasha ke andar ${hinglishVerb}.`,
  });
}

module.exports = { CANONICAL_PLANETS, HINGLISH_PLANETS, planet, structuralSummary };
