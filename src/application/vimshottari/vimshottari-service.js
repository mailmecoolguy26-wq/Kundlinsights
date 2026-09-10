'use strict';

const { calculateVimshottariDasha, SOLAR_RETURN_VIMSHOTTARI_RULESET } = require('../../dasha');
const { findActiveAt } = require('../../dasha/timeline-builder');
const { repositoryError } = require('../../persistence/contracts');
const { toCurrentVimshottariDto, toTimelineVimshottariDto } = require('./vimshottari-dto');
const { adaptDashaInsight } = require('./dasha-insight-adapter');
const { adaptDashaPeriodInsight } = require('./dasha-period-insight-adapter');
const { resolveMahadashaByStart, resolveAntardashaByStart, resolvePratyantarByStart, contained } = require('./vimshottari-parent-scope');

const MAX_TIMELINE_WINDOW_MILLISECONDS = 1_827 * 86_400_000;
const LEVELS = Object.freeze(new Set(['md', 'ad', 'pd']));

function fail(code) { throw repositoryError(code); }

function birthRequest(birth) {
  return {
    date: birth.localDate,
    time: birth.localTime,
    timezone: birth.timezone,
    latitude: birth.latitude,
    longitude: birth.longitude,
  };
}

function parseUtcInstant(value, code = 'INVALID_VIMSHOTTARI_INSTANT') {
  const match = typeof value === 'string' &&
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/.exec(value);
  if (!match) {
    fail(code);
  }
  const epoch = Date.parse(value);
  if (!Number.isSafeInteger(epoch)) fail(code);
  const utc = new Date(epoch).toISOString();
  const canonicalInput = `${match[1]}.${(match[2] || '').padEnd(3, '0')}Z`;
  if (utc !== canonicalInput) fail(code);
  return Object.freeze({ epochMilliseconds: BigInt(epoch), utc });
}

function intervalOverlaps(period, from, to) {
  return BigInt(period.startInstant.epochMilliseconds) < to.epochMilliseconds &&
      BigInt(period.endInstant.epochMilliseconds) > from.epochMilliseconds;
}

function periodsAtLevel(periods, level) {
  if (level === 'md') return periods.map((period) => ({ period, mahadasha: null, antardasha: null }));
  if (level === 'ad') return periods.flatMap((mahadasha) =>
    mahadasha.children.map((period) => ({ period, mahadasha, antardasha: null })));
  return periods.flatMap((mahadasha) => mahadasha.children.flatMap((antardasha) =>
    antardasha.children.map((period) => ({ period, mahadasha, antardasha }))));
}

function statusAt(period, at) {
  const start = BigInt(period.startInstant.epochMilliseconds); const end = BigInt(period.endInstant.epochMilliseconds);
  return at < start ? 'UPCOMING' : at >= end ? 'PAST' : 'CURRENT';
}

class VimshottariService {
  constructor({ birthProfileService, astronomicalEngine, canonicalSiderealSunSampler, careerInsightSource = null, clock = () => new Date().toISOString() } = {}) {
    if (!birthProfileService || typeof birthProfileService.get !== 'function') {
      throw new TypeError('VimshottariService requires SecureBirthProfileService.get.');
    }
    if (!astronomicalEngine || typeof astronomicalEngine.calculate !== 'function') {
      throw new TypeError('VimshottariService requires an injected astronomicalEngine.');
    }
    if (!canonicalSiderealSunSampler ||
        typeof canonicalSiderealSunSampler.sampleCanonicalSiderealSun !== 'function') {
      throw new TypeError('VimshottariService requires canonicalSiderealSunSampler.');
    }
    this.birthProfileService = birthProfileService;
    this.astronomicalEngine = astronomicalEngine;
    this.canonicalSiderealSunSampler = canonicalSiderealSunSampler;
    if (careerInsightSource && typeof careerInsightSource.latestForProfile !== 'function') throw new TypeError('VimshottariService careerInsightSource must provide latestForProfile.');
    if (typeof clock !== 'function') throw new TypeError('VimshottariService clock must be a function.');
    this.careerInsightSource = careerInsightSource;
    this.clock = clock;
    Object.freeze(this);
  }

  async current({ principal, birthProfileId, at } = {}) {
    const instant = parseUtcInstant(at);
    const { profile, dasha } = await this._load({ principal, birthProfileId });
    let active;
    try { active = findActiveAt(dasha.periods, instant.epochMilliseconds); }
    catch (_) { fail('VIMSHOTTARI_OUTSIDE_TIMELINE'); }
    if (!active || !active.mahadasha || !active.antardasha || !active.pratyantardasha) {
      fail('VIMSHOTTARI_OUTSIDE_TIMELINE');
    }
    let source = null;
    // Career context is additive. A read failure must never turn a factual
    // Vimshottari request into a different availability result.
    if (this.careerInsightSource) {
      try { source = await this.careerInsightSource.latestForProfile({ principal, birthProfileId: profile.id }); }
      catch (_) { source = null; }
    }
    const insightContext = adaptDashaInsight({ dasha, active, insights: source && source.birthProfileId === profile.id ? source.insights : [] });
    return toCurrentVimshottariDto({ birthProfileId: profile.id, at: instant, dasha, active, insightContext });
  }

  async timeline({ principal, birthProfileId, from, to, level, root = false } = {}) {
    if (root === true && level === 'md' && from === undefined && to === undefined) return this._rootTimeline({ principal, birthProfileId });
    const start = parseUtcInstant(from, 'INVALID_VIMSHOTTARI_FROM');
    const end = parseUtcInstant(to, 'INVALID_VIMSHOTTARI_TO');
    if (start.epochMilliseconds >= end.epochMilliseconds) fail('INVALID_VIMSHOTTARI_WINDOW');
    if (end.epochMilliseconds - start.epochMilliseconds > BigInt(MAX_TIMELINE_WINDOW_MILLISECONDS)) {
      fail('VIMSHOTTARI_TIMELINE_WINDOW_TOO_LARGE');
    }
    if (!LEVELS.has(level)) fail('INVALID_VIMSHOTTARI_LEVEL');
    const { profile, dasha } = await this._load({ principal, birthProfileId });
    const periods = periodsAtLevel(dasha.periods, level)
      .filter((item) => intervalOverlaps(item.period, start, end));
    return toTimelineVimshottariDto({
      birthProfileId: profile.id,
      from: start,
      to: end,
      level,
      dasha,
      periods,
      maxTimelineWindowMilliseconds: MAX_TIMELINE_WINDOW_MILLISECONDS,
    });
  }

  async parentTimeline({ principal, birthProfileId, level, mahadashaStart, antardashaStart } = {}) {
    if (level !== 'ad' && level !== 'pd') fail('INVALID_VIMSHOTTARI_LEVEL');
    const mdStart = parseUtcInstant(mahadashaStart, 'INVALID_MAHADASHA_START');
    const adStart = level === 'pd' ? parseUtcInstant(antardashaStart, 'INVALID_ANTARDASHA_START') : null;
    const { profile, dasha } = await this._load({ principal, birthProfileId });
    const mahadasha = resolveMahadashaByStart(dasha.periods, mdStart);
    if (!mahadasha) fail('VIMSHOTTARI_PARENT_PERIOD_NOT_FOUND');
    const now = parseUtcInstant(new Date(this.clock()).toISOString(), 'INVALID_APPLICATION_CLOCK').epochMilliseconds;
    if (level === 'ad') {
      if (!contained(mahadasha.children, mahadasha)) fail('VIMSHOTTARI_CALCULATION_FAILED');
      return parentTimelineDto({ birthProfileId: profile.id, level, parent: mahadasha, parents: null, periods: mahadasha.children, now });
    }
    const antardasha = resolveAntardashaByStart(mahadasha, adStart);
    if (!antardasha || !contained(antardasha.children, antardasha)) fail('VIMSHOTTARI_PARENT_PERIOD_NOT_FOUND');
    return parentTimelineDto({ birthProfileId: profile.id, level, parent: null, parents: { mahadasha, antardasha }, periods: antardasha.children, now });
  }

  async _rootTimeline({ principal, birthProfileId }) {
    const { profile, dasha } = await this._load({ principal, birthProfileId });
    const now = parseUtcInstant(new Date(this.clock()).toISOString(), 'INVALID_APPLICATION_CLOCK').epochMilliseconds;
    return parentTimelineDto({ birthProfileId: profile.id, level: 'md', parent: null, parents: null, periods: dasha.periods, now });
  }

  async periodInsight({ principal, birthProfileId, pratyantarStart } = {}) {
    const selector = parseUtcInstant(pratyantarStart, 'INVALID_PRATYANTAR_START');
    const { profile, dasha, layer1 } = await this._load({ principal, birthProfileId });
    const selected = resolvePratyantarByStart(dasha, selector);
    if (!selected) fail('VIMSHOTTARI_PERIOD_NOT_FOUND');
    const pdStart = BigInt(selected.pratyantar.startInstant.epochMilliseconds);
    const adStart = BigInt(selected.antardasha.startInstant.epochMilliseconds);
    const mdStart = BigInt(selected.mahadasha.startInstant.epochMilliseconds);
    const pdEnd = BigInt(selected.pratyantar.endInstant.epochMilliseconds);
    const adEnd = BigInt(selected.antardasha.endInstant.epochMilliseconds);
    const mdEnd = BigInt(selected.mahadasha.endInstant.epochMilliseconds);
    if (!(mdStart <= adStart && adStart <= pdStart && pdEnd <= adEnd && adEnd <= mdEnd)) fail('VIMSHOTTARI_CALCULATION_FAILED');
    const now = parseUtcInstant(new Date(this.clock()).toISOString(), 'INVALID_APPLICATION_CLOCK');
    let source = null;
    if (this.careerInsightSource) {
      try { source = await this.careerInsightSource.latestForProfile({ principal, birthProfileId: profile.id }); }
      catch (_) { source = null; }
    }
    return adaptDashaPeriodInsight({
      selection: selected,
      status: statusAt(selected.pratyantar, now.epochMilliseconds),
      nextPeriod: selected.nextPratyantar,
      layer1,
      insights: source && source.birthProfileId === profile.id ? source.insights : [],
    });
  }

  async _load({ principal, birthProfileId }) {
    const profile = await this.birthProfileService.get({ principal, birthProfileId });
    if (!profile || profile.status !== 'active') fail('NOT_FOUND_OR_FORBIDDEN');
    try {
      const layer1 = this.astronomicalEngine.calculate(birthRequest(profile.birthData));
      const dasha = calculateVimshottariDasha({
        birthInstant: layer1.instant.utc,
        moonCanonicalSiderealLongitude: layer1.bodies.Moon.siderealLongitudeDegrees,
        natalSunCanonicalSiderealLongitude: layer1.bodies.Sun.siderealLongitudeDegrees,
        canonicalSiderealSunSampler: this.canonicalSiderealSunSampler,
        rulesetId: SOLAR_RETURN_VIMSHOTTARI_RULESET.id,
      });
      return Object.freeze({ profile, dasha, layer1 });
    } catch (_) {
      fail('VIMSHOTTARI_CALCULATION_FAILED');
    }
  }
}

function publicPeriod(period, level, now) { const status = statusAt(period, now) === 'PAST' ? 'COMPLETED' : statusAt(period, now); return Object.freeze({ level, lord: period.lord.id, start: period.startInstant.utc, end: period.endInstant.utc, status }); }
function parentTimelineDto({ birthProfileId, level, parent, parents, periods, now }) {
  const periodLevel = level === 'md' ? 'MAHADASHA' : level === 'ad' ? 'ANTARDASHA' : 'PRATYANTAR';
  const value = { birthProfileId, level, count: periods.length, periods: periods.map((period) => publicPeriod(period, periodLevel, now)) };
  if (parent) value.parent = publicPeriod(parent, 'MAHADASHA', now);
  if (parents) value.parents = Object.freeze({ mahadasha: publicPeriod(parents.mahadasha, 'MAHADASHA', now), antardasha: publicPeriod(parents.antardasha, 'ANTARDASHA', now) });
  return Object.freeze(value);
}
module.exports = { VimshottariService, MAX_TIMELINE_WINDOW_MILLISECONDS, parseUtcInstant, statusAt, parentTimelineDto };
