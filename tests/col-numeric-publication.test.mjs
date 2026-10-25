import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {attestationBytes,ACTIVATION_DOMAIN,buildNumericPayload,sha256,
  signNumericRelease} from '../col-numeric-adapter.mjs';
import {verifyNumericTrust,verifyNumericViewerRun,verifyIndependentSource,
  numericDispatchBundle,prepareNumericPublication} from '../scripts/col-numeric-publication.mjs';
import {observeNumericSite} from '../scripts/col-numeric-live-witness.mjs';

const ROOT=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const baseline=JSON.parse(await readFile(path.join(ROOT,'data/celebration.json'),'utf8'));
const clubState=JSON.parse(await readFile(path.join(ROOT,'data/col-club-state.json'),'utf8'));
const now=new Date('2026-10-23T12:00:00.000Z'),commit='b'.repeat(40);
const behavior='f'.repeat(64),source='a'.repeat(64);
const purpose=['authenticated-member-action','independent-death-verifier',
  'numeric-activation-boundary','viewer-source-row-observer','numeric-release'];
const keys=purpose.map((p,i)=>({purpose:p,id:'owner-numeric-'+String(i+1).padStart(4,'0'),
  pair:generateKeyPairSync('ed25519')}));
const keyring={schemaVersion:1,currentReleaseDigest:null,keys:keys.map(x=>({
  id:x.id,purpose:x.purpose,algorithm:'Ed25519',
  publicKey:x.pair.publicKey.export({type:'spki',format:'pem'})}))};
const sourceObservation={kind:'col-source-readonly-observation-v1',sourceDigest:source,
  observedAt:'2026-10-23T11:55:00.925895Z',implementationCommit:commit,
  workflowRunId:'123456',scope:'spreadsheets.readonly'};
const qualification={kind:'col-prospective-calculation-qualification-v1',implementationCommit:commit,
  workflowRunId:'123456',sourceObservation,sourceAllocationMatch:true,
  regressionPassed:true,signedRelease:false,
  qualification:'source-matched-candidate-calculation-only'};
const viewerRun={id:123456,head_sha:commit,status:'completed',conclusion:'success',
  repository:{full_name:'justinpfisher/Stammtisch'},event:'push',
  path:'.github/workflows/col-source-observe.yml'};
const freshSource={...sourceObservation,observedAt:'2026-10-23T11:59:00.000Z',workflowRunId:'789123'};
const activationPayload={schemaVersion:1,activationId:'activation-000001',
  effectiveAt:'2026-10-23T11:56:00.000Z',implementationCommit:commit,
  sourceDigest:source,behaviorDigest:behavior,viewerQualificationDigest:sha256(qualification),
  issuedAt:'2026-10-23T11:56:00.000Z'};
const activationKey=keys.find(k=>k.purpose==='numeric-activation-boundary');
const numericKey=keys.find(k=>k.purpose==='numeric-release');
const activationWitness={keyId:activationKey.id,payload:activationPayload,
  signature:sign(null,attestationBytes(ACTIVATION_DOMAIN,activationPayload),activationKey.pair.privateKey).toString('base64')};
const prep=()=>({viewerRun,qualification,sourceObservation:freshSource,baseline,
  clubState,keyring,previousRelease:null,checkoutCommit:commit,publisherRunId:'789123',now,
  behaviorDigest:behavior});
async function published() {
  const p=buildNumericPayload({baseline,clubState,viewerQualification:qualification,
    sourceDigest:source,implementationCommit:commit,behaviorDigest:behavior,keyring,
    activationWitness,events:[],actionEnvelopes:[],now});
  const release=signNumericRelease(p,{privateKey:numericKey.pair.privateKey,keyId:numericKey.id,
    previousReleaseDigest:null,expectedPreviousDigest:null});
  const bundle={schemaVersion:1,kind:'col-numeric-publication-request-v1',release,
    activationWitness,events:[],actionEnvelopes:[]};
  return {bundle,release};
}

test('five distinct real-purpose signing anchors are required before any hosted publication',()=>{
  assert.equal(verifyNumericTrust(keyring),true);
  assert.throws(()=>verifyNumericTrust({...keyring,keys:[]}),/Five qualified/);
  assert.throws(()=>verifyNumericTrust({...keyring,keys:keyring.keys.map((x,i)=>i===0?
    {...x,id:'test-insecure'}:x)}),/Invalid or duplicate/);
  const duplicated=structuredClone(keyring);duplicated.keys[4].publicKey=duplicated.keys[3].publicKey;
  assert.throws(()=>verifyNumericTrust(duplicated),/reuses a trust key/);
});

test('the Viewer must be the real successful exact-commit main workflow',()=>{
  assert.equal(verifyNumericViewerRun(viewerRun,qualification,{implementationCommit:commit}),true);
  assert.equal(verifyNumericViewerRun({...viewerRun,
    path:'justinpfisher/Stammtisch/.github/workflows/col-source-observe.yml@refs/heads/main'},
    qualification,{implementationCommit:commit}),true);
  assert.throws(()=>verifyNumericViewerRun({...viewerRun,head_sha:'c'.repeat(40)},qualification,
    {implementationCommit:commit}),/Viewer workflow identity/);
  assert.throws(()=>verifyNumericViewerRun({...viewerRun,conclusion:'failure'},qualification,
    {implementationCommit:commit}),/Viewer workflow identity/);
  assert.throws(()=>verifyNumericViewerRun({...viewerRun,path:'other.yml'},qualification,
    {implementationCommit:commit}),/Viewer workflow identity/);
});

test('fresh separate source observation must match the actual Viewer digest',()=>{
  assert.equal(verifyIndependentSource(freshSource,qualification,
    {commit,publisherRunId:'789123',now}),true);
  assert.throws(()=>verifyIndependentSource({...freshSource,sourceDigest:'d'.repeat(64)},
    qualification,{commit,publisherRunId:'789123',now}),/source changed/);
});

test('reconstructs an independently authenticated, signed no-event activation without alerts',async()=>{
  const {bundle,release}=await published();
  const result=await prepareNumericPublication({...prep(),bundle});
  const digest=sha256(release);
  assert.equal(result.releaseDigest,digest);
  assert.equal(result.witness.previousReleaseDigest,null);
  assert.equal(Object.keys(result.files).length,4);
  assert.equal(JSON.parse(result.files['data/col-numeric-trust.json']).currentReleaseDigest,digest);
  assert.equal(JSON.parse(result.files['data/col-numeric-release.json']).payload.activationAt,
    activationPayload.effectiveAt);
  assert.equal(Object.hasOwn(release.payload,'notificationEligibleEvents'),false);
});

test('refuses source drift, forged run, altered signed snapshot, replay base, and stale requests',async()=>{
  const {bundle}=await published();
  await assert.rejects(prepareNumericPublication({...prep(),bundle,
    sourceObservation:{...freshSource,sourceDigest:'1'.repeat(64)}}),/source changed/);
  await assert.rejects(prepareNumericPublication({...prep(),bundle,
    viewerRun:{...viewerRun,head_sha:'c'.repeat(40)}}),/Viewer workflow identity/);
  const tampered=structuredClone(bundle);tampered.release.payload.siteResults.members[0].score++;
  await assert.rejects(prepareNumericPublication({...prep(),bundle:tampered}),/reconstructed|website|release/i);
  await assert.rejects(prepareNumericPublication({...prep(),bundle,
    keyring:{...keyring,currentReleaseDigest:'4'.repeat(64)}}),/release pointer/);
  await assert.rejects(prepareNumericPublication({...prep(),bundle,
    now:new Date('2026-10-23T12:40:00.000Z')}),/Fresh signed complete numeric release/);
  const unsafe={...bundle,events:[{name:'Fictional',born:'1900-01-01',diedOn:'2026-10-23',
    discoveredOn:'2026-10-23',deathWitness:{},viewerRowWitness:{},rawEmail:'PRIVATE'}]};
  await assert.rejects(prepareNumericPublication({...prep(),bundle:unsafe}),
    /Only screened signed numerical evidence/);
});

test('complete six-member signed snapshot fits bounded Apps Script gzip dispatch',async()=>{
  const {bundle}=await published();
  const payload=gzipSync(Buffer.from(JSON.stringify(bundle),'utf8')).toString('base64');
  const dispatch={schemaVersion:1,kind:'col-numeric-gzip-dispatch-v1',encoding:'gzip+base64',payload};
  assert(payload.length<60000,'Real baseline must fit GitHub dispatch after compression');
  assert(JSON.stringify(dispatch).length<65535,'GitHub repository_dispatch cap');
  assert.deepEqual(numericDispatchBundle(dispatch),bundle);
  assert.throws(()=>numericDispatchBundle({...dispatch,payload:'!'}),/Bounded compressed/);
  assert.throws(()=>numericDispatchBundle({...dispatch,payload:'a'.repeat(60004)}),/Bounded compressed/);
  const bomb=gzipSync(Buffer.alloc(513*1024,32)).toString('base64');
  assert.throws(()=>numericDispatchBundle({...dispatch,payload:bomb}),/Invalid or oversized/);
});

test('public live witness verifies every hosted byte and browser-verifier result',async()=>{
  const {bundle}=await published();
  const result=await prepareNumericPublication({...prep(),bundle});
  const files={...result.files,'data/celebration.json':JSON.stringify(baseline),
    'data/col-club-state.json':JSON.stringify(clubState)};
  const getName=full=>{
    const normalized=full.replaceAll('\\','/');
    return Object.keys(files).find(p=>normalized.endsWith('/'+p));
  };
  const readImpl=async p=>files[getName(p)];
  const fetchImpl=async url=>({status:200,redirected:false,text:async()=>files[getName(url)]});
  const observed=await observeNumericSite({fetchImpl,readImpl,now:now.getTime()});
  assert.equal(observed.releaseDigest,result.releaseDigest);
  const tampered=async url=>({status:200,redirected:false,
    text:async()=>files[getName(url)]+' '});
  await assert.rejects(observeNumericSite({fetchImpl:tampered,readImpl,now:now.getTime()}),
    /asset differs/);
});
