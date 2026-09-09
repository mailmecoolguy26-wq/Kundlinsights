'use strict';

// Research-only external-source audit. This module is intentionally isolated
// from production code: it neither calculates charts nor changes any Career
// interpretation or projection behaviour.
const fs = require('node:fs');
const path = require('node:path');

const ACCESS_DATE = '2026-09-09';

const BIBLIOGRAPHY = Object.freeze([
  Object.freeze({
    sourceId: 'phaladeepika-kapoor-ch26',
    title: "Mantreswara's Phala Deepika",
    author: 'Mantreswara',
    translatorOrCommentator: 'Dr. G. S. Kapoor',
    editionOrPublisher: 'Not stated in the consulted electronic transcript',
    url: 'https://studyres.com/doc/5566615/mantreswara-s-phala-deepika-english-translation--commenta...',
    accessedOn: ACCESS_DATE,
    sourceQuality: 'PRIMARY_TEXT_TRANSLATION',
    scope: 'Chapter 26, Gochar / transit effects; verses 1–2, 9–24, and 33; plus Chapter 16 verse 35 for the rejected general conjunction rule.',
    caveat: 'Only one accessible English electronic transcript was verified in this audit; rule wording requires a translator/edition review before implementation.',
  }),
  Object.freeze({
    sourceId: 'bphs-unknown-translator-natal-h10',
    title: 'Brihat Parashara Hora Shastra',
    author: 'Parashara',
    translatorOrCommentator: 'Not reliably identified in the consulted PDF',
    editionOrPublisher: 'Not stated in the consulted PDF',
    url: 'https://vedic-astro.s3.amazonaws.com/books/bhrihat_parasara_hora_shastra.pdf',
    accessedOn: ACCESS_DATE,
    sourceQuality: 'WEAK / REJECT',
    scope: 'Natal tenth-house material consulted only to avoid conflating natal Career rules with Gochar.',
    caveat: 'This source did not supply a verified Career-specific Gochar candidate for this audit.',
  }),
]);

// Every candidate records source wording in compact normalized form.  The
// fields are a research contract, not a rulebook or an implementation plan.
const CANDIDATES = Object.freeze([
  Object.freeze({
    candidateRuleId: 'phaladeepika-ch26-sun-h10-from-moon-undertaking-v1',
    sourceId: 'phaladeepika-kapoor-ch26',
    sourceTitle: "Mantreswara's Phala Deepika",
    sourceAuthor: 'Mantreswara',
    chapterOrSection: 'Chapter 26 — Effects of transits',
    verseOrReference: 'Verse 11',
    translationUsed: 'Dr. G. S. Kapoor English translation/commentary transcript',
    ruleContext: 'TRANSIT / GOCHAR',
    transitPlanetScope: { scope: 'EXPLICIT_SINGLE', planets: ['SUN'] },
    natalTarget: { scope: 'EXPLICIT_OTHER', factor: 'TENTH_HOUSE_FROM_NATAL_MOON' },
    relationType: { scope: 'OCCUPANCY', value: 'transit through the tenth from natal Moon' },
    stateCondition: 'Sun occupies the tenth house counted from natal Moon.',
    temporalSemantics: 'STATE_INTERVAL',
    statedOutcome: 'Success in a great and important undertaking.',
    outcomeStatus: 'INTERPRETIVE_TRANSLATION',
    exactDependencyStatus: 'EXPLICIT_DEPENDENCIES',
    implementationInputsRequired: ['natal Moon sign/house', 'Sun transit sign', 'house-from-natal-Moon state interval'],
    currentEngineInputReadiness: 'PARTIALLY_READY',
    scannerSupport: 'PARTIALLY_READY: ingress facts exist, but no audited Moon-relative-house interval adapter exists.',
    intervalCapable: true,
    classification: 'NEEDS_TRANSLATION_REVIEW',
    rejectionOrReviewReason: 'The target and transit state are explicit, but “undertaking” is not an unambiguous Career outcome and this audit verified only one translation transcript.',
  }),
  Object.freeze({
    candidateRuleId: 'phaladeepika-ch26-jupiter-h10-from-moon-position-v1',
    sourceId: 'phaladeepika-kapoor-ch26',
    sourceTitle: "Mantreswara's Phala Deepika",
    sourceAuthor: 'Mantreswara',
    chapterOrSection: 'Chapter 26 — Effects of transits',
    verseOrReference: 'Verse 20',
    translationUsed: 'Dr. G. S. Kapoor English translation/commentary transcript',
    ruleContext: 'TRANSIT / GOCHAR',
    transitPlanetScope: { scope: 'EXPLICIT_SINGLE', planets: ['JUPITER'] },
    natalTarget: { scope: 'EXPLICIT_OTHER', factor: 'TENTH_HOUSE_FROM_NATAL_MOON' },
    relationType: { scope: 'OCCUPANCY', value: 'transit through the tenth from natal Moon' },
    stateCondition: 'Jupiter occupies the tenth house counted from natal Moon.',
    temporalSemantics: 'STATE_INTERVAL',
    statedOutcome: 'Danger to property, position and children.',
    outcomeStatus: 'EXPLICIT_CLASSICAL',
    exactDependencyStatus: 'EXPLICIT_DEPENDENCIES',
    implementationInputsRequired: ['natal Moon sign/house', 'Jupiter transit sign', 'house-from-natal-Moon state interval'],
    currentEngineInputReadiness: 'PARTIALLY_READY',
    scannerSupport: 'PARTIALLY_READY: ingress facts exist, but no audited Moon-relative-house interval adapter exists.',
    intervalCapable: true,
    classification: 'NEEDS_TRANSLATION_REVIEW',
    rejectionOrReviewReason: '“Position” is explicit but bundled with non-Career outcomes; independent translation and product-language review are required.',
  }),
  Object.freeze({
    candidateRuleId: 'phaladeepika-ch26-saturn-h10-from-moon-honour-v1',
    sourceId: 'phaladeepika-kapoor-ch26',
    sourceTitle: "Mantreswara's Phala Deepika",
    sourceAuthor: 'Mantreswara',
    chapterOrSection: 'Chapter 26 — Effects of transits',
    verseOrReference: 'Verse 23',
    translationUsed: 'Dr. G. S. Kapoor English translation/commentary transcript',
    ruleContext: 'TRANSIT / GOCHAR',
    transitPlanetScope: { scope: 'EXPLICIT_SINGLE', planets: ['SATURN'] },
    natalTarget: { scope: 'EXPLICIT_OTHER', factor: 'TENTH_HOUSE_FROM_NATAL_MOON' },
    relationType: { scope: 'OCCUPANCY', value: 'transit through the tenth from natal Moon' },
    stateCondition: 'Saturn occupies the tenth house counted from natal Moon.',
    temporalSemantics: 'STATE_INTERVAL',
    statedOutcome: 'Indulgence in sinful actions, loss of honour and suffering from diseases.',
    outcomeStatus: 'EXPLICIT_CLASSICAL',
    exactDependencyStatus: 'EXPLICIT_DEPENDENCIES',
    implementationInputsRequired: ['natal Moon sign/house', 'Saturn transit sign', 'house-from-natal-Moon state interval'],
    currentEngineInputReadiness: 'PARTIALLY_READY',
    scannerSupport: 'PARTIALLY_READY: ingress facts exist, but no audited Moon-relative-house interval adapter exists.',
    intervalCapable: true,
    classification: 'NEEDS_TRANSLATION_REVIEW',
    rejectionOrReviewReason: '“Loss of honour” may be status-relevant but is not unambiguously professional; a second translation is required.',
  }),
  Object.freeze({
    candidateRuleId: 'phaladeepika-ch26-saturn-h3-from-moon-employment-v1',
    sourceId: 'phaladeepika-kapoor-ch26',
    sourceTitle: "Mantreswara's Phala Deepika",
    sourceAuthor: 'Mantreswara',
    chapterOrSection: 'Chapter 26 — Effects of transits',
    verseOrReference: 'Verse 23',
    translationUsed: 'Dr. G. S. Kapoor English translation/commentary transcript',
    ruleContext: 'TRANSIT / GOCHAR',
    transitPlanetScope: { scope: 'EXPLICIT_SINGLE', planets: ['SATURN'] },
    natalTarget: { scope: 'EXPLICIT_OTHER', factor: 'THIRD_HOUSE_FROM_NATAL_MOON' },
    relationType: { scope: 'OCCUPANCY', value: 'transit through the third from natal Moon' },
    stateCondition: 'Saturn occupies the third house counted from natal Moon.',
    temporalSemantics: 'STATE_INTERVAL',
    statedOutcome: 'Gain of position or employment.',
    outcomeStatus: 'EXPLICIT_CLASSICAL',
    exactDependencyStatus: 'EXPLICIT_DEPENDENCIES',
    implementationInputsRequired: ['natal Moon sign/house', 'Saturn transit sign', 'house-from-natal-Moon state interval'],
    currentEngineInputReadiness: 'PARTIALLY_READY',
    scannerSupport: 'PARTIALLY_READY: ingress facts exist, but no audited Moon-relative-house interval adapter exists.',
    intervalCapable: true,
    classification: 'NEEDS_TRANSLATION_REVIEW',
    rejectionOrReviewReason: 'The employment language is strong, but a second established translation and policy review are required before a rule can be adopted.',
  }),
  Object.freeze({
    candidateRuleId: 'phaladeepika-ch26-sun-mars-jupiter-saturn-h10-moon-position-v1',
    sourceId: 'phaladeepika-kapoor-ch26',
    sourceTitle: "Mantreswara's Phala Deepika",
    sourceAuthor: 'Mantreswara',
    chapterOrSection: 'Chapter 26 — Effects of transits',
    verseOrReference: 'Verse 33',
    translationUsed: 'Dr. G. S. Kapoor English translation/commentary transcript',
    ruleContext: 'TRANSIT / GOCHAR',
    transitPlanetScope: { scope: 'EXPLICIT_SET', planets: ['SUN', 'MARS', 'JUPITER', 'SATURN'] },
    natalTarget: { scope: 'EXPLICIT_OTHER', factor: 'TENTH_HOUSE_FROM_NATAL_MOON' },
    relationType: { scope: 'OCCUPANCY', value: 'transit through the tenth from natal Moon' },
    stateCondition: 'Any listed planet occupies the tenth house counted from natal Moon.',
    temporalSemantics: 'STATE_INTERVAL',
    statedOutcome: 'Danger to life, fall from position and loss of wealth.',
    outcomeStatus: 'EXPLICIT_CLASSICAL',
    exactDependencyStatus: 'EXPLICIT_DEPENDENCIES',
    implementationInputsRequired: ['natal Moon sign/house', 'listed-planet transit sign', 'house-from-natal-Moon state interval'],
    currentEngineInputReadiness: 'PARTIALLY_READY',
    scannerSupport: 'PARTIALLY_READY: ingress facts exist, but no audited Moon-relative-house interval adapter exists.',
    intervalCapable: true,
    classification: 'NEEDS_TRANSLATION_REVIEW',
    rejectionOrReviewReason: 'The explicit status wording is bundled with high-stakes non-Career outcomes and overlaps individual rules; a review must define whether it is productizable at all.',
  }),
  Object.freeze({
    candidateRuleId: 'phaladeepika-general-house-lord-transit-conjunction-v1',
    sourceId: 'phaladeepika-kapoor-ch26',
    sourceTitle: "Mantreswara's Phala Deepika",
    sourceAuthor: 'Mantreswara',
    chapterOrSection: 'Chapter 16 — General transit principle',
    verseOrReference: 'Verse 35',
    translationUsed: 'Dr. G. S. Kapoor English translation/commentary transcript',
    ruleContext: 'TRANSIT / GOCHAR',
    transitPlanetScope: { scope: 'UNSPECIFIED', planets: [] },
    natalTarget: { scope: 'UNSPECIFIED', factor: 'house under examination' },
    relationType: { scope: 'CONJUNCTION', value: 'Lagna lord conjoined with a house lord in transit, with the house lord strong' },
    stateCondition: 'The stated conjunction and strength condition hold.',
    temporalSemantics: 'STATE_INTERVAL',
    statedOutcome: 'Success of the house under examination.',
    outcomeStatus: 'AMBIGUOUS',
    exactDependencyStatus: 'INCOMPLETE_DEPENDENCIES',
    implementationInputsRequired: ['Lagna lord', 'chosen house lord', 'transit conjunction', 'source-defined strength condition'],
    currentEngineInputReadiness: 'NOT_READY',
    scannerSupport: 'NOT_READY: no source-audited strength predicate and a Career/H10 specialization would be an extrapolation.',
    intervalCapable: true,
    classification: 'NEEDS_MORE_SOURCE_SUPPORT',
    rejectionOrReviewReason: 'It is a general house-success rule, not a Career-specific rule; specializing it to H10 would violate the audit scope.',
  }),
  Object.freeze({
    candidateRuleId: 'bphs-natal-h10-rule-not-gochar-v1',
    sourceId: 'bphs-unknown-translator-natal-h10',
    sourceTitle: 'Brihat Parashara Hora Shastra',
    sourceAuthor: 'Parashara',
    chapterOrSection: 'Natal tenth-house material',
    verseOrReference: 'Consulted PDF; translation/edition metadata unavailable',
    translationUsed: 'Unverified PDF translation',
    ruleContext: 'NATAL',
    transitPlanetScope: { scope: 'UNSPECIFIED', planets: [] },
    natalTarget: { scope: 'EXPLICIT_H10', factor: 'TENTH_HOUSE' },
    relationType: { scope: 'UNSPECIFIED', value: null },
    stateCondition: 'Natal placement condition, not a transit condition.',
    temporalSemantics: 'UNSPECIFIED',
    statedOutcome: 'Natal professional significations.',
    outcomeStatus: 'UNSAFE_TO_PRODUCTIZE',
    exactDependencyStatus: 'NOT_A_TRANSIT_RULE',
    implementationInputsRequired: [],
    currentEngineInputReadiness: 'NOT_APPLICABLE',
    scannerSupport: 'NOT_APPLICABLE',
    intervalCapable: false,
    classification: 'REJECT',
    rejectionOrReviewReason: 'Natal material must not be treated as a Gochar predicate.',
  }),
]);

const REQUIRED_CANDIDATE_FIELDS = Object.freeze([
  'candidateRuleId', 'sourceId', 'sourceTitle', 'sourceAuthor', 'chapterOrSection',
  'verseOrReference', 'translationUsed', 'ruleContext', 'transitPlanetScope',
  'natalTarget', 'relationType', 'stateCondition', 'temporalSemantics',
  'statedOutcome', 'outcomeStatus', 'exactDependencyStatus',
  'implementationInputsRequired', 'classification',
]);

function validateArtifact(value) {
  if (!value || !Array.isArray(value.bibliography) || !Array.isArray(value.candidateRules)) {
    throw new TypeError('External Career Gochar audit has an invalid root schema.');
  }
  const sourceIds = value.bibliography.map((source) => source.sourceId);
  if (new Set(sourceIds).size !== sourceIds.length) throw new Error('External Career Gochar audit has duplicate source IDs.');
  for (const candidate of value.candidateRules) {
    for (const field of REQUIRED_CANDIDATE_FIELDS) {
      if (candidate[field] === undefined || candidate[field] === null) throw new Error(`Candidate ${candidate.candidateRuleId || '<unknown>'} lacks ${field}.`);
    }
    if (!sourceIds.includes(candidate.sourceId)) throw new Error(`Candidate ${candidate.candidateRuleId} references an unknown source.`);
  }
  return true;
}

function idsFor(classification) {
  return CANDIDATES.filter((candidate) => candidate.classification === classification).map((candidate) => candidate.candidateRuleId);
}

function artifact() {
  const value = {
    auditVersion: 'external-career-gochar-source-audit-v1',
    researchOnly: true,
    productionChanges: false,
    bibliography: BIBLIOGRAPHY,
    candidateRules: CANDIDATES,
    classifications: {
      readyForReview: idsFor('READY_FOR_REVIEW'),
      needsTranslationReview: idsFor('NEEDS_TRANSLATION_REVIEW'),
      needsMoreSourceSupport: idsFor('NEEDS_MORE_SOURCE_SUPPORT'),
      rejected: idsFor('REJECT'),
    },
    dashaTransitCombinedRules: [],
    projectionFilteringValue: {
      readyForReview: [],
      rationale: 'No candidate clears the source, target, translation, and current-engine-input minimum bar; future projection filtering remains disabled.',
    },
    phase5FMinimumBar: {
      met: false,
      missing: ['second established translation or authoritative edition review', 'unambiguous Career-only outcome wording', 'audited Moon-relative-house interval adapter'],
    },
    decision: 'MORE_RESEARCH_REQUIRED',
    rationale: 'Several Chapter 26 transit conditions are precise enough for human review, but none is safe to turn into a Career projection dependency yet.',
  };
  validateArtifact(value);
  return value;
}

function run({ outputPath = path.join(process.cwd(), 'tmp', 'external-career-gochar-source-audit.json') } = {}) {
  const result = artifact();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  return { outputPath, result };
}

if (require.main === module) console.log(JSON.stringify(run(), null, 2));

module.exports = { BIBLIOGRAPHY, CANDIDATES, REQUIRED_CANDIDATE_FIELDS, validateArtifact, artifact, run };
