'use strict';

// This module deliberately knows nothing about astrology.  A domain supplies
// already-valid candidates in its existing primary order and an explicit
// equivalence group.  History can only settle a tie inside that group.
const REASON = Object.freeze({
  NOT_ELIGIBLE: 'PERSONALIZATION_NOT_ELIGIBLE',
  NOT_EQUIVALENT: 'PRIMARY_RANK_NOT_EQUIVALENT',
  ADVANTAGE: 'HISTORICAL_MATCH_ADVANTAGE',
  NO_DIFFERENCE: 'NO_PERSONALIZATION_DIFFERENCE',
  CONTRADICTION: 'MATERIAL_CONTRADICTION',
  NOT_ENABLED: 'DOMAIN_NOT_ENABLED',
});
const strength = Object.freeze({ NONE: 0, LIMITED: 1, WEAK: 2, MODERATE: 3, STRONG: 4 });

function freeze(value) { return Object.freeze(value); }
function byId(items) { return new Map((items || []).map((item) => [item.candidateId, item])); }
function eligibility(annotation, readiness) {
  if (!annotation || !readiness || readiness.customerDisplayEligible !== true || annotation.tieBreakEligible !== true) {
    return freeze({ eligible: false, reason: REASON.NOT_ELIGIBLE, tuple: null });
  }
  if ((annotation.contradictionFlags || []).length) return freeze({ eligible: false, reason: REASON.CONTRADICTION, tuple: null });
  return freeze({
    eligible: true,
    reason: null,
    // Lexicographic, intentionally small and explainable.  The first two
    // dimensions must improve (or remain equal) before a later dimension can
    // matter, preventing a trivial family/strength difference from a flip.
    tuple: freeze([
      readiness.matchedEventCount || 0,
      readiness.highMediumMatchedEventCount || 0,
      (readiness.matchedEvidenceFamilies || []).length,
      strength[annotation.patternStrength] || 0,
    ]),
  });
}
function hasMaterialAdvantage(left, right) {
  if (!left.eligible || !right.eligible) return false;
  const [matches, precision, families, pattern] = left.tuple;
  const [otherMatches, otherPrecision, otherFamilies, otherPattern] = right.tuple;
  if (matches > otherMatches && precision >= otherPrecision && families >= otherFamilies) return true;
  if (matches === otherMatches && precision > otherPrecision && families >= otherFamilies) return true;
  if (matches === otherMatches && precision === otherPrecision && families === otherFamilies && pattern > otherPattern) return true;
  return false;
}

function rankPersonalisedTiming({ candidates = [], calibration = null, enabled = true } = {}) {
  const original = [...candidates];
  const annotations = byId(calibration && calibration.annotations);
  const readiness = byId(calibration && calibration.customerDisplayReadiness);
  const rows = original.map((candidate, index) => freeze({ candidate, index, historical: eligibility(annotations.get(candidate.candidateId), readiness.get(candidate.candidateId)) }));
  if (!enabled) return freeze({ orderedCandidateIds: freeze(original.map((item) => item.candidateId)), applied: false, audit: freeze(rows.map((row) => freeze({ candidateId: row.candidate.candidateId, originalPrimaryRank: row.index, finalPersonalizedRank: row.index, rankingGroup: row.candidate.personalizationGroup || null, reasonCode: REASON.NOT_ENABLED }))) });
  const groups = new Map();
  for (const row of rows) {
    const key = row.candidate.personalizationGroup;
    if (typeof key !== 'string' || !key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const rankById = new Map(rows.map((row) => [row.candidate.candidateId, row.index]));
  const reasons = new Map(rows.map((row) => [row.candidate.candidateId, row.historical.reason || REASON.NO_DIFFERENCE]));
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const ordered = [...group].sort((left, right) => {
      if (hasMaterialAdvantage(left.historical, right.historical)) { reasons.set(left.candidate.candidateId, REASON.ADVANTAGE); return -1; }
      if (hasMaterialAdvantage(right.historical, left.historical)) { reasons.set(right.candidate.candidateId, REASON.ADVANTAGE); return 1; }
      return left.index - right.index;
    });
    // Do not allow a group to move across another primary candidate: only the
    // original contiguous group can be reordered.
    const positions = group.map((row) => row.index).sort((a, b) => a - b);
    if (positions.every((position, index) => position === positions[0] + index)) {
      ordered.forEach((row, index) => rankById.set(row.candidate.candidateId, positions[index]));
    } else {
      group.forEach((row) => reasons.set(row.candidate.candidateId, REASON.NOT_EQUIVALENT));
    }
  }
  const ordered = [...rows].sort((left, right) => rankById.get(left.candidate.candidateId) - rankById.get(right.candidate.candidateId) || left.index - right.index);
  const applied = ordered.some((row, index) => row.index !== index);
  return freeze({ orderedCandidateIds: freeze(ordered.map((row) => row.candidate.candidateId)), applied, audit: freeze(rows.map((row) => freeze({ candidateId: row.candidate.candidateId, originalPrimaryRank: row.index, finalPersonalizedRank: rankById.get(row.candidate.candidateId), rankingGroup: row.candidate.personalizationGroup || null, reasonCode: reasons.get(row.candidate.candidateId) })) ) });
}

module.exports = { REASON, rankPersonalisedTiming, hasMaterialAdvantage };
