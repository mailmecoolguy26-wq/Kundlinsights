'use strict';

function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.freeze(value); Object.values(value).forEach(freeze); return value; }
const utc = (epochMilliseconds) => new Date(epochMilliseconds).toISOString();
const returnRecord = (index, epochMilliseconds, bracketLowEpochMilliseconds, lowResidual, highResidual, iterations) => ({ index, epochMilliseconds: String(epochMilliseconds), utc: utc(epochMilliseconds), bracketLowEpochMilliseconds: String(bracketLowEpochMilliseconds), bracketLowUtc: utc(bracketLowEpochMilliseconds), bracketHighEpochMilliseconds: String(epochMilliseconds), bracketHighUtc: utc(epochMilliseconds), residualImmediatelyBelow: lowResidual, residualAtOrAfter: highResidual, iterations });

const SWISS_C_SOLAR_RETURN_GOLDEN_PROVENANCE = freeze({
  fixtureStatus: 'INDEPENDENT_SWISS_C_GOLDEN', source: 'official Swiss Ephemeris C 2.10.03 local swetest/source build', swissVersion: '2.10.03', officialReferenceTool: 'temporary direct C harness linked against official libswe.a; not the Node sweph binding', generationMethod: 'native SE_SIDM_LAHIRI, SEFLG_SWIEPH|SEFLG_SPEED|SEFLG_SIDEREAL; daily 350–380 / prior 380–350 bracket; integer-millisecond bisection; Moshier/JPL rejected', siderealMode: 'SE_SIDM_LAHIRI', ephemerisMode: 'SWIEPH', coordinateFrame: 'geocentric-ecliptic-of-date; native-sidereal-lahiri', targetDefinition: 'natal canonical Lahiri sidereal Sun longitude', ephemerisFiles: [{ fileName: 'sepl_18.se1', byteLength: 484061, sha256: 'ca1393ceab3a44fbc895887cf789c68819ae6a1cbc9b22225872dbe4ccd99a66' }, { fileName: 'semo_18.se1', byteLength: 1304771, sha256: '1ca07bd67c24374d77226180c20a4f9996cba013697894810518e7eb582ca4f7' }], productionAuthority: false });

const HYDERABAD_SOLAR_RETURN_GOLDEN = freeze({
  fixtureId: 'independent-swiss-c-hyderabad-1990-lahiri-v1', birthInstantUtc: '1990-11-26T08:10:00.000Z', natalSunCanonicalSiderealLongitude: 220.07412509999472, moonCanonicalSiderealLongitude: 319.5198697609602,
  returns: [
    returnRecord(-20, 28443934737, 28443934736, -7.905583743195166e-9, 3.878113830069196e-9, 26),
    returnRecord(-18, 91560537200, 91560537199, -4.914738838124322e-9, 6.863359658382251e-9, 27),
    returnRecord(-17, 123118655729, 123118655728, -3.567208750610007e-9, 8.216204605560051e-9, 26),
    returnRecord(-3, 564932724912, 564932724911, -7.150617875595344e-10, 1.0594220611892524e-8, 26),
    returnRecord(-2, 596490804373, 596490804372, -9.087301577892504e-9, 2.687926325961598e-9, 27),
    returnRecord(-1, 628049092585, 628049092584, -5.8139164593740134e-9, 5.9689000408980064e-9, 26),
    returnRecord(1, 691165268782, 691165268781, -1.1262841326242778e-8, 5.138645065017045e-10, 27),
    returnRecord(2, 722723242863, 722723242862, -4.9824677716969745e-9, 6.801030849601375e-9, 26),
    returnRecord(3, 754281058428, 754281058427, -9.572886483510956e-9, 2.202511950599728e-9, 27)
  ],
  chronology: { rahu: { startUtc: '1973-07-20T11:29:06.641Z', endUtc: '1991-07-21T02:11:46.831Z' }, jupiter: { startUtc: '1991-07-21T02:11:46.831Z', endUtc: '2007-07-21T04:40:20.799Z' }, saturn: { startUtc: '2007-07-21T04:40:20.799Z', endUtc: '2026-07-21T01:33:54.601Z' }, mercury: { startUtc: '2026-07-21T01:33:54.601Z', endUtc: '2043-07-21T10:16:28.360Z', mercuryAntardashaEndUtc: '2028-12-16T17:23:56.383Z', mercuryPratyantardashaEndUtc: '2026-11-22T16:24:29.853Z' }, activeAt20260812: ['mercury', 'mercury', 'mercury'] }
});

const SWISS_C_SOLAR_RETURN_MATRIX = freeze([
  ['hyderabad-1990',220.07412509999472,659607000000,691165268782], ['near-zero',0.001,955670400000,987185593452], ['near-360',359.999,955670400000,987185417057], ['wrap-zero',0,955670400000,987185505254], ['leap-year',256.0060150826978,946684800000,978242715607], ['historical',256.8470480238734,-631152000000,-599593371656], ['future',256.1886119263439,2524608000000,2556166385696], ['different-timezone-same-utc',220.07412509999472,659607000000,691165268782], ['north-observer-invariant',220.07412509999472,659607000000,691165268782], ['south-observer-invariant',220.07412509999472,659607000000,691165268782], ['other-dasha-lord',256.7668165730952,978307200000,1009865549464], ['long-venus-case',256.5032771943079,1009843200000,1041401335167]
].map(([fixtureId, targetLongitude, anchorEpochMilliseconds, returnEpochMilliseconds]) => ({ fixtureId, targetLongitude, anchorUtc: utc(anchorEpochMilliseconds), returnUtc: utc(returnEpochMilliseconds) })));

module.exports = freeze({ SWISS_C_SOLAR_RETURN_GOLDEN_PROVENANCE, HYDERABAD_SOLAR_RETURN_GOLDEN, SWISS_C_SOLAR_RETURN_MATRIX });
