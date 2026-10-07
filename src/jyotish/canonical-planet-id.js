'use strict';

// Canonical identity boundary for the nine grahas used by D1, Dasha, and
// research facts.  Presentation names deliberately remain outside this helper.
const CANONICAL_PLANET_IDS = Object.freeze([
  'sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu',
]);

function canonicalPlanetId(value) {
  const candidate = typeof value === 'string'
    ? value
    : value && typeof value.id === 'string'
      ? value.id
      : value && typeof value.name === 'string'
        ? value.name
        : null;
  if (!candidate) return null;
  const normalized = candidate.trim().toLowerCase();
  return CANONICAL_PLANET_IDS.includes(normalized) ? normalized : null;
}

module.exports = { CANONICAL_PLANET_IDS, canonicalPlanetId };
