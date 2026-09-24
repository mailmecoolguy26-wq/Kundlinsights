'use strict';

// Launch-safe timing presentation. This maps already-calculated D1, Dasha and
// Gochar facts into a non-predictive Candidate-B signal packet. It performs no
// astronomy, persistence or runtime I/O.
const { FULL_ASPECTS_BY_GRAHA } = require('../../drishti/reference-data');
const { freeze } = require('../../synthesis/evidence-node');
const { resolveCareerNatalFactors } = require('./career-generalized-timing-engine');

const RULESET_VERSION = 'career-timing-launch-v1';
const MAJOR_PLANETS = new Set(['Jupiter', 'Saturn']);
const PLANET_NAMES = Object.freeze({ Sun: 'Surya Dev', Moon: 'Chandra Dev', Mars: 'Mangal', Mercury: 'Budh', Jupiter: 'Guru Dev', Venus: 'Shukra', Saturn: 'Shani Dev', Rahu: 'Rahu', Ketu: 'Ketu' });
const validInterval = (value) => value && typeof value.start === 'string' && typeof value.end === 'string' && Date.parse(value.start) < Date.parse(value.end);
const overlap = (left, right) => Date.parse(left.start) < Date.parse(right.end) && Date.parse(right.start) < Date.parse(left.end);
const bounded = (left, right) => overlap(left, right) ? { start: Date.parse(left.start) > Date.parse(right.start) ? left.start : right.start, end: Date.parse(left.end) < Date.parse(right.end) ? left.end : right.end } : null;
const at = (sign, offset) => ((sign - 1 + offset) % 12) + 1;
const stable = (items) => [...new Set(items.filter(Boolean))].sort();
const name = (planet) => PLANET_NAMES[planet] || planet;

function activationTypes({ planet, sign, targetSign }) {
  const output = [];
  if (sign === targetSign) output.push('occupies');
  for (const aspect of FULL_ASPECTS_BY_GRAHA[planet] || []) if (at(sign, aspect.rashiOffset) === targetSign) output.push(`casts ${aspect.aspectNumber}th aspect to`);
  return output;
}

function buildCareerTimingPeriods({ d1Houses, dashaIntervals = [], transitIntervals = [], horizonStart, horizonEnd, d10Confirmation = false, h10Sav = null, recurrence = null } = {}) {
  const horizon = { start: horizonStart, end: horizonEnd };
  if (!validInterval(horizon)) throw new TypeError('Career timing periods require a valid horizon.');
  const factors = resolveCareerNatalFactors({ d1Houses });
  const relevant = new Map((factors.relevantPlanets || []).map((item) => [item.planet, item.relevanceReasons]));
  const h10Targets = [
    { kind: '10th-house Career axis', sign: factors.tenthHouseSign, planet: null },
    { kind: '10th-house lord', sign: factors.tenthLordNatalSign, planet: factors.tenthLord },
  ];
  const candidates = [];
  for (const dasha of dashaIntervals) {
    const dashaBounds = validInterval(dasha) && bounded(dasha, horizon);
    if (!dashaBounds || !Array.isArray(dasha.activePeriods)) continue;
    const qualifyingDasha = dasha.activePeriods.filter((period) => period && ['MD', 'AD', 'PD'].includes(period.level) && relevant.has(period.lord));
    if (!qualifyingDasha.length) continue;
    for (const transit of transitIntervals) {
      if (!transit || !MAJOR_PLANETS.has(transit.planet) || !Number.isInteger(transit.sign) || !validInterval(transit)) continue;
      const interval = bounded(dashaBounds, transit);
      if (!interval) continue;
      const activations = h10Targets.flatMap((target) => activationTypes({ planet: transit.planet, sign: transit.sign, targetSign: target.sign }).map((type) => ({ transitPlanet: transit.planet, targetKind: target.kind, targetPlanet: target.planet, activationType: type })));
      if (activations.length) candidates.push({ ...interval, qualifyingDasha, activations });
    }
  }
  const ordered = candidates.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  const groups = [];
  for (const candidate of ordered) {
    const previous = groups.at(-1);
    if (previous && Date.parse(candidate.start) <= Date.parse(previous.end)) {
      if (Date.parse(candidate.end) > Date.parse(previous.end)) previous.end = candidate.end;
      previous.items.push(candidate);
    } else groups.push({ start: candidate.start, end: candidate.end, items: [candidate] });
  }
  const periods = groups.map((group) => {
    const dasha = group.items.flatMap((item) => item.qualifyingDasha);
    const gochar = group.items.flatMap((item) => item.activations);
    const dashaDetails = stable(dasha.map((item) => `${item.level}:${item.lord}`));
    const gocharDetails = stable(gochar.map((item) => `${item.transitPlanet}|${item.targetKind}|${item.targetPlanet || ''}|${item.activationType}`));
    const why = [
      ...stable(dasha.map((item) => `${name(item.lord)} ${item.level === 'MD' ? 'Mahadasha' : item.level === 'AD' ? 'Antardasha' : 'Pratyantar Dasha'} Career structure se connected hai.`)),
      ...stable(gochar.map((item) => `${name(item.transitPlanet)} ka Gochar ${item.targetKind}${item.activationType === 'occupies' ? ' ko activate kar raha hai.' : ` par ${item.activationType} hai.`}`)),
      ...(d10Confirmation ? ['D10 professional theme ko factual structural context ke roop mein dikhata hai.'] : []),
    ];
    return freeze({
      startDate: group.start,
      endDate: group.end,
      evidenceState: 'POSSIBLE_CAREER_ACTIVITY_SIGNAL',
      headline: 'POSSIBLE CAREER ACTIVITY SIGNAL',
      summary: 'TaraVerse ke current timing model ke according, is period mein Career se jude important Dasha aur Gochar factors ek saath active hain.',
      whyItems: freeze(why),
      whatThisCanMean: 'Is dauran interviews, networking, important Career conversations aur naye professional opportunities zyada active ho sakte hain.',
      professionalDirection: 'Career structure aur current timing context ko saath mein dekhein.',
      ...(recurrence && recurrence.available === true ? { recurrenceSummary: recurrence.present === true ? 'Past Career pattern context available hai.' : 'Past Career pattern context available hai, lekin similarity present nahi hai.' } : {}),
      technicalDetails: freeze({
        d1: freeze({ h10Sign: factors.tenthHouseSign, h10Lord: factors.tenthLord, directCareerFactors: freeze([...relevant.keys()].sort()) }),
        dasha: freeze({ qualifyingLevel: freeze(stable(dasha.map((item) => item.level))), periods: freeze(dashaDetails) }),
        gochar: freeze(gocharDetails.map((item) => { const [transitPlanet, target, targetPlanet, activation] = item.split('|'); return freeze({ transitPlanet, target, ...(targetPlanet ? { targetPlanet } : {}), activation }); })),
        d10: freeze({ confirmationPresent: d10Confirmation === true }),
        moon: freeze({ supportPresent: false }),
        savBav: freeze({ ...(Number.isInteger(h10Sav) ? { h10Sav } : {}) }),
        historicalPattern: freeze({ available: recurrence && recurrence.available === true, present: recurrence && recurrence.present === true }),
        window: freeze({ startDate: group.start, endDate: group.end }),
      }),
      disclosure: 'Yeh kisi specific job change, offer ya promotion ki guarantee nahi hai. Career decisions mein role quality, compensation, financial readiness aur personal circumstances ko bhi consider karein.',
      sourceRuleVersion: RULESET_VERSION,
      longWindow: (Date.parse(group.end) - Date.parse(group.start)) > 120 * 86400000,
    });
  });
  return freeze({ rulesetVersion: RULESET_VERSION, horizon: freeze(horizon), periods: freeze(periods), noSignal: periods.length === 0 });
}

module.exports = { RULESET_VERSION, buildCareerTimingPeriods };
