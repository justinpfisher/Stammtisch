/* Entirely fictional bytes and mocked HTTP. No real publication or secrets. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {COL_RULE_PUBLIC_FILES,observeHostedCoL} from '../scripts/annals/observe-hosted-col.mjs';

const digest=v=>createHash('sha256').update(v).digest('hex');
const bodies=Object.fromEntries(COL_RULE_PUBLIC_FILES.map((name,i)=>[name,'FICTIONAL ONLY '+i+' '+name]));
const expected=Object.fromEntries(COL_RULE_PUBLIC_FILES.map(name=>[name,digest(bodies[name])]));
const at='2026-10-15T18:00:00.000Z';
function mockFetch({mismatch,missing,redirected,huge}={}){
  const requests=[];
  const fn=async(url,options)=>{
    const path=new URL(url).pathname.slice(1);requests.push({url,options});
    assert.equal(url,'https://stammtischbrewery.com/'+path);
    assert.equal(options.redirect,'error');
    assert.equal(options.credentials,'omit');
    assert.equal(options.cache,'no-store');
    assert.equal(options.method,'GET');
    if(path===missing)return {status:503,redirected:false,arrayBuffer:async()=>Buffer.from('Not ready')};
    if(path===redirected)return {status:200,redirected:true,arrayBuffer:async()=>Buffer.from(bodies[path])};
    const body=path===mismatch?'Partially deployed and stale':bodies[path];
    return {status:200,redirected:false,
      headers:{get:key=>key==='content-length'?(huge===path?String(1048576):String(Buffer.byteLength(body))):null},
      arrayBuffer:async()=>Buffer.from(body)};
  };
  return {fn,requests};
}

test('exact public snapshot reports a read-only observation, never rule-activation authority',async()=>{
  const {fn,requests}=mockFetch();
  const observation=await observeHostedCoL(expected,{fetchImpl:fn,clock:()=>new Date(at)});
  assert.equal(observation.kind,'public-col-byte-observation-only');
  assert.equal(observation.origin,'https://stammtischbrewery.com/');
  assert.equal(observation.startedAt,at);
  assert.equal(observation.completedAt,at);
  assert.deepEqual(observation.files.map(x=>x.path),COL_RULE_PUBLIC_FILES);
  assert.ok(observation.files.every(x=>x.sha256===expected[x.path]&&x.bytes>0));
  assert.equal(requests.length,5);
  for(const forbidden of ['activationAt','effectiveAt','active','verified','signature','key','sourceText']){
    assert.equal(Object.hasOwn(observation,forbidden),false);
  }
  assert.equal(JSON.stringify(observation).includes('FICTIONAL ONLY'),false);
});

test('a partially deployed, stale, missing or redirected public asset fails closed',async()=>{
  const partial=mockFetch({mismatch:'celebration.html'});
  await assert.rejects(observeHostedCoL(expected,{fetchImpl:partial.fn,clock:()=>new Date(at)}),/hosted byte mismatch/);
  assert.equal(partial.requests.length,4,'A mismatch does not inspect or bless remaining assets');
  for(const option of [
    {missing:'data/col-rules-versions.json'},
    {redirected:'data/col-rules-register.json'},
    {huge:'col-revisions.html'}
  ]){
    await assert.rejects(observeHostedCoL(expected,{fetchImpl:mockFetch(option).fn,clock:()=>new Date(at)}),/evidence/);
  }
});

test('source expectations are exact and exclude arbitrary URLs, secret or extra inputs',async()=>{
  const f=mockFetch();
  for(const wrong of [
    {},
    {...expected,'https://example.test/private':'a'.repeat(64)},
    {...expected,'data/not-approved.json':'a'.repeat(64)},
    {...expected,'celebration.html':'invalid'},
    Object.fromEntries(Object.entries(expected).filter(([key])=>key!=='col-revisions.html'))
  ]){
    await assert.rejects(observeHostedCoL(wrong,{fetchImpl:f.fn,clock:()=>new Date(at)}),/five source-bound/);
  }
  assert.equal(f.requests.length,0);
});

test('unknown transport and time evidence cannot produce a successful snapshot',async()=>{
  await assert.rejects(observeHostedCoL(expected,{fetchImpl:async()=>{throw Error('Simulated timeout');},clock:()=>new Date(at)}),/evidence unavailable/);
  await assert.rejects(observeHostedCoL(expected,{fetchImpl:mockFetch().fn,clock:()=>new Date(NaN)}),/Valid observation clock/);
  let n=0;
  await assert.rejects(observeHostedCoL(expected,{fetchImpl:mockFetch().fn,clock:()=>new Date(n++?'2026-10-15T17:00:00Z':at)}),/clock moved backwards/);
});
