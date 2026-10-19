/* Entirely fictional read-only desk and editor diagnostics. No live service access. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const guarded=readFileSync(new URL('../scripts/annals/GuardedRelease.gs',import.meta.url),'utf8');
const ui=readFileSync(new URL('../scripts/annals/ReviewUi.html',import.meta.url),'utf8');
function harness(){
  let ownerCalls=0,propertyReads=0,triggerReads=0,logs=[];
  const properties={
    ANNALS_PRODUCTION_INTAKE_ENABLED:'true',ANNALS_AI_ENABLED:'true',
    ANNALS_AUTO_PUBLICATION_ENABLED:'true',ANNALS_AUTO_MEDIA_ENABLED:'true',
    ANNALS_PHOTOS_V2_ENABLED:'true',ANNALS_PHOTOS_GUARDED_JPEG_ENABLED:'true',
    ANNALS_PHOTO_BLOB_TRANSPORT_ENABLED:'true',ANNALS_HISTORY_PUBLICATION_ENABLED:'true',
    ANNALS_PHOTOS_HOSTED_ACCEPTED:'false',ANNALS_ALLOWED_SENDERS:'a,b,c,d,e,f',
    ANNALS_BUDGET_LEDGER:JSON.stringify({schemaVersion:1,month:'2026-10',reservedCents:350}),
    ANNALS_APPROVAL_KEY:'A'.repeat(40),ANNALS_PUBLISH_SIGNING_KEY:'B'.repeat(40),
    ANNALS_HISTORY_SIGNING_KEY:'C'.repeat(40),ANNALS_GITHUB_TOKEN:'fictional-private-token'
  };
  const globals={
    annalsOwner_:()=>{ownerCalls++;},
    annalsProps_:()=>({getProperties:()=>{propertyReads++;return {...properties};}}),
    annalsPublisherExpiry_:()=>Date.parse('2027-01-16T00:00:00.000Z'),
    AnnalsPilot:{allowedSenders:v=>v.split(',')},
    ScriptApp:{getProjectTriggers:()=>{triggerReads++;return [{getHandlerFunction:()=> 'runAnnalsProductionIntake'}];}},
    console:{log:t=>logs.push(t)},
    annalsRoot_:()=>{throw Error('Quick readback must not open private Drive');},
    annalsRuleAcceptanceSecurity_:()=>{throw Error('Quick readback must not run heavy security checks');},
    annalsLocked_:()=>{throw Error('Read-only quick check must not acquire intake lock');},
    UrlFetchApp:{fetch:()=>{throw Error('Must not call provider');}}
  };
  const ctx=vm.createContext(globals);vm.runInContext(guarded,ctx);
  return {ctx,properties,logs,stats:()=>({ownerCalls,propertyReads,triggerReads})};
}
test('owner fast readback avoids unbounded Drive/security work and reports scoped, non-secret status',()=>{
  const h=harness(),r=h.ctx.annalsQuickProductionReadbackInEditor();
  assert.equal(r.kind,'owner-fast-configuration-readback-v1');
  assert.equal(r.flags.ANNALS_AUTO_PUBLICATION_ENABLED,true);
  assert.equal(r.flags.ANNALS_PHOTOS_HOSTED_ACCEPTED,false);
  assert.equal(r.intakeTriggerCount,1);
  assert.equal(r.soleTriggerIsIntake,true);
  assert.equal(r.budgetReservedCents,350);
  assert.equal(r.budgetMonth,'2026-10');
  assert.equal(r.publisherCutoff,'2027-01-16T00:00:00.000Z');
  assert.equal(r.allowedSenderCount,6);
  assert.equal(r.signingMaterialsSeparate,true);
  assert.equal(r.signedJournalOrConsentVerificationPerformed,false);
  assert.equal(r.publicationVerifiedByThisCheck,false);
  assert.equal(r.providerAuthenticationVerifiedByThisCheck,false);
  assert.deepEqual(h.stats(),{ownerCalls:1,propertyReads:1,triggerReads:1});
  assert.equal(h.logs.length,1);
  assert.equal(h.logs[0],JSON.stringify(r));
  assert.doesNotMatch(JSON.stringify(r),/fictional-private-token|AAAA|BBBB|CCCC|\ba,b,c,d,e,f\b/);
});
test('fast readback reports malformed budget, missing signing or invalid cutoff without modifying production',()=>{
  const h=harness();h.properties.ANNALS_BUDGET_LEDGER='{invalid';
  h.properties.ANNALS_HISTORY_SIGNING_KEY=h.properties.ANNALS_PUBLISH_SIGNING_KEY;
  h.ctx.annalsPublisherExpiry_=()=>NaN;
  const r=h.ctx.annalsQuickProductionReadbackInEditor();
  assert.equal(r.budgetReservedCents,null);
  assert.equal(r.publisherCutoff,null);
  assert.equal(r.publisherCutoffInFuture,false);
  assert.equal(r.signingMaterialsSeparate,false);
  h.ctx.annalsOwner_=()=>{throw Error('Not the owner')};
  assert.throws(()=>h.ctx.annalsQuickProductionReadbackInEditor(),/Not the owner/);
  assert.equal(h.logs.length,1);
});
test('a direct held-item link opens before listing, consent refresh or speaker lookup',()=>{
  const start=ui.slice(ui.indexOf('async function initReviewDesk()'));
  assert.match(start,/nonce=\(await call\('annalsReviewSession'\)\)\.nonce/);
  assert.match(start,/if\(\/\^\[a-f0-9\]\{64\}\$\/\.test\(item\|\|''\)\)\{/);
  assert.ok(start.indexOf('await open(item)')<start.indexOf('await list(true)'));
  assert.doesNotMatch(start,/await el\('refreshConsent'\)\.onclick/);
  assert.doesNotMatch(start,/await loadSpeakerMap\(\)/);
  assert.doesNotMatch(start,/act\(async/);
  assert.match(start,/initReviewDesk\(\);/);
  assert.match(ui,/el\('refreshConsent'\)\.onclick=|el\('loadSpeakerMap'\)\.onclick=/);
});
