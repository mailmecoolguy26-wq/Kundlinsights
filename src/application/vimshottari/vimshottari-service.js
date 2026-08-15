'use strict';

const { calculateVimshottariDasha, SOLAR_RETURN_VIMSHOTTARI_RULESET } = require('../../dasha');
const { findActiveAt } = require('../../dasha/timeline-builder');
const { repositoryError } = require('../../persistence/contracts');
const { toCurrentVimshottariDto, toTimelineVimshottariDto } = require('./vimshottari-dto');

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

class VimshottariService {
  constructor({ birthProfileService, astronomicalEngine, canonicalSiderealSunSampler } = {}) {
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
    return toCurrentVimshottariDto({ birthProfileId: profile.id, at: instant, dasha, active });
  }

  async timeline({ principal, birthProfileId, from, to, level } = {}) {
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
      return Object.freeze({ profile, dasha });
    } catch (_) {
      fail('VIMSHOTTARI_CALCULATION_FAILED');
    }
  }
}

module.exports = { VimshottariService, MAX_TIMELINE_WINDOW_MILLISECONDS, parseUtcInstant };
