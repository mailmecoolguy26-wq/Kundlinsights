'use strict';

const { freeze } = require('../../synthesis/evidence-node');

const THEME_BY_PLANET = freeze({
  Sun: 'AUTHORITY_ADMINISTRATION',
  Moon: 'PEOPLE_CARE_PUBLIC',
  Mars: 'EXECUTION_TECHNICAL',
  Mercury: 'COMMUNICATION_COMMERCE_TECH',
  Jupiter: 'ADVISORY_KNOWLEDGE',
  Venus: 'DESIGN_LUXURY_CLIENT',
  Saturn: 'STRUCTURE_OPERATIONS',
  Rahu: 'UNCONVENTIONAL_TECH_GLOBAL',
  Ketu: 'RESEARCH_SPECIALIZATION',
});

const THEME_ORDER = freeze([
  'AUTHORITY_ADMINISTRATION',
  'PEOPLE_CARE_PUBLIC',
  'EXECUTION_TECHNICAL',
  'COMMUNICATION_COMMERCE_TECH',
  'ADVISORY_KNOWLEDGE',
  'DESIGN_LUXURY_CLIENT',
  'STRUCTURE_OPERATIONS',
  'UNCONVENTIONAL_TECH_GLOBAL',
  'RESEARCH_SPECIALIZATION',
]);

const PLANETS = new Set(Object.keys(THEME_BY_PLANET));
const FACTOR_SOURCES = new Set([
  'D10_LAGNA_OCCUPANT',
  'D10_LAGNA_LORD',
  'D10_TENTH_OCCUPANT',
  'D10_TENTH_LORD',
  'D10_SHANI',
]);

function supportedFoundation(insights) {
  return Array.isArray(insights) && insights.some(
    (item) => item && item.family === 'CAREER_FOUNDATION' && item.status === 'SUPPORTED',
  );
}

function house(value) {
  return Number.isInteger(value) && value >= 1 && value <= 12 ? value : null;
}

function factor(source, planet, placementHouse) {
  if (!FACTOR_SOURCES.has(source) || !PLANETS.has(planet) || !house(placementHouse)) return null;
  return freeze({ source, planet, house: placementHouse });
}

function factorsFromHouse(value, occupantSource, lordSource) {
  if (!value || typeof value !== 'object') return [];
  const factors = [];
  if (PLANETS.has(value.lord) && house(value.lordHouse)) {
    factors.push(factor(lordSource, value.lord, value.lordHouse));
  }
  for (const occupant of Array.isArray(value.occupants) ? value.occupants : []) {
    const item = occupant && factor(occupantSource, occupant.planet, occupant.house);
    if (item) factors.push(item);
  }
  return factors;
}

function validD10Structure(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.chart !== 'D10') return null;
  if (!value.lagna || !value.tenthHouse || !value.shani || value.shani.planet !== 'Saturn') return null;
  const factors = [
    ...factorsFromHouse(value.lagna, 'D10_LAGNA_OCCUPANT', 'D10_LAGNA_LORD'),
    ...factorsFromHouse(value.tenthHouse, 'D10_TENTH_OCCUPANT', 'D10_TENTH_LORD'),
  ];
  const shani = factor('D10_SHANI', value.shani.planet, value.shani.house);
  if (shani) factors.push(shani);
  return factors.length ? factors : null;
}

function compareFactors(left, right) {
  return `${left.source}|${left.planet}|${left.house}`.localeCompare(
    `${right.source}|${right.planet}|${right.house}`,
  );
}

/// Delivers controlled D10 profession-theme context only after an existing
/// supported D1 Career foundation. It does not score, rank, time, or predict.
function buildCareerD10Corroboration({ insights = [], careerD10Structure = null } = {}) {
  if (!supportedFoundation(insights)) return null;
  const factors = validD10Structure(careerD10Structure);
  if (!factors) return null;
  const themes = new Map();
  for (const item of factors) {
    const theme = THEME_BY_PLANET[item.planet];
    if (!theme) continue;
    const existing = themes.get(theme) || [];
    if (!existing.some((entry) => entry.source === item.source && entry.planet === item.planet && entry.house === item.house)) {
      existing.push(item);
    }
    themes.set(theme, existing);
  }
  const output = THEME_ORDER
    .filter((theme) => themes.has(theme))
    .map((theme) => freeze({
      theme,
      supportingFactors: freeze([...themes.get(theme)].sort(compareFactors)),
      interpretationLevel: 'CONTEXTUAL',
      limitation: 'NOT_STANDALONE_PREDICTION',
    }));
  return output.length
    ? freeze({
      chart: 'D10',
      corroborates: 'CAREER_FOUNDATION',
      themes: freeze(output),
    })
    : null;
}

module.exports = {
  THEME_BY_PLANET,
  THEME_ORDER,
  buildCareerD10Corroboration,
};
