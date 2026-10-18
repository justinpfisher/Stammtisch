/* Fictional local data only. No source requests, Sheets, real keys or publishing. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import Rules from '../scripts/annals/RulesCore.js';
import {canonical,digest,renderRegister} from '../scripts/annals/RulesPublisher.mjs';
import {MODES,EMPTY_STATE,STATE_PATH,LITERAL_EXPLANATION,snapshotHashes,stageCandidate,authorizeActivation,confirmActivation,materializeConfirmed,validateState,cancelStaged,sealCompletion,MAX_LEDGER_BYTES} from '../scripts/annals/RulesStaged.mjs';
import {sourceProof} from '../scripts/annals/run-staged-col.mjs';
import {loadOperativeSnapshot} from '../col-rules-reader.mjs';
import {verifyJobWitness,readReleaseWitness,validateSealedWitness,WITNESS_WORKFLOW,WITNESS_STEP,WITNESS_SOURCE_STEP} from '../col-rules-witness.mjs';
import {observeReadyRelease,verifyFinalSourceReceipt} from '../scripts/annals/verify-staged-col-hosted.mjs';

const key='entirely-fictional-local-v3-key-never-production',commit='c'.repeat(40),behavior='d'.repeat(64),sourceDigest='e'.repeat(64);
const t0='2026-10-15T18:00:00.000Z',t1='2026-10-15T18:01:00.000Z',t2='2026-10-15T18:02:00.000Z',t3='2026-10-15T18:03:00.000Z';
const producer={repository:'justinpfisher/Stammtisch',workflow:WITNESS_WORKFLOW,job:'staged',runId:'123456',runAttempt:1,workflowHead:commit,checkoutHead:commit};
const clone=structuredClone;
const witness=at=>({sourceDigest,observedAt:at,repoCommit:commit,workflowRun:'123456'});
function sign(kind,state,content,at){const approval={mode:MODES[kind],baseStateDigest:digest(state),issuedAt:at};return {content,approval:{...approval,signature:createHmac('sha256',key).update(JSON.stringify(canonical({content,approval}))).digest('hex')}};}
function fixture(){
  const before="## PRIZE\n\nThe fictional member's tokens stay unchanged.",after='## PRIZE\n\nThe fictional  member’s tokens stay unchanged.';
  const base={id:'col-baseline-fictional',digest:'a'.repeat(64),previous:null,verified:true,effectiveAt:'2026-10-15T17:00:00.000Z',publishedAt:'2026-10-15T17:00:00.000Z',provisions:{PRIZE:before},parameters:{fictionalTokens:7},januaryGap:'unresolved'};
  const directive='In the CoL rules, replace "'+before+'" with "'+after+'".';
  const source={senderAuthenticated:true,freshOperativeWindow:true,member:'marc',text:directive,receivedAt:t0};
  const assessment={intent:'operative',requestExcerpt:directive,changes:[{provision:'PRIZE',before,after,sourceExcerpt:directive}],explanation:'Fictional typography fixture only.',clarification:'',effectiveAt:'',retrospective:{requested:false,period:'',results:'',clubAgreementExcerpt:''}};
  const revision=Rules.intake(source,assessment,base,'col-fictional-v3-0001');
  const register={schemaVersion:1,baseline:{id:base.id,recordedAt:base.effectiveAt,description:'Fictional baseline only.'},revisions:[],events:[]};
  const versions={schemaVersion:1,versions:[base]};
  const files={'data/col-rules-register.json':JSON.stringify(register),'data/col-rules-versions.json':JSON.stringify(versions),
    'docs/celebration-of-life-rules.md':'# Fictional only\n\n'+before+'\n\n---\n\nPreserve this note.',
    'celebration.html':'<section id="official-rules"><details class="rule-topic"><summary>PRIZE</summary><p>Old fictional words</p></details>\n      <p class="rules-reference">Preserve this reference.</p></section>',
    'col-revisions.html':renderRegister(register)};
  const state=clone(EMPTY_STATE),clean={...Rules.publicRecord(revision),baseDigest:base.digest,explanation:LITERAL_EXPLANATION};
  const content={revision:clean,qualification:'literal-typography-v1',baseFiles:snapshotHashes(files),implementationCommit:commit,behaviorDigest:behavior,source:null};
  const args={state,files,envelope:sign('stage',state,content,t0),secret:key,enabled:true,now:new Date(t0),implementationCommit:commit,behaviorDigest:behavior,sourceWitness:witness(t0)};
  return {base,source,assessment,revision,args};
}
function staged(){const f=fixture();return {...f,stage:stageCandidate(f.args)};}
function authorization(stage,overrides={}){
  const content={candidateDigest:stage.candidateDigest,observation:{candidateDigest:stage.candidateDigest,observedAt:t1},source:stage.candidate.source,baseFiles:stage.candidate.baseFiles};
  return {state:stage.state,candidate:stage.candidate,envelope:sign('authorize',stage.state,content,t1),secret:key,enabled:true,now:new Date(t1),implementationCommit:commit,behaviorDigest:behavior,sourceWitness:witness(t1),...overrides};
}
function full(){
  const f=staged(),authArgs=authorization(f.stage),authorized=authorizeActivation(authArgs);
  const content={candidateDigest:f.stage.candidateDigest,activationDigest:authorized.activationDigest,observedAt:t2,source:f.stage.candidate.source,baseFiles:f.stage.candidate.baseFiles};
  const confirmArgs={...authArgs,state:authorized.state,activation:authorized.activation,envelope:sign('confirm',authorized.state,content,t2),now:new Date(t2),sourceWitness:witness(t2),producer};
  const result=confirmActivation(confirmArgs);return {...f,authorized,confirmArgs,result};
}
function hosted(f,options={}){
  const h=f.stage.candidateDigest,prefix='data/col-releases/'+h;
  const evidence=options.evidence||jobEvidence(),api='https://api.github.com/repos/justinpfisher/Stammtisch/actions/runs/123456/attempts/1';
  const bodies={[STATE_PATH]:JSON.stringify(options.state||f.result.state),[prefix+'.json']:JSON.stringify(f.stage.candidate),[prefix+'-activation.json']:JSON.stringify(f.authorized.activation),[prefix+'-confirmed.json']:JSON.stringify(f.result.confirmedSnapshot),[prefix+'-witness.json']:JSON.stringify(options.receipt),[api]:JSON.stringify(evidence.run),[api+'/jobs?per_page=100']:JSON.stringify(evidence.listing)};
  return async(path,init)=>{
    assert.equal(init.credentials,'omit');assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');
    if(path===options.fail)return {status:503,text:async()=> 'Failed Pages deployment'};
    if(path===options.throwAt)throw Error('Fictional network loss');
    return {status:200,redirected:path===options.redirect,text:async()=>path===options.stale?'{}':bodies[path]||'{}'};
  };
}
function jobEvidence(at=t3){const sourceStart=new Date(Date.parse(at)-60000).toISOString();return {run:{id:123456,run_attempt:1,path:WITNESS_WORKFLOW,event:'repository_dispatch',head_sha:commit,repository:{full_name:'justinpfisher/Stammtisch'},status:'completed',conclusion:'success'},listing:{total_count:1,jobs:[{name:'staged',run_id:123456,run_attempt:1,head_sha:commit,status:'completed',conclusion:'success',started_at:t2,completed_at:at,steps:[{name:WITNESS_STEP,status:'completed',conclusion:'success',completed_at:sourceStart},{name:WITNESS_SOURCE_STEP,status:'completed',conclusion:'success',started_at:sourceStart,completed_at:at}]}]}};}

test('bounded literal typography qualification requires the exact authenticated directive, not AI semantic confidence',()=>{
  const f=fixture();assert.equal(Rules.literalWording(f.source,f.revision,f.base).kind,'literal-typography-v1');
  for(const patch of [{senderAuthenticated:false},{replayed:true},{truncated:true},{text:'Someone said: '+f.source.text},{text:f.source.text+' Maybe; this is a joke.'}])assert.throws(()=>Rules.literalWording({...f.source,...patch},f.revision,f.base));
  const r=clone(f.revision);r.changes[0].after=r.changes[0].after.replace('tokens','medals');assert.throws(()=>Rules.literalWording(f.source,r,f.base),/engineering/);
});
test('candidate staging is non-operative and preserves base bytes, parameters, history and January uncertainty',()=>{
  const f=fixture(),before=JSON.stringify(f.args),s=stageCandidate(f.args),version=JSON.parse(s.candidate.files['data/col-rules-versions.json']).versions.at(-1);
  assert.equal(s.state.operations[0].phase,'candidate');assert.equal(version.verified,false);assert.equal(version.effectiveAt,null);assert.equal(version.publishedAt,null);
  assert.deepEqual(version.parameters,f.base.parameters);assert.equal(version.januaryGap,'unresolved');
  assert.equal(Rules.select(JSON.parse(s.candidate.files['data/col-rules-versions.json']).versions,t2).id,f.base.id);assert.equal(JSON.stringify(f.args),before);
  assert.match(s.candidate.files['docs/celebration-of-life-rules.md'],/Preserve this note/);
});
test('all three runtime gates default off independently',()=>{
  const f=full();assert.throws(()=>stageCandidate({...f.args,enabled:false}),/disabled/);
  assert.throws(()=>authorizeActivation({...authorization(f.stage),enabled:false}),/disabled/);
  assert.throws(()=>confirmActivation({...f.confirmArgs,enabled:false}),/disabled/);
});
test('stage cannot use a semantic, number, formula, allocation or caller-provided source proof',()=>{
  for(const replacement of ['The fictional member has 8 tokens.','New formula: 100 minus age.','Give the fictional tokens to another member.']){
    const f=fixture(),c=clone(f.args.envelope.content);c.revision.changes[0].after='## PRIZE\n\n'+replacement;
    assert.throws(()=>stageCandidate({...f.args,envelope:sign('stage',f.args.state,c,t0)}),/engineering/);
  }
  const f=fixture(),c={...f.args.envelope.content,source:witness(t0)};assert.throws(()=>stageCandidate({...f.args,envelope:sign('stage',f.args.state,c,t0)}),/independent Viewer/);
});
test('forged, stale, wrong-domain, changed implementation and changed-base dispatches fail without mutation',()=>{
  const f=fixture(),original=JSON.stringify(f.args);
  for(const patch of [{secret:'fictional-wrong-signature-secret-1234567890'},{now:new Date('2026-10-15T19:00:00Z')},{implementationCommit:'f'.repeat(40)},{behaviorDigest:'f'.repeat(64)},{files:{...f.args.files,'celebration.html':'Changed base'}}])assert.throws(()=>stageCandidate({...f.args,...patch}));
  assert.throws(()=>stageCandidate({...f.args,envelope:sign('authorize',f.args.state,f.args.envelope.content,t0)}));assert.equal(JSON.stringify(f.args),original);
});
test('a second staged or replayed candidate is rejected until prior operation is reconciled',()=>{
  const f=staged();assert.throws(()=>stageCandidate({...f.args,state:f.stage.state,envelope:sign('stage',f.stage.state,f.args.envelope.content,t1),now:new Date(t1),sourceWitness:witness(t1)}),/pending operation/);
});
test('complete hosted job completion supplies publication clock; ready files never contain invented operative times',()=>{
  const f=full(),op=f.result.state.operations.at(-1);
  assert.equal(f.authorized.activation.publishedAt,null);assert.equal(f.authorized.activation.effectiveAt,null);
  assert.equal(f.authorized.activation.authorizedAt,t1);assert.equal(op.confirmation.observedAt,t2);
  const ready=JSON.parse(f.result.confirmedSnapshot.files['data/col-rules-versions.json']).versions.at(-1);assert.equal(ready.publishedAt,null);assert.equal(ready.effectiveAt,null);assert.equal(ready.verified,false);
  const at=verifyJobWitness(producer,jobEvidence().run,jobEvidence().listing,{now:Date.parse(t3)}).completedAt;
  const v=JSON.parse(materializeConfirmed(f.stage.candidate,op,at)['data/col-rules-versions.json']).versions.at(-1);assert.equal(v.publishedAt,t3);assert.equal(v.effectiveAt,t3);assert.notEqual(v.publishedAt,t2);
});
test('partial/mismatched candidate evidence and unobserved timestamps cannot authorize activation',()=>{
  const f=staged(),args=authorization(f.stage),content=clone(args.envelope.content);content.observation.candidateDigest='f'.repeat(64);
  assert.throws(()=>authorizeActivation({...args,envelope:sign('authorize',args.state,content,t1)}));
  const changed=clone(f.stage.candidate);changed.files['celebration.html']='Stale cache';assert.throws(()=>authorizeActivation({...args,candidate:changed}),/discrepancy/);
  content.observation.candidateDigest=f.stage.candidateDigest;content.observation.observedAt='2026-10-15T17:00:00Z';assert.throws(()=>authorizeActivation({...args,envelope:sign('authorize',args.state,content,t1)}));
});
test('fresh independent source discrepancy or unavailable Viewer proof prevents activation and confirmation',()=>{
  const f=full();for(const sourceWitness of [undefined,{...witness(t1),sourceDigest:'f'.repeat(64)},{...witness(t1),observedAt:'2026-10-15T17:00:00Z'}])assert.throws(()=>authorizeActivation({...authorization(f.stage),sourceWitness}));
  assert.throws(()=>confirmActivation({...f.confirmArgs,sourceWitness:{...witness(t2),sourceDigest:'f'.repeat(64)}}),/source witness/);
});
test('scheduled candidate needs due-time base/source qualification, and missed explicit dates are never backdated',()=>{
  const f=fixture(),content=clone(f.args.envelope.content);content.revision.effectiveAt='2026-10-16T18:00:00.000Z';
  const stage=stageCandidate({...f.args,envelope:sign('stage',f.args.state,content,t0)});
  assert.throws(()=>authorizeActivation(authorization(stage)),/due-time/);
  assert.throws(()=>authorizeActivation(authorization(stage,{now:new Date('2026-10-16T18:10:00.000Z')})),/Stale/);
  const due='2026-10-16T18:00:00.000Z',args=authorization(stage),c={...args.envelope.content,observation:{candidateDigest:stage.candidateDigest,observedAt:due}};
  const auth=authorizeActivation({...args,now:new Date(due),sourceWitness:witness(due),envelope:sign('authorize',stage.state,c,due)});
  const later='2026-10-16T18:00:01.000Z',confirm={candidateDigest:stage.candidateDigest,activationDigest:auth.activationDigest,observedAt:later,source:stage.candidate.source,baseFiles:stage.candidate.baseFiles};
  assert.throws(()=>confirmActivation({...args,state:auth.state,activation:auth.activation,now:new Date(later),sourceWitness:witness(later),producer,envelope:sign('confirm',auth.state,confirm,later)}),/never backdate/);
});
test('expired delayed activation and altered confirmation readback preserve prior version',()=>{
  const f=full(),later='2026-10-15T18:47:00.000Z',c={...f.confirmArgs.envelope.content,observedAt:later};
  assert.throws(()=>confirmActivation({...f.confirmArgs,envelope:sign('confirm',f.authorized.state,c,later),now:new Date(later),sourceWitness:witness(later)}),/expired/);
  assert.throws(()=>confirmActivation({...f.confirmArgs,activation:{...f.authorized.activation,authorizedAt:t0}}),/discrepancy/);
  assert.equal(f.authorized.state.operations[0].phase,'activation_pending');
});
test('competing confirmed base and replayed final confirmation cannot overwrite a version',()=>{
  const f=full();assert.throws(()=>confirmActivation({...f.confirmArgs,state:f.result.state}),/base mismatch/);
  const altered=clone(f.authorized.state);altered.operations[0].previous='f'.repeat(64);assert.throws(()=>confirmActivation({...f.confirmArgs,state:altered,envelope:sign('confirm',altered,f.confirmArgs.envelope.content,t2)}));
});
test('browser admits only complete candidate, activation and confirmed five-file snapshot',async()=>{
  const f=full(),v=await loadOperativeSnapshot({fetchImpl:hosted(f),now:Date.parse(t3)});
  assert.equal(v.version.id,f.revision.id);assert.equal(v.version.verified,true);assert.deepEqual(v.version.parameters,f.base.parameters);
  for(const suffix of ['', '-activation','-confirmed']){
    const name='data/col-releases/'+f.stage.candidateDigest+suffix+'.json';
    assert.equal(await loadOperativeSnapshot({fetchImpl:hosted(f,{fail:name}),now:Date.parse(t3)}),null);
    assert.equal(await loadOperativeSnapshot({fetchImpl:hosted(f,{stale:name}),now:Date.parse(t3)}),null);
  }
});
test('failed Pages, redirects, network loss and stale ledger retain last complete session snapshot',async()=>{
  const f=full(),previous=await loadOperativeSnapshot({fetchImpl:hosted(f),now:Date.parse(t3)});
  for(const option of [{fail:STATE_PATH},{redirect:STATE_PATH},{throwAt:STATE_PATH},{state:EMPTY_STATE},{state:f.stage.state},{state:f.authorized.state}])
    assert.equal(await loadOperativeSnapshot({fetchImpl:hosted(f,option),previous,now:Date.parse(t3)}),previous);
});
test('a newly served staging/activation package never activates on a clock alone',async()=>{
  const f=full();for(const state of [f.stage.state,f.authorized.state])assert.equal(await loadOperativeSnapshot({fetchImpl:hosted(f,{state}),now:Date.parse('2030-01-01T00:00:00Z')}),null);
  assert.equal(await loadOperativeSnapshot({fetchImpl:hosted(f),now:Date.parse(t1)}),null);
});
test('immutable confirmations are strict, and premature materialization is refused',()=>{
  const f=full();assert.throws(()=>materializeConfirmed(f.stage.candidate,f.stage.state.operations[0]),/confirmed/);
  const state=clone(f.result.state);state.operations[0].confirmation.snapshotDigest='wrong';assert.throws(()=>validateState(state));
});
test('independent Viewer receipt identity is checked and microseconds normalize without exposing source',()=>{
  const receipt={kind:'col-source-readonly-observation-v1',digestFormat:'monitor-semantic-v1-json-sorted-compact-ascii',scope:'spreadsheets.readonly',qualification:'snapshot-only-not-formula-or-allocation-approval',implementationCommit:commit,workflowRunId:'123456',sourceDigest,observedAt:'2026-10-15T18:00:00.123456Z'};
  assert.equal(sourceProof(receipt,commit,'123456').observedAt,'2026-10-15T18:00:00.123Z');
  for(const patch of [{scope:'spreadsheets'},{workflowRunId:'different'},{qualification:'formula-approved'},{implementationCommit:'f'.repeat(40)}])assert.throws(()=>sourceProof({...receipt,...patch},commit,'123456'));
});
test('legacy private exact-byte reconciliation cannot claim any operative success',()=>{
  let reads=0,writes=0;const pending={sourceId:'fictional',state:'accepted',at:t0,expectedFiles:{'celebration.html':'match'}};
  const c=vm.createContext({annalsRoot_:()=> 'root',annalsRead_:()=>pending,annalsHash_:v=>v,UrlFetchApp:{fetch:()=>{reads++;return {getResponseCode:()=>200,getContentText:()=> 'match'};}},annalsSavePrivate_:()=>{writes++;}});
  vm.runInContext(readFileSync(new URL('../scripts/annals/RulesProduction.gs',import.meta.url),'utf8'),c);
  assert.equal(c.annalsReconcileRuleRelease_('fictional'),false);assert.equal(reads,0);assert.equal(writes,0);
});
test('lost-response v3 attempts enter readback reconciliation without redispatching the phase',()=>{
  let reconciles=0;const pending={sourceId:'fictional',kind:'v3',state:'unknown_or_held_no_retry'};
  const c=vm.createContext({annalsRoot_:()=> 'root',annalsRead_:()=>pending});vm.runInContext(readFileSync(new URL('../scripts/annals/RulesProduction.gs',import.meta.url),'utf8'),c);
  c.annalsReconcileStagedRule_=(id,attempt)=>{assert.equal(attempt,pending);reconciles++;return false;};
  assert.equal(c.annalsReconcileRuleRelease_('fictional'),false);assert.equal(reconciles,1);
});
test('private and hosted v3 gates require all independent qualification, with no setup/permission expansion',()=>{
  const values={},c=vm.createContext({annalsProps_:()=>({getProperty:name=>values[name]||null})});vm.runInContext(readFileSync(new URL('../scripts/annals/RulesProduction.gs',import.meta.url),'utf8'),c);c.annalsRulesReady_=()=>true;
  assert.equal(c.annalsStagedRulesReady_(),false);values.ANNALS_RULES_V3_ENABLED='true';values.ANNALS_RULES_V3_HOSTED_ACCEPTED='true';assert.equal(c.annalsStagedRulesReady_(),false);
  values.ANNALS_RULES_V3_CLOCK_QUALIFIED='true';assert.equal(c.annalsStagedRulesReady_(),true);
  const workflow=readFileSync(new URL('../.github/workflows/annals-col-rules-v3.yml',import.meta.url),'utf8');assert.match(workflow,/CLOCK_QUALIFIED == 'true'/);assert.match(workflow,/observe-col-source\.py/);assert.match(workflow,/ubuntu-latest/);assert.doesNotMatch(workflow,/self-hosted|COL_VERIFIED_SOURCE_DIGEST/);
});

test('the existing fifteen-minute intake cadence fits the bounded activation lease with a fresh source read',()=>{
  const f=full(),at='2026-10-15T18:16:00.000Z',content={...f.confirmArgs.envelope.content,observedAt:at};
  const result=confirmActivation({...f.confirmArgs,now:new Date(at),sourceWitness:witness(at),envelope:sign('confirm',f.authorized.state,content,at)});
  assert.equal(result.state.operations[0].confirmation.observedAt,at);
  assert.equal(f.authorized.activation.source.observedAt,t1,'Activation records the new Viewer observation, not the staging witness time');
});
test('authenticated cancellation retains immutable attempts and permits a new identity without replay',()=>{
  const f=staged(),content={revisionId:f.revision.id,candidateDigest:f.stage.candidateDigest,reason:'deployment_failed',stageEvidenceDigest:digest(f.args.envelope)};
  const cancelled=cancelStaged({state:f.stage.state,envelope:sign('cancel',f.stage.state,content,t1),secret:key,enabled:true,now:new Date(t1)});
  assert.equal(cancelled.state.operations[0].phase,'failed');assert.deepEqual(cancelled.state.events[0],f.stage.state.events[0]);assert.equal(cancelled.state.events[1].phase,'failed');
  assert.throws(()=>authorizeActivation({...authorization(f.stage),state:cancelled.state}),/base mismatch/);
  const next=clone(f.args.envelope.content);next.revision.id='col-fictional-v3-0002';
  assert.equal(stageCandidate({...f.args,state:cancelled.state,envelope:sign('stage',cancelled.state,next,t1),now:new Date(t1),sourceWitness:witness(t1)}).state.operations.at(-1).phase,'candidate');
  assert.throws(()=>stageCandidate({...f.args,state:cancelled.state,envelope:sign('stage',cancelled.state,f.args.envelope.content,t1),now:new Date(t1),sourceWitness:witness(t1)}),/replayed/);
});
test('lost stage response can be tombstoned before any public candidate; delayed original dispatch then fails',()=>{
  const f=fixture(),content={revisionId:f.revision.id,candidateDigest:null,reason:'deployment_failed',stageEvidenceDigest:digest(f.args.envelope)};
  const cancelled=cancelStaged({state:f.args.state,envelope:sign('cancel',f.args.state,content,t1),secret:key,enabled:true,now:new Date(t1)});
  assert.equal(cancelled.state.operations.length,0);assert.equal(cancelled.state.events.length,1);
  assert.throws(()=>stageCandidate({...f.args,state:cancelled.state}),/base mismatch/);
});
test('cancellation is separately authenticated, exact-stage bound, and cannot roll back an operative revision',()=>{
  const f=full(),content={revisionId:f.revision.id,candidateDigest:f.stage.candidateDigest,reason:'withdrawn',stageEvidenceDigest:digest(f.args.envelope)};
  assert.throws(()=>cancelStaged({state:f.result.state,envelope:sign('cancel',f.result.state,content,t2),secret:key,enabled:true,now:new Date(t2)}),/operative/);
  assert.throws(()=>cancelStaged({state:f.stage.state,envelope:sign('cancel',f.stage.state,{...content,stageEvidenceDigest:'f'.repeat(64)},t1),secret:key,enabled:true,now:new Date(t1)}),/original staging/);
  assert.throws(()=>cancelStaged({state:f.stage.state,envelope:sign('stage',f.stage.state,content,t1),secret:key,enabled:true,now:new Date(t1)}),/authority/);
});
test('a failed successor deployment falls back to its complete predecessor, and historical reader links remain pinned',async()=>{
  const f=full(),state=clone(f.result.state),op=clone(state.operations[0]);
  op.candidateDigest='9'.repeat(64);op.previous=f.stage.candidateDigest;op.revisionId='col-fictional-v3-0002';op.activationDigest='8'.repeat(64);op.confirmation={...op.confirmation,candidateDigest:op.candidateDigest,activationDigest:op.activationDigest,snapshotDigest:'7'.repeat(64)};state.operations.push(op);
  assert.equal((await loadOperativeSnapshot({fetchImpl:hosted(f,{state}),now:Date.parse(t3)})).version.id,f.revision.id);
  assert.equal((await loadOperativeSnapshot({fetchImpl:hosted(f,{state}),versionId:f.revision.id,now:Date.parse(t3)})).version.id,f.revision.id);
  assert.equal(await loadOperativeSnapshot({fetchImpl:hosted(f,{state}),versionId:'col-fictional-v3-0002',now:Date.parse(t3)}),null);
});

test('actual private adapters and hosted reducers complete separate signed phases, retain history and stage the next revision',()=>{
  const f=fixture(),privateFiles=new Map(),dispatches=[],notices=[],publicFiles=new Map();let now=t0,currentState=clone(EMPTY_STATE),currentFiles=f.args.files,brokenFinal=false;
  const hash=v=>createHash('sha256').update(v).digest('hex');
  const source={rulesAuthorityVersion:2,rulesActivationEligible:true,senderAuthenticated:true,aiConsentActive:true,source:{sender:'fictional@example.test',subject:'A normal natural-language subject without a command tag',excerpt:f.source.text,receivedAt:t0}};
  privateFiles.set('folder/source-private.json',source);privateFiles.set('folder/col-rule-request-private.json',clone(f.revision));
  const c=vm.createContext({AnnalsRules:Rules,AnnalsProduction:{serial:v=>JSON.stringify(canonical(v))},annalsUiCall_:(nonce,fn)=>fn(),annalsLocked_:fn=>fn(),
    Date:class extends Date{constructor(value){super(value===undefined?now:value);}static now(){return Date.parse(now);}},
    annalsProps_:()=>({getProperty:k=>k==='ANNALS_PUBLISH_SIGNING_KEY'?key:k==='ANNALS_APPROVAL_KEY'?'different-approval-key':k==='ANNALS_GITHUB_TOKEN'?'existing-fictional-repository-token':null}),
    annalsRoot_:()=> 'root',annalsFolder_:id=>id==='fixture'?'folder':'folder2',annalsConsentActive_:()=>true,annalsStandingPublicationActive_:()=>true,
    annalsRead_:(folder,name)=>privateFiles.get(folder+'/'+name)||null,annalsFile_:(folder,name)=>privateFiles.get(folder+'/'+name)||null,
    annalsSavePrivate_:(folder,name,value)=>privateFiles.set(folder+'/'+name,clone(value)),annalsWriteOnce_:(folder,name,value)=>{assert.equal(privateFiles.has(folder+'/'+name),false);privateFiles.set(folder+'/'+name,clone(value));},
    annalsHash_:hash,annalsHex_:v=>Buffer.from(v).toString('hex'),Utilities:{Charset:{UTF_8:'UTF-8'},computeHmacSha256Signature:(input,secret)=>Array.from(createHmac('sha256',secret).update(input).digest())},
    annalsDispatchEvent_:(folder,event,payload,name)=>{assert.equal(privateFiles.has(folder+'/'+name),false);privateFiles.set(folder+'/'+name,{state:'reserved'});dispatches.push({event,payload:clone(payload)});return false;},
    UrlFetchApp:{fetch:url=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify(url.includes('/jobs?')?jobEvidence('2026-10-15T18:31:00.000Z').listing:jobEvidence('2026-10-15T18:31:00.000Z').run)})}
  });
  vm.runInContext(readFileSync(new URL('../scripts/annals/RulesProduction.gs',import.meta.url),'utf8'),c);
  c.annalsStagedRulesReady_=()=>true;c.annalsRuleNotice_=(folder,address,kind,body)=>notices.push({kind,body});
  c.annalsRuleContext_=()=>{
    const ready=currentState.operations.filter(op=>op.phase==='release_pending').at(-1),publicationAt=ready?(ready.confirmation.sealDigest?c.annalsRuleRetainedWitness_(ready,commit):c.annalsRuleJobWitness_(ready.confirmation.producer)).completedAt:null;
    const versions=JSON.parse(currentFiles['data/col-rules-versions.json']).versions;
    if(ready)versions[versions.length-1]={...versions.at(-1),verified:true,publishedAt:publicationAt,effectiveAt:publicationAt,confirmedAt:publicationAt};
    return {commit,state:clone(currentState),files:clone(currentFiles),baseFiles:snapshotHashes(currentFiles),behaviorDigest:behavior,base:Rules.select(versions,now),publicationAt};
  };
  c.annalsRulePublicRead_=(path,atCommit)=>{
    if(brokenFinal&&path.endsWith('-confirmed.json')&&!atCommit)return '{}';
    if(!publicFiles.has(path))throw Error('Fictional not hosted');return publicFiles.get(path);
  };
  assert.equal(c.annalsStageLiteralRule_('fixture').dispatchAccepted,false);assert.equal(dispatches[0].event,'annals-col-candidate-v3');
  assert.equal(privateFiles.get('root/col-release-pending-private.json').state,'unknown_or_held_no_retry');
  const stage=stageCandidate({...f.args,envelope:dispatches[0].payload.envelope});currentState=stage.state;const prefix='data/col-releases/'+stage.candidateDigest;
  publicFiles.set(prefix+'.json',JSON.stringify(stage.candidate));
  now='2026-10-15T18:15:00.000Z';assert.equal(c.annalsReconcileRuleRelease_('fixture').phase,'authorize');assert.equal(dispatches.length,2);
  const auth=authorizeActivation({...authorization(stage),envelope:dispatches[1].payload.envelope,now:new Date(now),sourceWitness:witness(now)});currentState=auth.state;publicFiles.set(prefix+'-activation.json',JSON.stringify(auth.activation));
  now='2026-10-15T18:30:00.000Z';assert.equal(c.annalsReconcileRuleRelease_('fixture').phase,'confirm');assert.equal(dispatches.length,3);assert.equal(notices.length,0);
  const confirmed=confirmActivation({...authorization(stage),state:auth.state,activation:auth.activation,envelope:dispatches[2].payload.envelope,now:new Date(now),sourceWitness:witness(now),producer});
  currentState=confirmed.state;currentFiles=confirmed.confirmedSnapshot.files;publicFiles.set(prefix+'-confirmed.json',JSON.stringify(confirmed.confirmedSnapshot));
  now='2026-10-15T18:45:00.000Z';brokenFinal=true;assert.equal(c.annalsReconcileRuleRelease_('fixture'),false);assert.equal(notices.length,0);assert.equal(privateFiles.get('folder/col-rule-request-private.json').state,'awaiting_implementation');
  brokenFinal=false;assert.equal(c.annalsReconcileRuleRelease_('fixture').phase,'seal');assert.equal(notices.length,0);assert.equal(dispatches.length,4);
  const retained=sealCompletion({state:currentState,envelope:dispatches[3].payload.envelope,secret:key,enabled:true,now:new Date(now),activation:auth.activation,independentWitness:{successful:true,completedAt:'2026-10-15T18:31:00.000Z'}});
  now='2026-10-15T18:51:00.000Z';assert.equal(c.annalsRetainRuleWitness('fictional-owner','fixture').phase,'seal');assert.equal(dispatches.length,5);
  now='2026-10-15T18:57:00.000Z';assert.throws(()=>c.annalsRetainRuleWitness('fictional-owner','fixture'),/recovery/);
  assert.equal([...privateFiles.keys()].filter(name=>/seal-[12]-envelope-private/.test(name)).length,2,'Original and recovery signed envelopes remain private immutable evidence');
  currentState=retained.state;publicFiles.set(prefix+'-witness.json',JSON.stringify(retained.receipt));
  c.UrlFetchApp.fetch=()=>{throw Error('Historical GitHub API no longer available');};
  now='2026-10-15T19:00:00.000Z';assert.equal(c.annalsReconcileRuleRelease_('fixture'),true);assert.equal(notices.length,1);assert.equal(dispatches.length,5);
  assert.equal(privateFiles.get('folder/col-rule-request-private.json').effectiveAt,'2026-10-15T18:31:00.000Z');
  assert.equal(privateFiles.get('root/col-release-pending-private.json').verifiedAt,now);assert.equal(c.annalsReconcileRuleRelease_('fixture'),false);assert.equal(notices.length,1);
  const nextBase=c.annalsRuleContext_().base,before=nextBase.provisions.PRIZE,after=before.replace('fictional  member','fictional   member'),directive='In the CoL rules, replace "'+before+'" with "'+after+'".';
  const assessment={...f.assessment,requestExcerpt:directive,changes:[{provision:'PRIZE',before,after,sourceExcerpt:directive}]};
  const nextRequest=Rules.intake({...f.source,text:directive,receivedAt:now},assessment,nextBase,'col-fictional-v3-0002');
  privateFiles.set('folder2/source-private.json',{...source,source:{...source.source,excerpt:directive,receivedAt:now}});privateFiles.set('folder2/col-rule-request-private.json',nextRequest);
  assert.equal(c.annalsStageLiteralRule_('fixture2').phase,'stage');assert.equal(dispatches.length,6);
  const next=stageCandidate({...f.args,state:currentState,files:currentFiles,envelope:dispatches[5].payload.envelope,now:new Date(now),sourceWitness:witness(now),basePublishedAt:retained.receipt.publishedAt});
  assert.deepEqual(next.candidate.baseFiles,snapshotHashes(currentFiles),'Both runtimes bind the same raw immutable base bytes');
  const nextVersions=JSON.parse(next.candidate.files['data/col-rules-versions.json']).versions;
  assert.equal(nextVersions.at(-2).id,f.revision.id);assert.equal(nextVersions.at(-2).effectiveAt,'2026-10-15T18:31:00.000Z');assert.equal(nextVersions.at(-2).verified,true);assert.equal(nextVersions.at(-1).verified,false);
  currentState=next.state;const nextPrefix='data/col-releases/'+next.candidateDigest;publicFiles.set(nextPrefix+'.json',JSON.stringify(next.candidate));
  now='2026-10-15T19:15:00.000Z';assert.equal(c.annalsReconcileRuleRelease_('fixture2').phase,'authorize');
  const nextAuth=authorizeActivation({...authorization(next),envelope:dispatches[6].payload.envelope,now:new Date(now),sourceWitness:witness(now)});currentState=nextAuth.state;publicFiles.set(nextPrefix+'-activation.json',JSON.stringify(nextAuth.activation));
  now='2026-10-15T19:30:00.000Z';assert.equal(c.annalsReconcileRuleRelease_('fixture2').phase,'confirm');
  const nextProducer={...producer,runId:'223456'},nextConfirmed=confirmActivation({...authorization(next),state:nextAuth.state,activation:nextAuth.activation,envelope:dispatches[7].payload.envelope,now:new Date(now),sourceWitness:{...witness(now),workflowRun:'223456'},producer:nextProducer});
  currentState=nextConfirmed.state;currentFiles=nextConfirmed.confirmedSnapshot.files;publicFiles.set(nextPrefix+'-confirmed.json',JSON.stringify(nextConfirmed.confirmedSnapshot));
  c.UrlFetchApp.fetch=url=>{assert.ok(url.includes('/223456/'),'The prior release is retained without API access');const evidence=jobEvidence('2026-10-15T19:31:00.000Z');evidence.run.id=223456;evidence.listing.jobs[0].run_id=223456;return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(url.includes('/jobs?')?evidence.listing:evidence.run)};};
  now='2026-10-15T19:45:00.000Z';assert.equal(c.annalsReconcileRuleRelease_('fixture2').phase,'seal');assert.equal(notices.length,1);
  const nextRetained=sealCompletion({state:currentState,envelope:dispatches[8].payload.envelope,secret:key,enabled:true,now:new Date(now),activation:nextAuth.activation,independentWitness:{successful:true,completedAt:'2026-10-15T19:31:00.000Z'}});currentState=nextRetained.state;publicFiles.set(nextPrefix+'-witness.json',JSON.stringify(nextRetained.receipt));
  c.UrlFetchApp.fetch=()=>{throw Error('Both historical APIs unavailable');};now='2026-10-15T20:00:00.000Z';assert.equal(c.annalsReconcileRuleRelease_('fixture2'),true);assert.equal(notices.length,2);assert.equal(dispatches.length,9);
  assert.equal(privateFiles.get('folder2/col-rule-request-private.json').effectiveAt,'2026-10-15T19:31:00.000Z');assert.equal(c.annalsRuleContext_().base.id,nextRequest.id);

});
test('desk gate inspection reads only seven booleans, with no signing marker, source, network or mutation',()=>{
  const reads=[],c=vm.createContext({annalsUiCall_:(nonce,fn)=>{assert.equal(nonce,'fictional-owner-session');return fn();},annalsProps_:()=>({getProperty:name=>{reads.push(name);if(/SIGN|KEY|REMEDIAT/.test(name))assert.fail('Forbidden gate probe');return null;}})});
  vm.runInContext(readFileSync(new URL('../scripts/annals/RulesProduction.gs',import.meta.url),'utf8'),c);
  const result=c.annalsReadStagedRuleGates('fictional-owner-session');assert.equal(result.ready,false);assert.equal(result.configurationOnly,true);assert.equal(reads.length,7);assert.equal(result.automaticOldestEnabled,false);
  assert.ok(Object.values(result).every(v=>typeof v==='boolean'));
});
test('public completion clock rejects failed, running, altered, future and incomplete producer evidence',()=>{
  const ok=jobEvidence();assert.equal(verifyJobWitness(producer,ok.run,ok.listing,{now:Date.parse(t3)}).completedAt,t3);
  for(const patch of [{status:'in_progress'},{conclusion:'failure'},{path:'.github/workflows/other.yml'},{event:'push'},{head_sha:'f'.repeat(40)},{run_attempt:2},{repository:{full_name:'different/repository'}}])
    assert.throws(()=>verifyJobWitness(producer,{...ok.run,...patch},ok.listing,{now:Date.parse(t3)}));
  for(const patch of [{conclusion:'failure'},{steps:[]},{status:'in_progress'},{head_sha:'f'.repeat(40)},{run_attempt:2},{run_id:987654},{completed_at:'2026-10-15T19:00:00Z'}]){
    const listing=clone(ok.listing);Object.assign(listing.jobs[0],patch);assert.throws(()=>verifyJobWitness(producer,ok.run,listing,{now:Date.parse(t3)}));
  }
});
test('run and job metadata stay pinned to the original attempt when a later attempt is rerun',async()=>{
  const evidence=jobEvidence(),urls=[];
  const witness=await readReleaseWitness(producer,{now:Date.parse(t3),fetchImpl:async(url,options)=>{
    urls.push(url);assert.equal(options.credentials,'omit');assert.match(url,/\/attempts\/1(?:\/jobs\?per_page=100)?$/);
    return {status:200,text:async()=>JSON.stringify(url.includes('/jobs?')?evidence.listing:evidence.run)};
  }});
  assert.equal(witness.completedAt,t3);assert.equal(urls.length,2);
  assert.ok(!urls.some(url=>/runs\/123456$/.test(url)),'The mutable latest-attempt run endpoint is never read');
});
test('a ready release with missing or failed job proof stays non-operative and late job completion is held',async()=>{
  const f=full(),api='https://api.github.com/repos/justinpfisher/Stammtisch/actions/runs/123456/attempts/1';
  assert.equal(await loadOperativeSnapshot({fetchImpl:hosted(f,{fail:api}),now:Date.parse(t3)}),null);
  const failed=jobEvidence();failed.run.conclusion='failure';failed.listing.jobs[0].conclusion='failure';
  assert.equal(await loadOperativeSnapshot({fetchImpl:hosted(f,{evidence:failed}),now:Date.parse(t3)}),null);
  const late=jobEvidence('2026-10-15T19:00:00.000Z');assert.equal(await loadOperativeSnapshot({fetchImpl:hosted(f,{evidence:late}),now:Date.parse('2026-10-15T19:01:00Z')}),null);
  assert.equal(JSON.parse(f.result.confirmedSnapshot.files['data/col-rules-versions.json']).versions.at(-1).verified,false);
});
test('mandatory final job observer checks every exact hosted package byte before successful completion',async()=>{
  const f=full(),prefix='data/col-releases/'+f.stage.candidateDigest,bodies={[STATE_PATH]:JSON.stringify(f.result.state),[prefix+'.json']:JSON.stringify(f.stage.candidate),[prefix+'-activation.json']:JSON.stringify(f.authorized.activation),[prefix+'-confirmed.json']:JSON.stringify(f.result.confirmedSnapshot)};
  const hashes=Object.fromEntries(Object.entries(bodies).map(([name,body])=>[name,createHash('sha256').update(body).digest('hex')]));let count=0;
  const fetchImpl=async(url,options)=>{count++;assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');return {status:200,text:async()=>bodies[new URL(url).pathname.slice(1)]};};
  const seen=await observeReadyRelease(hashes,{fetchImpl,clock:()=>new Date(t3),expiresAt:f.authorized.activation.expiresAt});assert.equal(count,4);assert.equal(seen.kind,'complete-hosted-release-observation');
  await assert.rejects(observeReadyRelease(hashes,{fetchImpl:async()=>({status:503}),clock:()=>new Date(t3),expiresAt:f.authorized.activation.expiresAt}),/not ready/);
  await assert.rejects(observeReadyRelease(hashes,{fetchImpl:async()=>({status:200,text:async()=> 'stale'}),clock:()=>new Date(t3),expiresAt:f.authorized.activation.expiresAt}),/bytes differ/);
  await assert.rejects(observeReadyRelease(hashes,{fetchImpl,clock:()=>new Date('2026-10-15T19:00:00Z'),expiresAt:f.authorized.activation.expiresAt}),/expired/);
});
test('a final failed job can be cancelled only with independently verified failure, preserving its nonoperative snapshot',()=>{
  const f=full(),content={revisionId:f.revision.id,candidateDigest:f.stage.candidateDigest,reason:'deployment_failed',stageEvidenceDigest:digest(f.args.envelope)};
  const args={state:f.result.state,envelope:sign('cancel',f.result.state,content,t3),secret:key,enabled:true,now:new Date(t3)};
  assert.throws(()=>cancelStaged(args),/operative/);
  const cancelled=cancelStaged({...args,failedFinalWitness:true});assert.equal(cancelled.state.operations[0].phase,'failed');
  assert.equal(JSON.parse(f.result.confirmedSnapshot.files['data/col-rules-versions.json']).versions.at(-1).verified,false);assert.deepEqual(cancelled.state.events.slice(0,-1),f.result.state.events);
});
test('ledger capacity leaves room for phase completion and cancellation; no oversized state can be committed',()=>{
  const f=fixture(),state=clone(EMPTY_STATE),event={revisionId:'col-cancelled-fixture',candidateDigest:null,phase:'failed',at:t0,evidenceDigest:'f'.repeat(64),reason:'expired'};
  const size=v=>Buffer.byteLength(JSON.stringify(v,null,2)+'\n');
  while(size(state)<MAX_LEDGER_BYTES-16000)state.events.push(clone(event));
  validateState(state);const before=digest(state);assert.throws(()=>stageCandidate({...f.args,state,envelope:sign('stage',state,f.args.envelope.content,t0)}),/capacity/);assert.equal(digest(state),before);
  const oversized=clone(state);while(size(oversized)<=MAX_LEDGER_BYTES)oversized.events.push(clone(event));assert.throws(()=>validateState(oversized),/ledger/);
});

test('completion retention is independently authenticated and preserves the original job clock through API expiry',async()=>{
  const f=full(),content={candidateDigest:f.stage.candidateDigest,snapshotDigest:f.result.state.operations[0].confirmation.snapshotDigest,producer,completedAt:t3};
  const args={state:f.result.state,envelope:sign('seal',f.result.state,content,t3),secret:key,enabled:true,now:new Date(t3),activation:f.authorized.activation,independentWitness:{successful:true,completedAt:t3}};
  for(const patch of [{enabled:false},{independentWitness:{successful:false,completedAt:t3}},{independentWitness:{successful:true,completedAt:t2}},{envelope:sign('confirm',args.state,content,t3)}])assert.throws(()=>sealCompletion({...args,...patch}));
  const sealed=sealCompletion(args),op=sealed.state.operations[0];assert.equal(sealed.receipt.publishedAt,t3);assert.equal(op.phase,'release_pending');assert.equal(op.confirmation.sealDigest,digest(sealed.receipt));
  assert.deepEqual(sealed.state.events.slice(0,-1),f.result.state.events);assert.equal(sealed.state.events.at(-1).phase,'sealed');
  assert.throws(()=>sealCompletion({...args,state:sealed.state,envelope:sign('seal',sealed.state,content,t3)}),/replay/);
  const noApi=hosted(f,{state:sealed.state,receipt:sealed.receipt}),urls=[];
  const snapshot=await loadOperativeSnapshot({now:Date.parse('2030-01-01T00:00:00Z'),fetchImpl:async(url,options)=>{urls.push(url);assert.ok(!url.startsWith('https://api.github.com'),'Sealed history does not require expired or rate-limited job metadata');return noApi(url,options);}});
  assert.equal(snapshot.version.effectiveAt,t3);assert.ok(urls.some(url=>url.endsWith('-witness.json')));
  const changed={...sealed.receipt,publishedAt:t2};
  assert.equal((await loadOperativeSnapshot({now:Date.parse(t3),fetchImpl:hosted(f,{state:sealed.state,receipt:changed})})).version.effectiveAt,t3,'A mixed retained receipt still admits the same already operative job proof');
  const unavailableApi='https://api.github.com/repos/justinpfisher/Stammtisch/actions/runs/123456/attempts/1';
  assert.equal(await loadOperativeSnapshot({now:Date.parse(t3),fetchImpl:hosted(f,{state:sealed.state,receipt:changed,fail:unavailableApi})}),null);
  assert.equal((await loadOperativeSnapshot({now:Date.parse(t3),fetchImpl:hosted(f,{state:sealed.state,fail:'data/col-releases/'+f.stage.candidateDigest+'-witness.json'})})).version.effectiveAt,t3);
  assert.throws(()=>validateSealedWitness({...sealed.receipt,verifiedAt:t2},op),/clock/);
});
test('combined immutable package bounds count UTF-8 bytes, including non-ASCII narrative',()=>{
  const f=fixture(),files=clone(f.args.files);files['celebration.html']+='<!--'+'\u00e9'.repeat(210000)+'-->';files['docs/celebration-of-life-rules.md']+='\n'+'\u00e9'.repeat(210000);
  const versions=JSON.parse(files['data/col-rules-versions.json']);versions.fixturePadding='\u00e9'.repeat(110000);files['data/col-rules-versions.json']=JSON.stringify(versions);
  const content={...f.args.envelope.content,baseFiles:snapshotHashes(files)};
  assert.ok(Object.values(files).every(value=>Buffer.byteLength(value)<=512*1024));
  // The baseline fits; the candidate repeats the large public narrative across
  // its HTML/Markdown/structured version, so no unreadable package is written.
  assert.throws(()=>stageCandidate({...f.args,files,envelope:sign('stage',f.args.state,content,t0)}),/byte bound/);
});

test('final Viewer read is after hosted verification, source-bound, fresh and required by the job clock',()=>{
  const f=full(),op=f.result.state.operations[0],receipt={kind:'col-source-readonly-observation-v1',digestFormat:'monitor-semantic-v1-json-sorted-compact-ascii',scope:'spreadsheets.readonly',qualification:'snapshot-only-not-formula-or-allocation-approval',implementationCommit:commit,workflowRunId:'123456',sourceDigest,observedAt:t3};
  assert.equal(verifyFinalSourceReceipt(receipt,op,{commit,run:'123456',now:new Date(t3)}),true);
  for(const patch of [{sourceDigest:'f'.repeat(64)},{observedAt:t0},{implementationCommit:'f'.repeat(40)},{workflowRunId:'2'}])assert.throws(()=>verifyFinalSourceReceipt({...receipt,...patch},op,{commit,run:'123456',now:new Date(t3)}));
  assert.throws(()=>verifyFinalSourceReceipt(receipt,op,{commit,run:'123456',now:new Date('2026-10-15T18:09:00.000Z')}),/Stale/);
  const evidence=jobEvidence();
  for(const patch of [{conclusion:'failure'},{status:'in_progress'},{started_at:t0},{completed_at:'2026-10-15T18:05:00.000Z'}]){
    const listing=clone(evidence.listing);Object.assign(listing.jobs[0].steps[1],patch);assert.throws(()=>verifyJobWitness(producer,evidence.run,listing,{now:Date.parse(t3)}));
  }
  const delayed=clone(evidence.listing);delayed.jobs[0].completed_at='2026-10-15T18:09:00.000Z';assert.throws(()=>verifyJobWitness(producer,evidence.run,delayed,{now:Date.parse('2026-10-15T18:10:00Z')}));
});

test('an in-flight stage winning a cancellation race permits one freshly authenticated changed-base cancellation',()=>{
  const f=staged(),privateFiles=new Map(),dispatches=[];let now=t1,state=clone(EMPTY_STATE);
  privateFiles.set('root/col-release-pending-private.json',{kind:'v3',state:'unknown_or_held_no_retry',sourceId:'fixture',phase:'stage',revisionId:f.revision.id,stageEvidenceDigest:digest(f.args.envelope),envelope:f.args.envelope});privateFiles.set('folder/col-rule-request-private.json',clone(f.revision));
  const c=vm.createContext({AnnalsProduction:{serial:v=>JSON.stringify(canonical(v))},Date:class extends Date{constructor(value){super(value===undefined?now:value);}static now(){return Date.parse(now);}},
    annalsProps_:()=>({getProperty:k=>k==='ANNALS_PUBLISH_SIGNING_KEY'?key:'different-approval'}),annalsUiCall_:(nonce,fn)=>{assert.equal(nonce,'fictional-owner');return fn();},annalsLocked_:fn=>fn(),annalsRoot_:()=> 'root',annalsFolder_:()=> 'folder',
    annalsRead_:(folder,name)=>privateFiles.get(folder+'/'+name),annalsFile_:(folder,name)=>privateFiles.get(folder+'/'+name),annalsSavePrivate_:(folder,name,value)=>privateFiles.set(folder+'/'+name,clone(value)),
    annalsWriteOnce_:(folder,name,value)=>{assert.ok(!privateFiles.has(folder+'/'+name));privateFiles.set(folder+'/'+name,clone(value));},annalsHash_:v=>createHash('sha256').update(v).digest('hex'),annalsHex_:v=>Buffer.from(v).toString('hex'),Utilities:{Charset:{UTF_8:'UTF-8'},computeHmacSha256Signature:(input,secret)=>Array.from(createHmac('sha256',secret).update(input).digest())},
    annalsDispatchEvent_:(folder,event,payload,name)=>{assert.ok(!privateFiles.has(folder+'/'+name));privateFiles.set(folder+'/'+name,{state:'unknown_no_retry'});dispatches.push({event,payload:clone(payload),name});return false;}
  });
  vm.runInContext(readFileSync(new URL('../scripts/annals/RulesProduction.gs',import.meta.url),'utf8'),c);c.annalsStagedRulesReady_=()=>true;c.annalsRuleHead_=()=>commit;c.annalsRulePublicRead_=()=>JSON.stringify(state);
  assert.equal(c.annalsCancelStagedRule('fictional-owner','fixture','deployment_failed').phase,'cancel');assert.equal(dispatches.length,1);
  state=f.stage.state;assert.throws(()=>cancelStaged({state,envelope:dispatches[0].payload.envelope,secret:key,enabled:true,now:new Date(now)}),/base mismatch/);
  assert.throws(()=>c.annalsCancelStagedRule('fictional-owner','fixture','deployment_failed'),/expiry/);
  now='2026-10-15T18:07:00.000Z';assert.equal(c.annalsCancelStagedRule('fictional-owner','fixture','deployment_failed').phase,'cancel');assert.equal(dispatches.length,2);assert.notEqual(dispatches[0].name,dispatches[1].name);
  assert.equal([...privateFiles.keys()].filter(name=>name.includes('cancel-')&&name.endsWith('-envelope-private.json')).length,2);
  now='2026-10-15T18:13:00.000Z';assert.throws(()=>c.annalsCancelStagedRule('fictional-owner','fixture','deployment_failed'),/exhausted/);
  now='2026-10-15T18:07:00.000Z';state=cancelStaged({state,envelope:dispatches[1].payload.envelope,secret:key,enabled:true,now:new Date(now)}).state;
  now='2026-10-15T18:13:00.000Z';assert.equal(c.annalsCancelStagedRule('fictional-owner','fixture','deployment_failed'),true,'An already committed tombstone is reconciled instead of consuming another attempt');assert.equal(privateFiles.get('root/col-release-pending-private.json').state,'verified_cancelled');assert.equal(dispatches.length,2);
});

function oldestFixture(){
  const before='## DRAFT - ORDER OF BUSINESS\n\n### FIRST - Blood Diamonds\n\nExisting fictional protection.\n\n### SECOND - Steals\n\nExisting fictional Steal order.\n\n### THIRD - Devil’s Share\n\nExisting fictional award.';
  const base={id:'col-baseline-fictional',digest:'a'.repeat(64),previous:null,verified:true,
    effectiveAt:'2026-10-15T17:00:00.000Z',publishedAt:'2026-10-15T17:00:00.000Z',
    provisions:{'DRAFT - ORDER OF BUSINESS':before},parameters:{fictionalTokens:7},januaryGap:'unresolved'};
  const source={senderAuthenticated:true,freshOperativeWindow:true,member:'marc',
    text:'Whoever had the oldest death in the year gets a steal. This is effective immediately',receivedAt:t0};
  const revision=Rules.oldestSteal(source,base,'col-fictional-oldest-0001');
  const register={schemaVersion:1,baseline:{id:base.id,recordedAt:base.effectiveAt,description:'Fictional baseline only.'},revisions:[],events:[]};
  const versions={schemaVersion:1,versions:[base]};
  const files={'data/col-rules-register.json':JSON.stringify(register),'data/col-rules-versions.json':JSON.stringify(versions),
    'docs/celebration-of-life-rules.md':'# Fictional only\n\n'+before+'\n\n---\n\nPreserve this note.',
    'celebration.html':'<section id="official-rules"><details class="rule-topic"><summary>DRAFT - ORDER OF BUSINESS</summary><p>Old fictional rules</p></details>\n      <p class="rules-reference">Preserve this reference.</p></section>',
    'col-revisions.html':renderRegister(register)};
  const content={revision:{...Rules.publicRecord(revision),baseDigest:base.digest},qualification:'oldest-death-steal-v1',
    baseFiles:snapshotHashes(files),implementationCommit:commit,behaviorDigest:behavior,source:null};
  const state=clone(EMPTY_STATE);
  const args={state,files,envelope:sign('stage',state,content,t0),secret:key,enabled:true,now:new Date(t0),
    implementationCommit:commit,behaviorDigest:behavior,sourceWitness:witness(t0)};
  return {source,base,revision,args};
}

test('authenticated oldest-death email is mapped to the single canonical semantic rule',()=>{
  const f=oldestFixture(),change=f.revision.changes[0];
  assert.equal(f.revision.state,'awaiting_implementation');
  assert.equal(change.before,f.base.provisions['DRAFT - ORDER OF BUSINESS']);
  assert.equal(change.after.split(Rules.OLDEST_DEATH_STEAL_CLAUSE).length,2);
  assert.ok(change.after.includes('### FIRST - Blood Diamonds'));
  assert.ok(change.after.includes('### THIRD - Devil’s Share'));
  assert.equal(f.revision.effectiveAt,null);
  assert.equal(f.revision.retrospective.requested,false);
  for(const source of [{text:'Is whoever has the oldest death entitled to a Steal?'},{text:'Someone joked: whoever had the oldest death in the year gets a steal.'},
    {senderAuthenticated:false},{freshOperativeWindow:false},{replayed:true},{truncated:true}]){
    assert.throws(()=>Rules.oldestSteal({...f.source,...source},f.base,f.revision.id),/exact authenticated/);
  }
  assert.throws(()=>Rules.oldestSteal(f.source,{...f.base,provisions:{'DRAFT - ORDER OF BUSINESS':change.after}},f.revision.id),/unchanged base/);
});

test('canonical oldest-death change stages without changing the old operative rules',()=>{
  const f=oldestFixture(),original=JSON.stringify(f.args),stage=stageCandidate(f.args);
  assert.equal(JSON.stringify(f.args),original);
  const version=JSON.parse(stage.candidate.files['data/col-rules-versions.json']).versions.at(-1);
  assert.equal(version.verified,false);assert.equal(version.publishedAt,null);assert.equal(version.effectiveAt,null);
  assert.deepEqual(version.parameters,f.base.parameters);
  assert.ok(stage.candidate.files['docs/celebration-of-life-rules.md'].includes(Rules.OLDEST_DEATH_STEAL_CLAUSE));
  assert.equal(Rules.select(JSON.parse(stage.candidate.files['data/col-rules-versions.json']).versions,t1).id,f.base.id);
  assert.throws(()=>stageCandidate({...f.args,state:stage.state,
    envelope:sign('stage',stage.state,f.args.envelope.content,t1),now:new Date(t1),sourceWitness:witness(t1)}),/pending operation/);
});

test('mutated oldest-death semantic data, stale base and mismatched class cannot stage',()=>{
  const f=oldestFixture();
  for(const mutator of [
    c=>{c.revision.changes[0].after=c.revision.changes[0].after.replace('one Steal','two Steals');},
    c=>{c.revision.changes[0].after=c.revision.changes[0].after.replace('calendar year','calendar month');},
    c=>{c.revision.explanation='Model claims this is safe';},
    c=>{c.revision.effectiveAt='2026-10-01T00:00:00.000Z';},
    c=>{c.revision.retrospective={requested:true};},
    c=>{c.qualification='literal-typography-v1';},
    c=>{c.revision.baseDigest='f'.repeat(64);}
  ]){
    const content=clone(f.args.envelope.content);mutator(content);
    assert.throws(()=>stageCandidate({...f.args,envelope:sign('stage',f.args.state,content,t0)}));
  }
  assert.throws(()=>stageCandidate({...f.args,enabled:false}),/disabled/);
});

test('oldest-death ready snapshot becomes operative only after the independent complete job witness',async()=>{
  const f=oldestFixture(),stage=stageCandidate(f.args),authorizationArgs=authorization(stage),authorized=authorizeActivation(authorizationArgs);
  const content={candidateDigest:stage.candidateDigest,activationDigest:authorized.activationDigest,observedAt:t2,
    source:stage.candidate.source,baseFiles:stage.candidate.baseFiles};
  const confirmArgs={...authorizationArgs,state:authorized.state,activation:authorized.activation,
    envelope:sign('confirm',authorized.state,content,t2),now:new Date(t2),sourceWitness:witness(t2),producer};
  const result=confirmActivation(confirmArgs),w={stage,authorized,result};
  const admitted=await loadOperativeSnapshot({fetchImpl:hosted(w),now:Date.parse(t3)});
  assert.equal(admitted.version.verified,true);
  assert.equal(admitted.version.effectiveAt,t3);
  assert.equal(admitted.version.provisions['DRAFT - ORDER OF BUSINESS'].includes(Rules.OLDEST_DEATH_STEAL_CLAUSE),true);
  assert.equal((await loadOperativeSnapshot({fetchImpl:hosted(w,{fail:'data/col-releases/'+stage.candidateDigest+'-confirmed.json'}),now:Date.parse(t3)})),null);
});

test('private rule evidence uses existing token only on fixed API routes and preserves GET/redirect bounds',()=>{
 const requests=[],head='a'.repeat(40),token='existing-fictional-restricted-token';
 const c=vm.createContext({annalsProps_:()=>({getProperty:k=>k==='ANNALS_GITHUB_TOKEN'?token:null}),
  UrlFetchApp:{fetch:(url,options)=>{requests.push({url,options});return {getResponseCode:()=>200,getContentText:()=>url.includes('/commits/')?JSON.stringify({sha:head}):url.includes('/actions/')?'{}':'public bytes'};}}});
 vm.runInContext(readFileSync(new URL('../scripts/annals/RulesProduction.gs',import.meta.url),'utf8'),c);
 assert.equal(c.annalsRuleHead_(),head);
 assert.throws(()=>c.annalsRuleJobWitness_(producer));
 c.annalsRulePublicRead_('data/col-rules-versions.json',head);
 assert.ok(requests.length>=3);
 for(const {url,options} of requests){
  assert.equal(options.followRedirects,false);assert.equal(options.validateHttpsCertificates,true);
  if(url.startsWith('https://api.github.com/repos/justinpfisher/Stammtisch/')){assert.equal(options.method,'get');assert.equal(options.headers.Authorization,'Bearer '+token);}
  else assert.equal(options.headers.Authorization,undefined);
 }
 c.annalsProps_=()=>({getProperty:()=>null});const before=requests.length;assert.throws(()=>c.annalsRuleHead_(),/Existing repository verification credential required/);assert.equal(requests.length,before);
});
