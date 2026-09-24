'use strict';

// Phase 2E owner-approved D10 evidence contract. This module is deliberately
// not connected to reading generation, eligibility, or temporal projection.
const { freeze } = require('../../synthesis/evidence-node');

const CAREER_D10_CONFIRMATION_CONTRACT_ID = 'taraverse-career-d10-confirmation-v1';
const D10_CONFIRMED_RULES = freeze(['D10_CONFIRM_PROPOSED_002', 'D10_CONFIRM_PROPOSED_003', 'D10_CONFIRM_PROPOSED_004']);

// These are structural cross-chart themes, not profession labels or outcome
// claims. A D1 caller must independently establish one before D10 corroborates it.
const D10_THEME_REGISTRY_VERSION = 'd10-structural-theme-registry-v1';
const D10_THEME_REGISTRY = freeze({
  PROFESSIONAL_PROFILE: freeze({ d1Input: 'D1_LAGNA_PROFILE', d10Evidence: 'D10_LAGNA', source: 'D10-Career-Masterclass-Transcript.txt:00:11:17.600-00:12:00.640' }),
  PROFESSIONAL_EXECUTION: freeze({ d1Input: 'D1_H10_EXECUTION', d10Evidence: 'D10_H10', source: 'D10-Career-Masterclass-Transcript.txt:00:29:42.640-00:30:32.240' }),
  TENTH_LORD_REFINEMENT: freeze({ d1Input: 'D1_H10_LORD_REFINEMENT', d10Evidence: 'D10_H10_LORD', source: 'D10-Career-Masterclass-Transcript.txt:00:30:20.799-00:30:32.240' }),
});
const THEME_IDS = new Set(Object.keys(D10_THEME_REGISTRY));

// The transcript gives explicit own-sign, exalted, and debilitated examples.
// Combustion, retrograde, friendship/enmity, and numeric strengths stay out.
const D10_DIGNITY_ALLOWLIST = freeze(['OWN_SIGN', 'EXALTED', 'DEBILITATED']);
const DIGNITY_IDS = new Set(D10_DIGNITY_ALLOWLIST);
const PLANETS = new Set(['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu']);
const SOURCE_FILE = 'docs/sources/career/d10/D10-Career-Masterclass-Transcript.txt';
const SOURCE_REFS = freeze({
  methodology: freeze({ file: SOURCE_FILE, from: '00:10:12.640', to: '00:10:20.720', paraphrase: 'D1 and D10 are both inspected for Career analysis.' }),
  profile: freeze({ file: SOURCE_FILE, from: '00:11:17.600', to: '00:12:00.640', paraphrase: 'D10 first house/Lagna is inspected as Career-profile context.' }),
  framework: freeze({ file: SOURCE_FILE, from: '00:13:30.720', to: '00:14:24.399', paraphrase: 'The same structural house and aspect framework is discussed for D1 and D10.' }),
  repetition: freeze({ file: SOURCE_FILE, from: '00:30:20.799', to: '00:30:32.240', paraphrase: 'A repeated D1 and D10 theme is described as confirmation in the case study.' }),
  tenthHouse: freeze({ file: SOURCE_FILE, from: '00:36:44.320', to: '00:37:00.000', paraphrase: 'The D10 tenth house and its lord placement are inspected.' }),
  dignity: freeze({ file: SOURCE_FILE, from: '00:25:15.039', to: '00:25:30.880', paraphrase: 'A D10 placement example explicitly distinguishes a debilitated planet.' }),
});

const list = (value) => Array.isArray(value) ? value : [];
const validStructure = (value) => value && typeof value === 'object' && value.chart === 'D10' ? value : null;
const fact = (value, required) => value && typeof value === 'object' && required.every((key) => value[key] !== undefined) ? value : null;
const uniqueSorted = (values) => [...new Set(values)].sort();

function d10Themes(structure) {
  const themes = [];
  if (fact(structure.lagna, ['house', 'sign'])) themes.push('PROFESSIONAL_PROFILE');
  if (fact(structure.tenthHouse, ['house', 'sign'])) themes.push('PROFESSIONAL_EXECUTION');
  if (fact(structure.tenthHouse, ['lord', 'lordHouse'])) themes.push('TENTH_LORD_REFINEMENT');
  return uniqueSorted(themes);
}

function normalizeDignity(value, relevantPlanets) {
  return list(value).filter((item) => item && PLANETS.has(item.planet) && DIGNITY_IDS.has(item.state))
    .filter((item) => relevantPlanets.has(item.planet)).map((item) => freeze({ planet: item.planet, state: item.state }))
    .sort((left, right) => `${left.planet}|${left.state}`.localeCompare(`${right.planet}|${right.state}`));
}

// D1 themes/relevance are supplied from independently approved D1 rules. This
// contract never derives D1 relevance, eligibility, timing, or a projection.
function evaluateCareerD10Confirmation({ d1CareerRelevant = false, d1Themes = [], careerD10Structure = null, relevantD10Planets = [], d10Dignity = [] } = {}) {
  const structure = validStructure(careerD10Structure);
  const profileEvidence = structure && fact(structure.lagna, ['house', 'sign']) ? freeze({ ruleId: 'D10_CONFIRM_PROPOSED_004', lagna: structure.lagna, source: SOURCE_REFS.profile }) : null;
  const executionEvidence = structure && fact(structure.tenthHouse, ['house', 'sign']) ? freeze({ ruleId: 'D10_CONFIRM_PROPOSED_002', tenthHouse: structure.tenthHouse, source: SOURCE_REFS.tenthHouse }) : null;
  const tenthLordEvidence = structure && fact(structure.tenthHouse, ['lord', 'lordHouse']) ? freeze({ ruleId: 'D10_CONFIRM_PROPOSED_003', lord: structure.tenthHouse.lord, house: structure.tenthHouse.lordHouse, source: SOURCE_REFS.tenthHouse }) : null;
  const suppliedD1Themes = uniqueSorted(list(d1Themes).filter((theme) => THEME_IDS.has(theme)));
  const themes = structure ? d10Themes(structure) : [];
  const sharedThemesWithD1 = d1CareerRelevant === true ? themes.filter((theme) => suppliedD1Themes.includes(theme)) : [];
  const relevantPlanetDignity = normalizeDignity(d10Dignity, new Set(list(relevantD10Planets).filter((planet) => PLANETS.has(planet))));
  const matchedRuleIds = uniqueSorted([...(executionEvidence ? ['D10_CONFIRM_PROPOSED_002'] : []), ...(tenthLordEvidence ? ['D10_CONFIRM_PROPOSED_003'] : []), ...(profileEvidence ? ['D10_CONFIRM_PROPOSED_004'] : []), ...(sharedThemesWithD1.length ? ['D10_CONFIRM_PROPOSED_001'] : []), ...(relevantPlanetDignity.length ? ['D10_CONFIRM_PROPOSED_005'] : [])]);
  return freeze({
    contractId: CAREER_D10_CONFIRMATION_CONTRACT_ID, profileEvidence, executionEvidence, tenthLordEvidence, relevantPlanetDignity,
    themes: freeze(themes), sharedThemesWithD1: freeze(sharedThemesWithD1), confirmationPresent: sharedThemesWithD1.length > 0,
    refinementNotes: freeze(relevantPlanetDignity.map((item) => freeze({ planet: item.planet, state: item.state, role: 'ALREADY_RELEVANT_FACTOR_ONLY' }))),
    matchedRuleIds: freeze(matchedRuleIds), evidenceRefs: freeze(Object.values(SOURCE_REFS)),
    limitations: freeze(['D1_ESTABLISHES_CAREER_RELEVANCE', 'D10_CANNOT_CREATE_CAREER_ELIGIBILITY', 'D10_CANNOT_CREATE_TIMING', 'D10_CANNOT_CREATE_FUTURE_WINDOW', 'D10_CANNOT_CHANGE_PROJECTION_GATE', 'D10_ABSENCE_IS_NOT_A_HARD_FALSE_GATE']),
    eligibilityCreated: false, timingCreated: false, futureWindowCreated: false, projectionGateChanged: false,
  });
}

module.exports = { CAREER_D10_CONFIRMATION_CONTRACT_ID, D10_CONFIRMED_RULES, D10_THEME_REGISTRY_VERSION, D10_THEME_REGISTRY, D10_DIGNITY_ALLOWLIST, SOURCE_REFS, evaluateCareerD10Confirmation };
