'use strict';

const TRANSIT_PLANETS = Object.freeze(['Jupiter', 'Saturn', 'Rahu', 'Ketu', 'Mars']);
const LIFE_AREAS = Object.freeze({ CAREER: [2, 6, 10, 11], RELATIONSHIPS: [5, 7], WEALTH_PROPERTY: [2, 4, 8, 11], GENERAL: [] });
const HOUSE_THEMES = Object.freeze({
  1: Object.freeze(['self', 'identity', 'vitality', 'personal direction']), 2: Object.freeze(['finances', 'savings', 'family', 'speech', 'possessions']),
  3: Object.freeze(['communication', 'skills', 'initiative', 'short travel']), 4: Object.freeze(['home', 'property', 'emotional security', 'vehicles']),
  5: Object.freeze(['children', 'creativity', 'learning', 'romance', 'speculation']), 6: Object.freeze(['work routines', 'service', 'competition', 'debts', 'disputes', 'health', 'problem-solving']),
  7: Object.freeze(['marriage', 'partnerships', 'contracts', 'public dealings']), 8: Object.freeze(['transformation', 'shared resources', 'inheritance', 'research', 'vulnerability']),
  9: Object.freeze(['higher learning', 'mentors', 'beliefs', 'long-distance travel']), 10: Object.freeze(['career', 'profession', 'authority', 'public responsibility']),
  11: Object.freeze(['gains', 'income', 'networks', 'goals']), 12: Object.freeze(['expenses', 'foreign matters', 'retreat', 'sleep', 'spirituality', 'letting go']),
});
const TaraTransitIntent = Object.freeze({ CURRENT_TRANSIT_OVERVIEW: 'CURRENT_TRANSIT_OVERVIEW', PLANET_TRANSIT_EFFECT: 'PLANET_TRANSIT_EFFECT', UPCOMING_TRANSIT_EFFECT: 'UPCOMING_TRANSIT_EFFECT', LIFE_AREA_TRANSIT_EFFECT: 'LIFE_AREA_TRANSIT_EFFECT', UNSUPPORTED_TRANSIT: 'UNSUPPORTED_TRANSIT' });

function normalize(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
function planetFor(text) { return ['jupiter', 'saturn', 'rahu', 'ketu', 'mars'].find((value) => new RegExp(`\\b${value}\\b`).test(text)) || null; }
function areaFor(text) { if (/\bcareer|job|work|business\b/.test(text)) return 'CAREER'; if (/\brelationship|marriage|marry|spouse|partner|love\b/.test(text)) return 'RELATIONSHIPS'; if (/\bwealth|money|property|real estate|investment\b/.test(text)) return 'WEALTH_PROPERTY'; return 'GENERAL'; }
function classifyTaraTransitIntent(message) {
  const text = normalize(message); const planet = planetFor(text); const area = areaFor(text);
  if (!/\b(gochar|transit|transits|planetary movement|planet changing house|jupiter|saturn|rahu|ketu|mars)\b/.test(text)) return Object.freeze({ intent: TaraTransitIntent.UNSUPPORTED_TRANSIT, planet: null, area: 'GENERAL' });
  if (/\b(next|when|change|changes|upcoming)\b/.test(text) && planet) return Object.freeze({ intent: TaraTransitIntent.UPCOMING_TRANSIT_EFFECT, planet, area });
  if (planet) return Object.freeze({ intent: TaraTransitIntent.PLANET_TRANSIT_EFFECT, planet, area });
  if (area !== 'GENERAL') return Object.freeze({ intent: TaraTransitIntent.LIFE_AREA_TRANSIT_EFFECT, planet: null, area });
  return Object.freeze({ intent: TaraTransitIntent.CURRENT_TRANSIT_OVERVIEW, planet: null, area });
}
function isoNow(clock) { const value = new Date(clock()); if (Number.isNaN(value.getTime())) throw new TypeError('INVALID_TARA_TRANSIT_CLOCK'); return value.toISOString(); }
function houseLords(houses) { const out = new Map(); for (const house of houses.houses || []) { const lord = typeof house.rashiHouseLord === 'string' ? house.rashiHouseLord : house.rashiHouseLord && house.rashiHouseLord.name; if (Number.isInteger(house.houseNumber) && typeof lord === 'string') out.set(lord, [...(out.get(lord) || []), house.houseNumber]); } return out; }
function areasFor(house) { return Object.entries(LIFE_AREAS).filter(([, values]) => values.includes(house)).map(([area]) => area); }
function themesFor(houses) { return [...new Set(houses.flatMap((house) => HOUSE_THEMES[house] || []))]; }
function careerThemes(houses) { return [...new Set(houses.flatMap((house) => house === 6 ? ['work routines', 'service', 'competition', 'problem-solving'] : house === 2 ? ['finances', 'savings'] : house === 11 ? ['gains', 'income', 'networks'] : house === 10 ? ['career', 'profession', 'authority'] : []))]; }
function evidenceFor({ snapshot, natalHouses, intent }) {
  const lords = houseLords(natalHouses); const wanted = intent.planet ? [intent.planet[0].toUpperCase() + intent.planet.slice(1)] : TRANSIT_PLANETS;
  return Object.freeze(wanted.map((planet) => {
    const body = snapshot.transitBodies[planet]; if (!body) return null;
    const house = body.transitNatalHouseNumber;
    const lordship = [...(lords.get(planet) || [])].sort((a, b) => a - b);
    const aspectHouses = (body.aspectsNatalHouses || []).map((item) => item.houseNumber).filter(Number.isInteger).sort((a, b) => a - b);
    const interactionThemes = [...new Set([...aspectHouses, house].flatMap((value) => HOUSE_THEMES[value] || []))];
    return Object.freeze({ planet, currentSign: body.transitRashi.englishName, currentHouse: house, natalHouseLordship: Object.freeze(lordship), retrograde: body.motion === 'retrograde', houseThemes: Object.freeze(HOUSE_THEMES[house] || []), lordshipThemes: Object.freeze(themesFor(lordship)), aspectThemes: Object.freeze(themesFor(aspectHouses)), interactionThemes: Object.freeze(interactionThemes), matchedLifeAreas: Object.freeze([...new Set([house, ...lordship, ...aspectHouses].flatMap(areasFor))]), natalInteractions: Object.freeze({ conjunctions: Object.freeze((body.sameRashiNatalBodies || []).map((item) => item.body || item).filter((item) => typeof item === 'string').sort()), aspects: Object.freeze((body.aspectsNatalBodies || []).map((item) => item.natalBody).filter((item) => typeof item === 'string').sort()) }), transitInteractions: Object.freeze({ housesAspected: Object.freeze(aspectHouses), natalPlanetsAspected: Object.freeze((body.aspectsNatalBodies || []).map((item) => item.natalBody).filter((item) => typeof item === 'string').sort()) }) });
  }).filter(Boolean));
}
function displayDate(value) { const date = typeof value === 'string' ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date) : null; }
function names(values) { return values.length ? values.join(', ') : 'the available chart context'; }
function ordinal(value) { return `${value}${value % 10 === 1 && value % 100 !== 11 ? 'st' : value % 10 === 2 && value % 100 !== 12 ? 'nd' : value % 10 === 3 && value % 100 !== 13 ? 'rd' : 'th'}`; }
function retrogradePhrase(item) { if (!item.retrograde || item.planet === 'Rahu' || item.planet === 'Ketu') return ''; if (item.planet === 'Saturn') return ' Its calculated retrograde state places additional emphasis on review, responsibility and pace.'; if (item.planet === 'Jupiter') return ' Its calculated retrograde state places additional emphasis on revisiting learning, guidance and longer-term direction.'; return ' Its calculated retrograde state places additional emphasis on revisiting how this transit is being expressed.'; }
function sentence(item, { area = 'GENERAL' } = {}) { const occupiedThemes = area === 'CAREER' ? careerThemes([item.currentHouse]) : item.houseThemes; const lordship = item.natalHouseLordship.length ? ` In your chart, ${item.planet} also rules the ${item.natalHouseLordship.map(ordinal).join(' and ')} house${item.natalHouseLordship.length > 1 ? 's' : ''}, connecting this transit with ${names(area === 'CAREER' ? careerThemes(item.natalHouseLordship) : item.lordshipThemes)}.` : ''; const aspects = item.transitInteractions.housesAspected.length ? ` It also aspects your ${item.transitInteractions.housesAspected.map(ordinal).join(' and ')} house${item.transitInteractions.housesAspected.length > 1 ? 's' : ''}.` : ''; return `${item.planet} is currently transiting your ${ordinal(item.currentHouse)} natal house in ${item.currentSign}. This activates themes of ${names(occupiedThemes)}.${lordship}${aspects}${retrogradePhrase(item)}`; }
function relevantForArea(item, area) { const houses = LIFE_AREAS[area] || []; return houses.includes(item.currentHouse) || item.natalHouseLordship.some((house) => houses.includes(house)) || item.transitInteractions.housesAspected.some((house) => houses.includes(house)); }
function overview(evidence) { const ranked = [...evidence].sort((left, right) => (TRANSIT_PLANETS.indexOf(left.planet) - TRANSIT_PLANETS.indexOf(right.planet)) || left.currentHouse - right.currentHouse); const major = ranked.filter((item) => ['Jupiter', 'Saturn', 'Rahu', 'Ketu'].includes(item.planet)); const areas = [...new Set(major.flatMap((item) => item.houseThemes))].slice(0, 6); return `The most significant current transit influences are ${major.map((item) => `${item.planet} in your ${ordinal(item.currentHouse)} house`).join(', ')}. ${major.slice(0, 3).map((item) => sentence(item)).join(' ')} Areas receiving the most activation include ${names(areas)}. Use this as a grounded transit perspective rather than a guarantee of a specific outcome.`; }
function diagnostic(log, event, fields) { if (typeof log === 'function') log({ event, ...fields }); }
function unsupported() { return 'I can explain your current Gochar from calculated chart data, but I’m not ready to answer that transit question reliably yet.'; }

class TaraTransitCapability {
  constructor({ transitSnapshotService, clock = () => new Date().toISOString() } = {}) { if (!transitSnapshotService || typeof transitSnapshotService.contextForTara !== 'function') throw new TypeError('INVALID_TARA_TRANSIT_SNAPSHOT_SERVICE'); this.transits = transitSnapshotService; this.clock = clock; }
  async respond({ principal, birthProfileId, message, diagnosticLog = null } = {}) {
    const intent = classifyTaraTransitIntent(message);
    diagnostic(diagnosticLog, 'TARA_TRANSIT_ROUTE', { domain: 'TRANSIT', intent: intent.intent, planet: intent.planet, birthProfileId });
    if (intent.intent === TaraTransitIntent.UNSUPPORTED_TRANSIT) { const result = Object.freeze({ intent: intent.intent, state: 'UNSUPPORTED_TRANSIT', answerability: 'UNSUPPORTED', message: unsupported(), evidence: Object.freeze([]) }); diagnostic(diagnosticLog, 'TARA_TRANSIT_RESPONSE', { state: result.state, birthProfileId }); return result; }
    let context;
    try { context = await this.transits.contextForTara({ principal, birthProfileId, at: isoNow(this.clock) }); diagnostic(diagnosticLog, 'TARA_TRANSIT_CALCULATION', { status: 'SUCCEEDED', birthProfileId }); } catch (_) { const result = Object.freeze({ intent: intent.intent, state: 'CALCULATION_UNAVAILABLE', answerability: 'INSUFFICIENT_EVIDENCE', message: 'I’m unable to calculate your current transit picture reliably right now.', evidence: Object.freeze([]) }); diagnostic(diagnosticLog, 'TARA_TRANSIT_CALCULATION', { status: 'FAILED', birthProfileId }); diagnostic(diagnosticLog, 'TARA_TRANSIT_RESPONSE', { state: result.state, birthProfileId }); return result; }
    const evidence = evidenceFor({ snapshot: context.snapshot, natalHouses: context.natalHouses, intent });
    diagnostic(diagnosticLog, 'TARA_TRANSIT_EVIDENCE', { evidenceItemCount: evidence.length, birthProfileId });
    if (!evidence.length) { const result = Object.freeze({ intent: intent.intent, state: 'INSUFFICIENT_EVIDENCE', answerability: 'INSUFFICIENT_EVIDENCE', message: 'I’m unable to identify the requested transit influence reliably right now.', evidence }); diagnostic(diagnosticLog, 'TARA_TRANSIT_RESPONSE', { state: result.state, birthProfileId }); return result; }
    let messageOut;
    if (intent.intent === TaraTransitIntent.UPCOMING_TRANSIT_EFFECT) {
      const planet = evidence[0].planet; const transition = (context.insightContext && context.insightContext.upcomingTransitions || []).find((item) => item.planet === planet && item.type === 'INGRESS');
      const date = transition && displayDate(transition.at);
      messageOut = date ? `${planet} has a calculated upcoming sign transition on ${date}. Its effect should be understood through the natal house it activates at that time; TaraVerse will only describe that once the calculated transition context is available.` : `I can explain ${planet}'s current calculated transit, but I’m not able to safely state the next change date from the available transit window.`;
    } else if (intent.intent === TaraTransitIntent.LIFE_AREA_TRANSIT_EFFECT) {
      const relevant = evidence.filter((item) => relevantForArea(item, intent.area));
      messageOut = relevant.length ? `${relevant.map((item) => sentence(item, { area: intent.area })).join(' ')} This is the transit-related part of your ${intent.area === 'WEALTH_PROPERTY' ? 'wealth or property' : intent.area.toLowerCase()} picture; it is not a deeper outcome prediction.` : `The current major transits do not directly connect with the core natal houses TaraVerse uses for this ${intent.area.toLowerCase()} transit view. I can still describe the broader current Gochar picture: ${overview(evidence)}`;
    } else if (intent.intent === TaraTransitIntent.PLANET_TRANSIT_EFFECT) messageOut = `${sentence(evidence[0])} Overall, this is a grounded area of emphasis, not a guaranteed event.`;
    else messageOut = overview(evidence);
    const result = Object.freeze({ intent: intent.intent, state: 'GROUNDED', answerability: 'SUPPORTED', message: messageOut, evidence });
    diagnostic(diagnosticLog, 'TARA_TRANSIT_RESPONSE', { state: result.state, birthProfileId });
    return result;
  }
}
module.exports = { TaraTransitCapability, TaraTransitIntent, classifyTaraTransitIntent, TRANSIT_PLANETS };
