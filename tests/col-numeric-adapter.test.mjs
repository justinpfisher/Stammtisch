import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {attestationBytes,ACTION_DOMAIN,DEATH_DOMAIN,NUMERIC_DOMAIN,buildNumericPayload,
  signNumericRelease,verifyNumericRelease,verifyMemberAction,sha256} from '../col-numeric-adapter.mjs';
import {prospectiveBehaviorDigest} from '../scripts/annals/RulesRelease.mjs';
import {verifyNumericSiteRelease} from '../col-numeric-reader.mjs';

const memberKeys=generateKeyPairSync('ed25519'),deathKeys=generateKeyPairSync('ed25519'),numericKeys=generateKeyPairSync('ed25519');
const keyring={keys:[{id:'test-member-authority',purpose:'authenticated-member-action',algorithm:'Ed25519',publicKey:memberKeys.publicKey.export({type:'spki',format:'pem'})},
  {id:'test-death-verifier',purpose:'independent-death-verifier',algorithm:'Ed25519',publicKey:deathKeys.publicKey.export({type:'spki',format:'pem'})},
  {id:'test-numeric-release',purpose:'numeric-release',algorithm:'Ed25519',publicKey:numericKeys.publicKey.export({type:'spki',format:'pem'})}]};
const now=new Date('2026-10-23T12:00:00.000Z');
function attest(domain,keyId,payload){const key=domain===ACTION_DOMAIN?memberKeys.privateKey:domain===DEATH_DOMAIN?deathKeys.privateKey:numericKeys.privateKey;
  return {keyId,payload,signature:sign(null,attestationBytes(domain,payload),key).toString('base64')};}
const observation={kind:'col-source-readonly-observation-v1',sourceDigest:'a'.repeat(64),observedAt:'2026-10-23T11:55:00.000Z',
  implementationCommit:'b'.repeat(40),workflowRunId:'123456',scope:'spreadsheets.readonly',qualification:'snapshot-only-not-formula-or-allocation-approval'};
const qualification={kind:'col-prospective-calculation-qualification-v1',implementationCommit:'b'.repeat(40),workflowRunId:'123456',
  sourceObservation:observation,sourceAllocationMatch:true,regressionPassed:true,signedRelease:false,
  qualification:'source-matched-candidate-calculation-only'};
const clubState=JSON.parse(await readFile(new URL('../data/col-club-state.json',import.meta.url)));
const baseline=JSON.parse(await readFile(new URL('../data/celebration.json',import.meta.url)));
async function payload(overrides={}) {return buildNumericPayload({baseline,clubState,events:[],actionEnvelopes:[],draft:null,
  viewerQualification:qualification,sourceDigest:observation.sourceDigest,implementationCommit:observation.implementationCommit,
  behaviorDigest:await prospectiveBehaviorDigest(),keyring,now,...overrides});}

test('builds source-bound candidate without rewriting historical awards or trusting draft summaries',async()=>{
  const result=await payload();
  assert.equal(result.kind,'col-numeric-release-payload-v1');
  assert.equal(result.historicalTotals.matt,baseline.members.find(m=>m.id==='matt').score);
  assert.equal(result.baselineDigest,sha256(baseline));
  assert.equal(result.correctionsDigest,sha256(clubState));
  assert.deepEqual(result.actionEventIds,[]);
  // Numerical releases never authorise notifications: only the independent
  // first-confirmed-passing delivery path may send a death alert.
  assert.equal(Object.hasOwn(result,'notificationEligibleEvents'),false);
});

test('requires exact Viewer source, commit, and recent observation',async()=>{
  await assert.rejects(payload({sourceDigest:'f'.repeat(64)}),/Viewer qualification mismatch/);
  await assert.rejects(payload({implementationCommit:'c'.repeat(40)}),/Viewer qualification mismatch/);
  const stale={...qualification,sourceObservation:{...observation,observedAt:'2026-10-23T10:00:00.000Z'}};
  await assert.rejects(payload({viewerQualification:stale}),/stale/i);
});

test('requires signed, attributable, replay-protected member actions; summaries are not executable',async()=>{
  const action={schemaVersion:1,eventId:'event-000000001',nonce:'1'.repeat(32),memberId:'marc',action:{kind:'member-decision',type:'note'},
    expectedDraftDigest:'b'.repeat(64),
    sourceMessageDigest:'c'.repeat(64),authenticatedAt:'2026-10-23T11:50:00.000Z',issuedAt:'2026-10-23T11:51:00.000Z'};
  const envelope=attest(ACTION_DOMAIN,'test-member-authority',action);
  const result=await payload({actionEnvelopes:[envelope]});
  assert.deepEqual(result.actionEventIds,[action.eventId]);
  await assert.rejects(payload({actionEnvelopes:[envelope,envelope]}),/replayed/i);
  const summary=attest(ACTION_DOMAIN,'test-member-authority',{...action,action:{type:'summary',text:'Advance draft'}});
  assert.throws(()=>verifyMemberAction(summary,keyring,now,new Set()),/summaries are not executable/);
  const bad=attest(ACTION_DOMAIN,'test-member-authority',{...action,memberId:'unknown'});
  assert.throws(()=>verifyMemberAction(bad,keyring,now,new Set()),/authenticated attribution/);
  const forged={...envelope,signature:Buffer.alloc(64).toString('base64')};
  assert.throws(()=>verifyMemberAction(forged,keyring,now,new Set()),/Invalid domain-separated signature/);
});

test('requires independently signed death evidence and rejects model or digest-shaped claims',async()=>{
  const witness={schemaVersion:1,personKey:'example:1900-01-01',name:'Example Person',born:'1900-01-01',diedOn:'2026-10-22',diedAt:null,
    evidenceDigest:'d'.repeat(64),verificationRecordDigest:'e'.repeat(64),verifiedAt:'2026-10-23T11:00:00.000Z',issuedAt:'2026-10-23T11:01:00.000Z'};
  const event={name:witness.name,born:witness.born,diedOn:witness.diedOn,deathWitness:attest(DEATH_DOMAIN,'test-death-verifier',witness)};
  await assert.rejects(payload({events:[event]}),/passings are held/i);
  await assert.rejects(payload({events:[{...event,deathWitness:{...event.deathWitness,payload:{...witness,verifiedAt:'model-assertion'}}}]}),/Invalid/i);
  await assert.rejects(payload({events:[{...event,deathWitness:{...event.deathWitness,payload:{...witness,evidenceDigest:'not-a-digest'}}}]}),/Invalid/i);
});

test('signs with numeric domain, rejects wrong key, stale chain and concurrent CAS',async()=>{
  const candidate=await payload(),envelope=signNumericRelease(candidate,{privateKey:numericKeys.privateKey,keyId:'test-numeric-release',
    previousReleaseDigest:null,expectedPreviousDigest:null});
  const activeTrust={...keyring,previousReleaseDigest:null,currentReleaseDigest:sha256(envelope)};
  const verified=verifyNumericRelease(envelope,{keyring,expectedPreviousDigest:null,now,commit:candidate.implementationCommit,behaviorDigest:candidate.behaviorDigest});
  assert.equal(verified.kind,'col-numeric-release-payload-v1');
  assert.deepEqual(await verifyNumericSiteRelease({release:envelope,keyring:activeTrust,baseline,clubState,now:now.getTime()}),baseline);
  assert.throws(()=>signNumericRelease(candidate,{privateKey:numericKeys.privateKey,keyId:'test-numeric-release',previousReleaseDigest:'a'.repeat(64),expectedPreviousDigest:null}),/compare-and-swap/);
  assert.throws(()=>verifyNumericRelease({...envelope,signature:sign(null,attestationBytes(ACTION_DOMAIN,envelope.payload),memberKeys.privateKey).toString('base64')},
    {keyring,expectedPreviousDigest:null,now,commit:candidate.implementationCommit,behaviorDigest:candidate.behaviorDigest}),/Invalid domain-separated/);
  assert.throws(()=>verifyNumericRelease(envelope,{keyring,expectedPreviousDigest:'a'.repeat(64),now,commit:candidate.implementationCommit,behaviorDigest:candidate.behaviorDigest}),/chain or source mismatch/);
  assert.throws(()=>verifyNumericRelease(envelope,{keyring,expectedPreviousDigest:null,now,commit:'c'.repeat(40),behaviorDigest:candidate.behaviorDigest}),/chain or source mismatch/);
  const altered=structuredClone(baseline);altered.members.find(m=>m.id==='matt').score++;
  assert.equal(await verifyNumericSiteRelease({release:envelope,keyring:activeTrust,baseline,clubState:{...clubState,schemaVersion:99},now:now.getTime()}),null);
  assert.equal(await verifyNumericSiteRelease({release:envelope,keyring:activeTrust,baseline:altered,clubState,now:now.getTime()}),null);
});
