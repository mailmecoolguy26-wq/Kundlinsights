'use strict';
const Fastify = require('fastify'); const cors = require('@fastify/cors'); const crypto = require('node:crypto'); const { mapApiError } = require('./api-error');
function required(value, name) { if (!value || typeof value !== 'object') throw new TypeError(`INVALID_${name}`); return value; }
function id(value, name) { if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value)) { const e = new Error(); e.code = `INVALID_${name}`; throw e; } return value; }
function dtoProfile(p) { return { id: p.id, displayLabel: p.displayLabel, birthData: p.birthData, status: p.status, createdAt: p.createdAt, updatedAt: p.updatedAt }; }
function dtoReading(r) { return { readingId: r.readingId, domain: r.domain || r.record && r.record.domain, engineProfileId: r.engineProfileId || r.record && r.record.engineProfileId, createdAt: r.createdAt || r.record && r.record.createdAt, status: r.status }; }
function createApi({ authVerifier, userResolver, birthProfileService, natalSummaryService = null, divisionalChartService = null, secureReadingService, placeResolutionService = null, entitlementService, requestIdGenerator = crypto.randomUUID, corsAllowlist = [], isReady = () => true, logger = false, bodyLimit = 16 * 1024 } = {}) {
  required(authVerifier, 'AUTH_VERIFIER'); if (typeof authVerifier.verifyRequest !== 'function') throw new TypeError('INVALID_AUTH_VERIFIER'); required(userResolver, 'USER_RESOLVER'); required(birthProfileService, 'BIRTH_PROFILE_SERVICE'); required(secureReadingService, 'SECURE_READING_SERVICE');
  if (!Array.isArray(corsAllowlist) || !corsAllowlist.every((origin) => typeof origin === 'string' && origin.startsWith('https://') && !origin.includes('*')) || typeof isReady !== 'function' || !Number.isInteger(bodyLimit) || bodyLimit < 1024 || bodyLimit > 16 * 1024) throw new TypeError('INVALID_API_RUNTIME_OPTIONS');
  const app = Fastify({ logger, bodyLimit, requestIdHeader: 'x-request-id', genReqId: () => requestIdGenerator() });
  app.register(cors, { origin: (origin, callback) => callback(null, !!origin && corsAllowlist.includes(origin)), methods: ['GET', 'POST'], allowedHeaders: ['authorization', 'content-type', 'idempotency-key'], exposedHeaders: ['x-request-id'], credentials: false, strictPreflight: true, logLevel: 'silent' });
  app.addHook('preHandler', async (request) => { if (request.routeOptions.url === '/health' || request.routeOptions.url === '/ready') return; request.principal = await authVerifier.verifyRequest(request); });
  app.setErrorHandler((error, request, reply) => { const out = mapApiError(error); reply.code(out.statusCode).send({ ...out.body, requestId: request.id }); });
  app.get('/health', async () => ({ status: 'ok' })); app.get('/ready', async (request, reply) => { if (!isReady()) { reply.code(503); return { status: 'not-ready' }; } return { status: 'ready' }; });
  app.get('/v1/me', async (request) => { const user = await userResolver.resolve(request.principal); return { user: { id: user.id, status: user.status }, requestId: request.id }; });
  if (placeResolutionService) {
    if (typeof placeResolutionService.search !== 'function' || typeof placeResolutionService.resolveBirthTime !== 'function') throw new TypeError('INVALID_PLACE_RESOLUTION_SERVICE');
    app.get('/v1/places/search', async (request) => ({ results: await placeResolutionService.search({ query: request.query && request.query.q }), requestId: request.id }));
    app.post('/v1/places/resolve-birth-time', async (request) => { const body = request.body || {}; const place = body.place || {}; return { birthData: await placeResolutionService.resolveBirthTime({ placeId: place.id, localDate: body.localDate, localTime: body.localTime }), requestId: request.id }; });
  }
  app.post('/v1/birth-profiles', async (request, reply) => { const body = request.body || {}; if (!body.birthData || typeof body !== 'object') { const e = new Error(); e.code = 'INVALID_BIRTH_PROFILE_INPUT'; throw e; } const created = await birthProfileService.create({ principal: request.principal, birthData: body.birthData, displayLabel: body.displayLabel == null ? null : String(body.displayLabel) }); reply.code(201); return { birthProfile: dtoProfile(created), requestId: request.id }; });
  app.get('/v1/birth-profiles', async (request) => ({ birthProfiles: (await birthProfileService.list({ principal: request.principal })).map(dtoProfile), requestId: request.id }));
  if (natalSummaryService) {
    if (typeof natalSummaryService.get !== 'function') throw new TypeError('INVALID_NATAL_SUMMARY_SERVICE');
    app.get('/v1/birth-profiles/:id/natal-summary', async (request) => ({ natalSummary: await natalSummaryService.get({ principal: request.principal, birthProfileId: id(request.params.id, 'BIRTH_PROFILE_ID') }), requestId: request.id }));
  }
  if (divisionalChartService) {
    if (typeof divisionalChartService.get !== 'function') throw new TypeError('INVALID_DIVISIONAL_CHART_SERVICE');
    for (const chartType of ['d9', 'd10']) {
      app.get(`/v1/birth-profiles/:id/divisional-charts/${chartType}`, async (request) => ({
        divisionalChart: await divisionalChartService.get({
          principal: request.principal,
          birthProfileId: id(request.params.id, 'BIRTH_PROFILE_ID'),
          chartType,
        }),
        requestId: request.id,
      }));
    }
  }
  app.get('/v1/birth-profiles/:id', async (request) => ({ birthProfile: dtoProfile(await birthProfileService.get({ principal: request.principal, birthProfileId: id(request.params.id, 'BIRTH_PROFILE_ID') })), requestId: request.id }));
  app.post('/v1/readings', async (request, reply) => { const body = request.body || {}; const key = request.headers['idempotency-key']; if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) { const e = new Error(); e.code = 'INVALID_IDEMPOTENCY_KEY'; throw e; } const reading = await secureReadingService.generateSecureReading({ principal: request.principal, birthProfileId: id(body.birthProfileId, 'BIRTH_PROFILE_ID'), domain: id(body.domain, 'READING_DOMAIN'), idempotencyKey: key, readingInstant: body.readingInstant, locale: body.locale }); reply.code(201); return { reading: dtoReading(reading), requestId: request.id }; });
  app.get('/v1/readings/:id', async (request) => ({ reading: dtoReading(await secureReadingService.getSecureReading({ principal: request.principal, readingId: id(request.params.id, 'READING_ID') })), requestId: request.id }));
  app.post('/v1/readings/:id/replay', async (request) => ({ replay: await secureReadingService.replaySecureReading({ principal: request.principal, readingId: id(request.params.id, 'READING_ID'), astronomicalRuntime: request.server.apiRuntime }), requestId: request.id }));
  if (entitlementService && typeof entitlementService.list === 'function') app.get('/v1/entitlements', async (request) => ({ entitlements: await entitlementService.list({ principal: request.principal }), requestId: request.id }));
  app.decorate('apiRuntime', null); return app;
}
module.exports = { createApi, createApiComposition: require('./create-api-composition').createApiComposition };
