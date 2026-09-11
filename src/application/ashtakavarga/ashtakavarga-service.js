'use strict';
const { classifyLayer1Bodies } = require('../../jyotish');
const { calculateRashiHouses } = require('../../bhava');
const { calculateRawAshtakavarga } = require('../../ashtakavarga');
const { repositoryError } = require('../../persistence/contracts');
function fail(code) { throw repositoryError(code); }
function request(b) { return { date:b.localDate,time:b.localTime,timezone:b.timezone,latitude:b.latitude,longitude:b.longitude }; }
function sign(r) { return { rashiIndex:r.rashiIndex, sanskritName:r.rashiName }; }
function scores(result) { return result.rashis.map((r) => ({ sign:sign(r), score:r.favorableMarkCount })); }
function at(scores, rashiIndex) { const value=scores.find((item)=>item.sign.rashiIndex===rashiIndex); return value ? value.score : null; }
function careerContext(raw, houses) { const byHouse=new Map(houses.houses.map((house)=>[house.houseNumber,house])); const h2=byHouse.get(2),h10=byHouse.get(10),h11=byHouse.get(11); if(!h2||!h10||!h11) return null; const sav=scores(raw.rawSarvashtakavarga),lagna=scores(raw.lagnaBav),lord=raw.planetaryBavs[h10.rashiHouseLord]; const h10LordBav=lord ? at(scores(lord),h10.rashi.rashiIndex) : null; return Object.freeze({ h2Sav:Object.freeze({ house:2,bindu:at(sav,h2.rashi.rashiIndex) }), h10Sav:Object.freeze({ house:10,bindu:at(sav,h10.rashi.rashiIndex) }), h11Sav:Object.freeze({ house:11,bindu:at(sav,h11.rashi.rashiIndex) }), h10LagnaBav:Object.freeze({ house:10,bindu:at(lagna,h10.rashi.rashiIndex) }), ...(h10LordBav===null?{}:{h10LordBav:Object.freeze({ planet:h10.rashiHouseLord,house:10,bindu:h10LordBav })}) }); }
function dto(profileId, raw, houses) { const lagnaRashiIndex=houses.ascendant.rashi.rashiIndex; return Object.freeze({ birthProfileId:profileId, lagnaRashiIndex, sav:Object.freeze({ rulesetId:raw.rawSarvashtakavarga.rulesetId, signScores:Object.freeze(scores(raw.rawSarvashtakavarga)) }), bav:Object.freeze(Object.values(raw.planetaryBavs).map((b) => Object.freeze({ body:b.targetBody,rulesetId:b.rulesetId,signScores:Object.freeze(scores(b)) }))), lagnaBav:Object.freeze({ rulesetId:raw.lagnaBav.rulesetId,signScores:Object.freeze(scores(raw.lagnaBav)) }), ...(careerContext(raw,houses)?{careerContext:careerContext(raw,houses)}:{}) }); }
function calculateAshtakavargaForLayer2(layer2Bodies) {
 const placements=Object.fromEntries(['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn','Ascendant'].map((body)=>[body,layer2Bodies[body].jyotishCoordinates.rashi.rashiIndex]));
 return calculateRawAshtakavarga({rashiPlacements:placements});
}
class AshtakavargaService {
 constructor({ birthProfileService, astronomicalEngine }={}) { if(!birthProfileService||typeof birthProfileService.get!=='function')throw new TypeError('AshtakavargaService requires SecureBirthProfileService.get.'); if(!astronomicalEngine||typeof astronomicalEngine.calculate!=='function')throw new TypeError('AshtakavargaService requires an injected astronomicalEngine.'); this.birthProfileService=birthProfileService;this.astronomicalEngine=astronomicalEngine;Object.freeze(this); }
 async get({principal,birthProfileId}={}) { const profile=await this.birthProfileService.get({principal,birthProfileId}); if(!profile||profile.status!=='active')fail('NOT_FOUND_OR_FORBIDDEN'); try { const layer1=this.astronomicalEngine.calculate(request(profile.birthData)); const layer2=classifyLayer1Bodies(layer1); const houses=calculateRashiHouses({ascendantCanonicalSiderealLongitude:layer1.bodies.Ascendant.siderealLongitudeDegrees,bodies:layer1.bodies}); return dto(profile.id,calculateAshtakavargaForLayer2(layer2),houses); } catch (_) { fail('ASHTAKAVARGA_CALCULATION_FAILED'); } }
}
module.exports={AshtakavargaService,calculateAshtakavargaForLayer2};
