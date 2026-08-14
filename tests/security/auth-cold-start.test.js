'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const auth = path.join(root, 'src/security/auth');
const verifier = path.join(root, 'src/security/auth/supabase-auth-verifier');
const runtime = path.join(root, 'src/runtime');

function load(script) {
  const child = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stderr.includes('circular dependency'), false, child.stderr);
  return JSON.parse(child.stdout);
}

test('AUTH-P1.1 cold-start loads public auth and production runtime exports without a circular dependency warning', () => {
  const result = load(`const auth=require(${JSON.stringify(auth)});const runtime=require(${JSON.stringify(runtime)});console.log(JSON.stringify({verifier:typeof auth.createSupabaseAuthVerifier,principal:typeof auth.verifiedPrincipal,runtime:typeof runtime.createProductionRuntime}));`);
  assert.deepEqual(result, { verifier: 'function', principal: 'function', runtime: 'function' });
});

test('AUTH-P1.1 alternate verifier-first load order preserves the same public exports without warnings', () => {
  const result = load(`const verifier=require(${JSON.stringify(verifier)});const auth=require(${JSON.stringify(auth)});const runtime=require(${JSON.stringify(runtime)});console.log(JSON.stringify({verifier:typeof verifier.createSupabaseAuthVerifier,publicVerifier:typeof auth.createSupabaseAuthVerifier,principal:typeof auth.verifiedPrincipal,runtime:typeof runtime.createProductionRuntime}));`);
  assert.deepEqual(result, { verifier: 'function', publicVerifier: 'function', principal: 'function', runtime: 'function' });
});
