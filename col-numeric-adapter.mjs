/* Protected prospective CoL numeric release boundary.
 * All keys and hosted witnesses are supplied by separately controlled trust
 * domains. This module never upgrades unsigned input to trusted evidence. */
import {createHash, createPrivateKey, createPublicKey, sign, verify} from 'node:crypto';
import {migrateBaseline, calculatePassing, prospectiveTotals, annualRights,
  beginDraft, applyDraftAction, MEMBERS} from './col-prospective.mjs';
import {readClubState} from './col-club-state.mjs';

export const NUMERIC_DOMAIN='Stammtisch-CoL-Numeric-Release-v1';
export const ACTION_DOMAIN='Stammtisch-CoL-Authenticated-Member-Action-v1';
export const DEATH_DOMAIN='Stammtisch-CoL-Independent-Death-Witness-v1';
const HEX=/^[a-f0-9]{64}$/;
const ISO=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?(?:Z|[+-]\d\d:\d\d)$/;
const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
const canonical=v=>Array.isArray(v)?`[${v.map(canonical).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`:JSON.stringify(v);
export const sha256=v=>createHash('sha256').update(typeof v==='string'?v:canonical(v)).digest('hex');
const trustProjection=keyring=>({schemaVersion:keyring?.schemaVersion??1,keys:keyring?.keys??[]});
export const attestationBytes=(domain,payload)=>Buffer.from(`${domain}\n${canonical(payload)}`,'utf8');
const exact=(obj,keys)=>obj&&Object.keys(obj).sort().join(',')===keys.slice().sort().join(',');

export function verifyAttestation(envelope,{domain,keyring,purpose,now,maxAgeMs=86400000}) {
  assert(envelope&&(domain===NUMERIC_DOMAIN?exact(envelope,['schemaVersion','kind','keyId','payload','signature']):exact(envelope,['keyId','payload','signature'])), 'Signed attestation required');
  if(domain===NUMERIC_DOMAIN)assert(envelope.schemaVersion===1&&envelope.kind==='col-numeric-site-release-v1','Numeric release envelope required');
  assert(domain===ACTION_DOMAIN||domain===DEATH_DOMAIN||domain===NUMERIC_DOMAIN,'Unknown signature domain');
  const key=keyring?.keys?.find(k=>k.id===envelope.keyId&&k.purpose===purpose&&k.algorithm==='Ed25519');
  assert(key&&typeof key.publicKey==='string','Trusted purpose-specific public key unavailable');
  assert(keyring.keys.filter(k=>k.algorithm==='Ed25519').every((k,i,all)=>all.findIndex(x=>x.publicKey===k.publicKey)===i),
    'Trust domains must use distinct signing keys');
  let signatureBytes;try{signatureBytes=Buffer.from(envelope.signature,'base64');}catch{throw Error('Invalid signature encoding');}
  assert(signatureBytes.length===64&&verify(null,attestationBytes(domain,envelope.payload),createPublicKey(key.publicKey),signatureBytes),'Invalid domain-separated signature');
  const at=envelope.payload?.issuedAt||envelope.payload?.verifiedAt||envelope.payload?.createdAt;
  assert(typeof at==='string'&&ISO.test(at)&&Number.isFinite(Date.parse(at)),'Attestation timestamp required');
  assert(Date.parse(at)<=now.getTime()+60000&&now.getTime()-Date.parse(at)<=maxAgeMs,'Stale or future attestation');
  return envelope.payload;
}

export function verifyMemberAction(envelope,keyring,now,seen=new Set()) {
  const p=verifyAttestation(envelope,{domain:ACTION_DOMAIN,keyring,purpose:'authenticated-member-action',now});
  assert(exact(p,['schemaVersion','eventId','nonce','memberId','action','expectedDraftDigest','sourceMessageDigest','authenticatedAt','issuedAt'])&&p.schemaVersion===1,
    'Invalid attributed action shape');
  assert(MEMBERS.includes(p.memberId)&&/^[a-z0-9-]{12,80}$/.test(p.eventId||'')&&/^[a-f0-9]{32,128}$/.test(p.nonce||'')&&
    HEX.test(p.expectedDraftDigest||'')&&HEX.test(p.sourceMessageDigest||'')&&ISO.test(p.authenticatedAt||'')&&Date.parse(p.authenticatedAt)<=Date.parse(p.issuedAt),
    'Action lacks authenticated attribution');
  const operationDigest=sha256(`${p.memberId}:${canonical(p.action)}`);
  assert(!seen.has(p.eventId)&&!seen.has(p.nonce)&&!seen.has(operationDigest),'Replayed or duplicate member action');
  seen.add(p.eventId);seen.add(p.nonce);seen.add(operationDigest);
  assert(!['summary','draftActions'].includes(p.action?.type),'Historical summaries are not executable actions');
  return structuredClone(p);
}

function verifyDeath(envelope,keyring,now) {
  const p=verifyAttestation(envelope,{domain:DEATH_DOMAIN,keyring,purpose:'independent-death-verifier',now,maxAgeMs:30*86400000});
  assert(exact(p,['schemaVersion','personKey','name','born','diedOn','diedAt','evidenceDigest','verificationRecordDigest','verifiedAt','issuedAt'])&&
    p.schemaVersion===1&&HEX.test(p.evidenceDigest||'')&&HEX.test(p.verificationRecordDigest||'')&&ISO.test(p.verifiedAt||''),
    'Independent death verification record required');
  assert(Date.parse(p.verifiedAt)<=Date.parse(p.issuedAt)&&p.diedOn&&(!p.diedAt||ISO.test(p.diedAt)), 'Invalid actual-death witness');
  return {kind:'independently-verified-death',personKey:p.personKey,name:p.name,born:p.born,diedOn:p.diedOn,diedAt:p.diedAt??undefined,
    digest:p.evidenceDigest,verificationRecordDigest:p.verificationRecordDigest,verifiedAt:p.verifiedAt};
}

function verifyViewerQualification(q,{commit,sourceDigest,now}) {
  assert(q?.kind==='col-prospective-calculation-qualification-v1'&&q.implementationCommit===commit&&
    q.sourceObservation?.implementationCommit===commit&&q.sourceObservation?.sourceDigest===sourceDigest&&
    q.sourceAllocationMatch===true&&q.regressionPassed===true&&q.signedRelease===false&&
    q.qualification==='source-matched-candidate-calculation-only'&&/^[0-9]{1,24}$/.test(q.workflowRunId||'')&&
    q.sourceObservation.workflowRunId===q.workflowRunId,'Exact-commit Viewer qualification mismatch');
  assert(HEX.test(sourceDigest||'')&&ISO.test(q.sourceObservation.observedAt||'')&&Date.parse(q.sourceObservation.observedAt)<=now.getTime(),
    'Invalid or future Viewer observation');
  assert(now.getTime()-Date.parse(q.sourceObservation.observedAt)<=30*60*1000,'Stale Viewer observation');
  return q;
}

/** Build candidate data only; caller must sign and publish with separately
 * authenticated numeric-release authority. No historical row is rewritten. */
export function buildNumericPayload({baseline,clubState,websiteResults=null,events=[],actionEnvelopes=[],draft=null,
  viewerQualification,sourceDigest,implementationCommit,behaviorDigest,keyring,now=new Date()}) {
  assert(HEX.test(behaviorDigest||'')&&/^[a-f0-9]{40}$/.test(implementationCommit||''),'Source-bound implementation required');
  const q=verifyViewerQualification(viewerQualification,{commit:implementationCommit,sourceDigest,now});
  readClubState(clubState);
  const baselineDigest=sha256(baseline),correctionsDigest=sha256(clubState);
  const migration=migrateBaseline(baseline,clubState),siteSnapshot=websiteResults??migration.corrected;
  assert(siteSnapshot&&Array.isArray(siteSnapshot.members)&&siteSnapshot.members.length===6,'Complete website results required');
  for(const member of baseline.members){const current=siteSnapshot.members.find(m=>m.id===member.id);assert(current,'Website member set mismatch');
    for(const old of member.picks.filter(p=>p.counted)){const row=current.picks.find(p=>p.id===old.id);assert(row&&row.counted&&row.points===old.points,'Historical award changed in website snapshot');}}
  const websiteResultsDigest=sha256(siteSnapshot);
  const seen=new Set(),actions=actionEnvelopes.map(a=>verifyMemberAction(a,keyring,now,seen));
  const deaths=events.map(event=>{
    const evidence=verifyDeath(event.deathWitness,keyring,now);
    assert(event.name===evidence.name&&event.born===evidence.born&&event.diedOn===evidence.diedOn,
      'Passing does not match independent witness');
    return {...event,evidence};
  });
  const calculated=deaths.map(e=>calculatePassing({members:baseline.members,event:e,clubState,effectiveAt:now.toISOString(),
    observedAt:now.toISOString(),consumedPeople:migration.consumedPeople}));
  assert(calculated.every(e=>e.status==='calculated'),'One or more passings are held');
  const years=[...new Set(calculated.map(e=>e.seasonYear))];
  const totals=Object.fromEntries(years.map(year=>[year,prospectiveTotals(migration,calculated,year)]));
  const targetYear=Math.max(baseline.year,...years),expected=totals[targetYear]??migration.corrected.members.reduce((out,m)=>(out[m.id]=m.score,out),{});
  assert(siteSnapshot.year===targetYear&&MEMBERS.every(id=>siteSnapshot.members.find(m=>m.id===id)?.score===expected[id]),
    'Website snapshot totals do not match protected calculation');
  const draftActions=actions.filter(a=>a.action?.kind==='draft');
  if(draftActions.length) {
    assert(draft,'Draft state required for draft actions');
    let state=structuredClone(draft);
    for(const event of draftActions){assert(event.action.memberId===event.memberId&&event.expectedDraftDigest===sha256(state),
      'Draft action attribution or state base mismatch');state=applyDraftAction(state,{...event.action,id:event.eventId});}
    draft=state;
  }
  return {schemaVersion:1,kind:'col-numeric-release-payload-v1',implementationCommit,behaviorDigest,sourceDigest,
    viewerRunId:q.workflowRunId,viewerObservedAt:q.sourceObservation.observedAt,viewerSourceDigest:q.sourceObservation.sourceDigest,
    viewerQualificationDigest:sha256(q),baselineDigest,correctionsDigest,keyringDigest:sha256(trustProjection(keyring)),
    historicalTotals:Object.fromEntries(baseline.members.map(m=>[m.id,m.score])),calculated,totals,draft:draft??null,
    siteResults:structuredClone(siteSnapshot),siteResultsDigest:websiteResultsDigest,
    actionEventIds:actions.map(a=>a.eventId),actionDigest:sha256(actions),deathWitnessDigests:deaths.map(e=>e.evidence.digest),
    createdAt:now.toISOString(),notificationEligibleEvents:calculated.filter(e=>e.status==='calculated'&&e.evidenceDigest).map(e=>e.personKey)};
}

export function signNumericRelease(payload,{privateKey,keyId,previousReleaseDigest,expectedPreviousDigest}) {
  assert(expectedPreviousDigest===previousReleaseDigest&&(/^[a-f0-9]{64}$/.test(previousReleaseDigest)||previousReleaseDigest===null),
    'Numeric release compare-and-swap failed');
  assert(payload?.kind==='col-numeric-release-payload-v1'&&payload.implementationCommit&&payload.behaviorDigest,'Qualified numeric payload required');
  const envelope={schemaVersion:1,kind:'col-numeric-site-release-v1',keyId,payload:{...payload,previousReleaseDigest}};
  envelope.signature=sign(null,attestationBytes(NUMERIC_DOMAIN,envelope.payload),privateKey?.type==='private'?privateKey:createPrivateKey(privateKey)).toString('base64');
  return envelope;
}

export function verifyNumericRelease(envelope,{keyring,expectedPreviousDigest,now=new Date(),commit,behaviorDigest}) {
  const payload=verifyAttestation(envelope,{domain:NUMERIC_DOMAIN,keyring,purpose:'numeric-release',now,maxAgeMs:365*86400000});
  assert(payload.kind==='col-numeric-release-payload-v1'&&payload.previousReleaseDigest===expectedPreviousDigest&&
    payload.implementationCommit===commit&&payload.behaviorDigest===behaviorDigest,'Numeric release chain or source mismatch');
  assert(Array.isArray(payload.calculated)&&payload.calculated.every(e=>e.status==='calculated')&&payload.historicalTotals&&
    MEMBERS.every(m=>Number.isInteger(payload.historicalTotals[m])),'Incomplete numeric result');
  return payload;
}
