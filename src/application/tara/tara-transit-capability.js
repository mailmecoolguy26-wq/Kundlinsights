'use strict';

const TRANSIT_PLANETS = Object.freeze(['Jupiter', 'Saturn', 'Rahu', 'Ketu', 'Mars', 'Mercury']);
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
const MONTHS = Object.freeze({ jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11 });
const UPCOMING_TRANSIT_HORIZON_DAYS = 400;
const DAILY_COARSE_SCAN_MILLISECONDS = 86_400_000;

function normalize(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
function planetFor(text) { return TRANSIT_PLANETS.map((planet) => planet.toLowerCase()).find((value) => new RegExp(`\\b${value}\\b`).test(text)) || null; }
function areaFor(text) { if (/\bcareer|job|work|business\b/.test(text)) return 'CAREER'; if (/\brelationship|marriage|marry|spouse|partner|love\b/.test(text)) return 'RELATIONSHIPS'; if (/\bwealth|money|property|real estate|investment\b/.test(text)) return 'WEALTH_PROPERTY'; return 'GENERAL'; }
function requestedDateHint(text) { const match = /\b(?:on\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+ko)?\b/.exec(text); if (!match) return null; const day = Number(match[1]); const month = MONTHS[match[2]]; return Number.isInteger(month) && day >= 1 && day <= 31 ? Object.freeze({ day, month, label: `${day} ${match[2].slice(0, 1).toUpperCase()}${match[2].slice(1, 3)}` }) : null; }
function hasFutureCue(text) { return /\b(next|when|kab|change|changes|upcoming|agla|jab|shift|move|hoga|rahega)\b/.test(text); }
function classifyTaraTransitIntent(message) {
  const text = normalize(message); const planet = planetFor(text); const area = areaFor(text); const requestedDate = requestedDateHint(text);
  if (!/\b(gochar|transit|transits|planetary movement|planet changing house|jupiter|saturn|rahu|ketu|mars|mercury)\b/.test(text)) return Object.freeze({ intent: TaraTransitIntent.UNSUPPORTED_TRANSIT, planet: null, area: 'GENERAL' });
  if (planet && (requestedDate || hasFutureCue(text))) return Object.freeze({ intent: TaraTransitIntent.UPCOMING_TRANSIT_EFFECT, planet, area, ...(requestedDate ? { requestedDate } : {}) });
  if (planet && area !== 'GENERAL') return Object.freeze({ intent: TaraTransitIntent.LIFE_AREA_TRANSIT_EFFECT, planet, area });
  if (planet) return Object.freeze({ intent: TaraTransitIntent.PLANET_TRANSIT_EFFECT, planet, area });
  if (area !== 'GENERAL') return Object.freeze({ intent: TaraTransitIntent.LIFE_AREA_TRANSIT_EFFECT, planet: null, area });
  return Object.freeze({ intent: TaraTransitIntent.CURRENT_TRANSIT_OVERVIEW, planet: null, area });
}
function isoNow(clock) { const value = new Date(clock()); if (Number.isNaN(value.getTime())) throw new TypeError('INVALID_TARA_TRANSIT_CLOCK'); return value.toISOString(); }
function requestedDateInstant(hint, now) { if (!hint) return null; const current = new Date(now); let value = new Date(Date.UTC(current.getUTCFullYear(), hint.month, hint.day)); if (value.getTime() < Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate())) value = new Date(Date.UTC(current.getUTCFullYear() + 1, hint.month, hint.day)); return Number.isNaN(value.getTime()) || value.getUTCMonth() !== hint.month ? null : value.toISOString(); }
function horizonDaysFor({ now, requestedDate }) { if (!requestedDate) return UPCOMING_TRANSIT_HORIZON_DAYS; const days = Math.ceil((Date.parse(requestedDate) - Date.parse(now)) / 86_400_000) + 14; return Math.max(30, Math.min(UPCOMING_TRANSIT_HORIZON_DAYS, days)); }
function sameUtcDate(left, right) { return typeof left === 'string' && typeof right === 'string' && left.slice(0, 10) === right.slice(0, 10); }
function transitionFor({ transitions, planet, requestedDate }) { const candidates = transitions.filter((item) => item.planet === planet && item.type === 'INGRESS'); if (!candidates.length) return null; if (!requestedDate) return Object.freeze({ transition: candidates[0], dateMatched: null }); const ordered = candidates.slice().sort((left, right) => Math.abs(Date.parse(left.at) - Date.parse(requestedDate)) - Math.abs(Date.parse(right.at) - Date.parse(requestedDate))); return Object.freeze({ transition: ordered[0], dateMatched: sameUtcDate(ordered[0].at, requestedDate) }); }
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
function names(values) { return values.length ? values.join(', ') : 'the themes shown by this transit'; }
function ordinal(value) { return `${value}${value % 10 === 1 && value % 100 !== 11 ? 'st' : value % 10 === 2 && value % 100 !== 12 ? 'nd' : value % 10 === 3 && value % 100 !== 13 ? 'rd' : 'th'}`; }
function ordinalList(values) { return values.map(ordinal).join(values.length === 2 ? ' and ' : ', '); }
function retrogradePhrase(item) { if (!item.retrograde || item.planet === 'Rahu' || item.planet === 'Ketu') return ''; if (item.planet === 'Saturn') return ' Its calculated retrograde state places additional emphasis on review, responsibility and pace.'; if (item.planet === 'Jupiter') return ' Its calculated retrograde state places additional emphasis on revisiting learning, guidance and longer-term direction.'; return ' Its calculated retrograde state places additional emphasis on revisiting how this transit is being expressed.'; }
function meaning(item, { area = 'GENERAL', language = 'ENGLISH' } = {}) { const themes = area === 'CAREER' ? careerThemes([item.currentHouse]) : item.houseThemes; return language === 'HINGLISH' ? `${item.planet} abhi ${names(themes)} ko activate kar raha hai.` : `${item.planet} is activating ${names(themes)}.`; }
function why(item, { language = 'ENGLISH' } = {}) { const lordship = item.natalHouseLordship.length ? language === 'HINGLISH' ? `${item.planet} aapke ${item.natalHouseLordship.map(ordinal).join(' aur ')} house${item.natalHouseLordship.length > 1 ? 's' : ''} rule karta hai` : `${item.planet} also rules your ${item.natalHouseLordship.map(ordinal).join(' and ')} house${item.natalHouseLordship.length > 1 ? 's' : ''}` : null; const aspects = item.transitInteractions.housesAspected.length ? language === 'HINGLISH' ? `yeh aapke ${item.transitInteractions.housesAspected.map(ordinal).join(' aur ')} house${item.transitInteractions.housesAspected.length > 1 ? 's' : ''} ko aspect karta hai` : `it influences your ${item.transitInteractions.housesAspected.map(ordinal).join(' and ')} house${item.transitInteractions.housesAspected.length > 1 ? 's' : ''}` : null; const transit = language === 'HINGLISH' ? `${item.planet} abhi ${item.currentSign} mein aapke ${ordinal(item.currentHouse)} house se transit kar raha hai` : `${item.planet} is transiting your ${ordinal(item.currentHouse)} house in ${item.currentSign}`; return [transit, lordship, aspects].filter(Boolean).join('; ') + '.'; }
function attention(item, { area = 'GENERAL', language = 'ENGLISH' } = {}) { const themes = area === 'CAREER' ? careerThemes([item.currentHouse, ...item.natalHouseLordship]) : [...item.houseThemes, ...item.lordshipThemes].slice(0, 4); return language === 'HINGLISH' ? `Dhyaan dene wali cheez: ${names(themes)}.${retrogradePhrase(item)}` : `What to pay attention to: ${names(themes)}.${retrogradePhrase(item)}`; }
function relevantForArea(item, area) { const houses = LIFE_AREAS[area] || []; return houses.includes(item.currentHouse) || item.natalHouseLordship.some((house) => houses.includes(house)) || item.transitInteractions.housesAspected.some((house) => houses.includes(house)); }
function overview(evidence, { language = 'ENGLISH' } = {}) { const byPlanet = new Map(evidence.map((item) => [item.planet, item])); const jupiter = byPlanet.get('Jupiter'), saturn = byPlanet.get('Saturn'), nodes = [byPlanet.get('Rahu'), byPlanet.get('Ketu')].filter(Boolean); const strongest = [jupiter, saturn].filter(Boolean); const nodeThemes = [...new Set(nodes.flatMap((item) => item.houseThemes))].slice(0, 4); const attentionThemes = [...new Set(strongest.flatMap((item) => item.houseThemes))].slice(0, 5); const opening = language === 'HINGLISH' ? `Abhi aapke chart mein sabse strong transit influences ${strongest.map((item) => item.planet).join(' aur ')} hain${nodes.length ? ', aur Rahu/Ketu secondary layer add kar rahe hain' : ''}.` : `The strongest transit influences in your chart right now are ${strongest.map((item) => item.planet).join(' and ')}${nodes.length ? ', with Rahu and Ketu adding a secondary layer' : ''}.`; const node = nodes.length ? language === 'HINGLISH' ? `Rahu/Ketu: ${names(nodeThemes)} par extra focus aa raha hai.` : `Rahu/Ketu: ${names(nodeThemes)} are receiving additional attention.` : ''; const attentionLabel = language === 'HINGLISH' ? 'Dhyaan dene wali cheez' : 'What to pay attention to'; return `${opening}\n\n${strongest.map((item) => `${item.planet}: ${meaning(item, { language })}`).join('\n')} ${node}\n\n${attentionLabel}: ${names(attentionThemes)}.\n\nWhy: ${strongest.map((item) => why(item, { language })).join(' ')}`; }
function upcomingWhy(item, { language = 'ENGLISH' } = {}) { const lordship = item.natalHouseLordship.length ? language === 'HINGLISH' ? `${item.planet} aapke ${ordinalList(item.natalHouseLordship)} house${item.natalHouseLordship.length > 1 ? 's' : ''} rule karta hai` : `${item.planet} rules your ${ordinalList(item.natalHouseLordship)} house${item.natalHouseLordship.length > 1 ? 's' : ''}` : null; const aspects = item.transitInteractions.housesAspected.length ? language === 'HINGLISH' ? `yeh aapke ${ordinalList(item.transitInteractions.housesAspected)} house${item.transitInteractions.housesAspected.length > 1 ? 's' : ''} ko aspect karega` : `it will influence your ${ordinalList(item.transitInteractions.housesAspected)} house${item.transitInteractions.housesAspected.length > 1 ? 's' : ''}` : null; const transit = language === 'HINGLISH' ? `${item.planet} calculated ingress ke baad ${item.currentSign} mein aapke ${ordinal(item.currentHouse)} house se transit karega` : `${item.planet} will transit your ${ordinal(item.currentHouse)} house in ${item.currentSign} after the calculated ingress`; return [transit, lordship, aspects].filter(Boolean).join('; ') + '.'; }
function upcomingMessage({ item, currentItem = null, date, language = 'ENGLISH', requestedDate = null, dateMatched = null }) {
  const aspects = item.transitInteractions.housesAspected;
  const aspectSentence = aspects.length
    ? language === 'HINGLISH' ? `${item.planet} aapke ${ordinalList(aspects)} house${aspects.length > 1 ? 's' : ''} ko bhi aspect karega, jisse ${names(item.aspectThemes)} activate honge.` : `${item.planet} will also aspect your ${ordinalList(aspects)} house${aspects.length > 1 ? 's' : ''}, activating ${names(item.aspectThemes)}.`
    : null;
  const lordshipSentence = item.natalHouseLordship.length
    ? language === 'HINGLISH' ? `Kyuki ${item.planet} aapke ${ordinalList(item.natalHouseLordship)} house${item.natalHouseLordship.length > 1 ? 's' : ''} rule karta hai, woh areas bhi is transit se connected hain.` : `Because ${item.planet} rules your ${ordinalList(item.natalHouseLordship)} house${item.natalHouseLordship.length > 1 ? 's' : ''}, those areas are also connected to this transit.`
    : null;
  const interactionBodies = [...new Set([...item.transitInteractions.natalPlanetsAspected, ...item.natalInteractions.conjunctions])];
  const interactionSentence = interactionBodies.length
    ? language === 'HINGLISH' ? `${item.planet} calculated aspect ya same-sign association ke through aapke natal ${interactionBodies.join(' aur ')} se bhi connect karega.` : `${item.planet} will also connect with your natal ${interactionBodies.join(' and ')} through calculated aspect or same-sign association.`
    : null;
  const summary = [
    `direct ${ordinal(item.currentHouse)}-house themes: ${names(item.houseThemes)}`,
    aspects.length ? `aspect-activated houses: ${ordinalList(aspects)}` : null,
    item.natalHouseLordship.length ? `lordship-related houses: ${ordinalList(item.natalHouseLordship)}` : null,
  ].filter(Boolean);
  const extendedContext = [aspectSentence, lordshipSentence, interactionSentence].filter(Boolean).join(' ');
  const direct = language === 'HINGLISH' ? `Jab ${item.planet} aapke ${ordinal(item.currentHouse)} house mein move karega${date ? `, ${date} ko` : ''}, direct focus ${names(item.houseThemes)} par hoga.` : `When ${item.planet} moves into your ${ordinal(item.currentHouse)} house${date ? ` on ${date}` : ''}, the direct emphasis shifts toward ${names(item.houseThemes)}.`;
  const bridge = language === 'HINGLISH' ? `Lekin effect sirf ${ordinal(item.currentHouse)} house tak limited nahi hai.` : `But the effect does not stop at the ${ordinal(item.currentHouse)} house.`;
  const overall = language === 'HINGLISH' ? 'Overall, is transit mein activate hoga:' : 'Overall, this transit activates:';
  const correction = requestedDate && dateMatched === false ? language === 'HINGLISH' ? `Aapne ${requestedDate} ke baare mein poocha tha, lekin calculated ${item.planet} ingress ${date} ko hai.` : `You asked about ${requestedDate}, but the calculated ${item.planet} ingress is on ${date}.` : '';
  const comparison = currentItem && currentItem.currentHouse !== item.currentHouse ? language === 'HINGLISH' ? `Current transit ke comparison mein focus ${names(currentItem.houseThemes)} se ${names(item.houseThemes)} ki taraf shift hoga.` : `Compared with the current transit, the focus shifts from ${names(currentItem.houseThemes)} to ${names(item.houseThemes)}.` : '';
  return `${[correction, direct].filter(Boolean).join('\n\n')}${extendedContext ? `\n\n${bridge}\n\n${extendedContext}` : ''}${comparison ? `\n\n${comparison}` : ''}\n\n${overall}\n${summary.map((value) => `- ${value}`).join('\n')}\n\nWhy: ${upcomingWhy(item, { language })}`;
}
function diagnostic(log, event, fields) { if (typeof log === 'function') log({ event, ...fields }); }
function unsupported(language) { return language === 'HINGLISH' ? 'Main calculated Gochar se aapke current transits explain kar sakti hoon, lekin is transit question ka reliable answer dene ke liye abhi ready nahi hoon.' : 'I can explain your current Gochar from calculated chart data, but I’m not ready to answer that transit question reliably yet.'; }

class TaraTransitCapability {
  constructor({ transitSnapshotService, clock = () => new Date().toISOString() } = {}) { if (!transitSnapshotService || typeof transitSnapshotService.contextForTara !== 'function') throw new TypeError('INVALID_TARA_TRANSIT_SNAPSHOT_SERVICE'); this.transits = transitSnapshotService; this.clock = clock; }
  async respond({ principal, birthProfileId, message, language = 'ENGLISH', diagnosticLog = null } = {}) {
    const intent = classifyTaraTransitIntent(message);
    diagnostic(diagnosticLog, 'TARA_TRANSIT_ROUTE', { domain: 'TRANSIT', intent: intent.intent, planet: intent.planet, birthProfileId });
    if (intent.intent === TaraTransitIntent.UPCOMING_TRANSIT_EFFECT) diagnostic(diagnosticLog, 'TARA_TRANSIT_UPCOMING_ROUTE', { planet: intent.planet });
    if (intent.intent === TaraTransitIntent.UNSUPPORTED_TRANSIT) { const result = Object.freeze({ intent: intent.intent, state: 'UNSUPPORTED_TRANSIT', answerability: 'UNSUPPORTED', message: unsupported(language), evidence: Object.freeze([]) }); diagnostic(diagnosticLog, 'TARA_TRANSIT_RESPONSE', { state: result.state, birthProfileId }); return result; }
    const now = isoNow(this.clock); const requestedDate = requestedDateInstant(intent.requestedDate, now);
    let context;
    const upcomingScan = intent.intent === TaraTransitIntent.UPCOMING_TRANSIT_EFFECT
      ? { horizonDays: horizonDaysFor({ now, requestedDate }), scanBodies: [intent.planet[0].toUpperCase() + intent.planet.slice(1)], scanEventTypes: ['rashiIngress'], scanOptions: { coarseScanStepMilliseconds: DAILY_COARSE_SCAN_MILLISECONDS } }
      : null;
    if (upcomingScan) diagnostic(diagnosticLog, 'TARA_TRANSIT_SCAN_START', { planet: intent.planet, scanStart: now, scanHorizonDays: upcomingScan.horizonDays });
    try { context = await this.transits.contextForTara({ principal, birthProfileId, at: now, horizonDays: upcomingScan ? upcomingScan.horizonDays : 30, ...(upcomingScan ? { scanBodies: upcomingScan.scanBodies, scanEventTypes: upcomingScan.scanEventTypes, scanOptions: upcomingScan.scanOptions } : {}) }); diagnostic(diagnosticLog, 'TARA_TRANSIT_CALCULATION', { status: 'SUCCEEDED', birthProfileId }); } catch (_) { const result = Object.freeze({ intent: intent.intent, state: 'CALCULATION_UNAVAILABLE', answerability: 'INSUFFICIENT_EVIDENCE', message: language === 'HINGLISH' ? 'Main aapka current transit picture abhi reliably calculate nahi kar pa rahi hoon.' : 'I’m unable to calculate your current transit picture reliably right now.', evidence: Object.freeze([]) }); diagnostic(diagnosticLog, 'TARA_TRANSIT_CALCULATION', { status: 'FAILED', birthProfileId }); diagnostic(diagnosticLog, 'TARA_TRANSIT_RESPONSE', { state: result.state, birthProfileId }); return result; }
    const evidence = evidenceFor({ snapshot: context.snapshot, natalHouses: context.natalHouses, intent });
    diagnostic(diagnosticLog, 'TARA_TRANSIT_EVIDENCE', { evidenceItemCount: evidence.length, birthProfileId });
    if (!evidence.length) { const result = Object.freeze({ intent: intent.intent, state: 'INSUFFICIENT_EVIDENCE', answerability: 'INSUFFICIENT_EVIDENCE', message: language === 'HINGLISH' ? 'Main requested transit influence ko abhi reliably identify nahi kar pa rahi hoon.' : 'I’m unable to identify the requested transit influence reliably right now.', evidence }); diagnostic(diagnosticLog, 'TARA_TRANSIT_RESPONSE', { state: result.state, birthProfileId }); return result; }
    let messageOut;
    if (intent.intent === TaraTransitIntent.UPCOMING_TRANSIT_EFFECT) {
      const planet = evidence[0].planet; const transitions = context.insightContext && context.insightContext.upcomingTransitions || [];
      diagnostic(diagnosticLog, 'TARA_TRANSIT_SCAN_RESULT', { planet: intent.planet, eventCount: transitions.length, candidateEventTypes: [...new Set(transitions.map((item) => item.type).filter(Boolean))] });
      const selected = transitionFor({ transitions, planet, requestedDate }); const transition = selected && selected.transition;
      const date = transition && displayDate(transition.at);
      if (!transition || !date) {
        messageOut = language === 'HINGLISH' ? `Main ${planet} ka current calculated transit explain kar sakti hoon, lekin available calculated window mein next change date safely identify nahi ho raha hai.` : `I can explain ${planet}'s current calculated transit, but I’m not able to safely state the next change date from the available transit window.`;
      } else {
        diagnostic(diagnosticLog, 'TARA_TRANSIT_INGRESS_MATCH', { planet: intent.planet, matchedIngressDate: transition.at, matchedDestinationSign: transition.toSign || null });
        try {
          const futureContext = await this.transits.contextForTara({ principal, birthProfileId, at: transition.at });
          const futureEvidence = evidenceFor({ snapshot: futureContext.snapshot, natalHouses: futureContext.natalHouses, intent });
          const futureItem = futureEvidence.find((item) => item.planet === planet);
          messageOut = futureItem
            ? upcomingMessage({ item: futureItem, currentItem: evidence[0], date, language, requestedDate: intent.requestedDate && intent.requestedDate.label, dateMatched: selected.dateMatched })
            : language === 'HINGLISH' ? `Main ${planet} ka current calculated transit explain kar sakti hoon, lekin upcoming ingress context abhi reliably calculate nahi ho raha hai.` : `I can explain ${planet}'s current calculated transit, but I’m unable to calculate its upcoming ingress context reliably right now.`;
        } catch (_) {
          messageOut = language === 'HINGLISH' ? `Main ${planet} ka current calculated transit explain kar sakti hoon, lekin upcoming ingress context abhi reliably calculate nahi ho raha hai.` : `I can explain ${planet}'s current calculated transit, but I’m unable to calculate its upcoming ingress context reliably right now.`;
        }
      }
    } else if (intent.intent === TaraTransitIntent.LIFE_AREA_TRANSIT_EFFECT) {
      const relevant = evidence.filter((item) => relevantForArea(item, intent.area));
      const selected = relevant.slice(0, 3);
      messageOut = selected.length ? `${language === 'HINGLISH' ? `Aapke ${intent.area.toLowerCase()} par abhi mixed lekin meaningful transit activation hai.` : `Your ${intent.area.toLowerCase()} is receiving mixed but meaningful transit activation right now.`}\n\n${selected.map((item) => `${item.planet}: ${meaning(item, { area: intent.area, language })}`).join('\n')}\n\n${attention(selected[0], { area: intent.area, language })}\n\nWhy: ${selected.map((item) => why(item, { language })).join(' ')}` : `${language === 'HINGLISH' ? `Current major transits is ${intent.area.toLowerCase()} view ke core natal houses se directly connect nahi kar rahe hain.` : `The current major transits do not directly connect with the core natal houses TaraVerse uses for this ${intent.area.toLowerCase()} view.`}\n\n${overview(evidence, { language })}`;
    } else if (intent.intent === TaraTransitIntent.PLANET_TRANSIT_EFFECT) { const item = evidence[0]; const lordship = item.natalHouseLordship.length ? language === 'HINGLISH' ? ` Aapke chart mein ${item.planet} ${item.natalHouseLordship.map(ordinal).join(' aur ')} house${item.natalHouseLordship.length > 1 ? 's' : ''} rule karta hai, isliye ${names(item.lordshipThemes)} ka connection bhi banta hai.` : ` Because ${item.planet} also rules your ${item.natalHouseLordship.map(ordinal).join(' and ')} house${item.natalHouseLordship.length > 1 ? 's' : ''}, this also connects with ${names(item.lordshipThemes)}.` : ''; messageOut = language === 'HINGLISH' ? `${item.planet} abhi aapke ${ordinal(item.currentHouse)} house ko activate kar raha hai, isliye ${names(item.houseThemes)} jaise themes zyada active hain.${lordship}\n\n${attention(item, { language })}\n\nWhy: ${why(item, { language })}` : `${item.planet} is currently activating your ${ordinal(item.currentHouse)} house, so the strongest themes are ${names(item.houseThemes)}.${lordship}\n\n${attention(item, { language })}\n\nWhy: ${why(item, { language })}`; }
    else messageOut = overview(evidence, { language });
    const result = Object.freeze({ intent: intent.intent, state: 'GROUNDED', answerability: 'SUPPORTED', message: messageOut, evidence });
    diagnostic(diagnosticLog, 'TARA_TRANSIT_RESPONSE', { state: result.state, birthProfileId });
    return result;
  }
}
module.exports = { TaraTransitCapability, TaraTransitIntent, classifyTaraTransitIntent, TRANSIT_PLANETS };
