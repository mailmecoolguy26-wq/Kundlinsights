'use strict';

const { OpenAICareerChatRenderer } = require('../src/infrastructure/ai/openai-career-chat-renderer');

const fixture = process.argv[2] || 'insufficient';
const enabled = process.env.CAREER_CHAT_LLM_ENABLED === 'true';
const key = process.env.CAREER_CHAT_OPENAI_API_KEY;
const model = process.env.CAREER_CHAT_OPENAI_MODEL;
if (!enabled || !key || !model) {
  console.error('Career Chat renderer smoke test requires enabled provider configuration.');
  process.exitCode = 2;
  return;
}
const fixtures = Object.freeze({
  insufficient: { language: 'HINGLISH', userQuestion: 'meri job chali gayi hai new job kab tak lagegi', intent: 'NEXT_JOB_TIMING', answerability: 'INSUFFICIENT_EVIDENCE', headlineFact: 'Available Career timing evidence is insufficient.', timingWindows: [], evidenceSummary: [], caveats: [], followUpOptions: ['Show my next Career timing window'], prohibitedClaims: ['EXACT_JOB_DATE', 'GUARANTEED_JOB', 'PROBABILITY'] },
  supported: { language: 'ENGLISH', userQuestion: 'What is my next Career timing window?', intent: 'NEXT_JOB_TIMING', answerability: 'SUPPORTED', headlineFact: 'A relevant Career period is available.', timingWindows: [{ start: '2026-10-15T00:00:00.000Z', end: '2026-11-30T00:00:00.000Z' }], evidenceSummary: ['A supplied Career timing window is available.'], caveats: ['This does not guarantee an outcome.'], followUpOptions: ['Compare current vs upcoming Career period'], prohibitedClaims: ['EXACT_JOB_DATE', 'GUARANTEED_JOB', 'PROBABILITY'] },
});
const input = fixtures[fixture];
if (!input) { console.error('Use synthetic fixture: insufficient or supported.'); process.exitCode = 2; }
else (async () => { const started = Date.now(); const result = await new OpenAICareerChatRenderer({ apiKey: key, model }).renderAnswerWithDiagnostics({ input }); console.log(JSON.stringify({ fixture, model, providerRendered: result.answer !== null, latencyMilliseconds: Date.now() - started, ...result.diagnostic, renderedAnswer: result.answer }, null, 2)); })().catch(() => { console.error('Career Chat renderer smoke test failed safely.'); process.exitCode = 1; });
