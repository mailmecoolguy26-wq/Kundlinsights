'use strict';
const { freeze } = require('../synthesis/evidence-node');
const { buildCareerEvidence, buildTemporalEvidence, analyzeEvidenceIndependence } = require('../synthesis');
const { buildNatalCareerConclusions, buildCareerDashaConclusions, buildCareerGocharConclusions, buildCareerTemporalCoactivationConclusions, buildCareerClassicalEventConclusions } = require('../interpretation');
const { buildReading } = require('../reading'); const { renderReading } = require('../rendering');
const { CAREER_ORCHESTRATOR_RULESET_ID, SUPPORTED_DOMAIN, SUPPORTED_LOCALE } = require('./reference-data');
function buildCareerReading({ natal, temporal, locale = SUPPORTED_LOCALE } = {}) {
  if (!natal || !Array.isArray(natal.nodes) || !natal.provenance || natal.provenance.layer !== '12A') throw new TypeError('natal must be a completed Layer 12A natal graph.');
  if (!temporal || typeof temporal !== 'object' || Array.isArray(temporal) || typeof temporal.instant !== 'string') throw new TypeError('temporal must supply a Layer 12C-compatible instant and optional supplied evidence.');
  const domainGraph = buildCareerEvidence({ natalGraph: natal });
  const temporalGraph = buildTemporalEvidence({ natalGraph: natal, domainGraph, instant: temporal.instant, dasha: temporal.dasha, gochar: temporal.gochar, transitEvents: temporal.transitEvents });
  if (temporalGraph.natalGraphId !== natal.graphId || domainGraph.sourceGraphId !== natal.graphId) throw new RangeError('Career orchestration received mismatched natal evidence identity.');
  const analysis = analyzeEvidenceIndependence({ natalGraph: natal, domainGraph, temporalGraph });
  const natalConclusions = buildNatalCareerConclusions({ domainGraph, analysis });
  const dashaConclusions = buildCareerDashaConclusions({ domainGraph, temporalGraph, analysis });
  const gocharConclusions = buildCareerGocharConclusions({ domainGraph, temporalGraph, analysis });
  const coactivationConclusions = buildCareerTemporalCoactivationConclusions({ domainGraph, temporalGraph, analysis, dashaConclusions, gocharConclusions });
  const classicalConclusions = buildCareerClassicalEventConclusions({ domainGraph, temporalGraph, analysis });
  const conclusions = [...new Map([...natalConclusions, ...dashaConclusions, ...gocharConclusions, ...coactivationConclusions, ...classicalConclusions].map((item) => [item.conclusionId, item])).values()].sort((left, right) => left.conclusionId.localeCompare(right.conclusionId));
  const reading = buildReading({ domain: SUPPORTED_DOMAIN, conclusions }); const renderedReading = renderReading({ reading, locale });
  return freeze({ domain: SUPPORTED_DOMAIN, locale, reading, renderedReading, provenance: { orchestratorRulesetId: CAREER_ORCHESTRATOR_RULESET_ID, analysisId: analysis.analysisId, conclusionIds: conclusions.map((item) => item.conclusionId), readingItemIds: reading.readingItems.map((item) => item.readingItemId), readingRulesetId: reading.rulesetId, rendererRulesetId: renderedReading.provenance.rendererRulesetId, interpretation: 'delegated-to-layer-13', readingConstruction: 'delegated-to-layer-14a', rendering: 'delegated-to-layer-14b', providerDependency: 'none', networkAccess: 'not-performed', llmGeneration: 'not-performed' } });
}
module.exports = { buildCareerReading };
