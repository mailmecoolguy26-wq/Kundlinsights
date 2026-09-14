'use strict';

const { freeze } = require('../../synthesis/evidence-node');

// Phase 16C permits only H10 SAV as context for an already-supported D1
// Career foundation. This module deliberately has no threshold, comparison,
// timing, outcome, or H7/business inference.
const H10_FOUNDATION_TOPICS = new Set([
  'CAREER_H10_SIGNIFICATION_SCOPE_PRESENT',
  'CAREER_H10_LORD_NATAL_CONNECTION_PRESENT',
  'CAREER_H10_OCCUPANT_CONNECTION_PRESENT',
]);

function hasSupportedH10Foundation(conclusions) {
  return Array.isArray(conclusions) && conclusions.some((conclusion) =>
    conclusion && conclusion.conclusionStatus === 'SUPPORTED' &&
    H10_FOUNDATION_TOPICS.has(conclusion.topic));
}

function validH10Fact(structure) {
  const h10 = structure && structure.h10;
  return h10 && h10.house === 10 && Number.isInteger(h10.sav) && h10.sav >= 0
    ? { house: 10, sav: h10.sav }
    : null;
}

function buildCareerAshtakavargaCorroboration({ conclusions, careerAshtakavargaStructure } = {}) {
  const h10 = validH10Fact(careerAshtakavargaStructure);
  if (!h10 || !hasSupportedH10Foundation(conclusions)) return null;
  return freeze({
    kind: 'H10_NATAL_CONTEXT',
    chart: 'D1',
    corroborates: 'CAREER_FOUNDATION',
    h10,
    limitation: 'NOT_STANDALONE_PREDICTION',
  });
}

module.exports = { buildCareerAshtakavargaCorroboration, hasSupportedH10Foundation };
