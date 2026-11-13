'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { InMemoryReadingRepository } = require('../../src/persistence');
const { SecureReadingService } = require('../../src/application/readings');
const { ReadingPayloadCodec } = require('../../src/security/crypto');
const { CareerTimingAuthorityService } = require('../../src/application/career-timing');

const principal = (subject) => ({ provider: 'supabase', subject, isAnonymous: false });

function record(readingId, createdAt, sentence, calibrationInterpretation = null, insights = null) {
  return {
    schemaVersion: 'kundlinsights-reading-record-v1', readingId, domain: 'CAREER', createdAt,
    engineProfileId: 'kundlinsights-vedic-engine-profile-v2',
    input: { readingInstant: createdAt, locale: 'en-IN' }, provenance: calibrationInterpretation ? { calibration: { contextVersion: 'career-reading-context-v1', sourceEventIds: ['private-event'], rulesets: { p3: 'career-pattern-comparison-v1' } } } : {}, reading: { internalEvidence: 'not-public', ...(calibrationInterpretation ? { calibrationInterpretation } : {}), ...(insights ? { insights } : {}) },
    renderedReading: { domain: 'CAREER', locale: 'en-IN', sections: [{ section: 'CAREER_STRUCTURE', headline: 'Career structure', items: [{ sentence }] }] },
    integrity: { calculation: { algorithm: 'sha256', digest: 'a'.repeat(64) }, output: { algorithm: 'sha256', digest: 'b'.repeat(64) }, rendered: { algorithm: 'sha256', digest: 'c'.repeat(64) } },
  };
}

function setup() {
  const readings = new InMemoryReadingRepository();
  readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: record('reading-a-old', '2026-08-17T00:00:00.000Z', 'Older stored content.') });
  readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: record('reading-a-new', '2026-08-18T00:00:00.000Z', 'Newer stored content.') });
  readings.insertReadingRecord({ userId: 'user-b', birthProfileId: 'profile-b', record: record('reading-b-own', '2026-08-19T00:00:00.000Z', 'Private content.') });
  const calls = { generator: 0, entitlement: 0, replay: 0 };
  const service = new SecureReadingService({
    authUserResolver: async (value) => ({ id: value.subject === 'subject-a' ? 'user-a' : 'user-b', status: 'active' }),
    transactionExecutor: { execute: async ({ operation }) => operation({}) },
    repositories: () => ({ birthProfiles: {}, readings, entitlements: {} }),
    secureBirthProfileLoader: { get: async ({ principal: value, birthProfileId }) => {
      if ((value.subject === 'subject-a' && birthProfileId === 'profile-a') || (value.subject === 'subject-b' && birthProfileId === 'profile-b')) return { id: birthProfileId, status: 'active' };
      const error = new Error(); error.code = 'NOT_FOUND_OR_FORBIDDEN'; throw error;
    } },
    readingGenerator: { generate: async () => { calls.generator += 1; throw new Error('not used'); } },
    readingRecordFactory: () => { throw new Error('not used'); },
    replayReading: async () => { calls.replay += 1; throw new Error('not used'); },
    requiresEntitlement: () => { calls.entitlement += 1; return true; }, idGenerator: () => 'unused', clock: () => '2026-08-20T00:00:00.000Z',
  });
  return { service, calls, readings };
}

function persistedCalibratedDetail(calibrationInterpretation, careerTimingPeriods = null) {
  const readings = new InMemoryReadingRepository();
  const stored = record('reading-calibrated', '2026-08-18T00:00:00.000Z', 'Stored content.', calibrationInterpretation);
  if (careerTimingPeriods) stored.reading.careerTimingPeriods = careerTimingPeriods;
  readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: stored });
  const service = new SecureReadingService({
    authUserResolver: async () => ({ id: 'user-a', status: 'active' }), transactionExecutor: { execute: async ({ operation }) => operation({}) }, repositories: () => ({ birthProfiles: {}, readings, entitlements: {} }),
    readingGenerator: { generate: async () => { throw new Error('not used'); } }, readingRecordFactory: () => { throw new Error('not used'); }, replayReading: async () => { throw new Error('not used'); }, requiresEntitlement: () => false, idGenerator: () => 'unused', clock: () => '2026-08-20T00:00:00.000Z',
  });
  return service.getSecureReadingDetail({ principal: principal('subject-a'), readingId: 'reading-calibrated' });
}

test('API-P5C2 service lists bounded owned summaries newest-first and verifies an optional birth profile filter', async () => {
  const { service, calls } = setup();
  const listed = await service.listSecureReadings({ principal: principal('subject-a') });
  assert.deepEqual(listed.map((item) => item.readingId), ['reading-a-new', 'reading-a-old']);
  assert.equal(JSON.stringify(listed).includes('content'), false); assert.equal(JSON.stringify(listed).includes('internalEvidence'), false);
  assert.deepEqual(await service.listSecureReadings({ principal: principal('subject-a'), birthProfileId: 'profile-a' }), listed);
  await assert.rejects(service.listSecureReadings({ principal: principal('subject-a'), birthProfileId: 'profile-b' }), (error) => error && error.code === 'NOT_FOUND_OR_FORBIDDEN');
  assert.deepEqual(calls, { generator: 0, entitlement: 0, replay: 0 });
});

test('API-P5C2 service returns exactly the newest fifty readings and uses reading ID ascending as the created-at tie-breaker', async () => {
  const { service, readings } = setup();
  for (let index = 0; index <= 50; index += 1) {
    readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: record(`limit-${String(index).padStart(2, '0')}`, new Date(Date.UTC(2026, 8, 1, 0, 0, index)).toISOString(), `Stored ${index}.`) });
  }
  readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: record('tie-z', '2026-10-01T00:00:00.000Z', 'Tie z.') });
  readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: record('tie-a', '2026-10-01T00:00:00.000Z', 'Tie a.') });
  const listed = await service.listSecureReadings({ principal: principal('subject-a') });
  assert.equal(listed.length, 50); assert.deepEqual(listed.slice(0, 2).map((item) => item.readingId), ['tie-a', 'tie-z']);
  assert.deepEqual(listed.slice(2).map((item) => item.readingId), Array.from({ length: 48 }, (_, offset) => `limit-${String(50 - offset).padStart(2, '0')}`));
  assert.equal(listed.some((item) => item.readingId === 'limit-02'), false);
});

test('API-P5C2 service returns only owned persisted rendered content without generation, replay, or entitlement consumption', async () => {
  const { service, calls } = setup();
  const detail = await service.getSecureReadingDetail({ principal: principal('subject-a'), readingId: 'reading-a-new' });
  assert.equal(detail.content.sections[0].items[0].sentence, 'Newer stored content.');
  assert.equal(JSON.stringify(detail).includes('internalEvidence'), false);
  await assert.rejects(service.getSecureReadingDetail({ principal: principal('subject-a'), readingId: 'reading-b-own' }), (error) => error && error.code === 'NOT_FOUND_OR_FORBIDDEN');
  assert.deepEqual(calls, { generator: 0, entitlement: 0, replay: 0 });
});
test('Career Insight delivery exposes a safe structured trace without internal evidence identifiers', async () => {
  const { service, readings } = setup();
  const insights = [{ insightId: 'insight:private', family: 'ACTIVE_CAREER_DASHA', titleKey: 'career.dasha.active.title', summaryKey: 'career.dasha.active.summary', displayPriority: 0, status: 'SUPPORTED', timing: { instant: '2026-09-15T00:00:00.000Z', from: '2026-09-01T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z', dashaPeriods: [{ kind: 'DASHA_PERIOD', start: '2026-09-01T00:00:00.000Z', end: '2026-10-01T00:00:00.000Z', isCurrent: true, periodLevel: 'ANTARDASHA', periodPlanet: 'Saturn', source: 'VIMSHOTTARI', sourceRulesetId: 'private-ruleset', privateNodeId: 'nope' }], transitContexts: [], mechanismFamilies: ['DASHA'] }, signals: ['signal:private'], evidenceTrace: { signals: [{ signalId: 'signal:private', evidence: [{ evidenceId: 'evidence:private', sourceRuleId: 'career-h10-connected-dasha-activation-v1', sourceRulesetId: 'parashari-career-interpretation-foundation-v1', chart: 'D10', rootSourceIds: ['fact:private'], technicalContext: [{ sourceFamily: 'ASHTAKAVARGA', scoreType: 'SAV', houseNumber: 10, rashiIndex: 9, value: 29, privateBlob: 'nope' }, { sourceFamily: 'PLANETARY_STATE', planet: 'Saturn', chart: 'D1', state: 'RETROGRADE', privateBlob: 'nope' }, { sourceFamily: 'PLANETARY_RELATIONSHIP', subjectPlanet: 'Saturn', targetPlanet: 'Mercury', relationshipType: 'PANCHADHA', relationship: 'neutral', chart: 'D1', privateBlob: 'nope' }, { sourceFamily: 'ASHTAKAVARGA', scoreType: 'INVALID', houseNumber: 10, rashiIndex: 9, value: 99 }] }] }] }, caveats: [], calibrationContext: null, technicalDetails: { independentMechanismFamilies: ['DASHA'] }, rulesetVersions: { insightEngine: 'kundlinsights-career-insight-engine-v1' } }];
  readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: record('reading-insight', '2026-08-21T00:00:00.000Z', 'Insight content.', null, insights) });
  const detail = await service.getSecureReadingDetail({ principal: principal('subject-a'), readingId: 'reading-insight' });
  assert.equal(detail.insights[0].family, 'ACTIVE_CAREER_DASHA');
  assert.deepEqual(detail.insights[0].evidenceTrace.signals, []);
  assert.deepEqual(detail.insights[0].technicalContext.d10CareerChart, [{ kind: 'D10_CAREER_CHART', label: 'D10 Career Chart' }]);
  assert.deepEqual(detail.insights[0].technicalContext.supportingContext, [{ sourceFamily: 'ASHTAKAVARGA', scoreType: 'SAV', houseNumber: 10, rashiIndex: 9, value: 29 }, { sourceFamily: 'PLANETARY_RELATIONSHIP', subjectPlanet: 'Saturn', targetPlanet: 'Mercury', relationshipType: 'PANCHADHA', relationship: 'neutral', chart: 'D1' }, { sourceFamily: 'PLANETARY_STATE', planet: 'Saturn', chart: 'D1', state: 'RETROGRADE' }]);
  assert.deepEqual(detail.insights[0].timing.dashaPeriods, [{ kind: 'DASHA_PERIOD', start: '2026-09-01T00:00:00.000Z', end: '2026-10-01T00:00:00.000Z', isCurrent: true, periodLevel: 'ANTARDASHA', periodPlanet: 'Saturn', source: 'VIMSHOTTARI' }]);
  assert.deepEqual(detail.insights[0].timing.instant, '2026-09-15T00:00:00.000Z');
  assert.deepEqual(detail.insights[0].timing.from, '2026-09-01T00:00:00.000Z');
  assert.deepEqual(detail.insights[0].timing.to, '2026-10-01T00:00:00.000Z');
  assert.equal(JSON.stringify(detail.insights).match(/evidence:private|signal:private|fact:private|privateBlob|career-h10-connected|ruleset/i), null);
});
test('Career Ashtakavarga structure delivery is additive, factual, and excludes internal or interpretive fields', async () => {
  const { service, readings } = setup();
  const snapshot = record('reading-ashtakavarga', '2026-08-23T00:00:00.000Z', 'Insight content.');
  snapshot.reading.careerAshtakavargaStructure = {
    h10: { house: 10, sav: 31, threshold: 'private' },
    h10Lord: { planet: 'Mars', house: 7, houseSav: 31, sourceId: 'private' },
    h7: { house: 7, sav: 25 },
    h7Lord: { planet: 'Saturn', house: 6, houseSav: 23 },
    tenthFromH10Lord: { house: 4, sav: 35, rank: 1 },
  };
  readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: snapshot });
  const detail = await service.getSecureReadingDetail({ principal: principal('subject-a'), readingId: 'reading-ashtakavarga' });
  assert.deepEqual(detail.careerAshtakavargaStructure, {
    h10: { house: 10, sav: 31 },
    h10Lord: { planet: 'Mars', house: 7, houseSav: 31 },
    h7: { house: 7, sav: 25 },
    h7Lord: { planet: 'Saturn', house: 6, houseSav: 23 },
    tenthFromH10Lord: { house: 4, sav: 35 },
  });
  assert.equal(JSON.stringify(detail.careerAshtakavargaStructure).match(/threshold|rank|sourceId|strong|weak|favorable/i), null);
});
test('Career D10 structure delivery is additive, factual, and excludes interpretation', async () => {
  const { service, readings } = setup();
  const snapshot = record('reading-d10-structure', '2026-08-23T00:00:00.000Z', 'Insight content.');
  snapshot.reading.careerD10Structure = { chart: 'D10', lagna: { house: 1, sign: { rashiIndex: 1, englishName: 'Mesha' }, occupants: [], aspectsReceived: [] }, tenthHouse: { house: 10, sign: { rashiIndex: 10, englishName: 'Makara' }, lord: 'Saturn', lordHouse: 8, occupants: [], aspectsReceived: [] }, shani: { planet: 'Saturn', house: 8, sign: { rashiIndex: 8, englishName: 'Vrishchika' }, degree: 12.4, retrograde: true, conjunctions: [], aspectsToHouses: [{ house: 10, aspectNumber: 3 }], aspectsToPlanets: [], privateReason: 'omit' } };
  readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: snapshot });
  const detail = await service.getSecureReadingDetail({ principal: principal('subject-a'), readingId: 'reading-d10-structure' });
  assert.deepEqual(detail.careerD10Structure, { chart: 'D10', lagna: { house: 1, sign: { rashiIndex: 1, englishName: 'Mesha' }, occupants: [], aspectsReceived: [] }, tenthHouse: { house: 10, sign: { rashiIndex: 10, englishName: 'Makara' }, lord: 'Saturn', lordHouse: 8, occupants: [], aspectsReceived: [] }, shani: { planet: 'Saturn', house: 8, sign: { rashiIndex: 8, englishName: 'Vrishchika' }, degree: 12.4, retrograde: true, conjunctions: [], aspectsToHouses: [{ house: 10, aspectNumber: 3 }], aspectsToPlanets: [] } });
  assert.equal(JSON.stringify(detail.careerD10Structure).match(/private|score|threshold|ranking|probability|confidence|timing/i), null);
});
test('Career D10 corroboration delivery is additive, contextual, and sanitizes internal fields', async () => {
  const { service, readings } = setup();
  const snapshot = record('reading-d10-corroboration', '2026-08-24T00:00:00.000Z', 'Insight content.');
  snapshot.reading.careerD10Corroboration = {
    chart: 'D10', corroborates: 'CAREER_FOUNDATION', privateReason: 'omit',
    themes: [{
      theme: 'COMMUNICATION_COMMERCE_TECH', interpretationLevel: 'CONTEXTUAL', limitation: 'NOT_STANDALONE_PREDICTION', privateReason: 'omit',
      supportingFactors: [
        { source: 'D10_LAGNA_LORD', planet: 'Mercury', house: 1, privateReason: 'omit' },
        { source: 'D10_TENTH_OCCUPANT', planet: 'Mercury', house: 10, privateReason: 'omit' },
      ],
    }],
  };
  readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: snapshot });
  const detail = await service.getSecureReadingDetail({ principal: principal('subject-a'), readingId: 'reading-d10-corroboration' });
  assert.deepEqual(detail.careerD10Corroboration, {
    chart: 'D10', corroborates: 'CAREER_FOUNDATION', themes: [{
      theme: 'COMMUNICATION_COMMERCE_TECH', interpretationLevel: 'CONTEXTUAL', limitation: 'NOT_STANDALONE_PREDICTION',
      supportingFactors: [{ source: 'D10_LAGNA_LORD', planet: 'Mercury', house: 1 }, { source: 'D10_TENTH_OCCUPANT', planet: 'Mercury', house: 10 }],
    }],
  });
  assert.equal(JSON.stringify(detail.careerD10Corroboration).match(/private|score|threshold|ranking|probability|confidence|timing|promotion|job.?change|business|success|failure|wealth|debt|foreign/i), null);
  const legacy = await service.getSecureReadingDetail({ principal: principal('subject-a'), readingId: 'reading-a-new' });
  assert.equal('careerD10Corroboration' in legacy, false);
});
test('Career Ashtakavarga corroboration is an optional, narrow public H10 context only', async () => {
  const { service, readings } = setup();
  const snapshot = record('reading-ashtakavarga-corroboration', '2026-08-24T00:00:00.000Z', 'Insight content.');
  snapshot.reading.careerAshtakavargaCorroboration = {
    kind: 'H10_NATAL_CONTEXT', chart: 'D1', corroborates: 'CAREER_FOUNDATION',
    h10: { house: 10, sav: 31, threshold: 'private' },
    limitation: 'NOT_STANDALONE_PREDICTION', privateReason: 'nope',
  };
  readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: snapshot });
  const detail = await service.getSecureReadingDetail({ principal: principal('subject-a'), readingId: 'reading-ashtakavarga-corroboration' });
  assert.deepEqual(detail.careerAshtakavargaCorroboration, {
    kind: 'H10_NATAL_CONTEXT', chart: 'D1', corroborates: 'CAREER_FOUNDATION',
    h10: { house: 10, sav: 31 }, limitation: 'NOT_STANDALONE_PREDICTION',
  });
  assert.equal(JSON.stringify(detail.careerAshtakavargaCorroboration).match(/threshold|rank|score|confidence|probability|strong|weak|favorable|private/i), null);
  const legacy = await service.getSecureReadingDetail({ principal: principal('subject-a'), readingId: 'reading-a-new' });
  assert.equal('careerAshtakavargaCorroboration' in legacy, false);
});
test('Phase16E delivery exposes only the structured synthesis packet and safely omits malformed legacy data', async () => {
  const { service, readings } = setup();
  const snapshot = record('reading-synthesis', '2026-08-24T00:00:00.000Z', 'Insight content.');
  snapshot.reading.careerEvidenceSynthesis = {
    foundation: { family: 'CAREER_FOUNDATION', internal: 'nope' },
    timing: { activeDasha: true, currentTransit: false, concurrent: false, limited: true, strength: 'private' },
    corroboration: { h10: { house: 10, sav: 31, threshold: 'private' } },
    calibration: { calibrationLevel: 'LIMITED', eventCount: 1, patternCount: 9 },
    futureRecurrence: { family: 'FUTURE_RECURRENCE_WINDOW', private: true },
  };
  readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: snapshot });
  const detail = await service.getSecureReadingDetail({ principal: principal('subject-a'), readingId: 'reading-synthesis' });
  assert.deepEqual(detail.careerEvidenceSynthesis, {
    foundation: { family: 'CAREER_FOUNDATION' },
    timing: { activeDasha: true, currentTransit: false, concurrent: false, limited: true },
    corroboration: { h10: { house: 10, sav: 31 } },
    calibration: { calibrationLevel: 'LIMITED', eventCount: 1 },
    futureRecurrence: { family: 'FUTURE_RECURRENCE_WINDOW' },
  });
  assert.equal(JSON.stringify(detail.careerEvidenceSynthesis).match(/threshold|score|rank|probability|confidence|strong|weak|h7|private/i), null);
  const malformedSnapshot = record('reading-synthesis-malformed', '2026-08-25T00:00:00.000Z', 'Insight content.');
  malformedSnapshot.reading.careerEvidenceSynthesis = { foundation: { family: 'CAREER_FOUNDATION' }, timing: {} };
  readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: malformedSnapshot });
  const malformed = await service.getSecureReadingDetail({ principal: principal('subject-a'), readingId: 'reading-synthesis-malformed' });
  assert.equal('careerEvidenceSynthesis' in malformed, false);
});
test('Career timing delivery is optional, public-safe, chronological, and does not promote a possible signal', async () => {
  const { service, readings } = setup();
  const snapshot = record('reading-timing-periods', '2026-08-25T00:00:00.000Z', 'Insight content.');
  snapshot.reading.careerTimingPeriods = [{
    startDate: '2027-01-05T00:00:00.000Z', endDate: '2027-01-20T00:00:00.000Z', evidenceState: 'POSSIBLE_CAREER_ACTIVITY_SIGNAL', headline: 'POSSIBLE CAREER ACTIVITY SIGNAL', summary: 'Safe timing summary.', whyItems: ['Guru Dev Dasha Career structure se connected hai.'], whatThisCanMean: 'Safe factual timing context.', professionalDirection: 'Context only.', disclosure: 'No guarantee.', sourceRuleVersion: 'career-timing-launch-v1', longWindow: false,
    technicalDetails: { d1: { h10Sign: 9, h10Lord: 'Jupiter', directCareerFactors: ['Jupiter'] }, dasha: { qualifyingLevel: ['PD'], periods: ['PD:Jupiter'] }, gochar: [{ transitPlanet: 'Jupiter', target: '10th-house Career axis', activation: 'occupies' }], d10: { confirmationPresent: false }, moon: { supportPresent: false }, savBav: { h10Sav: 35 }, historicalPattern: { available: false, present: false }, private: 'omit' },
  }, {
    startDate: '2026-11-20T00:00:00.000Z', endDate: '2026-12-10T00:00:00.000Z', evidenceState: 'POSSIBLE_CAREER_ACTIVITY_SIGNAL', headline: 'POSSIBLE CAREER ACTIVITY SIGNAL', summary: 'Safe timing summary.', whyItems: [], whatThisCanMean: 'Safe factual timing context.', professionalDirection: 'Context only.', disclosure: 'No guarantee.', sourceRuleVersion: 'career-timing-launch-v1', longWindow: false,
    technicalDetails: { d1: { h10Sign: 9, h10Lord: 'Jupiter', directCareerFactors: [] }, dasha: { qualifyingLevel: ['PD'], periods: ['PD:Jupiter'] }, gochar: [], d10: { confirmationPresent: false }, moon: { supportPresent: false }, savBav: {}, historicalPattern: { available: false, present: false } },
  }];
  readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: snapshot });
  const detail = await service.getSecureReadingDetail({ principal: principal('subject-a'), readingId: 'reading-timing-periods' });
  assert.deepEqual(detail.careerTimingPeriods.map((item) => item.startDate), ['2026-11-20T00:00:00.000Z', '2027-01-05T00:00:00.000Z']);
  assert.equal(detail.careerTimingPeriods[0].evidenceState, 'POSSIBLE_CAREER_ACTIVITY_SIGNAL');
  assert.equal(JSON.stringify(detail.careerTimingPeriods).match(/private|threshold|rank|score|probability|confidence/i), null);
  const legacy = await service.getSecureReadingDetail({ principal: principal('subject-a'), readingId: 'reading-a-new' });
  assert.equal('careerTimingPeriods' in legacy, false);
});
test('canonical Career timing is strictly allowlisted while legacy and unsupported snapshots remain compatible', async () => {
  const { service, readings } = setup();
  const start='2026-01-01T00:00:00.000Z', end='2026-01-20T00:00:00.000Z';
  const evidence={d1Houses:{houses:Array.from({length:12},(_,i)=>({houseNumber:i+1,rashi:{rashiIndex:i+1},rashiHouseLord:i===9?'Saturn':'Sun'})),planetaryAssignments:[{body:'Saturn',rashi:{rashiIndex:8},rashiHouseNumber:8},{body:'Moon',rashi:{rashiIndex:10},rashiHouseNumber:10}]},dashaIntervals:[{start,end,activePeriods:[{level:'MD',lord:'Saturn'},{level:'AD',lord:'Moon'},{level:'PD',lord:'Saturn'}]}],transitIntervals:[{planet:'Jupiter',sign:10,start,end},{planet:'Saturn',sign:10,start,end}],d10Corroboration:{themes:[{}]},forecastStart:start,forecastEnd:end,calculationInstant:start};
  const canonical=new CareerTimingAuthorityService({rolloutMode:'ON'}).calculate(evidence).careerTiming;
  const stored=record('reading-canonical-timing','2026-08-26T00:00:00.000Z','Stored content.');
  stored.reading.careerTiming=JSON.parse(JSON.stringify(canonical));
  stored.reading.careerTiming.birthData={date:'private'}; stored.reading.careerTiming.coordinates={latitude:1}; stored.reading.careerTiming.certification={cohort:'private'}; stored.reading.careerTiming.historicalEvents=[{eventId:'private'}];
  readings.insertReadingRecord({userId:'user-a',birthProfileId:'profile-a',record:stored});
  const detail=await service.getSecureReadingDetail({principal:principal('subject-a'),readingId:'reading-canonical-timing'});
  assert.equal(detail.careerTiming.contractVersion,'career-timing-production-v1');
  assert.equal(detail.careerTiming.intervalSemantics,'HALF_OPEN');
  assert.equal(Object.isFrozen(detail.careerTiming),true);
  const serialized=JSON.stringify(detail.careerTiming);
  for(const forbidden of ['birthData','coordinates','certification']) assert.equal(Object.hasOwn(detail.careerTiming,forbidden),false,forbidden);
  assert.equal(Object.hasOwn(detail.careerTiming,'historicalEvents'),false);
  assert.equal(serialized.includes('private'),false);

  const future=record('reading-future-timing','2026-08-27T00:00:00.000Z','Stored content.'); future.reading.careerTiming={...canonical,contractVersion:'career-timing-production-v99'};
  const malformed=record('reading-malformed-timing','2026-08-28T00:00:00.000Z','Stored content.'); malformed.reading.careerTiming={...canonical,periods:[{start:'invalid'}]};
  readings.insertReadingRecord({userId:'user-a',birthProfileId:'profile-a',record:future}); readings.insertReadingRecord({userId:'user-a',birthProfileId:'profile-a',record:malformed});
  assert.equal('careerTiming' in await service.getSecureReadingDetail({principal:principal('subject-a'),readingId:'reading-future-timing'}),false);
  assert.equal('careerTiming' in await service.getSecureReadingDetail({principal:principal('subject-a'),readingId:'reading-malformed-timing'}),false);
  assert.equal('careerTiming' in await service.getSecureReadingDetail({principal:principal('subject-a'),readingId:'reading-a-new'}),false);
});
test('canonical Career timing public contract is stable, nullable, half-open, and rejects malformed selections or boundaries', async () => {
  const { service, readings } = setup();
  const start='2026-01-01T00:00:00.000Z', end='2026-01-20T00:00:00.000Z';
  const evidence={d1Houses:{houses:Array.from({length:12},(_,i)=>({houseNumber:i+1,rashi:{rashiIndex:i+1},rashiHouseLord:i===9?'Saturn':'Sun'})),planetaryAssignments:[{body:'Saturn',rashi:{rashiIndex:8},rashiHouseNumber:8},{body:'Moon',rashi:{rashiIndex:10},rashiHouseNumber:10}]},dashaIntervals:[{start,end,activePeriods:[{level:'MD',lord:'Saturn'},{level:'AD',lord:'Moon'},{level:'PD',lord:'Saturn'}]}],transitIntervals:[{planet:'Jupiter',sign:10,start,end},{planet:'Saturn',sign:10,start,end}],d10Corroboration:{themes:[{}]},forecastStart:start,forecastEnd:end,calculationInstant:'2026-01-05T00:00:00.000Z'};
  const canonical=new CareerTimingAuthorityService({rolloutMode:'SHADOW'}).calculate(evidence,{referenceInstant:'2026-01-05T00:00:00.000Z'}).careerTiming;
  const stored=record('reading-contract-snapshot','2026-08-29T00:00:00.000Z','Stored content.'); stored.reading.careerTiming=canonical; readings.insertReadingRecord({userId:'user-a',birthProfileId:'profile-a',record:stored});
  const detail=await service.getSecureReadingDetail({principal:principal('subject-a'),readingId:'reading-contract-snapshot'});
  assert.deepEqual(Object.keys(detail.careerTiming).sort(),['contractVersion','timingEngineVersion','eligibilityRuleset','refinementRuleset','authority','intervalSemantics','periods','current','next','explanationPolicy'].sort());
  assert.deepEqual({contractVersion:detail.careerTiming.contractVersion,authority:detail.careerTiming.authority,intervalSemantics:detail.careerTiming.intervalSemantics},{contractVersion:'career-timing-production-v1',authority:'SHADOW',intervalSemantics:'HALF_OPEN'});
  assert.equal(detail.careerTiming.periods.length,1); assert.equal(detail.careerTiming.periods[0].label,'Supportive period'); assert.equal(detail.careerTiming.periods[0].strongestWindow.label,'Background support'); assert.equal(detail.careerTiming.current.eligiblePeriod.periodId,detail.careerTiming.periods[0].periodId); assert.equal(detail.careerTiming.next,null); assert.equal(Object.isFrozen(detail.careerTiming.current.eligiblePeriod.refinementWindows),true);

  const cases = [
    ['missing-version',(({timingEngineVersion: _omitted,...rest})=>rest)(canonical)],
    ['bad-semantics',{...canonical,intervalSemantics:'INCLUSIVE'}],
    ['bad-state',{...canonical,periods:[{...canonical.periods[0],internalState:'UNKNOWN'}]}],
    ['outside-child',{...canonical,periods:[{...canonical.periods[0],refinementWindows:[{...canonical.periods[0].refinementWindows[0],start:'2025-12-31T00:00:00.000Z'}]}]}],
    ['detached-current',{...canonical,current:{...canonical.current,eligiblePeriod:{...canonical.current.eligiblePeriod,periodId:'different-period'}}}],
  ];
  for (const [suffix,value] of cases) { const invalid=record(`reading-invalid-${suffix}`,'2026-08-30T00:00:00.000Z','Stored content.'); invalid.reading.careerTiming=value; readings.insertReadingRecord({userId:'user-a',birthProfileId:'profile-a',record:invalid}); const output=await service.getSecureReadingDetail({principal:principal('subject-a'),readingId:`reading-invalid-${suffix}`}); assert.equal('careerTiming' in output,false,suffix); }
});
test('Career Insight delivery omits absent optional transit and concurrent fields without rejecting the detail DTO', async () => {
  const { service, readings } = setup();
  const insights = [{
    insightId: 'insight:partial-timing', family: 'CURRENT_CAREER_TRANSIT', titleKey: 'career.transit.title', summaryKey: 'career.transit.summary', displayPriority: 0, status: 'MIXED',
    timing: {
      transitContexts: [{ kind: 'GOCHAR_SNAPSHOT', start: '2026-09-10T00:00:00.000Z', isCurrent: true }],
      timingWindow: { kind: 'CAREER_TIMING_OVERLAP', start: '2026-09-10T00:00:00.000Z', end: '2026-09-11T00:00:00.000Z', isCurrent: true },
      mechanismFamilies: ['GOCHAR'],
    },
    caveats: [], calibrationContext: null, technicalDetails: { independentMechanismFamilies: ['GOCHAR'] }, evidenceTrace: { signals: [] },
  }];
  readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: record('reading-partial-timing', '2026-08-22T00:00:00.000Z', 'Insight content.', null, insights) });
  const detail = await service.getSecureReadingDetail({ principal: principal('subject-a'), readingId: 'reading-partial-timing' });
  assert.equal(detail.insights.length, 1);
  assert.deepEqual(detail.insights[0].technicalContext.timing, [
    { kind: 'CONCURRENT_TIMING', start: '2026-09-10T00:00:00.000Z', end: '2026-09-11T00:00:00.000Z', mechanismFamilies: ['GOCHAR'] },
    { kind: 'TRANSIT', start: '2026-09-10T00:00:00.000Z' },
  ]);
});
test('P7B normalizes persisted calibrated interpretation without exposing internal evidence', async () => {
  const readings = new InMemoryReadingRepository(), calibrated = { schemaVersion: 'career-reading-interpretation-schema-v1', calibrationSummary: { narrative: 'Calibration is limited.' }, recurringHistoricalEvidence: [{ evidenceId: 'hist:private', patternKey: 'private-pattern', text: 'A recurring pattern is present.' }], upcomingRecurrenceWindows: [], decisionConsiderations: ['Review options.'], disclosure: { hasProvisionalEvidence: true } }; readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: record('reading-a-new', '2026-08-18T00:00:00.000Z', 'Newer stored content.', calibrated) }); const calls = { generator: 0, entitlement: 0, replay: 0 }; const service = new SecureReadingService({ authUserResolver: async () => ({ id: 'user-a', status: 'active' }), transactionExecutor: { execute: async ({ operation }) => operation({}) }, repositories: () => ({ birthProfiles: {}, readings, entitlements: {} }), readingGenerator: { generate: async () => { calls.generator++; } }, readingRecordFactory: () => {}, replayReading: async () => {}, requiresEntitlement: () => false, idGenerator: () => 'unused', clock: () => '2026-08-20T00:00:00.000Z' }); const detail = await service.getSecureReadingDetail({ principal: principal('subject-a'), readingId: 'reading-a-new' }); assert.equal(detail.calibratedContent.sections[0].items[0].sentence, 'Calibration is limited.'); assert.equal(JSON.stringify(detail.calibratedContent).match(/evidenceId|patternKey|provenance|private/), null); assert.equal(detail.content.sections[0].items[0].sentence, 'Newer stored content.');
});
test('P7B reads back NONE calibration as a summary without fabricating recurrence', async () => {
  const detail = await persistedCalibratedDetail({ schemaVersion: 'career-reading-interpretation-schema-v1', calibrationSummary: { calibrationLevel: 'NONE', narrative: 'No historical calibration is available.' }, recurringHistoricalEvidence: [], upcomingRecurrenceWindows: [], decisionConsiderations: [], disclosure: { hasProvisionalEvidence: false } });
  assert.equal(detail.content.sections[0].items[0].sentence, 'Stored content.'); assert.deepEqual(detail.calibratedContent.sections.map((section) => section.section), ['calibration']);
  assert.equal(JSON.stringify(detail.calibratedContent).match(/evidenceId|patternKey|sourceEventIds|contextVersion|schemaVersion/), null);
});
test('P7B reads back LIMITED calibration as a summary without recurrence sections', async () => {
  const detail = await persistedCalibratedDetail({ schemaVersion: 'career-reading-interpretation-schema-v1', calibrationSummary: { calibrationLevel: 'LIMITED', narrative: 'Calibration is limited to available history.' }, recurringHistoricalEvidence: [], upcomingRecurrenceWindows: [], decisionConsiderations: [], disclosure: { hasProvisionalEvidence: false } });
  assert.deepEqual(detail.calibratedContent.sections.map((section) => section.section), ['calibration']); assert.equal(detail.calibratedContent.sections[0].items[0].sentence, 'Calibration is limited to available history.');
});
test('P7B reads back calibrated no-pattern output without fabricating recurrence', async () => {
  const detail = await persistedCalibratedDetail({ schemaVersion: 'career-reading-interpretation-schema-v1', calibrationSummary: { calibrationLevel: 'CALIBRATED', narrative: 'No repeated pattern is available.' }, recurringHistoricalEvidence: [], upcomingRecurrenceWindows: [], decisionConsiderations: ['Review options before acting.'], disclosure: { hasProvisionalEvidence: true } });
  assert.deepEqual(detail.calibratedContent.sections.map((section) => section.section), ['calibration', 'decision-considerations', 'calculation-note']);
  assert.equal(detail.calibratedContent.sections[1].items[0].sentence, 'Review options before acting.'); assert.equal(detail.calibratedContent.sections[2].items[0].sentence, 'A supporting historical-calibration calculation uses a provisional method. Treat it as additional context, not as a standalone Career conclusion.');
  assert.equal(JSON.stringify(detail.calibratedContent).includes('hasProvisionalEvidence'), false);
});

test('P7B distinguishes empty historical recurrence from broader future Career forecast windows', async () => {
  const detail = await persistedCalibratedDetail({
    schemaVersion: 'career-reading-interpretation-schema-v1',
    calibrationSummary: { calibrationLevel: 'CALIBRATED', narrative: 'Since no future occurrences were supplied, there are no specific upcoming recurrence windows.' },
    recurringHistoricalEvidence: [], upcomingRecurrenceWindows: [],
    decisionConsiderations: ['Since no future occurrences were provided, no future periods exist.'],
    disclosure: { hasProvisionalEvidence: false },
  }, [{ startDate: '2026-11-20T00:00:00.000Z', endDate: '2027-01-10T00:00:00.000Z', evidenceState: 'POSSIBLE_CAREER_ACTIVITY_SIGNAL', headline: 'signal', summary: 'summary', whyItems: [], whatThisCanMean: 'context', professionalDirection: 'prepare', technicalDetails: { d1: { h10Sign: 9, h10Lord: 'Jupiter', directCareerFactors: [] }, dasha: { qualifyingLevel: [], periods: [] }, gochar: [], d10: { confirmationPresent: false }, moon: { supportPresent: false }, savBav: {}, historicalPattern: { available: false, present: false }, window: { startDate: '2026-11-20T00:00:00.000Z', endDate: '2027-01-10T00:00:00.000Z' } }, disclosure: 'No guarantee.', sourceRuleVersion: 'v1', longWindow: false }]);
  const serialized = JSON.stringify(detail.calibratedContent);
  assert.match(serialized, /an additional recurrence-based future window/);
  assert.match(serialized, /broader Career timing model/);
  assert.doesNotMatch(serialized, /no future occurrences|no future periods exist/i);
});

test('API-P5C2 service decrypts owned encrypted storage through the existing reading payload codec without exposing an envelope', async () => {
  const plain = record('reading-encrypted', '2026-08-20T00:00:00.000Z', 'Encrypted stored content.');
  const encodeCodec = new ReadingPayloadCodec({ userDekProvider: { current: async () => ({ keyVersion: 'test-key', dek: Buffer.alloc(32, 7) }), forVersion: async () => ({ keyVersion: 'test-key', dek: Buffer.alloc(32, 7) }) } });
  const payload = await encodeCodec.encodeRecord({ userId: 'user-a', record: plain });
  const encrypted = { readingId: plain.readingId, userId: 'user-a', birthProfileId: 'profile-a', status: 'active', archivedAt: null, idempotencyKey: null, recordMetadata: { readingId: plain.readingId, domain: plain.domain, engineProfileId: plain.engineProfileId, schemaVersion: plain.schemaVersion, createdAt: plain.createdAt, integrity: plain.integrity }, ...payload };
  let replayCalls = 0;
  const service = new SecureReadingService({
    authUserResolver: async () => ({ id: 'user-a', status: 'active' }), transactionExecutor: { execute: async ({ operation }) => operation({}) },
    repositories: () => ({ birthProfiles: {}, entitlements: {}, readings: { getEncryptedReadingRecord: async () => encrypted, listEncryptedReadingRecordsForUser: async () => [encrypted] } }),
    readingCryptoCoordinator: { current: async () => ({ keyVersion: 'test-key', dek: Buffer.alloc(32, 7) }), forVersion: async () => ({ keyVersion: 'test-key', dek: Buffer.alloc(32, 7) }) },
    readingGenerator: { generate: async () => { throw new Error('not used'); } }, readingRecordFactory: () => { throw new Error('not used'); }, replayReading: async () => { replayCalls += 1; }, requiresEntitlement: () => false, idGenerator: () => 'unused', clock: () => '2026-08-20T00:00:00.000Z',
  });
  const detail = await service.getSecureReadingDetail({ principal: principal('subject-a'), readingId: plain.readingId });
  const list = await service.listSecureReadings({ principal: principal('subject-a') });
  assert.equal(detail.content.sections[0].items[0].sentence, 'Encrypted stored content.'); assert.deepEqual(list.map((item) => item.readingId), [plain.readingId]);
  assert.equal(JSON.stringify({ detail, list }).match(/ciphertext|nonce|keyVersion|userId/g), null); assert.equal(replayCalls, 0);
});
