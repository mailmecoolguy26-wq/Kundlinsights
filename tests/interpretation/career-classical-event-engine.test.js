'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CAREER_CLASSICAL_EVENT_RULES,
  CAREER_PRODUCTION_RULES,
  createInterpretiveRuleRegistry,
  buildCareerClassicalEventConclusions
} = require('../../src/interpretation');

const START = '2024-01-01T00:00:00.000Z';
const END = '2025-01-01T00:00:00.000Z';
const INSTANT = '2024-06-01T00:00:00.000Z';

function deepFreeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(deepFreeze); } return value; }
function fixture({ branch = 'CAREER_STATUS_SATURN_NATAL_HOUSE', branchNumber = 8, mdLord = 'Venus', adLord = 'Saturn', includeMd = true, includeAd = true, includeNatal = true, missingNatal = false, missingDasha = false, instant = INSTANT, pd = null, gochar = false, duplicateNatal = false, contradiction = false, reverse = false } = {}) {
  const natal = includeNatal ? [{ id: 'n:Saturn', relationType: branch, fact: branch === 'CAREER_STATUS_SATURN_NATAL_HOUSE' ? { natalHouseNumber: branchNumber } : { relativeHouse: branchNumber }, provenance: { sourcePredicate: { sourcePredicateId: 'bphs-venus-saturn-professional-loss-natal-v1', section: 'Chapter 60, Venus Dasha / Saturn Antardasha, verses 55–57' } } }] : [];
  if (duplicateNatal && natal.length) natal.push({ ...natal[0] });
  const nodes = [];
  if (includeMd) nodes.push({ id: 'd:md', sourceLayer: '4', fact: { dashaLevel: 'mahadasha', lord: mdLord, startInstant: { utc: START }, endInstant: { utc: END } } });
  if (includeAd) nodes.push({ id: 'd:ad', sourceLayer: '4', fact: { dashaLevel: 'antardasha', lord: adLord, startInstant: { utc: START }, endInstant: { utc: END } } });
  if (pd) nodes.push({ id: 'd:pd', sourceLayer: '4', fact: { dashaLevel: 'pratyantardasha', lord: pd, startInstant: { utc: START }, endInstant: { utc: END } } });
  if (gochar) nodes.push({ id: 'g:Saturn', sourceLayer: '9', fact: {} });
  const relations = nodes.filter((node) => node.sourceLayer === '4').map((node) => ({ id: `r:${node.id}`, relationType: 'TEMPORALLY_ACTIVATES', fact: { mechanism: 'active-vimshottari-period' }, inputNodeIds: [node.id, 'n:Saturn'] }));
  const ids = [...new Set([...natal.map((item) => item.id), ...nodes.filter((item) => item.sourceLayer === '4').map((item) => item.id), ...relations.map((item) => item.id)])];
  const ordered = reverse ? [...ids].reverse() : ids;
  return {
    domainGraph: { domain: 'CAREER', derivedRelations: natal, missingData: missingNatal ? [{ id: 'm:Saturn', dataKey: 'Saturn.natalPlacement' }] : [] },
    temporalGraph: { instant, nodes: reverse ? [...nodes].reverse() : nodes, relations: reverse ? [...relations].reverse() : relations, missingData: missingDasha ? [{ id: 'm:dasha', fact: { dataKey: 'dasha' } }] : [] },
    analysis: {
      analysisId: 'analysis:career-classical-event',
      nodeAnalysis: ordered.map((id) => ({ nodeId: id, rootSourceIds: [`root:${id}`], sourceStrengths: ['CLASSICAL_TRANSLATION'] })),
      evidenceFamilies: [{ familyId: 'family:predicate', memberNodeIds: ids }],
      contradictionGroups: contradiction ? [{ contradictionGroupId: 'contradiction:selected', memberNodeIds: ['n:Saturn', 'd:ad'] }] : [],
      missingData: []
    }
  };
}
function output(options) { return buildCareerClassicalEventConclusions(fixture(options))[0]; }

test('allowlists exactly the authorized classical production rule and rejects arbitrary production rules', () => {
  const registry = createInterpretiveRuleRegistry({ rules: CAREER_PRODUCTION_RULES });
  assert.ok(registry.productionRules.includes('career-venus-md-saturn-ad-professional-loss-predicate-v1'));
  assert.equal(CAREER_CLASSICAL_EVENT_RULES.length, 1);
  assert.throws(() => createInterpretiveRuleRegistry({ rules: [{ ...CAREER_CLASSICAL_EVENT_RULES[0], id: 'career-arbitrary-event-v1' }] }), /allowlisted/);
});

for (const house of [8, 11, 12]) test(`supports Saturn natal H${house} with Venus MD and Saturn AD`, () => {
  const result = output({ branch: 'CAREER_STATUS_SATURN_NATAL_HOUSE', branchNumber: house });
  assert.equal(result.conclusionStatus, 'SUPPORTED'); assert.deepEqual(result.provenance.natalBranchesPresent, ['CAREER_STATUS_SATURN_NATAL_HOUSE']);
});
for (const house of [8, 11, 12]) test(`supports Saturn ${house}th-from-Venus with Venus MD and Saturn AD`, () => {
  const result = output({ branch: 'CAREER_STATUS_SATURN_FROM_VENUS', branchNumber: house });
  assert.equal(result.conclusionStatus, 'SUPPORTED'); assert.deepEqual(result.provenance.natalBranchesPresent, ['CAREER_STATUS_SATURN_FROM_VENUS']);
});

test('deduplicates both natal branches and duplicate evidence into one logical conclusion', () => {
  const value = fixture({ duplicateNatal: true });
  value.domainGraph.derivedRelations.push({ id: 'n:from-venus', relationType: 'CAREER_STATUS_SATURN_FROM_VENUS' });
  value.analysis.nodeAnalysis.push({ nodeId: 'n:from-venus', rootSourceIds: ['root:n:from-venus'], sourceStrengths: ['CLASSICAL_TRANSLATION'] });
  const results = buildCareerClassicalEventConclusions(value);
  assert.equal(results.length, 1); assert.equal(results[0].conclusionStatus, 'SUPPORTED');
  assert.deepEqual(results[0].provenance.natalBranchesPresent, ['CAREER_STATUS_SATURN_FROM_VENUS', 'CAREER_STATUS_SATURN_NATAL_HOUSE']);
});

test('uses NOT_APPLICABLE for complete nonmatching MD/AD evidence and never accepts PD as AD', () => {
  assert.equal(output({ adLord: 'Mercury' }).conclusionStatus, 'NOT_APPLICABLE');
  assert.equal(output({ mdLord: 'Mercury' }).conclusionStatus, 'NOT_APPLICABLE');
  assert.equal(output({ includeAd: false, pd: 'Saturn' }).conclusionStatus, 'INSUFFICIENT_EVIDENCE');
});

test('keeps absence neutral, detects contradictions, and follows half-open AD timing', () => {
  assert.equal(output({ includeNatal: false, missingNatal: true }).conclusionStatus, 'INSUFFICIENT_EVIDENCE');
  assert.equal(output({ includeNatal: false }).conclusionStatus, 'NOT_APPLICABLE');
  assert.equal(output({ missingDasha: true }).conclusionStatus, 'INSUFFICIENT_EVIDENCE');
  assert.equal(output({ contradiction: true }).conclusionStatus, 'CONTRADICTED');
  assert.equal(output({ instant: START }).conclusionStatus, 'SUPPORTED');
  assert.equal(output({ instant: END }).conclusionStatus, 'NOT_APPLICABLE');
});

test('preserves optional PD only as traceability context and never requires Gochar', () => {
  const without = output(); const withPd = output({ pd: 'Mars' }); const withGochar = output({ gochar: true });
  assert.equal(withPd.conclusionStatus, without.conclusionStatus); assert.equal(withGochar.conclusionStatus, without.conclusionStatus);
  assert.equal(withPd.temporalContext.pratyantardashaContext[0].lord, 'Mars'); assert.equal(withGochar.temporalContext.gocharSnapshotInstant, null);
  assert.deepEqual(withGochar.evidenceIds, without.evidenceIds);
});

test('is deterministic, frozen-input safe, deeply immutable, and has complete non-predictive traceability', () => {
  const source = deepFreeze(fixture({ pd: 'Mars' })); const before = JSON.stringify(source);
  const left = buildCareerClassicalEventConclusions(source); const right = buildCareerClassicalEventConclusions(fixture({ pd: 'Mars', reverse: true }));
  assert.deepEqual(left, right); assert.equal(Object.isFrozen(left), true); assert.equal(Object.isFrozen(left[0]), true); assert.equal(JSON.stringify(source), before);
  const text = JSON.stringify(left[0]);
  for (const forbidden of ['score', 'weight', 'probability', 'confidence', 'guaranteed', 'predictedOutcome', 'sameRashi', 'conjunction']) assert.equal(text.includes(`"${forbidden}"`), false, forbidden);
  assert.equal(left[0].provenance.sourcePredicateId, 'bphs-venus-saturn-professional-loss-natal-v1');
  assert.equal(left[0].provenance.layer5cYuti, 'not-consumed');
  assert.ok(left[0].rootSourceIds.length > 0); assert.ok(left[0].evidenceFamilyIds.length > 0);
});

test('does not register or evaluate the deferred H10 honour rule', () => {
  assert.throws(() => createInterpretiveRuleRegistry({ rules: [{ ...CAREER_CLASSICAL_EVENT_RULES[0], id: 'career-h10-honour-predicate-v1' }] }), /allowlisted/);
  const text = JSON.stringify(output()); assert.equal(text.includes('bphs-h10-honour-natal-v1'), false);
});
