'use strict';

const { repositoryError, immutableCopy } = require('../../persistence/contracts');

const OPENAI_RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
const DEFAULT_TIMEOUT_MILLISECONDS = 15000;
const DEFAULT_MAX_OUTPUT_TOKENS = 3000;
const nullableString = Object.freeze({ type: ['string', 'null'] });
const nullableInteger = Object.freeze({
  type: ['integer', 'null'],
  minimum: 0,
});
const eventDateReferenceSchema = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['eventId', 'precision', 'year', 'month', 'day'],
  properties: {
    eventId: { type: 'string' },
    precision: { type: 'string', enum: ['YEAR', 'MONTH', 'DAY'] },
    year: { type: 'integer' },
    month: { type: ['integer', 'null'], minimum: 1, maximum: 12 },
    day: { type: ['integer', 'null'], minimum: 1, maximum: 31 },
  },
});
const historicalEvidenceSchema = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: [
    'evidenceId',
    'text',
    'matchedEventCount',
    'eligibleEventCount',
    'recurrenceRate',
    'eventDateReferences',
    'factorsReferenced',
  ],
  properties: {
    evidenceId: { type: 'string' },
    text: { type: 'string' },
    matchedEventCount: nullableInteger,
    eligibleEventCount: nullableInteger,
    recurrenceRate: { type: ['number', 'null'], minimum: 0 },
    eventDateReferences: {
      type: ['array', 'null'],
      items: eventDateReferenceSchema,
    },
    factorsReferenced: { type: 'array', items: { type: 'string' } },
  },
});
const futureEvidenceSchema = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: [
    'evidenceId',
    'text',
    'occurrenceType',
    'from',
    'to',
    'instant',
    'factorsReferenced',
  ],
  properties: {
    evidenceId: { type: 'string' },
    text: { type: 'string' },
    occurrenceType: {
      type: 'string',
      enum: ['EVENT', 'WINDOW', 'COMPOSITE'],
    },
    from: nullableString,
    to: nullableString,
    instant: nullableString,
    factorsReferenced: { type: 'array', items: { type: 'string' } },
  },
});
const CAREER_OUTPUT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaVersion',
    'calibrationSummary',
    'recurringHistoricalEvidence',
    'upcomingRecurrenceWindows',
    'decisionConsiderations',
    'disclosure',
  ],
  properties: {
    schemaVersion: {
      type: 'string',
      const: 'career-reading-interpretation-schema-v1',
    },
    calibrationSummary: {
      type: 'object',
      additionalProperties: false,
      required: ['calibrationLevel', 'narrative', 'eventCount'],
      properties: {
        calibrationLevel: {
          type: 'string',
          enum: ['NONE', 'LIMITED', 'CALIBRATED'],
        },
        narrative: { type: 'string' },
        eventCount: nullableInteger,
      },
    },
    recurringHistoricalEvidence: {
      type: 'array',
      items: historicalEvidenceSchema,
    },
    upcomingRecurrenceWindows: {
      type: 'array',
      items: futureEvidenceSchema,
    },
    decisionConsiderations: {
      type: 'array',
      maxItems: 5,
      items: { type: 'string' },
    },
    disclosure: {
      type: 'object',
      additionalProperties: false,
      required: ['hasProvisionalEvidence'],
      properties: { hasProvisionalEvidence: { type: 'boolean' } },
    },
  },
});
function fail(category, status, requestId, extractionReasonCode) { const error = repositoryError('READING_GENERATION_FAILED'); error.provider = 'openai'; error.category = category; if (Number.isInteger(status)) error.httpStatus = status; if (typeof requestId === 'string' && requestId) error.providerRequestId = requestId; if (typeof extractionReasonCode === 'string') error.extractionReasonCode = extractionReasonCode; throw error; }
function validText(value) { return typeof value === 'string' && value.length > 0; }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function safeResponseMetadata(response, requestId) {
  const output = Array.isArray(response && response.output) ? response.output : [];
  const messages = output.filter((item) => item && item.type === 'message');
  const content = messages.flatMap((item) => Array.isArray(item.content) ? item.content : []);
  const usage = object(response && response.usage) ? response.usage : {};
  const outputDetails = object(usage.output_tokens_details) ? usage.output_tokens_details : {};
  return Object.freeze({
    responseStatus: typeof (response && response.status) === 'string' ? response.status : null,
    hasTopLevelRefusal: Boolean(response && response.refusal),
    incompleteReason: typeof (response && response.incomplete_details && response.incomplete_details.reason) === 'string' ? response.incomplete_details.reason : null,
    outputItemCount: output.length,
    outputItemTypes: output.map((item) => typeof (item && item.type) === 'string' ? item.type : 'unknown'),
    messageItemCount: messages.length,
    contentItemTypes: content.map((item) => typeof (item && item.type) === 'string' ? item.type : 'unknown'),
    hasOutputParsed: object(response && response.output_parsed) || content.some((item) => object(item && item.parsed)),
    providerRequestId: typeof requestId === 'string' && requestId ? requestId : null,
    inputTokens: Number.isInteger(usage.input_tokens) ? usage.input_tokens : null,
    outputTokens: Number.isInteger(usage.output_tokens) ? usage.output_tokens : null,
    reasoningTokens: Number.isInteger(outputDetails.reasoning_tokens) ? outputDetails.reasoning_tokens : null,
    totalTokens: Number.isInteger(usage.total_tokens) ? usage.total_tokens : null,
  });
}
function extract(response) {
  if (!object(response)) return { candidate: null, reasonCode: 'NO_PARSED_OUTPUT' };
  if (response.status === 'incomplete') return { candidate: null, reasonCode: 'PROVIDER_INCOMPLETE' };
  if (response.status !== 'completed') return { candidate: null, reasonCode: 'PROVIDER_INCOMPLETE' };
  if (response.refusal) return { candidate: null, reasonCode: 'PROVIDER_REFUSAL' };
  if (object(response.output_parsed)) return { candidate: response.output_parsed, reasonCode: null };
  const messages = (Array.isArray(response.output) ? response.output : []).filter((item) => item && item.type === 'message');
  if (messages.length === 0) return { candidate: null, reasonCode: 'NO_OUTPUT_MESSAGE' };
  if (messages.length > 1) return { candidate: null, reasonCode: 'MULTIPLE_OUTPUT_MESSAGES' };
  const content = Array.isArray(messages[0].content) ? messages[0].content : [];
  if (content.some((item) => item && item.type === 'refusal')) return { candidate: null, reasonCode: 'PROVIDER_REFUSAL' };
  const parsedContent = content.filter((item) => item && item.type === 'output_text' && object(item.parsed));
  if (parsedContent.length === 1) return { candidate: parsedContent[0].parsed, reasonCode: null };
  const outputText = content.filter((item) => item && item.type === 'output_text' && validText(item.text));
  if (outputText.length === 0) return { candidate: null, reasonCode: 'NO_OUTPUT_TEXT' };
  if (outputText.length > 1) return { candidate: null, reasonCode: 'MULTIPLE_OUTPUT_TEXT' };
  try {
    const parsed = JSON.parse(outputText[0].text);
    return object(parsed) ? { candidate: parsed, reasonCode: null } : { candidate: null, reasonCode: 'NO_PARSED_OUTPUT' };
  } catch {
    return { candidate: null, reasonCode: 'INVALID_JSON_OUTPUT' };
  }
}
class OpenAICareerGenerationAdapter {
  constructor({ apiKey, model, fetchImplementation = globalThis.fetch, timeoutMilliseconds = DEFAULT_TIMEOUT_MILLISECONDS, maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS, endpoint = OPENAI_RESPONSES_ENDPOINT } = {}) {
    if (!validText(apiKey) || !validText(model) || typeof fetchImplementation !== 'function' || !Number.isInteger(timeoutMilliseconds) || timeoutMilliseconds < 100 || timeoutMilliseconds > 30000 || !Number.isInteger(maxOutputTokens) || maxOutputTokens < 1500 || maxOutputTokens > 3000 || endpoint !== OPENAI_RESPONSES_ENDPOINT) throw new TypeError('INVALID_OPENAI_CAREER_GENERATION_ADAPTER');
    this.apiKey = apiKey; this.model = model; this.fetch = fetchImplementation; this.timeoutMilliseconds = timeoutMilliseconds; this.maxOutputTokens = maxOutputTokens; this.endpoint = endpoint; Object.freeze(this);
  }
  async generate({ prompt, diagnosticLog = null } = {}) {
    if (!prompt || prompt.version !== 'career-reading-prompt-v1' || !validText(prompt.instructions) || !prompt.input || typeof prompt.input !== 'object') fail('invalid_prompt');
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.timeoutMilliseconds); let response;
    if (typeof diagnosticLog === 'function') diagnosticLog({ event: 'CAREER_READING_INTERPRETER_STEP', step: 'PROVIDER_REQUEST', status: 'STARTED' });
    try { response = await this.fetch(this.endpoint, { method: 'POST', headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ model: this.model, instructions: prompt.instructions, input: JSON.stringify(prompt.input), max_output_tokens: this.maxOutputTokens, store: false, text: { format: { type: 'json_schema', name: 'career_reading_interpretation', strict: true, schema: CAREER_OUTPUT_SCHEMA } } }) }); } catch { clearTimeout(timer); if (typeof diagnosticLog === 'function') diagnosticLog({ event: 'CAREER_READING_INTERPRETER_STEP', step: controller.signal.aborted ? 'PROVIDER_TIMEOUT' : 'PROVIDER_NETWORK', status: 'FAILED' }); fail(controller.signal.aborted ? 'timeout' : 'network'); }
    const requestId = response && response.headers && typeof response.headers.get === 'function' ? response.headers.get('x-request-id') : undefined;
    if (!response || !response.ok) { clearTimeout(timer); const category = response && response.status === 401 || response && response.status === 403 ? 'authentication' : response && response.status === 429 ? 'rate_limit' : 'provider'; if (typeof diagnosticLog === 'function') diagnosticLog({ event: 'CAREER_READING_INTERPRETER_STEP', step: category === 'authentication' ? 'PROVIDER_AUTHENTICATION' : category === 'rate_limit' ? 'PROVIDER_RATE_LIMIT' : 'PROVIDER_RESPONSE', status: 'FAILED' }); fail(category, response && response.status, requestId); }
    if (typeof diagnosticLog === 'function') diagnosticLog({ event: 'CAREER_READING_INTERPRETER_STEP', step: 'PROVIDER_RESPONSE', status: 'SUCCEEDED' });
    let body; try { body = await response.json(); } catch { clearTimeout(timer); if (typeof diagnosticLog === 'function') diagnosticLog({ event: 'CAREER_READING_INTERPRETER_STEP', step: controller.signal.aborted ? 'PROVIDER_TIMEOUT' : 'PARSE_PROVIDER_RESPONSE', status: 'FAILED' }); fail(controller.signal.aborted ? 'timeout' : 'malformed_response', undefined, requestId); } finally { clearTimeout(timer); }
    if (typeof diagnosticLog === 'function') diagnosticLog({ event: 'CAREER_READING_INTERPRETER_STEP', step: 'PARSE_PROVIDER_RESPONSE', status: 'SUCCEEDED' });
    const metadata = safeResponseMetadata(body, requestId);
    if (typeof diagnosticLog === 'function') diagnosticLog({ event: 'CAREER_PROVIDER_RESPONSE_METADATA', ...metadata });
    const extraction = extract(body);
    if (!extraction.candidate) {
      const incompleteReason = metadata.incompleteReason;
      const category = extraction.reasonCode === 'PROVIDER_REFUSAL'
        ? 'refusal'
        : extraction.reasonCode === 'PROVIDER_INCOMPLETE' && incompleteReason === 'max_output_tokens'
          ? 'max_output_tokens'
          : extraction.reasonCode === 'PROVIDER_INCOMPLETE'
            ? 'incomplete'
            : 'empty_or_malformed_output';
      if (typeof diagnosticLog === 'function') diagnosticLog({ event: 'CAREER_READING_INTERPRETER_STEP', step: extraction.reasonCode === 'PROVIDER_REFUSAL' ? 'PROVIDER_REFUSAL' : 'EXTRACT_PROVIDER_OUTPUT', status: 'FAILED', extractionReasonCode: extraction.reasonCode });
      fail(category, undefined, requestId, extraction.reasonCode);
    }
    if (typeof diagnosticLog === 'function') diagnosticLog({ event: 'CAREER_READING_INTERPRETER_STEP', step: 'EXTRACT_PROVIDER_OUTPUT', status: 'SUCCEEDED' });
    return immutableCopy(extraction.candidate);
  }
}
module.exports = { OpenAICareerGenerationAdapter, OPENAI_RESPONSES_ENDPOINT, DEFAULT_TIMEOUT_MILLISECONDS, DEFAULT_MAX_OUTPUT_TOKENS, CAREER_OUTPUT_SCHEMA, extract, safeResponseMetadata };
