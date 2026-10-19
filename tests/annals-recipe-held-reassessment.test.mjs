/* Fictional, local-only verification of one-shot recipe recovery guards. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../scripts/annals/Production.gs',import.meta.url),'utf8');
const id='e'.repeat(64),sender='invented.member@example.test';
function fixture({eligible=true,consent=true,dispatch=false}={}){
  const source={sourceId:id,senderAuthenticated:true,aiConsentActive:true,autoConsentAtReceipt:true,
    source:{sender,subject:'Fictional Spice Glass',excerpt:'1 oz invented liquid. Stir.',
      receivedAt:'2026-10-18T17:00:00Z',sourceTruncated:false,subjectTruncated:false,excerptTruncated:false}};
  const records=new Map([
    ['source-private.json',source],
    ['draft-private.json',{category:'cocktail',recipe:{drinkIngredients:['1 oz invented liquid'],syrupIngredients:[],steps:['Stir.']}}],
    ['auto-decision-private.json',{state:'held',reason:'recipe_measure_or_step_uncertain'}],
    ['ai-attempt-private.json',{state:'attempt_reserved',model:'fictional'}]
  ]);
  if(dispatch)records.set('publication-dispatch-private.json',{state:'accepted'});
  const calls=[],overrides={
    annalsUiCall_:(_nonce,fn)=>fn(),annalsLocked_:fn=>fn(),annalsOwner_:()=>sender,
    annalsProps_:()=>({getProperty:k=>({ANNALS_ALLOWED_SENDERS:sender,ANNALS_ACTIVATED_AT:'2026-10-01T00:00:00Z'}[k]||'')}),
    annalsFolder_:()=>({}),
    annalsRead_:(_folder,name)=>records.get(name)||null,
    annalsFile_:(_folder,name)=>records.has(name)?{setContent:s=>records.set(name,JSON.parse(s))}:null,
    annalsWriteOnce_:(_folder,name,value)=>{if(records.has(name))throw Error('Immutable evidence overwritten');records.set(name,value);},
    annalsHash_:()=> 'f'.repeat(64),AnnalsProduction:{serial:JSON.stringify},
    AnnalsPilot:{allowedSenders:s=>s.split(',')},AnnalsAuto:{propose:()=>({eligible})},
    annalsConsentActive_:()=>consent,annalsStandingPublicationActive_:()=>consent,
    annalsAutoPublishCandidate_:(item,heldRecovery)=>{
      calls.push({item,heldRecovery});
      records.set('auto-reassessment-private.json',{state:'held',reason:'fictional_dispatch_unavailable'});
      return false;
    }
  };
  const ctx=vm.createContext({});
  vm.runInContext(script,ctx);
  Object.assign(ctx,overrides);
  return {ctx,records,calls};
}
test('one-time recipe exception preserves original decision, does not call AI and forbids replay',()=>{
  const f=fixture();
  const result=f.ctx.annalsReassessHeldRecipe('fictional-session',id,true);
  assert.equal(result.aiCall,false);
  assert.equal(result.dispatchAccepted,false);
  assert.equal(result.status,'fictional_dispatch_unavailable');
  assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].heldRecovery,true);
  assert.equal(f.records.get('reassessment-attempt-private.json').aiCall,false);
  assert.equal(f.records.get('reassessment-attempt-private.json').dispatchWasAbsent,true);
  assert.deepEqual(f.records.get('auto-decision-private.json'),{state:'held',reason:'recipe_measure_or_step_uncertain'});
  assert.deepEqual(f.records.get('ai-attempt-private.json'),{state:'attempt_reserved',model:'fictional'});
  assert.throws(()=>f.ctx.annalsReassessHeldRecipe('fictional-session',id,true),/not eligible/);
  assert.equal(f.calls.length,1);
});
test('recipe reassessment holds for missing confirmation, revoked consent, ungrouded draft and prior dispatch',()=>{
  for(const opts of [{consent:false},{eligible:false},{dispatch:true}]){
    const f=fixture(opts);
    assert.throws(()=>f.ctx.annalsReassessHeldRecipe('fictional-session',id,true),/not eligible/);
    assert.equal(f.calls.length,0);
    assert.equal(f.records.has('reassessment-attempt-private.json'),false);
  }
  const f=fixture();
  assert.throws(()=>f.ctx.annalsReassessHeldRecipe('fictional-session',id,false),/confirmation required/);
  assert.equal(f.records.has('reassessment-attempt-private.json'),false);
});


test('owner-only recipe recovery diagnostic identifies the exact blockers without reserving, paying or dispatching',()=>{
  const f=fixture(),before=JSON.stringify([...f.records.entries()]);
  const initial=f.ctx.annalsRecipeRecoveryReadbackInEditor(id);
  assert.equal(initial.readOnly,true);
  assert.equal(initial.eligibleForInitialReservation,true);
  assert.equal(initial.checks.noRecoveryReservation,true);
  assert.equal(initial.checks.deterministicTextEligible,true);
  assert.equal(initial.releaseAttempted,false);
  assert.equal(initial.providerCalled,false);
  assert.equal(initial.settingsChanged,false);
  assert.equal(JSON.stringify([...f.records.entries()]),before);
  assert.equal(f.calls.length,0);
  for(const opts of [{eligible:false},{consent:false},{dispatch:true}]){
    const held=fixture(opts),result=held.ctx.annalsRecipeRecoveryReadbackInEditor(id);
    assert.equal(result.eligibleForInitialReservation,false,JSON.stringify(opts));
    assert.equal(held.records.has('reassessment-attempt-private.json'),false);
    assert.equal(held.calls.length,0);
    if(opts.dispatch)assert.equal(result.checks.noPublicationDispatch,false);
    if(opts.eligible===false)assert.equal(result.checks.deterministicTextEligible,false);
    if(opts.consent===false)assert.equal(result.checks.currentStandingTextGrant,false);
  }
  const f2=fixture();
  f2.records.set('reassessment-attempt-private.json',{state:'attempt_reserved'});
  assert.equal(f2.ctx.annalsRecipeRecoveryReadbackInEditor(id).checks.noRecoveryReservation,false);
  assert.throws(()=>f2.ctx.annalsReassessHeldRecipe('fictional',id,true),/not eligible/);
});

test('bounded owner inbox audit counts candidate staging and notice gaps without exposing member identifiers or mutating mail',()=>{
  const f=fixture(),records=f.records,possible='member-message',other='automated-notice';
  f.ctx.annalsRoot_=()=>({getFoldersByName:id=>{
    const found=id==='digest-'+possible;let used=false;
    return {hasNext:()=>found&&!used,
      next:()=>{used=true;return {getName:()=>id};}};
  }});
  f.ctx.annalsPrivate_=x=>x;
  f.ctx.annalsHash_=x=>'digest-'+x;
  f.ctx.GmailApp={
    getInboxThreads:(offset,limit)=>{
      assert.equal(offset,0);assert.equal(limit,21);
      return [
        {getMessages:()=>[
          {getId:()=>possible,getFrom:()=>sender},
          {getId:()=> 'second-new-member',getFrom:()=>sender}
        ]},
        {getMessages:()=>[
          {getId:()=>other,getFrom:()=> 'automated@example.test'}
        ]}
      ];
    }
  };
  f.ctx.AnnalsPilot={allowedSenders:x=>x.split(','),senderAddress:x=>x};
  f.ctx.annalsRead_=(_folder,name)=>records.get(name)||null;
  f.ctx.annalsFile_=(_folder,name)=>records.has(name)?{}:null;
  const snapshot=JSON.stringify([...records.entries()]);
  const result=f.ctx.annalsInboxCoverageReadbackInEditor();
  assert.equal(result.readOnly,true);
  assert.equal(result.noProviderCalls,true);
  assert.equal(result.noMailOrJournalChanges,true);
  assert.equal(result.possibleAllowedSenderMessages,2);
  assert.equal(result.withPrivateStagingSource,1);
  assert.equal(result.withoutPrivateStagingSource,1);
  assert.equal(result.stagedButSenderUnverified,0);
  assert.equal(result.heldDecisionSeen,1);
  assert.equal(result.ownerHoldNoticesRecorded,0);
  assert.equal(result.contributorHoldNoticesRecorded,0);
  assert.equal(result.moreThreadsBeyondWindow,false);
  assert.doesNotMatch(JSON.stringify(result),/invented\.member|member-message|@example\.test/);
  assert.equal(JSON.stringify([...records.entries()]),snapshot);
  assert.equal(f.calls.length,0);
});

test('legacy owner-held recipe gets one contributor status without retroactive AI or publication retry',()=>{
  const f=fixture(),records=f.records;
  records.set('draft-notice-private.json',{state:'sent'});
  let notices=0,autoCalls=0;
  f.ctx.annalsPrivate_=v=>v;
  f.ctx.annalsRoot_=()=>({getFolders:()=>({
    at:0,hasNext(){return this.at++===0},next:()=>({getName:()=>id})
  })});
  f.ctx.annalsRead_=(_folder,name)=>records.get(name)||null;
  f.ctx.annalsFile_=(_folder,name)=>records.has(name)?{}:null;
  f.ctx.annalsAutoAttemptSafe_=()=>{autoCalls++;return false;};
  f.ctx.annalsNotifyDraftReady_=()=>{throw Error('Existing owner notice must not be resent');};
  f.ctx.annalsNotifyContributorHeld_=()=>{
    notices++;records.set('contributor-hold-notice-private.json',{state:'attempted_once'});return true;
  };
  f.ctx.annalsProps_=()=>({getProperty:()=>null,deleteProperty:()=>{},setProperty:()=>{}});
  f.ctx.AnnalsAuto={protectedRoute:()=> 'annals'};
  assert.equal(f.ctx.annalsResumeConsentedDrafts_(2),0);
  assert.equal(notices,1);
  assert.equal(autoCalls,1);
  assert.equal(records.get('ai-attempt-private.json').state,'attempt_reserved');
  assert.equal(records.has('reassessment-attempt-private.json'),false);
  assert.equal(records.has('publication-dispatch-private.json'),false);
});


function publishedReadbackFixture({httpStatus=200, pageStatus=200, changedArchive=false}={}){
  const x=fixture(),e={id:'annal-'+id.slice(0,24),category:'cocktail',
    title:'Imaginary test glass',summary:'An entirely invented recipe.',year:2026,
    dateLabel:'Submitted 2026-10',sortDate:'',quoteVerbatim:'',
    recipe:{drinkIngredients:['1 oz invented cordial'],syrupIngredients:[],steps:['Stir carefully.']},
    credit:'anonymous'};
  const proof={entryId:e.id,mode:'standing-consent-text-v1',signature:'fictional-signature'};
  x.ctx.annalsHash_=value=>createHash('sha256').update(value).digest('hex');
  const digest=x.ctx.annalsHash_(JSON.stringify(e));
  x.records.set('approval-private.json',{entry:e,receipt:{contentSha256:digest},
    publication:proof,approvalMode:proof.mode,publicationState:'dispatch_accepted'});
  x.records.set('publication-dispatch-private.json',{state:'accepted'});
  const calls=[];
  x.ctx.UrlFetchApp={fetch:(url,opts)=>{
    calls.push(url);
    assert.equal(opts.method,'get');
    assert.equal(opts.followRedirects,false);
    assert.equal(opts.validateHttpsCertificates,true);
    if(url.includes('raw.githubusercontent.com')){
      return {getResponseCode:()=>httpStatus,getContentText:()=>JSON.stringify({
        entries:changedArchive?[{...e,title:'Altered test'}]:[e],approvals:[proof]})};
    }
    if(url.includes('stammtischbrewery.com')){
      return {getResponseCode:()=>pageStatus,getContentText:()=>'<article id="'+e.id+'"></article>'};
    }
    throw Error('Unexpected public-only domain');
  }};
  return {...x,calls,e,proof};
}
test('owner-only publication readback independently checks signed public entry and page without sending anything',()=>{
  const x=publishedReadbackFixture(),snapshot=JSON.stringify([...x.records.entries()]);
  const result=x.ctx.annalsPublishedReceiptReadbackInEditor(id);
  assert.equal(result.readOnly,true);
  assert.equal(result.publicEvidenceMatches,true);
  assert.equal(result.archiveHttpStatus,200);
  assert.equal(result.pageHttpStatus,200);
  assert.equal(result.privateLiveMarkerPresent,false);
  assert.equal(result.publicationNoticeAttemptMarkerPresent,false);
  assert.equal(result.publisherOrAiCalled,false);
  assert.equal(result.mailAttempted,false);
  assert.equal(result.journalsOrCursorsChanged,false);
  assert.equal(Object.values(result.checks).every(v=>v===true),true);
  assert.equal(x.calls.length,2);
  assert.equal(JSON.stringify([...x.records.entries()]),snapshot);
  assert.doesNotMatch(JSON.stringify(result),/example\.test|fictional-signature|imaginary test|annal-e/);
});
test('owner verification isolates changed public data and redirects without recording a live marker',()=>{
  for(const opts of [{changedArchive:true},{httpStatus:302},{pageStatus:302}]){
    const x=publishedReadbackFixture(opts),old=JSON.stringify([...x.records.entries()]);
    const v=x.ctx.annalsPublishedReceiptReadbackInEditor(id);
    assert.equal(v.publicEvidenceMatches,false,JSON.stringify(opts));
    if(opts.changedArchive)assert.equal(v.checks.archiveDigestMatchesReceipt,false);
    if(opts.httpStatus!==undefined)assert.equal(v.archiveHttpStatus,opts.httpStatus);
    if(opts.pageStatus!==undefined)assert.equal(v.pageHttpStatus,opts.pageStatus);
    assert.equal(JSON.stringify([...x.records.entries()]),old);
    assert.equal(x.records.has('auto-live-verification-private.json'),false);
  }
});
test('owner verification declines remote reads for incomplete original approval and retains all records',()=>{
  const x=fixture(),before=JSON.stringify([...x.records.entries()]);
  x.ctx.UrlFetchApp={fetch:()=>assert.fail('Incomplete approval must not cause network calls')};
  const v=x.ctx.annalsPublishedReceiptReadbackInEditor(id);
  assert.equal(v.readOnly,true);
  assert.equal(v.publicEvidenceMatches,false);
  assert.equal(v.checks.privateApprovalAccepted,false);
  assert.equal(v.checks.privateDispatchAccepted,false);
  assert.equal(v.archiveHttpStatus,null);
  assert.equal(v.pageHttpStatus,null);
  assert.equal(JSON.stringify([...x.records.entries()]),before);
  assert.throws(()=>x.ctx.annalsPublishedReceiptReadbackInEditor('not-valid'),/Exact existing item identity required/);
});
