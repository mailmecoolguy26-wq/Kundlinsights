'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { SecureBirthProfileService } = require('../../src/application/birth-profiles');
const { BirthProfilePayloadCodec } = require('../../src/security/crypto');

const principal = { provider: 'supabase', subject: 'subject-a', isAnonymous: false };
const legacyBirthData = Object.freeze({ localDate: '2000-01-01', localTime: '01:02:03', timezone: 'Asia/Kolkata', utc: '1999-12-31T19:32:03.000Z', latitude: 12.5, longitude: 77.5, timezoneProvenance: { provider: 'fixture' }, fixtureExtra: { preserved: true } });

async function harness({ birthData = legacyBirthData, reverseGeocode = async()=>({provider:'google-geocoding',displayName:'Fixture City, Fixture State, Fixture Country'}), concurrentValue = null } = {}) {
  const key = Buffer.alloc(32, 7);
  const keyProvider = { current: async()=>({keyVersion:'v1',dek:Buffer.from(key)}), forVersion: async()=>({keyVersion:'v1',dek:Buffer.from(key)}) };
  const codec = new BirthProfilePayloadCodec({ userDekProvider:keyProvider });
  const encoded = await codec.encodeBirthData({userId:'user-a',profileId:'profile-001',birthData});
  let row = {id:'profile-001',userId:'user-a',displayLabel:'Synthetic Profile',...encoded,status:'active',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',archivedAt:null};
  let providerCalls=0, writes=0;
  const diagnostics=[];
  const birthProfiles = {
    listEncryptedBirthProfilesForUser:async()=>[row],
    getEncryptedBirthProfile:async()=>row,
    recoverEncryptedBirthProfileLocation:async(input)=>{
      writes++;
      if (concurrentValue) {
        const replacement=await codec.encodeBirthData({userId:'user-a',profileId:'profile-001',birthData:{...birthData,displayLocation:concurrentValue}});
        row={...row,...replacement,updatedAt:'2026-01-01T00:00:02.000Z'};
        return null;
      }
      if(input.expectedUpdatedAt!==row.updatedAt)return null;
      row={...row,...input.encryptedPayload,updatedAt:input.updatedAt};
      return row;
    },
  };
  const service=new SecureBirthProfileService({authUserResolver:async()=>({id:'user-a',status:'active'}),transactionExecutor:{execute:async({operation})=>operation({})},repositories:()=>({birthProfiles}),cryptoCoordinator:keyProvider,reverseGeocodingProvider:{reverseGeocode:async(input)=>{providerCalls++;return reverseGeocode(input)}},idGenerator:()=> 'unused',clock:()=> '2026-01-01T00:00:01.000Z',recoveryRetryMilliseconds:60000});
  const list=()=>service.list({principal,diagnosticLog:(entry)=>diagnostics.push(entry)});
  return {service,list,codec,birthProfiles,diagnostics,calls:()=>providerCalls,writes:()=>writes,row:()=>row};
}

test('legacy profile location is recovered into encrypted birthData without changing calculation fields or label',async()=>{
  const h=await harness();
  const [profile]=await h.list();
  assert.equal(profile.birthData.displayLocation,'Fixture City, Fixture State, Fixture Country');
  assert.equal(profile.displayLabel,'Synthetic Profile');
  const {displayLocation,...unchanged}=profile.birthData;
  assert.deepEqual(unchanged,legacyBirthData);
  assert.equal(h.calls(),1);assert.equal(h.writes(),1);
  const persisted=await h.codec.decodeBirthData({userId:'user-a',profileId:'profile-001',...h.row()});
  assert.equal(persisted.displayLocation,displayLocation);
  assert.ok(h.diagnostics.some((entry)=>entry.recoveryStatus==='LEGACY_LOCATION_RECOVERY_SUCCEEDED'));
  assert.ok(h.diagnostics.every((entry)=>!JSON.stringify(entry).includes('12.5')&&!JSON.stringify(entry).includes('77.5')&&!JSON.stringify(entry).includes('Fixture City')));
});

test('existing displayLocation is preserved and never reverse geocoded',async()=>{
  const h=await harness({birthData:{...legacyBirthData,displayLocation:'Existing Place'}});
  assert.equal((await h.list())[0].birthData.displayLocation,'Existing Place');
  assert.equal(h.calls(),0);assert.equal(h.writes(),0);
});

test('provider failure fails open and is deferred instead of retried on every list',async()=>{
  const h=await harness({reverseGeocode:async()=>{const error=new Error('raw provider detail');error.code='PLACE_PROVIDER_UNAVAILABLE';throw error;}});
  assert.equal((await h.list())[0].birthData.displayLocation,undefined);
  assert.equal((await h.list())[0].birthData.displayLocation,undefined);
  assert.equal(h.calls(),1);assert.equal(h.writes(),0);
  assert.ok(h.diagnostics.some((entry)=>entry.reasonCode==='PLACE_PROVIDER_UNAVAILABLE'));
  assert.equal(JSON.stringify(h.diagnostics).includes('raw provider detail'),false);
});

test('invalid coordinates skip provider and concurrent recovery never overwrites the winning value',async()=>{
  const invalid=await harness({birthData:{...legacyBirthData,latitude:91}});
  assert.equal((await invalid.list())[0].birthData.displayLocation,undefined);assert.equal(invalid.calls(),0);
  const concurrent=await harness({concurrentValue:'Concurrent Winner'});
  assert.equal((await concurrent.list())[0].birthData.displayLocation,'Concurrent Winner');
  assert.equal(concurrent.writes(),1);
  assert.ok(concurrent.diagnostics.some((entry)=>entry.recoveryStatus==='LEGACY_LOCATION_ALREADY_PRESENT'&&entry.reasonCode==='CONCURRENT_UPDATE'));
});
