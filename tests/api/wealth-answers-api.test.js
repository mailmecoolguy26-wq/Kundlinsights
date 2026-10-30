'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApi } = require('../../src/api');
const { createTestOnlyAuthVerifier } = require('../../src/api/test-only-auth-verifier');

test('Wealth Answers API is authenticated, profile-scoped, and exposes only the server-owned answer', async () => {
  const principal={provider:'supabase',subject:'subject-a',isAnonymous:false}; const calls=[];
  const app=createApi({authVerifier:createTestOnlyAuthVerifier({a:principal}),userResolver:{resolve:async()=>({id:'user-a',status:'active'})},birthProfileService:{create:async()=>null,list:async()=>[],get:async()=>null},secureReadingService:{},wealthAnswerService:{answer:async(input)=>{calls.push(input);return {intent:input.intent,state:'Mixed',ruleVersion:'wealth-rules-v1',strongerWindow:null};}},requestIdGenerator:()=> 'wealth-request'});
  const response=await app.inject({method:'POST',url:'/v1/birth-profiles/profile-a/wealth-answers',headers:{authorization:'Bearer a'},payload:{intent:'WEALTH_CURRENT_OUTLOOK',clientChart:'ignored'}});
  assert.equal(response.statusCode,200); assert.equal(response.json().wealthAnswer.ruleVersion,'wealth-rules-v1'); assert.equal(calls.length,1); assert.equal(calls[0].birthProfileId,'profile-a'); assert.equal(calls[0].principal.subject,'subject-a'); assert.equal(Object.hasOwn(calls[0],'clientChart'),false); await app.close();
});
