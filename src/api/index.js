'use strict';
const Fastify = require('fastify'); const cors = require('@fastify/cors'); const crypto = require('node:crypto'); const { mapApiError } = require('./api-error');
function required(value, name) { if (!value || typeof value !== 'object') throw new TypeError(`INVALID_${name}`); return value; }
function id(value, name) { if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value)) { const e = new Error(); e.code = `INVALID_${name}`; throw e; } return value; }
function careerReadingDomain(value) { const domain = id(value, 'READING_DOMAIN'); if (domain !== 'CAREER') { const e = new Error(); e.code = 'INVALID_READING_DOMAIN'; throw e; } return domain; }
function dtoProfile(p) { return { id: p.id, displayLabel: p.displayLabel, birthData: p.birthData, status: p.status, createdAt: p.createdAt, updatedAt: p.updatedAt }; }
function dtoReading(r) { return { readingId: r.readingId, domain: r.domain || r.record && r.record.domain, engineProfileId: r.engineProfileId || r.record && r.record.engineProfileId, createdAt: r.createdAt || r.record && r.record.createdAt, status: r.status }; }
function dtoReadingSummary(reading) { return { readingId: reading.readingId, birthProfileId: reading.birthProfileId, domain: reading.domain, status: reading.status, createdAt: reading.createdAt, readingInstant: reading.readingInstant, locale: reading.locale }; }
function dtoReadingDetail(reading) { return { ...dtoReadingSummary(reading), content: reading.content === undefined ? null : reading.content, ...(reading.calibratedContent === undefined ? {} : { calibratedContent: reading.calibratedContent }) }; }
function createApi({ authVerifier, userResolver, birthProfileService, careerEventService = null, careerEventAstrologyService = null, natalSummaryService = null, divisionalChartService = null, vimshottariService = null, transitSnapshotService = null, ashtakavargaService = null, secureReadingService, purchaseService = null, appleNotificationService = null, googleRtdnService = null, placeResolutionService = null, entitlementService, requestIdGenerator = crypto.randomUUID, corsAllowlist = [], isReady = () => true, logger = false, bodyLimit = 16 * 1024 } = {}) {
  required(authVerifier, 'AUTH_VERIFIER'); if (typeof authVerifier.verifyRequest !== 'function') throw new TypeError('INVALID_AUTH_VERIFIER'); required(userResolver, 'USER_RESOLVER'); required(birthProfileService, 'BIRTH_PROFILE_SERVICE'); required(secureReadingService, 'SECURE_READING_SERVICE');
  if (!Array.isArray(corsAllowlist) || !corsAllowlist.every((origin) => typeof origin === 'string' && origin.startsWith('https://') && !origin.includes('*')) || typeof isReady !== 'function' || !Number.isInteger(bodyLimit) || bodyLimit < 1024 || bodyLimit > 16 * 1024) throw new TypeError('INVALID_API_RUNTIME_OPTIONS');
  const app = Fastify({ logger, bodyLimit, requestIdHeader: 'x-request-id', genReqId: () => requestIdGenerator() });
  app.register(cors, { origin: (origin, callback) => callback(null, !!origin && corsAllowlist.includes(origin)), methods: ['GET', 'POST', 'PATCH', 'DELETE'], allowedHeaders: ['authorization', 'content-type', 'idempotency-key'], exposedHeaders: ['x-request-id'], credentials: false, strictPreflight: true, logLevel: 'silent' });
  app.addHook('preHandler', async (request) => { if (request.routeOptions.url === '/health' || request.routeOptions.url === '/ready' || request.routeOptions.url === '/v1/webhooks/apple' || request.routeOptions.url === '/v1/webhooks/google') return; request.principal = await authVerifier.verifyRequest(request); });
  app.setErrorHandler((error, request, reply) => { const out = mapApiError(error); reply.code(out.statusCode).send({ ...out.body, requestId: request.id }); });
  app.get('/health', async () => ({ status: 'ok' })); app.get('/ready', async (request, reply) => { if (!isReady()) { reply.code(503); return { status: 'not-ready' }; } return { status: 'ready' }; });
  app.get('/v1/me', async (request) => { const user = await userResolver.resolve(request.principal); return { user: { id: user.id, status: user.status }, requestId: request.id }; });
  app.get('/v1/me/entitlements', async (request) => {
    if (typeof secureReadingService.getReadingEntitlementStatus !== 'function') throw new TypeError('INVALID_SECURE_READING_SERVICE');
    return { entitlements: await secureReadingService.getReadingEntitlementStatus({ principal: request.principal, birthProfileId: id(request.query && request.query.birthProfileId, 'BIRTH_PROFILE_ID') }), requestId: request.id };
  });
  if (purchaseService) {
    app.post('/v1/purchases/verify', async (request) => ({ ...await purchaseService.verify({ principal: request.principal, body: request.body || {} }), requestId: request.id }));
    app.post('/v1/purchases/restore', async (request) => ({ ...await purchaseService.restore({ principal: request.principal, body: request.body || {} }), requestId: request.id }));
    app.get('/v1/me/purchases', async (request) => ({ purchases: await purchaseService.list({ principal: request.principal }), requestId: request.id }));
  }
  if (appleNotificationService) {
    if (typeof appleNotificationService.handle !== 'function') throw new TypeError('INVALID_APPLE_NOTIFICATION_SERVICE');
    app.post('/v1/webhooks/apple', async (request) => appleNotificationService.handle({ signedPayload: request.body && request.body.signedPayload }));
  }
  if (googleRtdnService) {
    if (typeof googleRtdnService.handle !== 'function') throw new TypeError('INVALID_GOOGLE_RTND_SERVICE');
    app.post('/v1/webhooks/google', async (request) => googleRtdnService.handle({ request, envelope: request.body }));
  }
  if (placeResolutionService) {
    if (typeof placeResolutionService.search !== 'function' || typeof placeResolutionService.resolveBirthTime !== 'function') throw new TypeError('INVALID_PLACE_RESOLUTION_SERVICE');
    app.get('/v1/places/search', async (request) => ({ results: await placeResolutionService.search({ query: request.query && request.query.q }), requestId: request.id }));
    app.post('/v1/places/resolve-birth-time', async (request) => { const body = request.body || {}; const place = body.place || {}; return { birthData: await placeResolutionService.resolveBirthTime({ placeId: place.id, localDate: body.localDate, localTime: body.localTime }), requestId: request.id }; });
  }
  app.post('/v1/birth-profiles', async (request, reply) => { const body = request.body || {}; if (!body.birthData || typeof body !== 'object') { const e = new Error(); e.code = 'INVALID_BIRTH_PROFILE_INPUT'; throw e; } const created = await birthProfileService.create({ principal: request.principal, birthData: body.birthData, displayLabel: body.displayLabel == null ? null : String(body.displayLabel) }); reply.code(201); return { birthProfile: dtoProfile(created), requestId: request.id }; });
  app.get('/v1/birth-profiles', async (request) => ({ birthProfiles: (await birthProfileService.list({ principal: request.principal })).map(dtoProfile), requestId: request.id }));
  if (careerEventService) {
    for (const method of ['create', 'list', 'update', 'remove']) if (typeof careerEventService[method] !== 'function') throw new TypeError('INVALID_CAREER_EVENT_SERVICE');
    app.post('/v1/birth-profiles/:id/career-events', async (request, reply) => { const careerEvent = await careerEventService.create({ principal: request.principal, birthProfileId: id(request.params.id, 'BIRTH_PROFILE_ID'), body: request.body || {} }); reply.code(201); return { careerEvent, requestId: request.id }; });
    app.get('/v1/birth-profiles/:id/career-events', async (request) => ({ careerEvents: await careerEventService.list({ principal: request.principal, birthProfileId: id(request.params.id, 'BIRTH_PROFILE_ID') }), requestId: request.id }));
    app.patch('/v1/birth-profiles/:id/career-events/:eventId', async (request) => ({ careerEvent: await careerEventService.update({ principal: request.principal, birthProfileId: id(request.params.id, 'BIRTH_PROFILE_ID'), eventId: id(request.params.eventId, 'CAREER_EVENT_ID'), body: request.body || {} }), requestId: request.id }));
    app.delete('/v1/birth-profiles/:id/career-events/:eventId', async (request) => ({ careerEvent: await careerEventService.remove({ principal: request.principal, birthProfileId: id(request.params.id, 'BIRTH_PROFILE_ID'), eventId: id(request.params.eventId, 'CAREER_EVENT_ID') }), requestId: request.id }));
    if (careerEventAstrologyService) app.get('/v1/birth-profiles/:id/career-events/:eventId/astrology', async (request) => ({ careerEvent: await careerEventService.get({ principal:request.principal,birthProfileId:id(request.params.id,'BIRTH_PROFILE_ID'),eventId:id(request.params.eventId,'CAREER_EVENT_ID') }), astrologySnapshot: await careerEventAstrologyService.get({ principal:request.principal,birthProfileId:id(request.params.id,'BIRTH_PROFILE_ID'),eventId:id(request.params.eventId,'CAREER_EVENT_ID') }), requestId:request.id }));
  }
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
  if (vimshottariService) {
    if (typeof vimshottariService.current !== 'function' || typeof vimshottariService.timeline !== 'function') throw new TypeError('INVALID_VIMSHOTTARI_SERVICE');
    app.get('/v1/birth-profiles/:id/vimshottari', async (request) => ({ vimshottari: await vimshottariService.current({ principal: request.principal, birthProfileId: id(request.params.id, 'BIRTH_PROFILE_ID'), at: request.query.at }), requestId: request.id }));
    app.get('/v1/birth-profiles/:id/vimshottari/timeline', async (request) => ({ vimshottariTimeline: await vimshottariService.timeline({ principal: request.principal, birthProfileId: id(request.params.id, 'BIRTH_PROFILE_ID'), from: request.query.from, to: request.query.to, level: request.query.level }), requestId: request.id }));
  }
  if (transitSnapshotService) {
    if (typeof transitSnapshotService.get !== 'function') throw new TypeError('INVALID_TRANSIT_SNAPSHOT_SERVICE');
    app.get('/v1/birth-profiles/:id/transits', async (request) => ({
      transitSnapshot: await transitSnapshotService.get({
        principal: request.principal,
        birthProfileId: id(request.params.id, 'BIRTH_PROFILE_ID'),
        at: request.query.at,
      }),
      requestId: request.id,
    }));
  }
  if (ashtakavargaService) { if (typeof ashtakavargaService.get !== 'function') throw new TypeError('INVALID_ASHTAKAVARGA_SERVICE'); app.get('/v1/birth-profiles/:id/ashtakavarga', async (request) => ({ ashtakavarga: await ashtakavargaService.get({ principal:request.principal,birthProfileId:id(request.params.id,'BIRTH_PROFILE_ID') }), requestId:request.id })); }
  app.get('/v1/birth-profiles/:id', async (request) => ({ birthProfile: dtoProfile(await birthProfileService.get({ principal: request.principal, birthProfileId: id(request.params.id, 'BIRTH_PROFILE_ID') })), requestId: request.id }));
  app.post('/v1/readings', async (request, reply) => { const body = request.body || {}; const key = request.headers['idempotency-key']; if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) { const e = new Error(); e.code = 'INVALID_IDEMPOTENCY_KEY'; throw e; } const reading = await secureReadingService.generateSecureReading({ principal: request.principal, birthProfileId: id(body.birthProfileId, 'BIRTH_PROFILE_ID'), domain: careerReadingDomain(body.domain), idempotencyKey: key }); reply.code(201); return { reading: dtoReading(reading), requestId: request.id }; });
  app.get('/v1/readings', async (request) => ({ readings: (await secureReadingService.listSecureReadings({ principal: request.principal, birthProfileId: request.query.birthProfileId })).map(dtoReadingSummary), requestId: request.id }));
  app.get('/v1/readings/:id', async (request) => {
    if (typeof secureReadingService.getSecureReadingDetail !== 'function') throw new TypeError('INVALID_SECURE_READING_SERVICE');
    return { reading: dtoReadingDetail(await secureReadingService.getSecureReadingDetail({ principal: request.principal, readingId: id(request.params.id, 'READING_ID') })), requestId: request.id };
  });
  app.post('/v1/readings/:id/replay', async (request) => ({ replay: await secureReadingService.replaySecureReading({ principal: request.principal, readingId: id(request.params.id, 'READING_ID'), astronomicalRuntime: request.server.apiRuntime }), requestId: request.id }));
  if (entitlementService && typeof entitlementService.list === 'function') app.get('/v1/entitlements', async (request) => ({ entitlements: await entitlementService.list({ principal: request.principal }), requestId: request.id }));
  app.decorate('apiRuntime', null); return app;
}
module.exports = { createApi, createApiComposition: require('./create-api-composition').createApiComposition };
