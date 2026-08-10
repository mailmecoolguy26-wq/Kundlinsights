'use strict';

const crypto = require('node:crypto');
const { EVIDENCE_RULESET_ID, NODE_KINDS, SOURCE_STRENGTHS, MISSING_DATA_STATUSES, FORBIDDEN_SEMANTIC_FIELDS } = require('./reference-data');

function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
}
function hash(value) { return crypto.createHash('sha256').update(stable(value)).digest('hex'); }
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.freeze(value); Object.values(value).forEach(freeze); return value; }
function assertNoForbidden(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_SEMANTIC_FIELDS.includes(key)) throw new RangeError(`Forbidden interpretation field: ${key}`);
    assertNoForbidden(child);
  }
}
function subject(subject) {
  if (!subject || typeof subject !== 'object' || Array.isArray(subject) || typeof subject.entityType !== 'string' || !subject.entityType || typeof subject.entityId !== 'string' || !subject.entityId) throw new TypeError('subject must provide non-empty entityType and entityId.');
  return { entityType: subject.entityType, entityId: subject.entityId };
}
function sourceStrength(value) { if (!SOURCE_STRENGTHS.includes(value)) throw new RangeError(`Unsupported source strength: ${value}`); return value; }
function common(input, kind) {
  if (!NODE_KINDS.includes(kind)) throw new RangeError(`Unsupported evidence node kind: ${kind}`);
  if (input.domain !== undefined && input.domain !== null) throw new RangeError('Layer 12A nodes must not declare a domain.');
  if (input.temporalContextId !== undefined && input.temporalContextId !== null) throw new RangeError('Layer 12A nodes must not declare temporal context.');
  if (typeof input.sourceLayer !== 'string' || !input.sourceLayer || typeof input.sourceRulesetId !== 'string' || !input.sourceRulesetId || typeof input.sourceIdentity !== 'string' || !input.sourceIdentity) throw new TypeError('Evidence nodes require sourceLayer, sourceRulesetId, and sourceIdentity.');
  assertNoForbidden(input);
  return { kind, domain: null, subject: subject(input.subject), sourceLayer: input.sourceLayer, sourceRulesetId: input.sourceRulesetId, sourceStrength: sourceStrength(input.sourceStrength), temporalContextId: null };
}
function createFact(input = {}) {
  const base = common(input, 'FACT');
  if (input.fact === undefined) throw new TypeError('FACT nodes require fact.');
  const identity = { type: 'FACT', sourceLayer: base.sourceLayer, sourceRulesetId: base.sourceRulesetId, subject: base.subject, sourceIdentity: input.sourceIdentity };
  return freeze({ id: `fact:${hash(identity)}`, ...base, fact: input.fact, relationType: null, inputNodeIds: [], provenance: { sourceIdentity: input.sourceIdentity, infrastructureRulesetId: EVIDENCE_RULESET_ID } });
}
function createDerivedRelation(input = {}) {
  const base = common(input, 'DERIVED_RELATION');
  if (typeof input.relationType !== 'string' || !input.relationType || !Array.isArray(input.inputNodeIds) || input.inputNodeIds.length === 0 || input.inputNodeIds.some((id) => typeof id !== 'string' || !id)) throw new TypeError('DERIVED_RELATION nodes require relationType and non-empty inputNodeIds.');
  if (typeof input.relationRulesetId !== 'string' || !input.relationRulesetId) throw new TypeError('DERIVED_RELATION nodes require relationRulesetId.');
  const inputNodeIds = [...new Set(input.inputNodeIds)].sort();
  const identity = { type: 'DERIVED_RELATION', relationType: input.relationType, subject: base.subject, inputNodeIds, relationRulesetId: input.relationRulesetId };
  return freeze({ id: `relation:${hash(identity)}`, ...base, fact: input.fact === undefined ? null : input.fact, relationType: input.relationType, inputNodeIds, provenance: { sourceIdentity: input.sourceIdentity, relationRulesetId: input.relationRulesetId, infrastructureRulesetId: EVIDENCE_RULESET_ID } });
}
function createMissingData(input = {}) {
  const base = common(input, 'MISSING_DATA');
  if (typeof input.dataKey !== 'string' || !input.dataKey || !MISSING_DATA_STATUSES.includes(input.status)) throw new TypeError('MISSING_DATA nodes require a dataKey and approved status.');
  const identity = { type: 'MISSING_DATA', subject: base.subject, dataKey: input.dataKey, status: input.status, sourceIdentity: input.sourceIdentity };
  return freeze({ id: `missing:${hash(identity)}`, ...base, fact: { dataKey: input.dataKey, status: input.status }, relationType: null, inputNodeIds: [], provenance: { sourceIdentity: input.sourceIdentity, infrastructureRulesetId: EVIDENCE_RULESET_ID } });
}

module.exports = { stable, hash, freeze, assertNoForbidden, createFact, createDerivedRelation, createMissingData };
