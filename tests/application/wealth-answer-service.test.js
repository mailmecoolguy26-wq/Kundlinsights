'use strict';
const test=require('node:test'); const assert=require('node:assert/strict');
const {WealthAnswerService,d1Evidence,dashaEvidence,classify,rankRelative,savEvidence,bavEvidence,parentDashaEvidence,pdRefinement,exactParentPeriods,pdSegments,sampleInstants,sampledTransitEvidence,candidateState,coalesceCandidates,rankCandidate,selectStrongerWindow}=require('../../src/application/wealth');
function houses(){return {houses:Array.from({length:12},(_,i)=>({houseNumber:i+1,rashiHouseLord:i+1===2?'Moon':i+1===11?'Venus':i+1===6?'Saturn':'Sun'})),planetaryAssignments:[{body:'Moon',rashiHouseNumber:2},{body:'Venus',rashiHouseNumber:11},{body:'Saturn',rashiHouseNumber:6}]};}
const period={md:'moon',ad:'venus',pd:'sun',start:'2027-01-01T00:00:00.000Z',end:'2027-06-01T00:00:00.000Z',adStart:'2027-01-01T00:00:00.000Z',adEnd:'2027-12-01T00:00:00.000Z'};
test('Wealth Rules v1 keeps D1 and MD/AD dominant over confirmation-only layers',()=>{const d1=d1Evidence(houses()); const dasha=dashaEvidence(houses(),period); assert.equal(d1.state,'SUPPORTIVE_FOUNDATION'); assert.equal(dasha.eligible,true); assert.equal(classify({d1,dasha,d2:{reinforcement:'REINFORCES'}}),'Supportive'); assert.notEqual(classify({d1:{...d1,state:'UNCLEAR_FOUNDATION'},dasha:{...dasha,eligible:false,state:'NO_RELEVANCE'},d2:{reinforcement:'REINFORCES'}}),'Supportive');});
test('Wealth Rules v1 does not translate financial activity into gain',()=>{const d1=d1Evidence(houses()); const caution=dashaEvidence(houses(),{...period,md:'saturn',ad:'saturn'}); assert.notEqual(classify({d1,dasha:caution,d2:{reinforcement:'NEUTRAL'}}),'Supportive');});

function instant(value){return {utc:value,epochMilliseconds:BigInt(Date.parse(value))};}
function hierarchy(){
  const pd=(lord,start,end)=>({lord:{id:lord},startInstant:instant(start),endInstant:instant(end)});
  const ad=(lord,start,end,children)=>({lord:{id:lord},startInstant:instant(start),endInstant:instant(end),children});
  return {periods:[{lord:{id:'Moon'},startInstant:instant('2027-01-01T00:00:00.000Z'),endInstant:instant('2028-01-01T00:00:00.000Z'),children:[ad('Venus','2027-01-01T00:00:00.000Z','2027-07-01T00:00:00.000Z',[pd('Sun','2027-01-01T00:00:00.000Z','2027-03-01T00:00:00.000Z'),pd('Saturn','2027-03-01T00:00:00.000Z','2027-07-01T00:00:00.000Z')]),ad('Saturn','2027-07-01T00:00:00.000Z','2028-01-01T00:00:00.000Z',[pd('Moon','2027-07-01T00:00:00.000Z','2028-01-01T00:00:00.000Z')])]}]};
}
function twelveHouses(){return {houses:Array.from({length:12},(_,index)=>({houseNumber:index+1,rashi:{rashiIndex:index+1},rashiHouseLord:index+1===2?'Moon':index+1===11?'Venus':index+1===6?'Saturn':'Sun'})),planetaryAssignments:[{body:'Moon',rashiHouseNumber:2},{body:'Venus',rashiHouseNumber:11},{body:'Saturn',rashiHouseNumber:6}]};}
function rawSav(values){return {rawSarvashtakavarga:{rashis:values.map((value,index)=>({rashiIndex:index+1,favorableMarkCount:value}))},planetaryBavs:{}};}
function candidate({start='2027-01-01T00:00:00.000Z',end='2027-02-01T00:00:00.000Z',state='Supportive',ad='venus',pd='sun',transit=true}={}){return {start,end,state,directionalMeaning:state==='Supportive'?'GROWTH':state==='Improving'?'IMPROVING':'CONSOLIDATION',parent:{md:'moon',ad,adStart:'2027-01-01T00:00:00.000Z',adEnd:'2027-07-01T00:00:00.000Z'},parentEvidence:{strength:2},d1:{primary:[{planet:'moon'}]},d2:{reinforcement:'REINFORCES'},pdRefinement:{state:pd==='sun'?'STRENGTHENING':'NEUTRAL'},transit:{persistent:{jupiterSupport:transit,saturnConsolidation:false,nodeCaution:false}},ashtakavarga:{sav:{overallConfirmation:'SUPPORTIVE'}}};}

test('relative SAV ranking is chart-relative and sends ties at ranking boundaries to Neutral',()=>{
  const ranks=rankRelative([35,34,33,32,32,31,30,29,28,27,26,25].map((value,index)=>({house:index+1,value})));
  assert.equal(ranks.get(1),'Strong');assert.equal(ranks.get(4),'Neutral');assert.equal(ranks.get(5),'Neutral');assert.equal(ranks.get(12),'Weak');
  const evidence=savEvidence(rawSav([35,34,33,32,32,31,30,29,28,27,26,25]),twelveHouses());
  assert.equal(evidence.available,true);assert.equal(evidence.houses.find((entry)=>entry.house===2).rank,'Strong');
  const untied=rankRelative([36,35,34,33,32,31,30,29,28,27,26,25].map((value,index)=>({house:index+1,value})));
  assert.equal(untied.get(4),'Strong');assert.equal(untied.get(8),'Neutral');assert.equal(untied.get(12),'Weak');
});

test('same-planet BAV is optional and never fabricates node evidence',()=>{
  const raw={planetaryBavs:{Jupiter:{targetBody:'Jupiter',rashis:Array.from({length:12},(_,index)=>({rashiIndex:index+1,favorableMarkCount:index}))}}};
  const transit={rows:[{planet:'Jupiter',houses:[2]},{planet:'Rahu',houses:[8]}]};
  const bav=bavEvidence(raw,twelveHouses(),transit);
  assert.deepEqual(bav.findings.map((entry)=>entry.planet),['Jupiter']);
});

test('parent extraction retains exact MD/AD boundaries and PD generation discards completed periods',()=>{
  const tree=hierarchy(), d1=d1Evidence(houses()), parents=exactParentPeriods(tree,'2027-02-01T00:00:00.000Z',houses(),d1);
  assert.equal(parents.length,2);assert.equal(parents[0].parent.adStart,'2027-01-01T00:00:00.000Z');assert.equal(parents[0].parent.adEnd,'2027-07-01T00:00:00.000Z');
  const segments=pdSegments([parents[0]],'2027-02-01T00:00:00.000Z',houses());
  assert.equal(segments.length,2);assert.equal(segments[0].pd.temporalStatus,'CURRENT');assert.equal(segments[1].pd.lord,'saturn');assert.equal(segments[1].pd.start,'2027-03-01T00:00:00.000Z');
  assert.deepEqual(sampleInstants(segments[1],'2027-02-01T00:00:00.000Z'),['2027-03-01T00:00:00.000Z','2027-04-30T12:00:00.000Z','2027-06-30T00:00:00.000Z']);
});

test('irrelevant MD/AD has no PD candidates, while PD refinements remain subordinate to a qualifying parent',()=>{
  const noWealth={houses:Array.from({length:12},(_,index)=>({houseNumber:index+1,rashiHouseLord:'Sun'})),planetaryAssignments:[{body:'Sun',rashiHouseNumber:1}]};
  assert.equal(exactParentPeriods(hierarchy(),'2027-01-01T00:00:00.000Z',noWealth,d1Evidence(noWealth)).length,0);
  assert.equal(pdRefinement(houses(),'Moon').state,'STRENGTHENING');assert.equal(pdRefinement(houses(),'Saturn').state,'WEAKENING');
});

test('transit persistence requires two of three samples and six semantic states remain deterministic',()=>{
  const transit=sampledTransitEvidence([{evidence:{supportive:true,consolidation:false,caution:0}},{evidence:{supportive:true,consolidation:false,caution:0}},{evidence:{supportive:false,consolidation:false,caution:0}}]);
  assert.equal(transit.persistent.jupiterSupport,true);
  const base={d1:{state:'SUPPORTIVE_FOUNDATION',primary:[{}]},d2:{reinforcement:'NEUTRAL'},parent:{eligible:true,state:'WEALTH_RELEVANT'},pd:{state:'NEUTRAL'},sav:{overallConfirmation:'NEUTRAL'}};
  assert.equal(candidateState({...base,transit:{persistent:{jupiterSupport:true,saturnConsolidation:false,nodeCaution:false}}}),'Supportive');
  assert.equal(candidateState({...base,transit:{persistent:{jupiterSupport:false,saturnConsolidation:false,nodeCaution:false}}}),'Improving');
  assert.equal(candidateState({...base,transit:{persistent:{jupiterSupport:false,saturnConsolidation:true,nodeCaution:false}}}),'Consolidation');
  assert.equal(candidateState({...base,pd:{state:'WEAKENING'},transit:{persistent:{jupiterSupport:false,saturnConsolidation:false,nodeCaution:false}}}),'Mixed');
  assert.equal(candidateState({...base,d1:{state:'UNCLEAR_FOUNDATION',primary:[]},transit:{persistent:{jupiterSupport:false,saturnConsolidation:false,nodeCaution:true}}}),'Insufficient Evidence');
  assert.equal(candidateState({...base,d1:{state:'LIMITED_FOUNDATION',primary:[]},parent:{eligible:true,state:'MIXED_RELEVANCE'},transit:{persistent:{jupiterSupport:false,saturnConsolidation:false,nodeCaution:true}}}),'Cautious');
});

test('coalescing preserves AD boundaries and caution/state breaks, while ranking remains lexicographic',()=>{
  const one=candidate(),two=candidate({start:'2027-02-01T00:00:00.000Z',end:'2027-03-01T00:00:00.000Z',pd:'moon'}),merged=coalesceCandidates([one,two]);
  assert.equal(merged.length,1);assert.equal(merged[0].end,'2027-03-01T00:00:00.000Z');
  assert.equal(coalesceCandidates([one,candidate({start:'2027-02-01T00:00:00.000Z',end:'2027-03-01T00:00:00.000Z',state:'Mixed'})]).length,2);
  assert.equal(coalesceCandidates([one,candidate({start:'2027-02-01T00:00:00.000Z',end:'2027-03-01T00:00:00.000Z',ad:'saturn'})]).length,2);
  const improving=candidate({start:'2027-04-01T00:00:00.000Z',end:'2027-05-01T00:00:00.000Z',state:'Improving'});
  assert.ok(rankCandidate(one,improving)<0);assert.equal(selectStrongerWindow([{...improving},{...one}]).state,'Supportive');
  assert.equal(selectStrongerWindow([{...candidate({state:'Mixed'})}]),null);
});

test('entitlement gating and profile ownership remain fail-closed before Wealth calculation',async()=>{
  const sampler={sampleCanonicalSiderealSun:()=>({})};
  const locked=new WealthAnswerService({birthProfileService:{get:async()=>{throw new Error('must not load profile');}},astronomicalEngine:{calculate:()=>{throw new Error('must not calculate');}},canonicalSiderealSunSampler:sampler,entitlementService:{getReadingEntitlementStatus:async()=>({profilePremium:{eligible:false}})}});
  const gated=await locked.answer({principal:{subject:'owner'},birthProfileId:'owned'});
  assert.equal(gated.answerability,'PREMIUM_REQUIRED');assert.equal(gated.strongerWindow,null);
  const denied=new WealthAnswerService({birthProfileService:{get:async()=>null},astronomicalEngine:{calculate:()=>null},canonicalSiderealSunSampler:sampler,entitlementService:{getReadingEntitlementStatus:async()=>({profilePremium:{eligible:true}})}});
  await assert.rejects(()=>denied.answer({principal:{subject:'other-user'},birthProfileId:'guessed'}),(error)=>error.code==='NOT_FOUND_OR_FORBIDDEN');
});
