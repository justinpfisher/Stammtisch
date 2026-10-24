import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {attestationBytes,ACTION_DOMAIN,DEATH_DOMAIN,ACTIVATION_DOMAIN,VIEWER_ROW_DOMAIN,NUMERIC_DOMAIN,buildNumericPayload,
  signNumericRelease,verifyNumericRelease,verifyMemberAction,sha256} from '../col-numeric-adapter.mjs';
import {prospectiveBehaviorDigest} from '../scripts/annals/RulesRelease.mjs';
import {verifyNumericSiteRelease} from '../col-numeric-reader.mjs';
import {celebrityKey} from '../col-club-state.mjs';
import {ageAt,basePoints} from '../celebration-rules.mjs';
import {migrateBaseline} from '../col-prospective.mjs';

const memberKeys=generateKeyPairSync('ed25519'),deathKeys=generateKeyPairSync('ed25519'),activationKeys=generateKeyPairSync('ed25519'),viewerKeys=generateKeyPairSync('ed25519'),numericKeys=generateKeyPairSync('ed25519');
const keyring={keys:[{id:'test-member-authority',purpose:'authenticated-member-action',algorithm:'Ed25519',publicKey:memberKeys.publicKey.export({type:'spki',format:'pem'})},
  {id:'test-death-verifier',purpose:'independent-death-verifier',algorithm:'Ed25519',publicKey:deathKeys.publicKey.export({type:'spki',format:'pem'})},
  {id:'test-activation',purpose:'numeric-activation-boundary',algorithm:'Ed25519',publicKey:activationKeys.publicKey.export({type:'spki',format:'pem'})},
  {id:'test-viewer-row',purpose:'viewer-source-row-observer',algorithm:'Ed25519',publicKey:viewerKeys.publicKey.export({type:'spki',format:'pem'})},
  {id:'test-numeric-release',purpose:'numeric-release',algorithm:'Ed25519',publicKey:numericKeys.publicKey.export({type:'spki',format:'pem'})}]};
const now=new Date('2026-10-23T12:00:00.000Z');
function attest(domain,keyId,payload){const key=domain===ACTION_DOMAIN?memberKeys.privateKey:domain===DEATH_DOMAIN?deathKeys.privateKey:domain===ACTIVATION_DOMAIN?activationKeys.privateKey:domain===VIEWER_ROW_DOMAIN?viewerKeys.privateKey:numericKeys.privateKey;
  return {keyId,payload,signature:sign(null,attestationBytes(domain,payload),key).toString('base64')};}
const observation={kind:'col-source-readonly-observation-v1',sourceDigest:'a'.repeat(64),observedAt:'2026-10-23T11:55:00.000Z',
  implementationCommit:'b'.repeat(40),workflowRunId:'123456',scope:'spreadsheets.readonly',qualification:'snapshot-only-not-formula-or-allocation-approval'};
const qualification={kind:'col-prospective-calculation-qualification-v1',implementationCommit:'b'.repeat(40),workflowRunId:'123456',
  sourceObservation:observation,sourceAllocationMatch:true,regressionPassed:true,signedRelease:false,
  qualification:'source-matched-candidate-calculation-only'};
const clubState=JSON.parse(await readFile(new URL('../data/col-club-state.json',import.meta.url)));
const baseline=JSON.parse(await readFile(new URL('../data/celebration.json',import.meta.url)));
const activationPayload={schemaVersion:1,activationId:'activation-000001',effectiveAt:'2026-10-23T10:00:00.000Z',
  implementationCommit:observation.implementationCommit,sourceDigest:observation.sourceDigest,behaviorDigest:'f'.repeat(64),
  viewerQualificationDigest:sha256(qualification),issuedAt:'2026-10-23T11:00:00.000Z'};
const activationWitness=attest(ACTIVATION_DOMAIN,'test-activation',activationPayload);
function rowWitness(event){return attest(VIEWER_ROW_DOMAIN,'test-viewer-row',{schemaVersion:1,sourceDigest:observation.sourceDigest,
  viewerRunId:qualification.workflowRunId,sourceRowDigest:'9'.repeat(64),personKey:celebrityKey(event.name,event.born),
  reportedOn:event.discoveredOn,observedAt:observation.observedAt,issuedAt:'2026-10-23T11:56:00.000Z'});}
function fictionalPassing(observed=observation,day='2026-10-23',avoidId=null){
  const holder=baseline.members.find(m=>m.picks.some(p=>p.id!==avoidId&&p.pick>1&&p.pick<50&&!p.counted&&!p.actualDeathDate&&!p.dateOfPassing));
  const pick=holder.picks.find(p=>p.id!==avoidId&&p.pick>1&&p.pick<50&&!p.counted&&!p.actualDeathDate&&!p.dateOfPassing);
  const event={name:pick.name,born:pick.born,diedOn:day,diedAt:`${day}T11:30:00.000Z`,discoveredOn:day};
  const witness={schemaVersion:1,personKey:celebrityKey(event.name,event.born),name:event.name,born:event.born,diedOn:day,diedAt:event.diedAt,
    evidenceDigest:'d'.repeat(64),verificationRecordDigest:'e'.repeat(64),verifiedAt:`${day}T11:40:00.000Z`,issuedAt:`${day}T11:45:00.000Z`};
  event.deathWitness=attest(DEATH_DOMAIN,'test-death-verifier',witness);
  event.viewerRowWitness=attest(VIEWER_ROW_DOMAIN,'test-viewer-row',{schemaVersion:1,sourceDigest:observed.sourceDigest,
    viewerRunId:observed.workflowRunId,sourceRowDigest:sha256(witness.personKey),personKey:witness.personKey,reportedOn:day,
    observedAt:observed.observedAt,issuedAt:observed.observedAt});
  return {event,holder,pick,points:basePoints(ageAt(event.born,event.diedOn))};
}
function siteWithPassing(source,points){
  const result=structuredClone(migrateBaseline(baseline,clubState).corrected);
  const row=result.members.find(m=>m.id===source.holder.id).picks.find(p=>p.id===source.pick.id);
  row.counted=true;row.points=points;row.dateOfPassing=source.event.diedOn;row.actualDeathDate=source.event.diedOn;
  result.members.find(m=>m.id===source.holder.id).score+=points;
  return result;
}
async function payload(overrides={}) {const useKeyring=overrides.keyring??{...keyring,currentReleaseDigest:overrides.previousRelease?sha256(overrides.previousRelease):null};return buildNumericPayload({baseline,clubState,events:[],actionEnvelopes:[],draft:null,
  viewerQualification:qualification,sourceDigest:observation.sourceDigest,implementationCommit:observation.implementationCommit,
  behaviorDigest:activationPayload.behaviorDigest,keyring:useKeyring,activationWitness,now,...overrides});}

test('builds source-bound candidate without rewriting historical awards or trusting draft summaries',async()=>{
  const result=await payload();
  assert.equal(result.kind,'col-numeric-release-payload-v1');
  assert.equal(result.historicalTotals.matt,baseline.members.find(m=>m.id==='matt').score);
  assert.equal(result.baselineDigest,sha256(baseline));
  assert.equal(result.correctionsDigest,sha256(clubState));
  assert.equal(result.activationAt,activationPayload.effectiveAt);
  assert.equal(result.observedAt,now.toISOString());
  assert.deepEqual(result.actionEventIds,[]);
  // Numerical releases never authorise notifications: only the independent
  // first-confirmed-passing delivery path may send a death alert.
  assert.equal(Object.hasOwn(result,'notificationEligibleEvents'),false);
});

test('no-events release rejects fabricated counted rows, date changes and score-neutral mutations',async()=>{
  const forged=structuredClone(baseline),member=forged.members[0];
  const innocent=member.picks.find(p=>p.counted===false&&Number.isInteger(p.pick));
  assert(innocent,'A living numbered fixture is required');
  innocent.counted=true;innocent.points=0;
  await assert.rejects(payload({websiteResults:forged}),/Unsigned site change without new death or draft authority/);
  const first=await payload();
  const signed=signNumericRelease(first,{privateKey:numericKeys.privateKey,keyId:'test-numeric-release',
    previousReleaseDigest:null,expectedPreviousDigest:null});
  const mutated=structuredClone(first.siteResults);
  mutated.members[0].picks.find(p=>p.counted===false).name='Unverified replacement';
  await assert.rejects(payload({previousRelease:signed,expectedPreviousDigest:sha256(signed),websiteResults:mutated,
    now:new Date('2026-10-23T12:05:00.000Z')}),/Unsigned site change without new death or draft authority/);
});

test('requires a separately signed initial boundary and preserves it across later releases',async()=>{
  await assert.rejects(payload({activationWitness:null}),/activation boundary/i);
  const first=await payload();
  const firstEnvelope=signNumericRelease(first,{privateKey:numericKeys.privateKey,keyId:'test-numeric-release',previousReleaseDigest:null,expectedPreviousDigest:null});
  const laterNow=new Date('2026-10-23T12:10:00.000Z');
  const later=await payload({previousRelease:firstEnvelope,expectedPreviousDigest:sha256(firstEnvelope),now:laterNow});
  assert.equal(later.activationAt,first.activationAt);
  assert.equal(later.observedAt,laterNow.toISOString());
  assert.equal(later.previousReleaseDigest,sha256(firstEnvelope));
  await assert.rejects(payload({previousRelease:firstEnvelope,expectedPreviousDigest:'a'.repeat(64),now:laterNow}),/compare-and-swap/i);
  const forged=structuredClone(activationWitness);forged.payload.effectiveAt='2026-10-20T00:00:00.000Z';
  await assert.rejects(payload({activationWitness:forged}),/signature/i);
});

test('carries awards and consumed identities across releases and rejects a replay or deletion',async()=>{
  const firstPassing=fictionalPassing(),firstSite=siteWithPassing(firstPassing,firstPassing.points);
  const first=await payload({events:[firstPassing.event],websiteResults:firstSite});
  const firstEnvelope=signNumericRelease(first,{privateKey:numericKeys.privateKey,keyId:'test-numeric-release',previousReleaseDigest:null,expectedPreviousDigest:null});
  const nextObservation={...observation,sourceDigest:'7'.repeat(64),observedAt:'2026-10-24T11:55:00.000Z',workflowRunId:'123457'};
  const nextQualification={...qualification,workflowRunId:nextObservation.workflowRunId,sourceObservation:nextObservation};
  const secondPassing=fictionalPassing(nextObservation,'2026-10-24',firstPassing.pick.id);
  const previousSite=structuredClone(first.siteResults);
  const selectedRow=previousSite.members.find(m=>m.id===secondPassing.holder.id).picks.find(p=>p.id===secondPassing.pick.id);
  selectedRow.counted=true;selectedRow.points=secondPassing.points;selectedRow.dateOfPassing='2026-10-24';selectedRow.actualDeathDate='2026-10-24';
  previousSite.members.find(m=>m.id===secondPassing.holder.id).score+=secondPassing.points;
  const second=await payload({previousRelease:firstEnvelope,expectedPreviousDigest:sha256(firstEnvelope),
    viewerQualification:nextQualification,sourceDigest:nextObservation.sourceDigest,events:[secondPassing.event],websiteResults:previousSite,
    now:new Date('2026-10-24T12:00:00.000Z')});
  assert.deepEqual(second.calculated.map(e=>e.personKey),[first.calculated[0].personKey,celebrityKey(secondPassing.event.name,secondPassing.event.born)]);
  assert.equal(second.activationAt,first.activationAt);
  assert(second.siteResults.members.find(m=>m.id===firstPassing.holder.id).picks.find(p=>p.id===firstPassing.pick.id).counted);
  const replayEvent=structuredClone(firstPassing.event);
  replayEvent.viewerRowWitness=attest(VIEWER_ROW_DOMAIN,'test-viewer-row',{schemaVersion:1,sourceDigest:nextObservation.sourceDigest,
    viewerRunId:nextObservation.workflowRunId,sourceRowDigest:sha256(celebrityKey(replayEvent.name,replayEvent.born)),personKey:celebrityKey(replayEvent.name,replayEvent.born),
    reportedOn:'2026-10-23',observedAt:nextObservation.observedAt,issuedAt:nextObservation.observedAt});
  await assert.rejects(payload({previousRelease:firstEnvelope,expectedPreviousDigest:sha256(firstEnvelope),events:[replayEvent],
    viewerQualification:nextQualification,sourceDigest:nextObservation.sourceDigest,now:new Date('2026-10-24T12:00:00.000Z')}),/held|already counted|source row replay/i);
  const erased=structuredClone(previousSite);erased.members.find(m=>m.id===firstPassing.holder.id).picks.find(p=>p.id===firstPassing.pick.id).counted=false;
  await assert.rejects(payload({previousRelease:firstEnvelope,expectedPreviousDigest:sha256(firstEnvelope),
    viewerQualification:nextQualification,sourceDigest:nextObservation.sourceDigest,websiteResults:erased,events:[secondPassing.event],
    now:new Date('2026-10-24T12:00:00.000Z')}),/Previously released award changed/i);
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
  event.discoveredOn='2026-10-23';event.viewerRowWitness=rowWitness(event);
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

test('supports independent 2048-bit RSA-SHA256 signers across all five domains',async()=>{
  const purposes=[
    [ACTION_DOMAIN,'authenticated-member-action','test-rsa-member'],
    [DEATH_DOMAIN,'independent-death-verifier','test-rsa-death'],
    [ACTIVATION_DOMAIN,'numeric-activation-boundary','test-rsa-activation'],
    [VIEWER_ROW_DOMAIN,'viewer-source-row-observer','test-rsa-viewer'],
    [NUMERIC_DOMAIN,'numeric-release','test-rsa-numeric']];
  const signers=new Map(purposes.map(([domain,purpose,keyId])=>[domain,{keyId,
    purpose,keys:generateKeyPairSync('rsa',{modulusLength:2048,publicExponent:0x10001})}]));
  const rsaTrust={keys:[...signers.values()].map(({keyId,purpose,keys})=>({id:keyId,purpose,
    algorithm:'RSA-SHA256',publicKey:keys.publicKey.export({type:'spki',format:'pem'})})),
    currentReleaseDigest:null};
  function nativeCompatibleAttest(domain,content){
    const {keyId,keys}=signers.get(domain);
    return {keyId,payload:content,
      signature:sign('RSA-SHA256',attestationBytes(domain,content),keys.privateKey).toString('base64')};
  }
  const fictional=fictionalPassing();
  fictional.event.deathWitness=nativeCompatibleAttest(DEATH_DOMAIN,fictional.event.deathWitness.payload);
  fictional.event.viewerRowWitness=nativeCompatibleAttest(VIEWER_ROW_DOMAIN,fictional.event.viewerRowWitness.payload);
  const action={schemaVersion:1,eventId:'event-000000002',nonce:'2'.repeat(32),memberId:'marc',
    action:{kind:'member-decision',type:'note'},expectedDraftDigest:'b'.repeat(64),
    sourceMessageDigest:'c'.repeat(64),authenticatedAt:'2026-10-23T11:50:00.000Z',issuedAt:'2026-10-23T11:51:00.000Z'};
  const reused=structuredClone(rsaTrust);
  reused.keys[1].publicKey=signers.get(ACTION_DOMAIN).keys.publicKey.export({type:'pkcs1',format:'pem'});
  assert.throws(()=>verifyMemberAction(nativeCompatibleAttest(ACTION_DOMAIN,action),
    reused,now,new Set()),/distinct signing keys/i);
  const candidate=await payload({keyring:rsaTrust,
    activationWitness:nativeCompatibleAttest(ACTIVATION_DOMAIN,activationPayload),
    events:[fictional.event],websiteResults:siteWithPassing(fictional,fictional.points),
    actionEnvelopes:[nativeCompatibleAttest(ACTION_DOMAIN,action)]});
  const release=signNumericRelease(candidate,{privateKey:signers.get(NUMERIC_DOMAIN).keys.privateKey,
    keyId:signers.get(NUMERIC_DOMAIN).keyId,previousReleaseDigest:null,expectedPreviousDigest:null});
  const active={...rsaTrust,currentReleaseDigest:sha256(release),previousReleaseDigest:null};
  assert.deepEqual(verifyNumericRelease(release,{keyring:active,expectedPreviousDigest:null,now,
    commit:observation.implementationCommit,behaviorDigest:activationPayload.behaviorDigest}),candidate);
  assert.deepEqual(await verifyNumericSiteRelease({release,keyring:active,baseline,clubState,now:now.getTime()}),candidate.siteResults);
  const forged={...release,signature:Buffer.alloc(256).toString('base64')};
  assert.equal(await verifyNumericSiteRelease({release:forged,
    keyring:{...active,currentReleaseDigest:sha256(forged)},baseline,clubState,now:now.getTime()}),null);
  const weak=generateKeyPairSync('rsa',{modulusLength:1024,publicExponent:0x10001});
  assert.throws(()=>signNumericRelease(candidate,{privateKey:weak.privateKey,keyId:'test-rsa-numeric',
    previousReleaseDigest:null,expectedPreviousDigest:null}),/insufficiently strong/i);
});
