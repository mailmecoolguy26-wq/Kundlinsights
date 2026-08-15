'use strict';
const { classifyLayer1Bodies } = require('../../jyotish');
const { calculateRawAshtakavarga } = require('../../ashtakavarga');
const { repositoryError } = require('../../persistence/contracts');
function fail(code) { throw repositoryError(code); }
function request(b) { return { date:b.localDate,time:b.localTime,timezone:b.timezone,latitude:b.latitude,longitude:b.longitude }; }
function sign(r) { return { rashiIndex:r.rashiIndex, sanskritName:r.rashiName }; }
function scores(result) { return result.rashis.map((r) => ({ sign:sign(r), score:r.favorableMarkCount })); }
function dto(profileId, raw) { return Object.freeze({ birthProfileId:profileId, sav:Object.freeze({ rulesetId:raw.rawSarvashtakavarga.rulesetId, signScores:Object.freeze(scores(raw.rawSarvashtakavarga)) }), bav:Object.freeze(Object.values(raw.planetaryBavs).map((b) => Object.freeze({ body:b.targetBody,rulesetId:b.rulesetId,signScores:Object.freeze(scores(b)) }))), lagnaBav:Object.freeze({ rulesetId:raw.lagnaBav.rulesetId,signScores:Object.freeze(scores(raw.lagnaBav)) }) }); }
class AshtakavargaService {
 constructor({ birthProfileService, astronomicalEngine }={}) { if(!birthProfileService||typeof birthProfileService.get!=='function')throw new TypeError('AshtakavargaService requires SecureBirthProfileService.get.'); if(!astronomicalEngine||typeof astronomicalEngine.calculate!=='function')throw new TypeError('AshtakavargaService requires an injected astronomicalEngine.'); this.birthProfileService=birthProfileService;this.astronomicalEngine=astronomicalEngine;Object.freeze(this); }
 async get({principal,birthProfileId}={}) { const profile=await this.birthProfileService.get({principal,birthProfileId}); if(!profile||profile.status!=='active')fail('NOT_FOUND_OR_FORBIDDEN'); try { const layer1=this.astronomicalEngine.calculate(request(profile.birthData)); const layer2=classifyLayer1Bodies(layer1); const placements=Object.fromEntries(['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn','Ascendant'].map((body)=>[body,layer2[body].jyotishCoordinates.rashi.rashiIndex])); return dto(profile.id,calculateRawAshtakavarga({rashiPlacements:placements})); } catch (_) { fail('ASHTAKAVARGA_CALCULATION_FAILED'); } }
}
module.exports={AshtakavargaService};
