'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { CareerReadingInterpreter, CAREER_READING_INTERPRETATION_SCHEMA_VERSION } = require('../../src/application/readings');
function context() { return { calibrationLevel: 'CALIBRATED', eventReferences: [], historicalEvidence: [], futureOccurrences: [], composites: [], calculationBasis: { hasProvisionalEvidence: false } }; }
function valid() { return { schemaVersion: CAREER_READING_INTERPRETATION_SCHEMA_VERSION, calibrationSummary: { calibrationLevel: 'CALIBRATED', narrative: 'No repeated pattern is available.', eventCount: 0 }, recurringHistoricalEvidence: [], upcomingRecurrenceWindows: [], decisionConsiderations: [], disclosure: { hasProvisionalEvidence: false } }; }
test('builds compact input, calls the mock generator once, and returns validated structured output', async () => { let calls = 0, received; const source = context(), interpreter = new CareerReadingInterpreter({ careerReadingContextBuilder: { build: async () => source }, generator: { generate: async ({ interpretationInput }) => { calls++; received = interpretationInput; return valid(); } } }); const out = await interpreter.interpret({ principal: {}, birthProfileId: 'p' }); assert.equal(calls, 1); assert.equal(out.schemaVersion, CAREER_READING_INTERPRETATION_SCHEMA_VERSION); assert.equal('patternKey' in received, false); assert.equal('provider' in received, false); });
test('treats zero Career Events as deterministic optional calibration and never calls the provider', async () => {
  const source = { calibrationLevel: 'NONE', eventReferences: [], historicalEvidence: [], futureOccurrences: [], composites: [], calculationBasis: { hasProvisionalEvidence: false } };
  let calls = 0;
  const interpreter = new CareerReadingInterpreter({
    careerReadingContextBuilder: { build: async () => source },
    generator: { generate: async () => { calls++; throw new Error('must not run'); } },
  });
  const output = await interpreter.interpret({ principal: {}, birthProfileId: 'profile-a' });
  assert.equal(calls, 0);
  assert.deepEqual(output.calibrationSummary, {
    calibrationLevel: 'NONE',
    narrative: 'No Career History has been added yet. Past Career Events can help personalize this interpretation further.',
    eventCount: 0,
  });
  assert.deepEqual(output.recurringHistoricalEvidence, []);
  assert.deepEqual(output.upcomingRecurrenceWindows, []);
});
test('fails closed without a second generation attempt and does not mutate inputs', async () => { let calls = 0; const source = Object.freeze(context()), bad = Object.freeze({ ...valid(), calibrationSummary: { ...valid().calibrationSummary, narrative: 'You will definitely get promoted.' } }); const interpreter = new CareerReadingInterpreter({ careerReadingContextBuilder: { build: async () => source }, generator: { generate: async () => { calls++; return bad; } } }); await assert.rejects(interpreter.interpret({}), (error) => error.code === 'READING_GENERATION_INVALID_OUTPUT'); assert.equal(calls, 1); assert.equal(bad.calibrationSummary.narrative, 'You will definitely get promoted.'); });
test('maps classified and unknown generator failures to generation failure',async()=>{for(const thrown of [Object.assign(new Error('safe'),{code:'READING_GENERATION_FAILED'}),new Error('unknown')]){const interpreter=new CareerReadingInterpreter({careerReadingContextBuilder:{build:async()=>context()},generator:{generate:async()=>{throw thrown;}}});await assert.rejects(()=>interpreter.interpret({}),e=>e.code==='READING_GENERATION_FAILED');}});
test('records a redacted interpreter failure boundary for a provider generation failure', async () => {
  const diagnostics = [];
  const providerFailure = Object.assign(new RangeError('READING_GENERATION_FAILED'), { code: 'READING_GENERATION_FAILED' });
  const interpreter = new CareerReadingInterpreter({ careerReadingContextBuilder: { build: async () => context() }, generator: { generate: async () => { throw providerFailure; } } });
  await assert.rejects(() => interpreter.interpretContext(context(), { diagnosticLog: (entry) => diagnostics.push(entry) }), (error) => error.code === 'READING_GENERATION_FAILED');
  const failure = diagnostics.find((entry) => entry.event === 'CAREER_READING_INTERPRETER_STEP' && entry.step === 'BUILD_FINAL_READING' && entry.status === 'FAILED');
  assert.deepEqual(failure && { event: failure.event, step: failure.step, status: failure.status, errorClass: failure.errorClass, errorMessage: failure.errorMessage }, { event: 'CAREER_READING_INTERPRETER_STEP', step: 'BUILD_FINAL_READING', status: 'FAILED', errorClass: 'RangeError', errorMessage: 'READING_GENERATION_FAILED' });
  assert.ok(Array.isArray(failure.stackFrames) && failure.stackFrames.length <= 3);
  assert.equal(JSON.stringify(diagnostics).includes('test-secret'), false);
});
