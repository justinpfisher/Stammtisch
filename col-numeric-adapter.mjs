/* Protected prospective CoL numeric release boundary.
 * All keys and hosted witnesses are supplied by separately controlled trust
 * domains. This module never upgrades unsigned input to trusted evidence. */
import {createHash, createPrivateKey, createPublicKey, sign, verify} from 'node:crypto';
import {migrateBaseline, calculatePassing, prospectiveTotals, annualRights,
  beginDraft, applyDraftAction, MEMBERS} from './col-prospective.mjs';
import {readClubState, celebrityKey} from './col-club-state.mjs';
import {numericBaselineProjection} from './col-numeric-baseline.mjs';

export const NUMERIC_DOMAIN='Stammtisch-CoL-Numeric-Release-v1';
export const ACTION_DOMAIN='Stammtisch-CoL-Authenticated-Member-Action-v1';
export const DEATH_DOMAIN='Stammtisch-CoL-Independent-Death-Witness-v1';
export const ACTIVATION_DOMAIN='Stammtisch-CoL-Numeric-Activation-Boundary-v1';
export const VIEWER_ROW_DOMAIN='Stammtisch-CoL-Viewer-Source-Row-v1';
const HEX=/^[a-f0-9]{64}$/;
const ISO=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/;
const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
const canonical=v=>Array.isArray(v)?`[${v.map(canonical).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`:JSON.stringify(v);
export const sha256=v=>createHash('sha256').update(typeof v==='string'?v:canonical(v)).digest('hex');
const trustProjection=keyring=>({schemaVersion:keyring?.schemaVersion??1,keys:keyring?.keys??[]});
export const attestationBytes=(domain,payload)=>Buffer.from(`${domain}\n${canonical(payload)}`,'utf8');
const exact=(obj,keys)=>obj&&Object.keys(obj).sort().join(',')===keys.slice().sort().join(',');

export function verifyAttestation(envelope,{domain,keyring,purpose,now,maxAgeMs=86400000}) {
  assert(envelope&&(domain===NUMERIC_DOMAIN?exact(envelope,['schemaVersion','kind','keyId','payload','signature']):exact(envelope,['keyId','payload','signature'])), 'Signed attestation required');
  if(domain===NUMERIC_DOMAIN)assert(envelope.schemaVersion===1&&envelope.kind==='col-numeric-site-release-v1','Numeric release envelope required');
  assert(domain===ACTION_DOMAIN||domain===DEATH_DOMAIN||domain===ACTIVATION_DOMAIN||domain===VIEWER_ROW_DOMAIN||domain===NUMERIC_DOMAIN,'Unknown signature domain');
  const key=keyring?.keys?.find(k=>k.id===envelope.keyId&&k.purpose===purpose&&
    (k.algorithm==='Ed25519'||k.algorithm==='RSA-SHA256'));
  assert(key&&typeof key.publicKey==='string','Trusted purpose-specific public key unavailable');
  const trusted=keyring.keys.filter(k=>k.algorithm==='Ed25519'||k.algorithm==='RSA-SHA256');
  // Compare actual SPKI key material, not PEM text (RSA permits multiple encodings).
  const identities=trusted.map(k=>createPublicKey(k.publicKey).export({type:'spki',format:'der'}).toString('base64'));
  assert(new Set(identities).size===identities.length,'Trust domains must use distinct signing keys');
  const material=createPublicKey(key.publicKey);
  const rsa=key.algorithm==='RSA-SHA256';
  assert(rsa?material.asymmetricKeyType==='rsa'&&material.asymmetricKeyDetails?.modulusLength>=2048:
    material.asymmetricKeyType==='ed25519','Public key algorithm or strength mismatch');
  let signatureBytes;try{signatureBytes=Buffer.from(envelope.signature,'base64');}catch{throw Error('Invalid signature encoding');}
  assert(signatureBytes.length===(rsa?material.asymmetricKeyDetails.modulusLength/8:64)&&
    verify(rsa?'RSA-SHA256':null,attestationBytes(domain,envelope.payload),material,signatureBytes),
    'Invalid domain-separated signature');
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

function verifyActivationBoundary(envelope,{keyring,now,commit,sourceDigest,behaviorDigest,viewerQualificationDigest,viewerObservedAt}) {
  const p=verifyAttestation(envelope,{domain:ACTIVATION_DOMAIN,keyring,purpose:'numeric-activation-boundary',now,maxAgeMs:30*60*1000});
  assert(exact(p,['schemaVersion','activationId','effectiveAt','implementationCommit','sourceDigest','behaviorDigest','viewerQualificationDigest','issuedAt'])&&
    p.schemaVersion===1&&/^[a-z0-9-]{12,80}$/.test(p.activationId||'')&&ISO.test(p.effectiveAt||'')&&
    p.implementationCommit===commit&&p.sourceDigest===sourceDigest&&p.behaviorDigest===behaviorDigest&&
    p.viewerQualificationDigest===viewerQualificationDigest&&p.effectiveAt===p.issuedAt&&
    ISO.test(viewerObservedAt||'')&&Date.parse(p.effectiveAt)>=Date.parse(viewerObservedAt),
    'Independently signed initial activation boundary required');
  return p.effectiveAt;
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

function verifyViewerRow(envelope,{keyring,now,sourceDigest,viewerRunId,event}) {
  const p=verifyAttestation(envelope,{domain:VIEWER_ROW_DOMAIN,keyring,purpose:'viewer-source-row-observer',now,maxAgeMs:30*60*1000});
  assert(exact(p,['schemaVersion','sourceDigest','viewerRunId','sourceRowDigest','personKey','reportedOn','observedAt','issuedAt'])&&
    p.schemaVersion===1&&p.sourceDigest===sourceDigest&&p.viewerRunId===viewerRunId&&HEX.test(p.sourceRowDigest||'')&&
    p.personKey===celebrityKey(event.name,event.born)&&
    /^\d{4}-\d{2}-\d{2}$/.test(p.reportedOn||'')&&ISO.test(p.observedAt||'')&&
    Date.parse(p.observedAt)<=Date.parse(p.issuedAt)&&now.getTime()-Date.parse(p.observedAt)<=30*60*1000&&
    event.discoveredOn===p.reportedOn,'Exact Viewer row and independently established Club report date required');
  return {sourceRowDigest:p.sourceRowDigest,reportedOn:p.reportedOn};
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
  viewerQualification,sourceDigest,implementationCommit,behaviorDigest,keyring,activationWitness=null,previousRelease=null,
  expectedPreviousDigest=null,now=new Date()}) {
  assert(HEX.test(behaviorDigest||'')&&/^[a-f0-9]{40}$/.test(implementationCommit||''),'Source-bound implementation required');
  const q=verifyViewerQualification(viewerQualification,{commit:implementationCommit,sourceDigest,now});
  const qualificationDigest=sha256(q);
  let activationAt,prior=null;
  if(previousRelease){
    assert(expectedPreviousDigest===sha256(previousRelease)&&keyring?.currentReleaseDigest===expectedPreviousDigest,
      'Prior numerical release compare-and-swap mismatch');
    prior=verifyAttestation(previousRelease,{domain:NUMERIC_DOMAIN,keyring,purpose:'numeric-release',now,maxAgeMs:365*86400000});
    assert(previousRelease.payload?.kind==='col-numeric-release-payload-v1'&&
      previousRelease.payload.previousReleaseDigest===prior.previousReleaseDigest&&
      previousRelease.payload.siteResultsDigest===sha256(previousRelease.payload.siteResults),
      'Prior numerical release chain is malformed');
    assert(previousRelease.payload?.kind==='col-numeric-release-payload-v1'&&
      previousRelease.payload.baselineDigest===sha256(numericBaselineProjection(baseline)),'Prior release baseline mismatch');
    assert(previousRelease.payload.correctionsDigest===sha256(clubState),
      'Authorised GitHub correction changed; requalify the correction before release');
    assert(HEX.test(prior.activationBoundaryDigest||'')&&ISO.test(prior.activationAt||''),
      'Prior signed release lacks immutable activation boundary');
    activationAt=prior.activationAt;
  } else {
    assert((keyring?.currentReleaseDigest??null)===null,'Initial activation requires an empty numerical release pointer');
    assert(activationWitness,'Initial signed activation boundary required');
    activationAt=verifyActivationBoundary(activationWitness,{keyring,now,commit:implementationCommit,sourceDigest,
      behaviorDigest,viewerQualificationDigest:qualificationDigest,
      viewerObservedAt:q.sourceObservation.observedAt});
  }
  readClubState(clubState);
  const baselineDigest=sha256(numericBaselineProjection(baseline)),correctionsDigest=sha256(clubState);
  const migration=migrateBaseline(baseline,clubState),siteSnapshot=structuredClone(websiteResults??prior?.siteResults??migration.corrected);
  assert(siteSnapshot&&Array.isArray(siteSnapshot.members)&&siteSnapshot.members.length===6,'Complete website results required');
  for(const member of baseline.members){const current=siteSnapshot.members.find(m=>m.id===member.id);assert(current,'Website member set mismatch');
    for(const old of member.picks.filter(p=>p.counted)){const row=current.picks.find(p=>p.id===old.id);assert(row&&row.counted&&row.points===old.points,'Historical award changed in website snapshot');}}
  if(prior)for(const member of prior.siteResults.members){const current=siteSnapshot.members.find(m=>m.id===member.id);assert(current,'Prior release member set changed');
    for(const old of member.picks.filter(p=>p.counted)){const row=current.picks.find(p=>p.id===old.id);assert(row&&row.counted&&row.points===old.points,'Previously released award changed');}}
  const seen=new Set(prior?.actionReplayKeys??[]),actions=actionEnvelopes.map(a=>verifyMemberAction(a,keyring,now,seen));
  const deaths=events.map(event=>{
    const sourceRow=verifyViewerRow(event.viewerRowWitness,{keyring,now,sourceDigest,viewerRunId:q.workflowRunId,event});
    const evidence=verifyDeath(event.deathWitness,keyring,now);
    assert(event.name===evidence.name&&event.born===evidence.born&&event.diedOn===evidence.diedOn,
      'Passing does not match independent witness');
    return {...event,discoveredOn:sourceRow.reportedOn,sourceRowDigest:sourceRow.sourceRowDigest,evidence};
  });
  const rowDigests=[...(prior?.sourceRowDigests??[]),...deaths.map(e=>e.sourceRowDigest)];
  assert(new Set(rowDigests).size===rowDigests.length,'Viewer source row replay detected');
  const consumedPeople=[...new Set([...migration.consumedPeople,...(prior?.consumedPeople??[])])];
  const calculatedNew=deaths.map(e=>calculatePassing({members:baseline.members,event:e,clubState,effectiveAt:activationAt,
    observedAt:now.toISOString(),consumedPeople}));
  assert(calculatedNew.every(e=>e.status==='calculated'),'One or more passings are held');
  const priorEvents=prior?.calculated??[];
  const calculated=[...priorEvents,...calculatedNew];
  const allPeople=new Set(migration.consumedPeople);
  for(const event of calculated){assert(event.status==='calculated'&&!allPeople.has(event.personKey),'Prior release contains duplicate or baseline passing');allPeople.add(event.personKey);}
  assert(calculatedNew.every(e=>!priorEvents.some(old=>old.personKey===e.personKey)),'Passing was already counted in a prior release');
  const years=[...new Set(calculated.map(e=>e.seasonYear))];
  const totals=Object.fromEntries(years.map(year=>[year,prospectiveTotals(migration,calculated,year)]));
  const targetYear=Math.max(baseline.year,...years),expected=totals[targetYear]??migration.corrected.members.reduce((out,m)=>(out[m.id]=m.score,out),{});
  assert(siteSnapshot.year===targetYear&&MEMBERS.every(id=>siteSnapshot.members.find(m=>m.id===id)?.score===expected[id]),
    'Website snapshot totals do not match protected calculation');
  draft=prior?structuredClone(prior.draft):draft;
  const draftActions=actions.filter(a=>a.action?.kind==='draft');
  // A genuine new death authorises a change to that person's recorded rows,
  // not arbitrary unrelated rows, names or score-neutral extra awards. Strip
  // only ephemeral age-display text when comparing existing source rows.
  // Authenticated annual draft changes use their separate reducer below.
  if(calculatedNew.length&&!draftActions.length) {
    const previousSite=prior?.siteResults??migration.corrected;
    const authorisedPeople=new Set(calculatedNew.map(e=>e.personKey));
    const unchangedPick=p=>{const {ageText,...stable}=p;return stable;};
    for(const beforeMember of previousSite.members) {
      const afterMember=siteSnapshot.members.find(m=>m.id===beforeMember.id);
      assert(afterMember,'Existing member missing from death release');
      const {score:oldScore,picks:oldPicks,...oldIdentity}=beforeMember;
      const {score:newScore,picks:newPicks,...newIdentity}=afterMember;
      assert(sha256(oldIdentity)===sha256(newIdentity),'Unrelated member identity changed in death release');
      const previousIds=new Set(beforeMember.picks.map(p=>p.id));
      for(const pick of beforeMember.picks) {
        const actual=afterMember.picks.find(p=>p.id===pick.id);
        assert(actual,'Existing selection disappeared in death release');
        if(authorisedPeople.has(celebrityKey(pick.name,pick.born))) {
          assert(actual.name===pick.name&&actual.born===pick.born&&actual.pick===pick.pick&&
            actual.sourceRow===pick.sourceRow&&actual.sourceName===pick.sourceName,
            'Independently verified death cannot replace a selection identity');
        } else assert(sha256(unchangedPick(actual))===sha256(unchangedPick(pick)),
          'Unrelated selection changed in death release');
      }
      for(const pick of afterMember.picks)if(!previousIds.has(pick.id)) {
        assert(pick.pick==='BB'&&authorisedPeople.has(celebrityKey(pick.name,pick.born)),
          'Unauthorised new selection in death release');
      }
    }
  }
  // Without a newly verified passing or authenticated draft action, a release
  // may only retain the exact previous signed site (or the corrected historical
  // baseline for first activation). Matching totals alone cannot substantiate
  // newly marked counted selections, altered dates or changed identities.
  if(!calculatedNew.length&&!draftActions.length) {
    const unchanged=prior?.siteResults??migration.corrected;
    assert(sha256(siteSnapshot)===sha256(unchanged),'Unsigned site change without new death or draft authority');
  }
  if(draftActions.length) {
    assert(draft,'Draft state required for draft actions');
    let state=structuredClone(draft);
    for(const event of draftActions){assert(event.action.memberId===event.memberId&&event.expectedDraftDigest===sha256(state),
      'Draft action attribution or state base mismatch');state=applyDraftAction(state,{...event.action,id:event.eventId});}
    draft=state;
  }
  return {schemaVersion:1,kind:'col-numeric-release-payload-v1',implementationCommit,behaviorDigest,sourceDigest,
    activationAt,activationBoundaryDigest:prior?.activationBoundaryDigest??sha256(activationWitness),observedAt:now.toISOString(),
    consumedPeople:[...allPeople],actionReplayKeys:[...seen],previousReleaseDigest:previousRelease?sha256(previousRelease):null,
    viewerRunId:q.workflowRunId,viewerObservedAt:q.sourceObservation.observedAt,viewerSourceDigest:q.sourceObservation.sourceDigest,
    viewerQualificationDigest:sha256(q),baselineDigest,correctionsDigest,keyringDigest:sha256(trustProjection(keyring)),
    historicalTotals:Object.fromEntries(baseline.members.map(m=>[m.id,m.score])),calculated,totals,draft:draft??null,
    siteResults:structuredClone(siteSnapshot),siteResultsDigest:sha256(siteSnapshot),
    sourceRowDigests:rowDigests,
    actionEventIds:[...(prior?.actionEventIds??[]),...actions.map(a=>a.eventId)],actionDigest:sha256([...seen]),deathWitnessDigests:[...(prior?.deathWitnessDigests??[]),...deaths.map(e=>e.evidence.digest)],
    createdAt:now.toISOString()};
}

export function signNumericRelease(payload,{privateKey,keyId,previousReleaseDigest,expectedPreviousDigest}) {
  assert(expectedPreviousDigest===previousReleaseDigest&&(/^[a-f0-9]{64}$/.test(previousReleaseDigest)||previousReleaseDigest===null),
    'Numeric release compare-and-swap failed');
  assert(payload?.kind==='col-numeric-release-payload-v1'&&payload.implementationCommit&&payload.behaviorDigest,'Qualified numeric payload required');
  const envelope={schemaVersion:1,kind:'col-numeric-site-release-v1',keyId,payload:{...payload,previousReleaseDigest}};
  const material=privateKey?.type==='private'?privateKey:createPrivateKey(privateKey);
  const rsa=material.asymmetricKeyType==='rsa';
  assert(material.asymmetricKeyType==='ed25519'||(rsa&&material.asymmetricKeyDetails?.modulusLength>=2048),
    'Unsupported or insufficiently strong numeric signing key');
  envelope.signature=sign(rsa?'RSA-SHA256':null,attestationBytes(NUMERIC_DOMAIN,envelope.payload),material).toString('base64');
  return envelope;
}

export function verifyNumericRelease(envelope,{keyring,expectedPreviousDigest,now=new Date(),commit,behaviorDigest}) {
  const payload=verifyAttestation(envelope,{domain:NUMERIC_DOMAIN,keyring,purpose:'numeric-release',now,maxAgeMs:365*86400000});
  assert(payload.kind==='col-numeric-release-payload-v1'&&payload.previousReleaseDigest===expectedPreviousDigest&&
    payload.implementationCommit===commit&&payload.behaviorDigest===behaviorDigest,'Numeric release chain or source mismatch');
  assert(ISO.test(payload.activationAt||'')&&ISO.test(payload.observedAt||'')&&Date.parse(payload.observedAt)>=Date.parse(payload.activationAt),
    'Invalid activation or observation clock');
  assert(HEX.test(payload.activationBoundaryDigest||'')&&
    (payload.previousReleaseDigest===null||HEX.test(payload.previousReleaseDigest||'')),
    'Signed activation boundary or prior release digest missing');
  assert(Array.isArray(payload.consumedPeople)&&new Set(payload.consumedPeople).size===payload.consumedPeople.length&&
    Array.isArray(payload.actionReplayKeys)&&new Set(payload.actionReplayKeys).size===payload.actionReplayKeys.length,
    'Cumulative replay and consumed identity state required');
  assert(Array.isArray(payload.calculated)&&payload.calculated.every(e=>e.status==='calculated')&&payload.historicalTotals&&
    MEMBERS.every(m=>Number.isInteger(payload.historicalTotals[m])),'Incomplete numeric result');
  return payload;
}
