'use strict';

const COPY = Object.freeze({
  currentPhase: Object.freeze({
    SUPPORTED: Object.freeze({ english: 'Career-related Dasha evidence is active in the current period.', hinglish: 'Current Dasha mein Career-related evidence active hai.' }),
    MIXED: Object.freeze({ english: 'Career-related Dasha evidence is mixed in the current period.', hinglish: 'Current Dasha mein Career-related evidence mixed hai.' }),
    CONTRADICTED: Object.freeze({ english: 'Current Career-related Dasha evidence is not consistently supported.', hinglish: 'Current Career-related Dasha evidence consistently supported nahi hai.' }),
    INSUFFICIENT_EVIDENCE: Object.freeze({ english: 'There is not enough Career-related Dasha evidence to show a current-phase summary.', hinglish: 'Current-phase summary ke liye Career-related Dasha evidence kaafi nahi hai.' }),
  }),
  careerRelevance: Object.freeze({ english: 'This Dasha period contributes to your current Career timing analysis.', hinglish: 'Yeh Dasha period aapki current Career timing analysis ka hissa hai.' }),
  classical: Object.freeze({ english: 'An audited classical Career rule is active in the current Dasha sequence.', hinglish: 'Current Dasha sequence mein ek audited classical Career rule active hai.' }),
  classicalCaution: Object.freeze({ english: 'This is classical rule evidence, not a guaranteed Career outcome.', hinglish: 'Yeh classical rule evidence hai, guaranteed Career outcome nahi.' }),
});

function copyForCurrentPhase(status) { return COPY.currentPhase[status] || null; }
module.exports = { COPY, copyForCurrentPhase };
