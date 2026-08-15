'use strict';

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function period(period, context = {}) {
  return freeze({
    lord: period.lord.id,
    start: period.startInstant.utc,
    end: period.endInstant.utc,
    ...context,
  });
}

function ruleset(dasha) {
  return freeze({
    id: dasha.ruleset.id,
    timeConventionId: dasha.ruleset.timeConventionId,
    boundaryPolicy: dasha.ruleset.boundaryPolicy,
  });
}

function provenance(dasha) {
  return freeze({ layer: dasha.provenance.layer, providerIndependent: dasha.provenance.providerIndependent });
}

function toCurrentVimshottariDto({ birthProfileId, at, dasha, active }) {
  return freeze({
    birthProfileId,
    at: at.utc,
    current: freeze({
      mahadasha: period(active.mahadasha),
      antardasha: period(active.antardasha, { mahadashaLord: active.mahadasha.lord.id }),
      pratyantardasha: period(active.pratyantardasha, {
        mahadashaLord: active.mahadasha.lord.id,
        antardashaLord: active.antardasha.lord.id,
      }),
    }),
    ruleset: ruleset(dasha),
    provenance: provenance(dasha),
  });
}

function timelinePeriod(level, item) {
  const context = level === 'md' ? {} : level === 'ad'
    ? { mahadashaLord: item.mahadasha.lord.id }
    : { mahadashaLord: item.mahadasha.lord.id, antardashaLord: item.antardasha.lord.id };
  return period(item.period, context);
}

function toTimelineVimshottariDto({ birthProfileId, from, to, level, dasha, periods, maxTimelineWindowMilliseconds }) {
  return freeze({
    birthProfileId,
    level,
    from: from.utc,
    to: to.utc,
    maxTimelineWindowMilliseconds,
    periods: periods.map((item) => timelinePeriod(level, item)),
    count: periods.length,
    ruleset: ruleset(dasha),
    provenance: provenance(dasha),
  });
}

module.exports = { toCurrentVimshottariDto, toTimelineVimshottariDto };
