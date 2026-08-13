'use strict';const test=require('node:test'),assert=require('node:assert/strict');const{SecureBirthProfileService}=require('../../src/application/birth-profiles');
const p={provider:'supabase',subject:'a',isAnonymous:false},birth={localDate:'2000-01-01',localTime:'00:00:00',timezone:'UTC',utc:'2000-01-01T00:00:00.000Z',latitude:0,longitude:0,timezoneProvenance:{x:1}};
test('secure birth profiles derive owner from verified principal and return safe DTOs',async()=>{let stored;const s=new SecureBirthProfileService({authUserResolver:async x=>({id:x.subject==='a'?'A':'B',status:'active'}),transactionExecutor:{execute:async({operation})=>operation({})},repositories:()=>({birthProfiles:{createBirthProfile:async x=>(stored={...x,status:'active',updatedAt:x.createdAt}),listBirthProfilesForUser:async u=>u==='A'?[stored]:[],getBirthProfile:async()=>stored}}),idGenerator:()=> 'profile-1',clock:()=> '2026-01-01T00:00:00.000Z'});const x=await s.create({principal:p,birthData:birth,userId:'B'});assert.equal(stored.userId,'A');assert.equal(x.id,'profile-1');assert.equal('userId'in x,false);assert.equal((await s.list({principal:p})).length,1);assert.equal((await s.get({principal:p,birthProfileId:'profile-1'})).id,'profile-1');await assert.rejects(s.get({principal:{...p,subject:'b'},birthProfileId:'profile-1'}),e=>e.code==='NOT_FOUND_OR_FORBIDDEN');});

test('secure birth profiles sequence crypto before runtime, use stored historical versions, and clear operation keys',async()=>{
  const events=[]; const rows=[]; const keys={v1:Buffer.alloc(32,1),v2:Buffer.alloc(32,2)};let active='v1';
  const tx={execute:async({role,operation})=>{events.push(role);return operation({role})}};
  const coordinator={current:async()=>tx.execute({role:'app_crypto',operation:async()=>({keyVersion:active,dek:Buffer.from(keys[active])})}),forVersion:async(_p,_u,v)=>tx.execute({role:'app_crypto',operation:async()=>({keyVersion:v,dek:Buffer.from(keys[v])})})};
  const repos=()=>({birthProfiles:{
    createEncryptedBirthProfile:async input=>{assert.equal(events.at(-1),'app_runtime');const r={id:input.id,userId:input.userId,displayLabel:input.displayLabel,...input.encryptedPayload,status:'active',createdAt:input.createdAt,updatedAt:input.createdAt};rows.push(r);return r},
    getEncryptedBirthProfile:async id=>rows.find(r=>r.id===id),listEncryptedBirthProfilesForUser:async()=>rows,
  }});
  const s=new SecureBirthProfileService({authUserResolver:async()=>({id:'A',status:'active'}),transactionExecutor:tx,repositories:repos,cryptoCoordinator:coordinator,idGenerator:(()=>{let n=0;return()=>`profile-${++n}`})(),clock:()=> '2026-01-01T00:00:00.000Z'});
  const first=await s.create({principal:p,birthData:birth,displayLabel:'one'});assert.deepEqual(events,['app_crypto','app_runtime']);assert.equal('ciphertext'in first,false);assert.equal(rows[0].keyVersion,'v1');
  rows[0].keyVersion='v1';events.length=0;const fetched=await s.get({principal:p,birthProfileId:first.id});assert.deepEqual(fetched.birthData,birth);assert.deepEqual(events,['app_runtime','app_crypto']);
  active='v2';const second=await s.create({principal:p,birthData:{...birth,latitude:1},displayLabel:'two'});events.length=0;const listed=await s.list({principal:p});assert.equal(listed.length,2);assert.deepEqual(events,['app_runtime','app_crypto','app_crypto']);assert.equal(keys.v1.every(x=>x===1),true);assert.equal(keys.v2.every(x=>x===2),true);
  assert.equal(second.id,'profile-2');
});

test('crypto failure prevents runtime persistence and runtime failure leaves only the independently provisioned key phase',async()=>{
  const events=[];let inserts=0;const tx={execute:async({role,operation})=>{events.push(role);return operation({})}};const base={authUserResolver:async()=>({id:'A',status:'active'}),transactionExecutor:tx,repositories:()=>({birthProfiles:{createEncryptedBirthProfile:async()=>{inserts++;throw new Error('runtime fail')}}}),idGenerator:()=> 'profile-fail',clock:()=> '2026-01-01T00:00:00.000Z'};
  const cryptoFailure=new SecureBirthProfileService({...base,cryptoCoordinator:{current:async()=>tx.execute({role:'app_crypto',operation:async()=>{throw new Error('kms fail')}}),forVersion:async()=>{throw new Error('unused')}}});
  await assert.rejects(cryptoFailure.create({principal:p,birthData:birth}),e=>e.code==='BIRTH_PROFILE_CREATE_FAILED');assert.deepEqual(events,['app_crypto']);assert.equal(inserts,0);
  events.length=0;const runtimeFailure=new SecureBirthProfileService({...base,cryptoCoordinator:{current:async()=>tx.execute({role:'app_crypto',operation:async()=>({keyVersion:'v1',dek:Buffer.alloc(32,1)})}),forVersion:async()=>{throw new Error('unused')}}});
  await assert.rejects(runtimeFailure.create({principal:p,birthData:birth}),e=>e.code==='BIRTH_PROFILE_CREATE_FAILED');assert.deepEqual(events,['app_crypto','app_runtime']);assert.equal(inserts,1);
});
