'use strict';

const { repositoryError, immutableCopy } = require('../../persistence/contracts');

const OPENAI_RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
const DEFAULT_TIMEOUT_MILLISECONDS = 15000;
const DEFAULT_MAX_OUTPUT_TOKENS = 2000;
const CAREER_OUTPUT_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  required: ['schemaVersion', 'calibrationSummary', 'recurringHistoricalEvidence', 'upcomingRecurrenceWindows', 'decisionConsiderations', 'disclosure'],
  properties: {
    schemaVersion: { type: 'string', const: 'career-reading-interpretation-schema-v1' },
    calibrationSummary: { type: 'object' }, recurringHistoricalEvidence: { type: 'array' }, upcomingRecurrenceWindows: { type: 'array' }, decisionConsiderations: { type: 'array', items: { type: 'string' } }, disclosure: { type: 'object' },
  },
});
function fail(category, status, requestId) { const error = repositoryError('READING_GENERATION_FAILED'); error.provider = 'openai'; error.category = category; if (Number.isInteger(status)) error.httpStatus = status; if (typeof requestId === 'string' && requestId) error.providerRequestId = requestId; throw error; }
function validText(value) { return typeof value === 'string' && value.length > 0; }
function extract(response) {
  if (!response || response.status !== 'completed' || response.refusal) return null;
  if (response.output_parsed && typeof response.output_parsed === 'object' && !Array.isArray(response.output_parsed)) return response.output_parsed;
  const messages = (response.output || []).filter((item) => item && item.type === 'message');
  if (messages.length !== 1) return null;
  const content = (messages[0].content || []).filter((item) => item && item.type === 'output_text' && validText(item.text));
  if (content.length !== 1) return null;
  try { const parsed = JSON.parse(content[0].text); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null; } catch { return null; }
}
class OpenAICareerGenerationAdapter {
  constructor({ apiKey, model, fetchImplementation = globalThis.fetch, timeoutMilliseconds = DEFAULT_TIMEOUT_MILLISECONDS, maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS, endpoint = OPENAI_RESPONSES_ENDPOINT } = {}) {
    if (!validText(apiKey) || !validText(model) || typeof fetchImplementation !== 'function' || !Number.isInteger(timeoutMilliseconds) || timeoutMilliseconds < 100 || timeoutMilliseconds > 30000 || !Number.isInteger(maxOutputTokens) || maxOutputTokens < 1500 || maxOutputTokens > 3000 || endpoint !== OPENAI_RESPONSES_ENDPOINT) throw new TypeError('INVALID_OPENAI_CAREER_GENERATION_ADAPTER');
    this.apiKey = apiKey; this.model = model; this.fetch = fetchImplementation; this.timeoutMilliseconds = timeoutMilliseconds; this.maxOutputTokens = maxOutputTokens; this.endpoint = endpoint; Object.freeze(this);
  }
  async generate({ prompt } = {}) {
    if (!prompt || prompt.version !== 'career-reading-prompt-v1' || !validText(prompt.instructions) || !prompt.input || typeof prompt.input !== 'object') fail('invalid_prompt');
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.timeoutMilliseconds); let response;
    try { response = await this.fetch(this.endpoint, { method: 'POST', headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ model: this.model, instructions: prompt.instructions, input: JSON.stringify(prompt.input), max_output_tokens: this.maxOutputTokens, store: false, text: { format: { type: 'json_schema', name: 'career_reading_interpretation', strict: false, schema: CAREER_OUTPUT_SCHEMA } } }) }); } catch { fail(controller.signal.aborted ? 'timeout' : 'network'); } finally { clearTimeout(timer); }
    const requestId = response && response.headers && typeof response.headers.get === 'function' ? response.headers.get('x-request-id') : undefined;
    if (!response || !response.ok) fail(response && response.status === 401 || response && response.status === 403 ? 'authentication' : response && response.status === 429 ? 'rate_limit' : 'provider', response && response.status, requestId);
    let body; try { body = await response.json(); } catch { fail('malformed_response', undefined, requestId); }
    const candidate = extract(body); if (!candidate) fail(body && body.refusal ? 'refusal' : 'empty_or_malformed_output', undefined, requestId);
    return immutableCopy(candidate);
  }
}
module.exports = { OpenAICareerGenerationAdapter, OPENAI_RESPONSES_ENDPOINT, DEFAULT_TIMEOUT_MILLISECONDS, DEFAULT_MAX_OUTPUT_TOKENS, CAREER_OUTPUT_SCHEMA };
