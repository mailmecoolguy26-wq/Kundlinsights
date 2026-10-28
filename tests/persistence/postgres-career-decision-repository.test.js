'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PostgresCareerDecisionRepository } = require('../../src/persistence/postgres');

const createdAt = '2026-10-28T10:00:00.000Z';
function row(values) {
  return { id: values[0], user_id: values[1], birth_profile_id: values[2], decision_type: values[3], context_json: JSON.parse(values[4]), result_json: JSON.parse(values[5]), source_reading_id: values[6], created_at: values[7] };
}
function input() { return { id: 'decision-a', userId: 'user-a', birthProfileId: 'profile-a', decisionType: 'JOB_OFFER', context: { priority: 'Career growth' }, result: { decisionType: 'JOB_OFFER', state: 'INSUFFICIENT_EVIDENCE', context: { priority: 'Career growth' } }, sourceReadingId: 'reading-a', createdAt }; }

test('Postgres Career Decision repository persists only structured validated context/result and maps immutable detail', async () => {
  const requests = [];
  const repository = new PostgresCareerDecisionRepository({ db: { async query(sql, values) { requests.push({ sql, values }); return { rows: [row(values)] }; } } });
  const stored = await repository.createDecision(input());
  assert.match(requests[0].sql, /insert into app\.career_decisions/);
  assert.match(requests[0].sql, /context_json,result_json/);
  assert.deepEqual(requests[0].values.slice(0, 4), ['decision-a', 'user-a', 'profile-a', 'JOB_OFFER']);
  assert.deepEqual(stored.context, { priority: 'Career growth' });
  assert.equal(stored.result.state, 'INSUFFICIENT_EVIDENCE');
  assert.equal(stored.sourceReadingId, 'reading-a');
});

test('Postgres Career Decision repository scopes list/detail queries by user and birth profile', async () => {
  const requests = [];
  const repository = new PostgresCareerDecisionRepository({ db: { async query(sql, values) { requests.push({ sql, values }); if (sql.includes("result_json->>'state'")) return { rows: [{ id: 'decision-a', user_id: 'user-a', birth_profile_id: 'profile-a', decision_type: 'JOB_OFFER', source_reading_id: null, created_at: createdAt, decision_state: 'INSUFFICIENT_EVIDENCE' }] }; return { rows: [{ ...row(['decision-a', 'user-a', 'profile-a', 'JOB_OFFER', JSON.stringify({}), JSON.stringify({ state: 'INSUFFICIENT_EVIDENCE' }), null, createdAt]) }] }; } } });
  const listed = await repository.listDecisionsForBirthProfile({ userId: 'user-a', birthProfileId: 'profile-a' });
  const detail = await repository.getDecisionForBirthProfile({ userId: 'user-a', birthProfileId: 'profile-a', decisionId: 'decision-a' });
  assert.equal(listed[0].state, 'INSUFFICIENT_EVIDENCE');
  assert.equal(detail.decisionId, 'decision-a');
  for (const request of requests) assert.ok(request.values.includes('user-a') && request.values.includes('profile-a'));
});
